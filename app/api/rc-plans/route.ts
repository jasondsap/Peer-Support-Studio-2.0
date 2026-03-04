import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// ============================================================================
// RC-PLANS API — 4-level recovery plan hierarchy
// File: app/api/rc-plans/route.ts
// Tables: rc_plans → rc_plan_domains → rc_plan_goals → rc_plan_activities
//         + rc_plan_outcomes
// ============================================================================

// ============================================================================
// GET /api/rc-plans
// ============================================================================
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const planId = searchParams.get('id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // ── Single plan with full nested data ──
        if (planId) {
            const plans = await sql`
                SELECT rp.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM rc_plans rp
                LEFT JOIN participants p ON rp.participant_id = p.id
                WHERE rp.id = ${planId}::uuid
                AND rp.organization_id = ${organizationId}::uuid
            `;

            if (plans.length === 0) {
                return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
            }
            const plan = plans[0];

            // Fetch domains
            const domains = await sql`
                SELECT * FROM rc_plan_domains
                WHERE plan_id = ${planId}::uuid
                ORDER BY sort_order, created_at
            `;

            // Fetch goals for all domains
            const domainIds = domains.map((d: any) => d.id);
            let goals: any[] = [];
            if (domainIds.length > 0) {
                goals = await sql`
                    SELECT * FROM rc_plan_goals
                    WHERE domain_entry_id = ANY(${domainIds}::uuid[])
                    ORDER BY sort_order, created_at
                `;
            }

            // Fetch activities for all goals
            const goalIds = goals.map((g: any) => g.id);
            let activities: any[] = [];
            if (goalIds.length > 0) {
                activities = await sql`
                    SELECT * FROM rc_plan_activities
                    WHERE goal_entry_id = ANY(${goalIds}::uuid[])
                    ORDER BY sort_order, created_at
                `;
            }

            // Fetch outcomes for all domains
            let outcomes: any[] = [];
            if (domainIds.length > 0) {
                outcomes = await sql`
                    SELECT o.*,
                        u.first_name as recorded_by_first_name,
                        u.last_name as recorded_by_last_name
                    FROM rc_plan_outcomes o
                    LEFT JOIN users u ON o.recorded_by = u.id
                    WHERE o.domain_entry_id = ANY(${domainIds}::uuid[])
                    ORDER BY o.recorded_at DESC
                `;
            }

            // Assemble hierarchy
            const goalsWithActivities = goals.map((g: any) => ({
                ...g,
                activities: activities.filter((a: any) => a.goal_entry_id === g.id),
            }));

            const domainsWithGoals = domains.map((d: any) => ({
                ...d,
                goals: goalsWithActivities.filter((g: any) => g.domain_entry_id === d.id),
                outcomes: outcomes.filter((o: any) => o.domain_entry_id === d.id),
            }));

            return NextResponse.json({ plan: { ...plan, domains: domainsWithGoals } });
        }

        // ── List plans (dynamic query for optional participant filter) ──
        let queryText = `
            SELECT rp.*,
                p.first_name as participant_first_name,
                p.last_name as participant_last_name,
                p.preferred_name as participant_preferred_name,
                (SELECT COUNT(*) FROM rc_plan_domains WHERE plan_id = rp.id) as domain_count,
                (SELECT COUNT(*) FROM rc_plan_goals g JOIN rc_plan_domains d ON g.domain_entry_id = d.id WHERE d.plan_id = rp.id AND g.status = 'completed') as completed_goals,
                (SELECT COUNT(*) FROM rc_plan_goals g JOIN rc_plan_domains d ON g.domain_entry_id = d.id WHERE d.plan_id = rp.id) as total_goals
            FROM rc_plans rp
            LEFT JOIN participants p ON rp.participant_id = p.id
            WHERE rp.organization_id = $1
        `;
        const params: any[] = [organizationId];
        let idx = 2;

        if (participantId) {
            queryText += ` AND rp.participant_id = $${idx}`;
            params.push(participantId);
            idx++;
        }

        queryText += ` ORDER BY rp.updated_at DESC`;

        const plans = await sql(queryText, params);
        return NextResponse.json({ plans });
    } catch (error) {
        console.error('Error fetching rc-plans:', error);
        return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }
}

