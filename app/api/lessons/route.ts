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
            group_composition
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
                created_at,
                updated_at
            ) VALUES (
                ${userId}::uuid,
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

        const lessons = await sql`
            SELECT 
                id,
                title,
                topic,
                session_type,
                session_length,
                setting_type,
                group_size,
                recovery_model,
                group_composition,
                facilitator_guide,
                participant_handout,
                lesson_json,
                gamma_presentation_url,
                created_at,
                updated_at
            FROM saved_lessons
            WHERE user_id = ${userId}::uuid
            ORDER BY created_at DESC
            LIMIT 50
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
