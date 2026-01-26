import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        // Optional auth check - allow both authenticated and unauthenticated requests
        const session = await getSession();
        let userId: string | null = null;
        
        if (session?.user?.id) {
            userId = await getInternalUserId(session.user.id, session.user.email);
        }

        const { 
            transcript, 
            metadata,
            saveToDb = true,
            organizationId,
            participantId
        } = await request.json();

        if (!transcript || transcript.trim().length === 0) {
            return NextResponse.json(
                { error: 'Transcript is required' },
                { status: 400 }
            );
        }

        const systemPrompt = `You are a documentation assistant for Peer Support Specialists (PSS). Your job is to help create professional, strength-based session notes from conversation transcripts or debriefs.

CRITICAL CONTEXT:
- You are creating PEER SUPPORT documentation, NOT clinical/therapy notes
- Peer Support Specialists are NOT clinicians - they are people with lived experience supporting others in recovery
- NEVER use clinical language like: diagnosis, symptoms, mental status exam, chief complaint, treatment plan, prognosis
- ALWAYS use recovery-oriented, strength-based language
- Focus on support provided, not treatment delivered

SESSION METADATA:
- Date: ${metadata?.date || 'Not specified'}
- Duration: ${metadata?.duration || 'Not specified'} minutes
- Session Type: ${metadata?.sessionType || 'Individual'}
- Setting: ${metadata?.setting || 'Not specified'}

YOUR TASK:
Analyze the transcript and create THREE outputs:

1. PSS SESSION NOTE - A structured note for documentation with these sections:
   - Session Overview (2-3 sentences summarizing the session)
   - Topics Discussed (bullet points of main subjects covered)
   - Participant Strengths Observed (positive qualities, progress, resilience shown)
   - Recovery Support Provided (what the PSS did to help - listening, sharing, resources, etc.)
   - Action Items (specific tasks agreed upon)
   - Follow-Up Needed (items to address in future sessions)

2. PSS SUMMARY - A brief bullet-point summary for the PSS's records or supervision (5-8 bullets)

3. PARTICIPANT SUMMARY - A warm, plain-language summary that could be shared with the participant to help them remember what was discussed (written in second person "you")

LANGUAGE GUIDELINES:
✅ USE: support, recovery, strengths, progress, coping strategies, peer support, shared experience, connection, resources, goals, action steps, wellness, resilience
❌ AVOID: diagnosis, symptoms, treatment, therapy, clinical, intervention, patient, mental status, prognosis, presenting problem, chief complaint

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:

{
    "pssNote": {
        "sessionOverview": "2-3 sentence overview of the session",
        "topicsDiscussed": ["Topic 1", "Topic 2", "Topic 3"],
        "strengthsObserved": ["Strength 1", "Strength 2", "Strength 3"],
        "recoverySupportProvided": ["Support 1", "Support 2", "Support 3"],
        "actionItems": ["Action 1", "Action 2"],
        "followUpNeeded": ["Follow-up 1", "Follow-up 2"]
    },
    "pssSummary": "• Bullet point 1\\n• Bullet point 2\\n• Bullet point 3...",
    "participantSummary": "Warm, conversational summary written to the participant..."
}

IMPORTANT:
- Be specific and concrete based on what's actually in the transcript
- Don't invent details not mentioned in the conversation
- Keep the tone warm, professional, and recovery-focused
- The participant summary should feel personal and encouraging
- Mark any safety concerns clearly but don't over-pathologize`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `TRANSCRIPT:\n${transcript}` }
            ],
            max_tokens: 2500,
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';

        // Clean and parse JSON
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let parsedData;
        try {
            parsedData = JSON.parse(cleanContent);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // Return a basic structure if parsing fails
            parsedData = {
                pssNote: {
                    sessionOverview: "Session documentation generated. Please review and edit as needed.",
                    topicsDiscussed: ["Review transcript for topics discussed"],
                    strengthsObserved: ["Review transcript for participant strengths"],
                    recoverySupportProvided: ["Review transcript for support provided"],
                    actionItems: ["Review and add action items"],
                    followUpNeeded: ["Review and add follow-up items"]
                },
                pssSummary: "• Session completed - review transcript for details\n• Add specific observations\n• Update with action items",
                participantSummary: "Thank you for meeting today. Please review the session notes and let me know if you have any questions.",
            };
        }

        // Save to database if authenticated and requested
        let savedNote = null;
        if (userId && saveToDb) {
            try {
                const notes = await sql`
                    INSERT INTO session_notes (
                        user_id,
                        organization_id,
                        participant_id,
                        metadata,
                        pss_note,
                        pss_summary,
                        participant_summary,
                        transcript,
                        source,
                        status,
                        is_archived
                    ) VALUES (
                        ${userId}::uuid,
                        ${organizationId || null}::uuid,
                        ${participantId || null}::uuid,
                        ${JSON.stringify(metadata || {})}::jsonb,
                        ${JSON.stringify(parsedData.pssNote)}::jsonb,
                        ${parsedData.pssSummary || null},
                        ${parsedData.participantSummary || null},
                        ${transcript},
                        'dictation',
                        'draft',
                        false
                    )
                    RETURNING *
                `;
                savedNote = notes[0];
            } catch (dbError) {
                console.error('Error saving to database:', dbError);
                // Don't fail the whole request if DB save fails
            }
        }

        return NextResponse.json({
            success: true,
            pssNote: parsedData.pssNote,
            pssSummary: parsedData.pssSummary,
            participantSummary: parsedData.participantSummary,
            savedNote: savedNote,
            noteId: savedNote?.id || null
        });

    } catch (error) {
        console.error('Session notes generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate session notes' },
            { status: 500 }
        );
    }
}
