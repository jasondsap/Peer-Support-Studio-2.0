// app/api/recovery-assessments/[id]/route.ts
// Individual assessment operations (GET, PATCH, DELETE)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET - Fetch single assessment
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const assessments = await sql`
            SELECT * FROM recovery_assessments WHERE id = ${params.id}::uuid
        `;

        if (!assessments || assessments.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // Add the ID as the last parameter
        values.push(params.id);

        const updateQuery = `
            UPDATE recovery_assessments 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}::uuid
            RETURNING *
        `;

        const result = await sql(updateQuery, values);

        if (!result || result.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await sql`
            DELETE FROM recovery_assessments 
            WHERE id = ${params.id}::uuid
            RETURNING id
        `;

        if (!result || result.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true,
            deleted_id: params.id 
        });

    } catch (error) {
        console.error('Error deleting assessment:', error);
        return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 });
    }
}
