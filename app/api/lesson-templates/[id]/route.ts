import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch a single published lesson template, including full content
// (lesson_json, facilitator_guide, participant_handout).
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const result = await sql`
            SELECT *
            FROM lesson_templates
            WHERE id = ${id}::uuid
            AND is_published = true
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ template: result[0] });
    } catch (error) {
        console.error('Error fetching lesson template:', error);
        return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }
}
