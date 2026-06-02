import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - List published lesson templates (system-owned, available to all authenticated users)
// Deliberately omits lesson_json, facilitator_guide, participant_handout for payload size.
// The detail endpoint returns the full record.
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const templates = await sql`
            SELECT
                id, title, topic, description, category, category_order,
                session_type, setting_type, session_length, recovery_model,
                group_size, group_composition, gamma_presentation_url,
                use_count, created_at
            FROM lesson_templates
            WHERE is_published = true
            ORDER BY category_order ASC, title ASC
            LIMIT 500
        `;

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching lesson templates:', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}
