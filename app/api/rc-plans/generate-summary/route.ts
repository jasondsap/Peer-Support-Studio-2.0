import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// ============================================================================
// POST /api/rc-plans/generate-summary
// Fetches full plan hierarchy, builds RAG query, saves to plan_summary.
//
// DB migration (run once):
//   ALTER TABLE rc_plans ADD COLUMN IF NOT EXISTS plan_summary TEXT;
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { plan_id, organization_id } = body;

        if (!plan_id || !organization_id) {
            return NextResponse.json(
                { error: 'plan_id and organization_id required' },
                { status: 400 }
            );
        }

        // ── Fetch plan + participant name ──────────────────────────────────────
        const plans = await sql`
            SELECT rp.*, p.first_name, p.last_name, p.preferred_name
            FROM rc_plans rp
            LEFT JOIN participants p ON rp.participant_id = p.id
            WHERE rp.id = ${plan_id}::uuid
            AND rp.organization_id = ${organization_id}::uuid
        `;

        if (plans.length === 0) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }
        const plan = plans[0];

        // ── Fetch full hierarchy ───────────────────────────────────────────────
        const domains = await sql`
            SELECT * FROM rc_plan_domains
            WHERE plan_id = ${plan_id}::uuid
            ORDER BY sort_order, created_at
        `;

        const domainIds = domains.map((d: any) => d.id);

        let goals: any[] = [];
        if (domainIds.length > 0) {
            goals = await sql`
                SELECT * FROM rc_plan_goals
                WHERE domain_entry_id = ANY(${domainIds}::uuid[])
                ORDER BY sort_order, created_at
            `;
        }

        const goalIds = goals.map((g: any) => g.id);

        let activities: any[] = [];
        if (goalIds.length > 0) {
            activities = await sql`
                SELECT * FROM rc_plan_activities
                WHERE goal_entry_id = ANY(${goalIds}::uuid[])
                ORDER BY sort_order, created_at
            `;
        }

        // ── Build human-readable plan description for RAG ─────────────────────
        const participantName = plan.preferred_name || `${plan.first_name} ${plan.last_name}`;

        const planDescription = domains.length > 0
            ? domains.map((d: any) => {
                const domainGoals = goals.filter((g: any) => g.domain_entry_id === d.id);
                const goalsText = domainGoals.length > 0
                    ? domainGoals.map((g: any) => {
                        const goalActivities = activities.filter((a: any) => a.goal_entry_id === g.id);
                        const actText = goalActivities.length > 0
                            ? `\n        Supporting actions: ${goalActivities.map((a: any) => a.activity_text).join('; ')}`
                            : '';
                        return `    • ${g.goal_text} [${g.status || 'active'}]${actText}`;
                    }).join('\n')
                    : '    (No goals recorded yet)';
                return `Recovery Domain: ${d.domain_key}\n${goalsText}`;
            }).join('\n\n')
            : '(No domains or goals recorded yet)';

        const ragQuery = `Write a professional, strength-based recovery plan narrative summary for peer support documentation.

PARTICIPANT: ${participantName}
PLAN NAME: ${plan.plan_name}
${plan.notes ? `PLAN NOTES FROM STAFF: ${plan.notes}` : ''}

RECOVERY DOMAINS AND GOALS:
${planDescription}

Write a 2-3 paragraph narrative that:
1. Opens by affirming the participant's commitment and strengths reflected in the plan
2. Describes each recovery domain and its goals in plain, recovery-oriented language (not clinical)
3. Closes by highlighting the action steps and the peer support relationship that will support this journey

Use warm, person-centered language. Avoid clinical terms like "treatment," "symptoms," or "diagnosis."
This summary will appear at the top of the recovery plan and may be referenced in session notes.
Return only the narrative text — no JSON, no headers, no markdown.`;

        // ── Call RAG service ───────────────────────────────────────────────────
        const ragApiUrl = process.env.RAG_API_URL;
        const ragApiKey = process.env.RAG_API_KEY;

        if (!ragApiUrl || !ragApiKey) {
            return NextResponse.json({ error: 'RAG service not configured' }, { status: 500 });
        }

        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'recovery_capital',
                query: ragQuery,
                context: {
                    participant_name: participantName,
                    plan_name: plan.plan_name,
                    domain_count: domains.length,
                    goal_count: goals.length,
                    activity_count: activities.length,
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            throw new Error(errorData.error || `RAG service returned ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();
        const summary = ragData.answer?.trim() || '';

        if (!summary) {
            return NextResponse.json({ error: 'RAG service returned empty summary' }, { status: 500 });
        }

        // ── Persist summary to rc_plans ────────────────────────────────────────
        await sql`
            UPDATE rc_plans
            SET plan_summary = ${summary}, updated_at = NOW()
            WHERE id = ${plan_id}::uuid
        `;

        return NextResponse.json({
            success: true,
            summary,
            sources: ragData.sources || [],
        });

    } catch (error) {
        console.error('Error generating plan summary:', error);
        return NextResponse.json(
            { error: `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
