import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// ============================================================================
// RC-PLANS ITEMS API — Add items to existing plans
// File: app/api/rc-plans/items/route.ts
// Handles: add goal, add activity, add domain, record outcome
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        const body = await req.json();
        const { type } = body;

        if (!type) {
            return NextResponse.json({ error: 'type is required' }, { status: 400 });
        }

        // ── Add goal to domain ──
        if (type === 'goal') {
            const { domain_entry_id, goal_text, is_custom } = body;
            if (!domain_entry_id || !goal_text) {
                return NextResponse.json({ error: 'domain_entry_id and goal_text required' }, { status: 400 });
            }

            const maxOrder = await sql`
                SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
                FROM rc_plan_goals WHERE domain_entry_id = ${domain_entry_id}::uuid
            `;

            const result = await sql`
                INSERT INTO rc_plan_goals (domain_entry_id, goal_text, is_custom, sort_order)
                VALUES (${domain_entry_id}::uuid, ${goal_text}, ${is_custom ?? true}, ${maxOrder[0].next_order})
                RETURNING *
            `;

            return NextResponse.json({ success: true, goal: result[0] });
        }

        // ── Add activity to goal ──
        if (type === 'activity') {
            const { goal_entry_id, activity_text, is_custom } = body;
            if (!goal_entry_id || !activity_text) {
                return NextResponse.json({ error: 'goal_entry_id and activity_text required' }, { status: 400 });
            }

            const maxOrder = await sql`
                SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
                FROM rc_plan_activities WHERE goal_entry_id = ${goal_entry_id}::uuid
            `;

            const result = await sql`
                INSERT INTO rc_plan_activities (goal_entry_id, activity_text, is_custom, sort_order)
                VALUES (${goal_entry_id}::uuid, ${activity_text}, ${is_custom ?? true}, ${maxOrder[0].next_order})
                RETURNING *
            `;

            return NextResponse.json({ success: true, activity: result[0] });
        }

        // ── Add domain to plan (with template goals & activities) ──
        if (type === 'domain') {
            const { plan_id, domain_key, goals } = body;
            if (!plan_id || !domain_key) {
                return NextResponse.json({ error: 'plan_id and domain_key required' }, { status: 400 });
            }

            const maxOrder = await sql`
                SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
                FROM rc_plan_domains WHERE plan_id = ${plan_id}::uuid
            `;

            const domainResult = await sql`
                INSERT INTO rc_plan_domains (plan_id, domain_key, sort_order)
                VALUES (${plan_id}::uuid, ${domain_key}, ${maxOrder[0].next_order})
                RETURNING id
            `;
            const domainId = domainResult[0].id;

            if (goals?.length) {
                for (let gi = 0; gi < goals.length; gi++) {
                    const goalData = goals[gi];
                    const goalResult = await sql`
                        INSERT INTO rc_plan_goals (domain_entry_id, goal_text, is_custom, sort_order)
                        VALUES (${domainId}::uuid, ${goalData.goal_text}, false, ${gi})
                        RETURNING id
                    `;
                    const goalId = goalResult[0].id;

                    if (goalData.activities?.length) {
                        for (let ai = 0; ai < goalData.activities.length; ai++) {
                            await sql`
                                INSERT INTO rc_plan_activities (goal_entry_id, activity_text, is_custom, sort_order)
                                VALUES (${goalId}::uuid, ${goalData.activities[ai].activity_text}, false, ${ai})
                            `;
                        }
                    }
                }
            }

            return NextResponse.json({ success: true, domain_id: domainId });
        }

        // ── Record outcome measure ──
        if (type === 'outcome') {
            const { domain_entry_id, measure_key, measure_type, label, value, assessment_type, notes } = body;
            if (!domain_entry_id || !measure_key || !value) {
                return NextResponse.json({ error: 'domain_entry_id, measure_key, and value required' }, { status: 400 });
            }

            const result = await sql`
                INSERT INTO rc_plan_outcomes (
                    domain_entry_id, measure_key, measure_type, label, value,
                    assessment_type, notes, recorded_by
                )
                VALUES (
                    ${domain_entry_id}::uuid,
                    ${measure_key},
                    ${measure_type || 'number'},
                    ${label || measure_key},
                    ${value},
                    ${assessment_type || null},
                    ${notes || null},
                    ${userId}::uuid
                )
                RETURNING *
            `;

            return NextResponse.json({ success: true, outcome: result[0] });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (error) {
        console.error('Error adding rc-plan item:', error);
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}