// ============================================================================
// POST /api/rc-plans
// ============================================================================
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await req.json();
        const { organization_id, participant_id, plan_name, notes, domains } = body;

        if (!organization_id || !participant_id) {
            return NextResponse.json({ error: 'organization_id and participant_id required' }, { status: 400 });
        }

        // Create plan
        const planResult = await sql`
            INSERT INTO rc_plans (participant_id, organization_id, user_id, plan_name, notes)
            VALUES (
                ${participant_id}::uuid,
                ${organization_id}::uuid,
                ${userId}::uuid,
                ${plan_name || 'Recovery Plan'},
                ${notes || null}
            )
            RETURNING *
        `;
        const planId = planResult[0].id;

        // Insert domains → goals → activities
        if (domains && Array.isArray(domains)) {
            for (let di = 0; di < domains.length; di++) {
                const domain = domains[di];
                const domainResult = await sql`
                    INSERT INTO rc_plan_domains (plan_id, domain_key, importance_rating, confidence_rating, notes, sort_order)
                    VALUES (
                        ${planId}::uuid,
                        ${domain.domain_key},
                        ${domain.importance_rating || null},
                        ${domain.confidence_rating || null},
                        ${domain.notes || null},
                        ${di}
                    )
                    RETURNING id
                `;
                const domainId = domainResult[0].id;

                if (domain.goals && Array.isArray(domain.goals)) {
                    for (let gi = 0; gi < domain.goals.length; gi++) {
                        const goal = domain.goals[gi];
                        const goalResult = await sql`
                            INSERT INTO rc_plan_goals (domain_entry_id, goal_text, is_custom, target_date, sort_order)
                            VALUES (
                                ${domainId}::uuid,
                                ${goal.goal_text},
                                ${goal.is_custom || false},
                                ${goal.target_date || null},
                                ${gi}
                            )
                            RETURNING id
                        `;
                        const goalId = goalResult[0].id;

                        if (goal.activities && Array.isArray(goal.activities)) {
                            for (let ai = 0; ai < goal.activities.length; ai++) {
                                const act = goal.activities[ai];
                                await sql`
                                    INSERT INTO rc_plan_activities (goal_entry_id, activity_text, frequency, duration, is_custom, sort_order)
                                    VALUES (
                                        ${goalId}::uuid,
                                        ${act.activity_text},
                                        ${act.frequency || null},
                                        ${act.duration || null},
                                        ${act.is_custom || false},
                                        ${ai}
                                    )
                                `;
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, planId });
    } catch (error) {
        console.error('Error creating rc-plan:', error);
        return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
    }
}

// ============================================================================
// PUT /api/rc-plans — Dynamic field updates via sql() call pattern
// ============================================================================
export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { type, id, _plan_id, ...data } = body;

        if (!type || !id) {
            return NextResponse.json({ error: 'type and id required' }, { status: 400 });
        }

        switch (type) {
            case 'plan': {
                const fields: string[] = [];
                const values: any[] = [];
                let pi = 1;
                if (data.status !== undefined) { fields.push(`status = $${pi++}`); values.push(data.status); }
                if (data.plan_name !== undefined) { fields.push(`plan_name = $${pi++}`); values.push(data.plan_name); }
                if (data.notes !== undefined) { fields.push(`notes = $${pi++}`); values.push(data.notes); }
                fields.push('updated_at = NOW()');
                values.push(id);
                await sql(`UPDATE rc_plans SET ${fields.join(', ')} WHERE id = $${pi}`, values);
                break;
            }
            case 'domain': {
                const fields: string[] = [];
                const values: any[] = [];
                let pi = 1;
                if (data.status !== undefined) { fields.push(`status = $${pi++}`); values.push(data.status); }
                if (data.importance_rating !== undefined) { fields.push(`importance_rating = $${pi++}`); values.push(data.importance_rating); }
                if (data.confidence_rating !== undefined) { fields.push(`confidence_rating = $${pi++}`); values.push(data.confidence_rating); }
                if (data.notes !== undefined) { fields.push(`notes = $${pi++}`); values.push(data.notes); }
                values.push(id);
                await sql(`UPDATE rc_plan_domains SET ${fields.join(', ')} WHERE id = $${pi}`, values);
                break;
            }
            case 'goal': {
                const fields: string[] = [];
                const values: any[] = [];
                let pi = 1;
                if (data.status !== undefined) { fields.push(`status = $${pi++}`); values.push(data.status); }
                if (data.goal_text !== undefined) { fields.push(`goal_text = $${pi++}`); values.push(data.goal_text); }
                if (data.target_date !== undefined) { fields.push(`target_date = $${pi++}`); values.push(data.target_date); }
                values.push(id);
                await sql(`UPDATE rc_plan_goals SET ${fields.join(', ')} WHERE id = $${pi}`, values);
                break;
            }
            case 'activity': {
                const fields: string[] = [];
                const values: any[] = [];
                let pi = 1;
                if (data.status !== undefined) { fields.push(`status = $${pi++}`); values.push(data.status); }
                if (data.activity_text !== undefined) { fields.push(`activity_text = $${pi++}`); values.push(data.activity_text); }
                if (data.frequency !== undefined) { fields.push(`frequency = $${pi++}`); values.push(data.frequency); }
                if (data.duration !== undefined) { fields.push(`duration = $${pi++}`); values.push(data.duration); }
                if (data.notes !== undefined) { fields.push(`notes = $${pi++}`); values.push(data.notes); }
                values.push(id);
                await sql(`UPDATE rc_plan_activities SET ${fields.join(', ')} WHERE id = $${pi}`, values);
                break;
            }
            case 'outcome': {
                const fields: string[] = [];
                const values: any[] = [];
                let pi = 1;
                if (data.value !== undefined) { fields.push(`value = $${pi++}`); values.push(data.value); }
                if (data.notes !== undefined) { fields.push(`notes = $${pi++}`); values.push(data.notes); }
                fields.push('recorded_at = NOW()');
                values.push(id);
                await sql(`UPDATE rc_plan_outcomes SET ${fields.join(', ')} WHERE id = $${pi}`, values);
                break;
            }
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        // Cascade updated_at to parent plan
        if (type !== 'plan' && _plan_id) {
            await sql`UPDATE rc_plans SET updated_at = NOW() WHERE id = ${_plan_id}::uuid`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating rc-plan:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

// ============================================================================
// DELETE /api/rc-plans
// ============================================================================
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'plan';
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        const tableMap: Record<string, string> = {
            plan: 'rc_plans',
            domain: 'rc_plan_domains',
            goal: 'rc_plan_goals',
            activity: 'rc_plan_activities',
            outcome: 'rc_plan_outcomes',
        };

        const table = tableMap[type];
        if (!table) {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        await sql(`DELETE FROM ${table} WHERE id = $1`, [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
