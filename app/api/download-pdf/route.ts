import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const { lessonId, lessonData } = await req.json();

        // If lessonData is provided directly, use it
        if (lessonData) {
            return NextResponse.json({ 
                success: true, 
                lessonPlan: lessonData 
            });
        }

        // Otherwise fetch from database
        if (!lessonId) {
            return NextResponse.json(
                { error: 'Lesson ID or lesson data required' },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Database not configured' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data: lesson, error } = await supabase
            .from('saved_lessons')
            .select('*')
            .eq('id', lessonId)
            .single();

        if (error || !lesson) {
            return NextResponse.json(
                { error: 'Lesson not found' },
                { status: 404 }
            );
        }

        // Try to parse the facilitator_guide if it's JSON
        let lessonPlan;
        try {
            lessonPlan = JSON.parse(lesson.facilitator_guide);
        } catch {
            // If it's not JSON, it's the old formatted text format
            // We can't generate a proper PDF from plain text
            // Return the raw data and let the client handle it
            return NextResponse.json({
                success: true,
                isLegacyFormat: true,
                title: lesson.title,
                facilitatorGuide: lesson.facilitator_guide,
                participantHandout: lesson.participant_handout
            });
        }

        return NextResponse.json({
            success: true,
            lessonPlan
        });

    } catch (error) {
        console.error('Error fetching lesson for PDF:', error);
        return NextResponse.json(
            { error: 'Failed to fetch lesson' },
            { status: 500 }
        );
    }
}
