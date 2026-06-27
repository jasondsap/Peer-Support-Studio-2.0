import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// POST - Save a generated lesson
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID from Cognito sub
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        // Stamp the creator's current org so teammates can see the lesson.
        // May be null if no org is selected (kept working for the owner).
        const organizationId = (session as any).currentOrganization?.id || null;

        const body = await request.json();
        const {
            title,
            topic,
            facilitator_guide,
            participant_handout,
            lesson_json,
            session_type,
            session_length,
            setting_type,
            recovery_model,
            group_size,
            group_composition,
            source_template_id,
            category
        } = body;

        // Validate required fields
        if (!title || !topic) {
            return NextResponse.json(
                { error: 'Title and topic are required' },
                { status: 400 }
            );
        }

        // Insert the lesson
        const result = await sql`
            INSERT INTO saved_lessons (
                user_id,
                organization_id,
                title,
                topic,
                facilitator_guide,
                participant_handout,
                lesson_json,
                session_type,
                session_length,
                setting_type,
                recovery_model,
                group_size,
                group_composition,
                source_template_id,
                category,
                created_at,
                updated_at
            ) VALUES (
                ${userId}::uuid,
                ${organizationId}::uuid,
                ${title},
                ${topic},
                ${facilitator_guide || null},
                ${participant_handout || null},
                ${lesson_json || null},
                ${session_type || 'group'},
                ${session_length || '60'},
                ${setting_type || 'outpatient'},
                ${recovery_model || 'General/Flexible'},
                ${group_size || null},
                ${group_composition || null},
                ${source_template_id || null},
                ${category || null},
                NOW(),
                NOW()
            )
            RETURNING id, title, created_at
        `;

        return NextResponse.json({ 
            success: true,
            lesson: result[0]
        });
    } catch (error) {
        console.error('Error saving lesson:', error);
        return NextResponse.json(
            { error: 'Failed to save lesson' },
            { status: 500 }
        );
    }
}

// GET - Fetch saved lessons for the current user
export async function GET(request: NextRequest) {
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

        // Org-wide visibility: return every lesson in the caller's current org,
        // plus the caller's own lessons (covers legacy rows whose organization_id
        // was never backfilled — those are NULL and would otherwise disappear).
        const organizationId = (session as any).currentOrganization?.id || null;

        const lessons = await sql`
            SELECT
                sl.id,
                sl.user_id,
                sl.organization_id,
                sl.title,
                sl.topic,
                sl.session_type,
                sl.session_length,
                sl.setting_type,
                sl.group_size,
                sl.recovery_model,
                sl.group_composition,
                sl.facilitator_guide,
                sl.participant_handout,
                sl.lesson_json,
                sl.gamma_presentation_url,
                sl.created_at,
                sl.updated_at,
                TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS author_name,
                (sl.user_id = ${userId}::uuid) AS is_mine
            FROM saved_lessons sl
            LEFT JOIN users u ON u.id = sl.user_id
            WHERE sl.user_id = ${userId}::uuid
               OR (${organizationId}::uuid IS NOT NULL AND sl.organization_id = ${organizationId}::uuid)
            ORDER BY sl.created_at DESC
            LIMIT 500
        `;

        return NextResponse.json({ lessons });
    } catch (error) {
        console.error('Error fetching lessons:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lessons' },
            { status: 500 }
        );
    }
}
