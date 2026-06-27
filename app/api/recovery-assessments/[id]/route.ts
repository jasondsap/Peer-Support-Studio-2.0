// app/api/recovery-assessments/[id]/route.ts
// Individual assessment operations (GET, PATCH, DELETE)

import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

// GET - Fetch single assessment
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const assessments = await sql`
            SELECT * FROM recovery_assessments WHERE id = ${params.id}::uuid
        `;

        if (!assessments || assessments.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        try { await requireOrgAccess(assessments[0].organization_id); }
        catch { return NextResponse.json({ error: 'Organization access denied' }, { status: 403 }); }

        return NextResponse.json({
            success: true,
            assessment: assessments[0]
        });

    } catch (error) {
        console.error('Error fetching assessment:', error);
        return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 });
    }
}

// PATCH - Update assessment (notes, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify the assessment exists and the caller can access its org
        const existing = await sql`
            SELECT organization_id FROM recovery_assessments WHERE id = ${params.id}::uuid
        `;
        if (!existing || existing.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }
        const organizationId = existing[0].organization_id;
        try { await requireOrgAccess(organizationId); }
        catch { return NextResponse.json({ error: 'Organization access denied' }, { status: 403 }); }

        const body = await request.json();
        const { notes, ai_analysis } = body;

        // Build dynamic update
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex}`);
            values.push(notes);
            paramIndex++;
        }

        if (ai_analysis !== undefined) {
            updates.push(`ai_analysis = $${paramIndex}`);
            values.push(JSON.stringify(ai_analysis));
            paramIndex++;
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Add the ID and org as the last parameters (org-scoped update)
        values.push(params.id);
        const idParam = paramIndex;
        paramIndex++;
        values.push(organizationId);
        const orgParam = paramIndex;

        const updateQuery = `
            UPDATE recovery_assessments
            SET ${updates.join(', ')}
            WHERE id = $${idParam}::uuid AND organization_id = $${orgParam}::uuid
            RETURNING *
        `;

        const result = await sql(updateQuery, values);

        if (!result || result.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organizationId, 'update', 'recovery_assessment', params.id, { updated_fields: updates.map(u => u.split(' ')[0]) });

        return NextResponse.json({
            success: true,
            assessment: result[0]
        });

    } catch (error) {
        console.error('Error updating assessment:', error);
        return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 });
    }
}

// DELETE - Delete assessment
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify the assessment exists and the caller can access its org
        const existing = await sql`
            SELECT organization_id FROM recovery_assessments WHERE id = ${params.id}::uuid
        `;
        if (!existing || existing.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }
        const organizationId = existing[0].organization_id;
        try { await requireOrgAccess(organizationId); }
        catch { return NextResponse.json({ error: 'Organization access denied' }, { status: 403 }); }

        const result = await sql`
            DELETE FROM recovery_assessments
            WHERE id = ${params.id}::uuid AND organization_id = ${organizationId}::uuid
            RETURNING id
        `;

        if (!result || result.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        await logAuditEvent(userId, organizationId, 'delete', 'recovery_assessment', params.id, {});

        return NextResponse.json({
            success: true,
            deleted_id: params.id
        });

    } catch (error) {
        console.error('Error deleting assessment:', error);
        return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 });
    }
}
