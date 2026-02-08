// app/api/service-log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// Helper to get user context (internal ID + organization from session)
async function getUserContext(session: any): Promise<{ userId: string; organizationId: string } | null> {
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) return null;
    
    // Get organization from session (already loaded by NextAuth)
    const organizationId = session.currentOrganization?.id;
    if (!organizationId) return null;
    
    return {
        userId,
        organizationId
    };
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const participantId = searchParams.get('participant_id');
        const status = searchParams.get('status');
        const view = searchParams.get('view'); // 'upcoming', 'completed', 'all', 'review'
        const limit = parseInt(searchParams.get('limit') || '50');

        const userContext = await getUserContext(session);
        if (!userContext) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { userId, organizationId } = userContext;
        let services;

        if (view === 'review') {
            // For supervisors: show all planned services awaiting approval in the org
            services = await sql`
                SELECT 
                    sp.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name
                FROM service_plans sp
                LEFT JOIN participants p ON sp.participant_id = p.id
                LEFT JOIN users u ON sp.user_id = u.id
                WHERE sp.organization_id = ${organizationId}
                AND sp.status = 'planned'
                ORDER BY sp.planned_date ASC
                LIMIT ${limit}
            `;
        } else if (view === 'upcoming') {
            services = await sql`
                SELECT 
                    sp.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM service_plans sp
                LEFT JOIN participants p ON sp.participant_id = p.id
                WHERE sp.user_id = ${userId}
                AND sp.status IN ('draft', 'planned', 'approved')
                AND sp.planned_date >= CURRENT_DATE
                ORDER BY sp.planned_date ASC
                LIMIT ${limit}
            `;
        } else if (view === 'completed') {
            services = await sql`
                SELECT 
                    sp.*,
                    p.first_name as participant_first_name,
                    p.last_name as participant_last_name,
                    p.preferred_name as participant_preferred_name
                FROM service_plans sp
                LEFT JOIN participants p ON sp.participant_id = p.id
                WHERE sp.user_id = ${userId}
                AND sp.status IN ('completed', 'verified')
                ORDER BY sp.completed_at DESC
                LIMIT ${limit}
            `;
        } else {
            // 'all' view or default - fetch user's services with optional filters
            if (status && participantId) {
                services = await sql`
                    SELECT 
                        sp.*,
                        p.first_name as participant_first_name,
                        p.last_name as participant_last_name,
                        p.preferred_name as participant_preferred_name
                    FROM service_plans sp
                    LEFT JOIN participants p ON sp.participant_id = p.id
                    WHERE sp.user_id = ${userId}
                    AND sp.status = ${status}
                    AND sp.participant_id = ${participantId}
                    ORDER BY sp.planned_date DESC
                    LIMIT ${limit}
                `;
            } else if (status) {
                services = await sql`
                    SELECT 
                        sp.*,
                        p.first_name as participant_first_name,
                        p.last_name as participant_last_name,
                        p.preferred_name as participant_preferred_name
                    FROM service_plans sp
                    LEFT JOIN participants p ON sp.participant_id = p.id
                    WHERE sp.user_id = ${userId}
                    AND sp.status = ${status}
                    ORDER BY sp.planned_date DESC
                    LIMIT ${limit}
                `;
            } else if (participantId) {
                services = await sql`
                    SELECT 
                        sp.*,
                        p.first_name as participant_first_name,
                        p.last_name as participant_last_name,
                        p.preferred_name as participant_preferred_name
                    FROM service_plans sp
                    LEFT JOIN participants p ON sp.participant_id = p.id
                    WHERE sp.user_id = ${userId}
                    AND sp.participant_id = ${participantId}
                    ORDER BY sp.planned_date DESC
                    LIMIT ${limit}
                `;
            } else {
                services = await sql`
                    SELECT 
                        sp.*,
                        p.first_name as participant_first_name,
                        p.last_name as participant_last_name,
                        p.preferred_name as participant_preferred_name
                    FROM service_plans sp
                    LEFT JOIN participants p ON sp.participant_id = p.id
                    WHERE sp.user_id = ${userId}
                    ORDER BY sp.planned_date DESC
                    LIMIT ${limit}
                `;
            }
        }

        // Fetch approvals for each service
        const serviceIds = services.map((s: any) => s.id);
        let approvals: any[] = [];
        
        if (serviceIds.length > 0) {
            approvals = await sql`
                SELECT * FROM service_approvals 
                WHERE service_plan_id = ANY(${serviceIds})
                ORDER BY approved_at DESC
            `;
        }

        // Attach approvals to services
        const servicesWithApprovals = services.map((service: any) => ({
            ...service,
            approvals: approvals.filter((a: any) => a.service_plan_id === service.id)
        }));

        return NextResponse.json({ success: true, services: servicesWithApprovals });

    } catch (error: any) {
        console.error('Service Log GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, ...data } = body;

        const userContext = await getUserContext(session);
        if (!userContext) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { userId, organizationId } = userContext;

        switch (action) {
            case 'create': {
                const result = await sql`
                    INSERT INTO service_plans (
                        user_id,
                        organization_id,
                        service_type,
                        planned_date,
                        planned_time,
                        planned_duration,
                        setting,
                        service_code,
                        participant_id,
                        lesson_id,
                        goal_id,
                        notes,
                        status
                    ) VALUES (
                        ${userId},
                        ${organizationId},
                        ${data.serviceType},
                        ${data.plannedDate},
                        ${data.plannedTime || null},
                        ${data.plannedDuration},
                        ${data.setting},
                        ${data.serviceCode || null},
                        ${data.participantId || null},
                        ${data.lessonId || null},
                        ${data.goalId || null},
                        ${data.notes || null},
                        ${data.status || 'draft'}
                    )
                    RETURNING *
                `;

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'update': {
                const { serviceId, ...updateData } = data;

                // Update all fields that were provided (using COALESCE to keep existing values if not provided)
                const result = await sql`
                    UPDATE service_plans 
                    SET 
                        service_type = COALESCE(${updateData.serviceType || null}, service_type),
                        planned_date = COALESCE(${updateData.plannedDate || null}, planned_date),
                        planned_time = COALESCE(${updateData.plannedTime || null}, planned_time),
                        planned_duration = COALESCE(${updateData.plannedDuration || null}, planned_duration),
                        setting = COALESCE(${updateData.setting || null}, setting),
                        service_code = COALESCE(${updateData.serviceCode}, service_code),
                        participant_id = COALESCE(${updateData.participantId}, participant_id),
                        lesson_id = COALESCE(${updateData.lessonId}, lesson_id),
                        goal_id = COALESCE(${updateData.goalId}, goal_id),
                        notes = COALESCE(${updateData.notes}, notes),
                        status = COALESCE(${updateData.status || null}, status),
                        updated_at = NOW()
                    WHERE id = ${serviceId} AND user_id = ${userId}
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or unauthorized' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'submit': {
                // Submit for review (change from draft to planned)
                const { serviceId } = data;

                const result = await sql`
                    UPDATE service_plans
                    SET status = 'planned', updated_at = NOW()
                    WHERE id = ${serviceId}
                    AND user_id = ${userId}
                    AND status = 'draft'
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or not in draft status' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'complete': {
                // Mark service as completed
                const { serviceId, actualDuration, attendanceCount, deliveredAsPlanned, deviationNotes } = data;

                const result = await sql`
                    UPDATE service_plans
                    SET 
                        status = 'completed',
                        actual_duration = ${actualDuration},
                        attendance_count = ${attendanceCount},
                        delivered_as_planned = ${deliveredAsPlanned},
                        deviation_notes = ${deviationNotes || null},
                        completed_at = NOW(),
                        completed_by = ${userId},
                        updated_at = NOW()
                    WHERE id = ${serviceId}
                    AND user_id = ${userId}
                    AND status IN ('planned', 'approved')
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or cannot be completed' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'link-note': {
                // Link a session note to the service
                const { serviceId, sessionNoteId } = data;

                const result = await sql`
                    UPDATE service_plans
                    SET session_note_id = ${sessionNoteId}, updated_at = NOW()
                    WHERE id = ${serviceId}
                    AND user_id = ${userId}
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'delete': {
                // Allow deleting drafts and planned services
                const { serviceId } = data;

                const result = await sql`
                    DELETE FROM service_plans
                    WHERE id = ${serviceId}
                    AND user_id = ${userId}
                    AND status IN ('draft', 'planned')
                    RETURNING id
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or cannot be deleted' }, { status: 404 });
                }

                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Service Log POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
