import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch surveys for a lesson or all surveys for a specialist
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const lessonId = searchParams.get('lessonId');
        const specialistId = searchParams.get('specialistId');
        const surveyId = searchParams.get('surveyId');

        // Get single survey with responses
        if (surveyId) {
            const { data: survey, error } = await supabase
                .from('lesson_surveys')
                .select(`
                    *,
                    survey_responses (*)
                `)
                .eq('id', surveyId)
                .single();

            if (error) {
                return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
            }

            return NextResponse.json(survey);
        }

        // Get surveys for a specific lesson
        if (lessonId) {
            const { data: surveys, error } = await supabase
                .from('lesson_surveys')
                .select(`
                    *,
                    survey_responses (count)
                `)
                .eq('lesson_id', lessonId)
                .order('created_at', { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json(surveys || []);
        }

        // Get all surveys for a specialist
        if (specialistId) {
            const { data: surveys, error } = await supabase
                .from('lesson_surveys')
                .select(`
                    *,
                    saved_lessons (title)
                `)
                .eq('specialist_id', specialistId)
                .order('created_at', { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json(surveys || []);
        }

        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });

    } catch (error) {
        console.error('GET surveys error:', error);
        return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }
}

// POST - Create a new survey for a lesson
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lessonId, specialistId, sessionDate, expirationDays = 7 } = body;

        if (!lessonId || !specialistId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Generate unique share code
        const generateCode = () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        let shareCode = generateCode();
        let attempts = 0;
        const maxAttempts = 10;

        // Ensure unique code
        while (attempts < maxAttempts) {
            const { data: existing } = await supabase
                .from('lesson_surveys')
                .select('id')
                .eq('share_code', shareCode)
                .single();

            if (!existing) break;
            shareCode = generateCode();
            attempts++;
        }

        // Calculate expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        // Create the survey
        const { data: survey, error } = await supabase
            .from('lesson_surveys')
            .insert({
                lesson_id: lessonId,
                specialist_id: specialistId,
                share_code: shareCode,
                session_date: sessionDate || new Date().toISOString().split('T')[0],
                expires_at: expiresAt.toISOString(),
                is_active: true,
                response_count: 0
            })
            .select()
            .single();

        if (error) {
            console.error('Create survey error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(survey);

    } catch (error) {
        console.error('POST survey error:', error);
        return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
    }
}

// PATCH - Update survey (deactivate, update analysis, etc.)
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { surveyId, ...updates } = body;

        if (!surveyId) {
            return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
        }

        const { data: survey, error } = await supabase
            .from('lesson_surveys')
            .update(updates)
            .eq('id', surveyId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(survey);

    } catch (error) {
        console.error('PATCH survey error:', error);
        return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
    }
}

// DELETE - Delete a survey
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const surveyId = searchParams.get('surveyId');

        if (!surveyId) {
            return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('lesson_surveys')
            .delete()
            .eq('id', surveyId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('DELETE survey error:', error);
        return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
    }
}
