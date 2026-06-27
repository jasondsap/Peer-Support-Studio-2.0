import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { query, logAuditEvent } from '@/lib/db';

// GET /api/recovery-assessments - List assessments
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const assessmentType = searchParams.get('type'); // barc10, mirc28

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // Verify org access before touching PHI
        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        let sql = `
            SELECT 
                ra.*,
                p.first_name as participant_first_name,
                p.last_name as participant_last_name,
                p.preferred_name as participant_preferred_name,
                u.first_name as administered_by_first_name,
                u.last_name as administered_by_last_name
            FROM recovery_assessments ra
            LEFT JOIN participants p ON ra.participant_id = p.id
            LEFT JOIN users u ON ra.user_id = u.id
            WHERE ra.organization_id = $1
        `;
        const params: any[] = [organizationId];
        let paramIndex = 2;

        if (participantId) {
            sql += ` AND ra.participant_id = $${paramIndex}`;
            params.push(participantId);
            paramIndex++;
        }

        if (assessmentType) {
            sql += ` AND ra.assessment_type = $${paramIndex}`;
            params.push(assessmentType);
            paramIndex++;
        }

        sql += ` ORDER BY ra.created_at DESC`;

        const result = await query(sql, params);

        return NextResponse.json({ assessments: result });
    } catch (error) {
        console.error('Error fetching assessments:', error);
        return NextResponse.json(
            { error: 'Failed to fetch assessments' },
            { status: 500 }
        );
    }
}

// POST /api/recovery-assessments - Create a new assessment
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
        const {
            organization_id,
            participant_id,
            participant_name,
            assessment_type,
            total_score,
            domain_scores,
            responses,
            ai_analysis,
            notes,
        } = body;

        if (!organization_id) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // Verify org access before creating PHI
        try {
            await requireOrgAccess(organization_id);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await query(
            `INSERT INTO recovery_assessments (
                user_id, organization_id, participant_id, participant_name,
                assessment_type, total_score, domain_scores, responses, ai_analysis, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                userId,
                organization_id,
                participant_id || null,
                participant_name || null,
                assessment_type || 'barc10',
                total_score,
                JSON.stringify(domain_scores),
                JSON.stringify(responses),
                ai_analysis ? JSON.stringify(ai_analysis) : null,
                notes,
            ]
        ) as { id: string }[];

        // Log audit event
        await logAuditEvent(
            userId,
            organization_id,
            'create',
            'recovery_assessment',
            result[0].id,
            { assessment_type, participant_id }
        );

        return NextResponse.json({ 
            success: true,
            assessment: result[0],
            assessmentId: result[0].id 
        });
    } catch (error) {
        console.error('Error creating assessment:', error);
        return NextResponse.json(
            { error: 'Failed to create assessment' },
            { status: 500 }
        );
    }
}

// DELETE /api/recovery-assessments - Delete an assessment
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organization_id');

        if (!id || !organizationId) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        // Verify org access before deleting PHI
        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const result = await query(
            'DELETE FROM recovery_assessments WHERE id = $1 AND organization_id = $2 RETURNING id',
            [id, organizationId]
        ) as { id: string }[];

        if (result.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        // Log audit event
        await logAuditEvent(
            userId,
            organizationId,
            'delete',
            'recovery_assessment',
            id,
            { action: 'delete' }
        );

        return NextResponse.json({ success: true, deleted_id: id });
    } catch (error) {
        console.error('Error deleting assessment:', error);
        return NextResponse.json(
            { error: 'Failed to delete assessment' },
            { status: 500 }
        );
    }
}
