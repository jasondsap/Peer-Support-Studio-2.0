import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch a single lesson by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const { id } = await params;

        const result = await sql`
            SELECT *
            FROM saved_lessons
            WHERE id = ${id}::uuid
            AND user_id = ${userId}::uuid
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Lesson not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ lesson: result[0] });
    } catch (error) {
        console.error('Error fetching lesson:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lesson' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a lesson by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const { id } = await params;

        // Delete the lesson (only if owned by user)
        const result = await sql`
            DELETE FROM saved_lessons
            WHERE id = ${id}::uuid
            AND user_id = ${userId}::uuid
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Lesson not found or not authorized' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting lesson:', error);
        return NextResponse.json(
            { error: 'Failed to delete lesson' },
            { status: 500 }
        );
    }
}
