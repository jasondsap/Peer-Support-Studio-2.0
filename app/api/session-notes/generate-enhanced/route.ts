import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SpeakerMapping {
    [key: string]: string; // e.g., { "A": "PSS", "B": "Participant" }
}

interface SpeakerStats {
    speakerCount: number;
    speakers: Array<{
        id: string;
        label: string;
        talkTimePercent: number;
        wordCount: number;
        utteranceCount: number;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        // Optional auth check - allow both authenticated and unauthenticated requests
        // But only save to DB if authenticated
        const session = await getSession();
        let userId: string | null = null;
        
        if (session?.user?.id) {
            userId = await getInternalUserId(session.user.id, session.user.email);
        }

        const { 
            transcript, 
            metadata, 
            speakerMapping,
            speakerStats,
            includePssCoaching = true,
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

        // Apply speaker mapping to transcript if provided
        let processedTranscript = transcript;
        if (speakerMapping && Object.keys(speakerMapping).length > 0) {
            processedTranscript = applySpeakerMapping(transcript, speakerMapping);
        }

        // Build speaker context for the prompt
        const speakerContext = buildSpeakerContext(speakerMapping, speakerStats);

        const systemPrompt = buildSystemPrompt(metadata, speakerContext, includePssCoaching);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `TRANSCRIPT:\n${processedTranscript}` }
            ],
            max_tokens: 4000,
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
                pssCoaching: null,
                conversationAnalysis: null,
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
                        pss_coaching,
                        conversation_analysis,
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
                        'recording',
                        'draft',
                        ${parsedData.pssCoaching ? JSON.stringify(parsedData.pssCoaching) : null}::jsonb,
                        ${parsedData.conversationAnalysis ? JSON.stringify(parsedData.conversationAnalysis) : null}::jsonb,
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
            pssCoaching: parsedData.pssCoaching || null,
            conversationAnalysis: parsedData.conversationAnalysis || null,
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

function applySpeakerMapping(transcript: string, mapping: SpeakerMapping): string {
    let result = transcript;
    for (const [speakerId, label] of Object.entries(mapping)) {
        // Replace [Speaker A] with [PSS] etc.
        const regex = new RegExp(`\\[Speaker ${speakerId}\\]`, 'g');
        result = result.replace(regex, `[${label}]`);
    }
    return result;
}

function buildSpeakerContext(mapping: SpeakerMapping | undefined, stats: SpeakerStats | undefined): string {
    if (!stats || stats.speakerCount === 0) {
        return '';
    }

    let context = `\nSPEAKER INFORMATION:\n`;
    context += `- ${stats.speakerCount} speakers detected in this conversation\n`;

    for (const speaker of stats.speakers) {
        const label = mapping?.[speaker.id] || speaker.label;
        context += `- ${label}: ${speaker.talkTimePercent}% of conversation, ${speaker.wordCount} words, ${speaker.utteranceCount} turns\n`;
    }

    return context;
}

function buildSystemPrompt(metadata: any, speakerContext: string, includePssCoaching: boolean): string {
    let prompt = `You are a documentation assistant for Peer Support Specialists (PSS). Your job is to help create professional, strength-based session notes from conversation transcripts.

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
${speakerContext}

YOUR TASK:
Analyze the transcript and create the following outputs:

1. PSS SESSION NOTE - A structured note for documentation with these sections:
   - Session Overview (2-3 sentences summarizing the session)
   - Topics Discussed (bullet points of main subjects covered)
   - Participant Strengths Observed (positive qualities, progress, resilience shown)
   - Recovery Support Provided (what the PSS did to help - listening, sharing, resources, etc.)
   - Action Items (specific tasks agreed upon)
   - Follow-Up Needed (items to address in future sessions)

2. PSS SUMMARY - A brief bullet-point summary for the PSS's records or supervision (5-8 bullets)

3. PARTICIPANT SUMMARY - A warm, plain-language summary that could be shared with the participant (written in second person "you")`;

    if (includePssCoaching) {
        prompt += `

4. PSS COACHING - Professional development feedback for the Peer Support Specialist including:
   - What Went Well: 2-3 specific things the PSS did effectively (with quotes/examples from transcript)
   - Growth Opportunities: 2-3 specific suggestions for improvement (constructive, actionable)
   - Suggested Follow-Up Actions: 3-5 concrete next steps the PSS should take for this participant
   - Skill Spotlight: One peer support competency demonstrated and one to focus on developing
   - Conversation Balance: Assessment of talk-time ratio and engagement style

5. CONVERSATION ANALYSIS - Brief analysis of the session dynamics:
   - Engagement Level: How engaged was the participant?
   - Rapport Quality: Assessment of the connection between PSS and participant
   - Key Moments: 1-2 pivotal moments in the conversation
   - Risk Factors: Any concerns to monitor (without clinical language)`;
    }

    prompt += `

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
    "participantSummary": "Warm, conversational summary written to the participant..."`;

    if (includePssCoaching) {
        prompt += `,
    "pssCoaching": {
        "whatWentWell": ["Positive observation 1 with example", "Positive observation 2"],
        "growthOpportunities": ["Suggestion 1", "Suggestion 2"],
        "suggestedFollowUpActions": ["Action 1", "Action 2", "Action 3"],
        "skillSpotlight": {
            "demonstrated": "Name of competency demonstrated with brief example",
            "toDevelop": "Name of competency to work on with specific suggestion"
        },
        "conversationBalance": "Assessment of talk-time and engagement style"
    },
    "conversationAnalysis": {
        "engagementLevel": "High/Medium/Low with brief explanation",
        "rapportQuality": "Assessment of PSS-participant connection",
        "keyMoments": ["Key moment 1", "Key moment 2"],
        "riskFactors": ["Any concerns to monitor"] or []
    }`;
    }

    prompt += `
}

IMPORTANT:
- Be specific and concrete based on what's actually in the transcript
- Don't invent details not mentioned in the conversation
- Keep the tone warm, professional, and recovery-focused
- The participant summary should feel personal and encouraging
- PSS coaching should be constructive and supportive, not critical
- Mark any safety concerns clearly but don't over-pathologize`;

    return prompt;
}
