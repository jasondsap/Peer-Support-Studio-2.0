// app/api/service-log/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// Helper to get internal user ID from session
async function getInternalUserIdFromSession(session: any): Promise<string | null> {
    return await getInternalUserId(session.user.id, session.user.email);
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, serviceId, comment } = body;

        if (!serviceId) {
            return NextResponse.json({ error: 'Service ID required' }, { status: 400 });
        }

        const userId = await getInternalUserIdFromSession(session);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        switch (action) {
            case 'approve': {
                // Create approval record
                await sql`
                    INSERT INTO service_approvals (
                        service_plan_id,
                        action,
                        comment,
                        approved_by
                    ) VALUES (
                        ${serviceId},
                        'approved',
                        ${comment || null},
                        ${userId}
                    )
                `;

                // Update service status
                const result = await sql`
                    UPDATE service_plans
                    SET status = 'approved', updated_at = NOW()
                    WHERE id = ${serviceId}
                    AND status = 'planned'
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or not in planned status' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'comment': {
                // Add comment without changing status
                await sql`
                    INSERT INTO service_approvals (
                        service_plan_id,
                        action,
                        comment,
                        approved_by
                    ) VALUES (
                        ${serviceId},
                        'commented',
                        ${comment},
                        ${userId}
                    )
                `;

                return NextResponse.json({ success: true });
            }

            case 'request-change': {
                // Request changes - moves back to draft
                await sql`
                    INSERT INTO service_approvals (
                        service_plan_id,
                        action,
                        comment,
                        approved_by
                    ) VALUES (
                        ${serviceId},
                        'change_requested',
                        ${comment},
                        ${userId}
                    )
                `;

                // Update service status back to draft
                const result = await sql`
                    UPDATE service_plans
                    SET status = 'draft', updated_at = NOW()
                    WHERE id = ${serviceId}
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            case 'verify': {
                // Final verification of completed service
                await sql`
                    INSERT INTO service_approvals (
                        service_plan_id,
                        action,
                        comment,
                        approved_by
                    ) VALUES (
                        ${serviceId},
                        'verified',
                        ${comment || null},
                        ${userId}
                    )
                `;

                // Update service status and verification timestamp
                const result = await sql`
                    UPDATE service_plans
                    SET 
                        status = 'verified',
                        verified_at = NOW(),
                        verified_by = ${userId},
                        updated_at = NOW()
                    WHERE id = ${serviceId}
                    AND status = 'completed'
                    RETURNING *
                `;

                if (result.length === 0) {
                    return NextResponse.json({ error: 'Service not found or not in completed status' }, { status: 404 });
                }

                return NextResponse.json({ success: true, service: result[0] });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Service Approval error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get('serviceId');

        if (!serviceId) {
            return NextResponse.json({ error: 'Service ID required' }, { status: 400 });
        }

        const approvals = await sql`
            SELECT 
                sa.*,
                u.first_name as approver_first_name,
                u.last_name as approver_last_name
            FROM service_approvals sa
            LEFT JOIN users u ON sa.approved_by = u.id
            WHERE sa.service_plan_id = ${serviceId}
            ORDER BY sa.approved_at DESC
        `;

        return NextResponse.json({ success: true, approvals });

    } catch (error: any) {
        console.error('Get approvals error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
