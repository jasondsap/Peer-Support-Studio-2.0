import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// POST - Clone a system template into the current user's personal saved_lessons.
// Records source_template_id for usage analytics and increments the template use_count.
// The template's gamma_presentation_url is copied so the clone keeps the premade deck.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);

        if (!userId) {
            return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
        }

        const { id } = await params;

        const templateRows = await sql`
            SELECT * FROM lesson_templates WHERE id = ${id}::uuid AND is_published = true
        `;
        const template = templateRows[0];

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const result = await sql`
            INSERT INTO saved_lessons (
                user_id, title, topic, facilitator_guide, participant_handout,
                lesson_json, session_type, session_length, setting_type,
                recovery_model, group_size, group_composition,
                gamma_presentation_url, source_template_id, category,
                created_at, updated_at
            ) VALUES (
                ${userId}::uuid,
                ${template.title},
                ${template.topic},
                ${template.facilitator_guide},
                ${template.participant_handout},
                ${template.lesson_json},
                ${template.session_type},
                ${template.session_length || '60'},
                ${template.setting_type},
                ${template.recovery_model || 'General/Flexible'},
                ${template.group_size},
                ${template.group_composition},
                ${template.gamma_presentation_url},
                ${template.id}::uuid,
                ${template.category},
                NOW(),
                NOW()
            )
            RETURNING id, title, created_at
        `;

        await sql`
            UPDATE lesson_templates
            SET use_count = use_count + 1, updated_at = NOW()
            WHERE id = ${id}::uuid
        `;

        return NextResponse.json({ success: true, lesson: result[0] });
    } catch (error) {
        console.error('Error cloning template:', error);
        return NextResponse.json({ error: 'Failed to clone template' }, { status: 500 });
    }
}
