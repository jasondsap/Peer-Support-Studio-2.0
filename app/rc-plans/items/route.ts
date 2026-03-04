import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

// ============================================================================
// POST /api/rc-plans/items - Add goal, activity, or domain to existing plan
// ============================================================================
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { type } = body;

        switch (type) {
            case 'goal': {
                const { domain_entry_id, goal_text, is_custom, target_date } = body;
                if (!domain_entry_id || !goal_text) {
                    return NextResponse.json({ error: 'domain_entry_id and goal_text required' }, { status: 400 });
                }
                const existing = await query(
                    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rc_plan_goals WHERE domain_entry_id = $1',
                    [domain_entry_id]
                ) as any[];
                const sortOrder = (existing[0]?.max_order ?? -1) + 1;

                const result = await query(
                    `INSERT INTO rc_plan_goals (domain_entry_id, goal_text, is_custom, target_date, sort_order)
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [domain_entry_id, goal_text, is_custom || false, target_date || null, sortOrder]
                ) as any[];

                await query(
                    'UPDATE rc_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM rc_plan_domains WHERE id = $1)',
                    [domain_entry_id]
                );
                return NextResponse.json({ success: true, goalId: result[0].id });
            }

            case 'activity': {
                const { goal_entry_id, activity_text, frequency, duration, is_custom } = body;
                if (!goal_entry_id || !activity_text) {
                    return NextResponse.json({ error: 'goal_entry_id and activity_text required' }, { status: 400 });
                }
                const existing = await query(
                    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rc_plan_activities WHERE goal_entry_id = $1',
                    [goal_entry_id]
                ) as any[];
                const sortOrder = (existing[0]?.max_order ?? -1) + 1;

                const result = await query(
                    `INSERT INTO rc_plan_activities (goal_entry_id, activity_text, frequency, duration, is_custom, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                    [goal_entry_id, activity_text, frequency || null, duration || null, is_custom || false, sortOrder]
                ) as any[];

                await query(
                    `UPDATE rc_plans SET updated_at = NOW() WHERE id = (
                        SELECT d.plan_id FROM rc_plan_domains d
                        JOIN rc_plan_goals g ON g.domain_entry_id = d.id
                        WHERE g.id = $1
                    )`,
                    [goal_entry_id]
                );
                return NextResponse.json({ success: true, activityId: result[0].id });
            }

            case 'domain': {
                const { plan_id, domain_key, goals } = body;
                if (!plan_id || !domain_key) {
                    return NextResponse.json({ error: 'plan_id and domain_key required' }, { status: 400 });
                }

                // Check duplicate
                const existingDomain = await query(
                    'SELECT id FROM rc_plan_domains WHERE plan_id = $1 AND domain_key = $2',
                    [plan_id, domain_key]
                ) as any[];
                if (existingDomain.length > 0) {
                    return NextResponse.json({ error: 'Domain already exists on this plan' }, { status: 400 });
                }

                const existing = await query(
                    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM rc_plan_domains WHERE plan_id = $1',
                    [plan_id]
                ) as any[];
                const sortOrder = (existing[0]?.max_order ?? -1) + 1;

                const domainResult = await query(
                    'INSERT INTO rc_plan_domains (plan_id, domain_key, sort_order) VALUES ($1, $2, $3) RETURNING id',
                    [plan_id, domain_key, sortOrder]
                ) as any[];
                const domainId = domainResult[0].id;

                if (goals && Array.isArray(goals)) {
                    for (let gi = 0; gi < goals.length; gi++) {
                        const goal = goals[gi];
                        const goalResult = await query(
                            `INSERT INTO rc_plan_goals (domain_entry_id, goal_text, is_custom, sort_order)
                             VALUES ($1, $2, false, $3) RETURNING id`,
                            [domainId, goal.goal_text, gi]
                        ) as any[];
                        const goalId = goalResult[0].id;

                        if (goal.activities && Array.isArray(goal.activities)) {
                            for (let ai = 0; ai < goal.activities.length; ai++) {
                                await query(
                                    `INSERT INTO rc_plan_activities (goal_entry_id, activity_text, is_custom, sort_order)
                                     VALUES ($1, $2, false, $3)`,
                                    [goalId, goal.activities[ai].activity_text, ai]
                                );
                            }
                        }
                    }
                }

                await query('UPDATE rc_plans SET updated_at = NOW() WHERE id = $1', [plan_id]);
                return NextResponse.json({ success: true, domainId });
            }

            case 'outcome': {
                const { domain_entry_id, measure_key, measure_type, label, value, assessment_type, notes } = body;
                if (!domain_entry_id || !measure_key || !label) {
                    return NextResponse.json({ error: 'domain_entry_id, measure_key, and label required' }, { status: 400 });
                }

                // Get user id for recorded_by
                const userResult = await query(
                    'SELECT id FROM users WHERE cognito_sub = $1',
                    [(session.user as any).sub || session.user.id]
                ) as { id: string }[];
                const recordedBy = userResult.length > 0 ? userResult[0].id : null;

                const result = await query(
                    `INSERT INTO rc_plan_outcomes (domain_entry_id, measure_key, measure_type, label, value, assessment_type, notes, recorded_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [domain_entry_id, measure_key, measure_type || 'number', label, value || null, assessment_type || null, notes || null, recordedBy]
                ) as any[];

                // Touch plan
                await query(
                    'UPDATE rc_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM rc_plan_domains WHERE id = $1)',
                    [domain_entry_id]
                );

                return NextResponse.json({ success: true, outcomeId: result[0].id });
            }

            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error adding item:', error);
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}
