import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// Types
// ============================================================================

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface QueryResult {
    type: string;
    data: any;
}

// ============================================================================
// System Prompt
// ============================================================================

const ALLY_INTELLIGENCE_SYSTEM_PROMPT = `You are Ally, an intelligent assistant for Peer Support Specialists. You have access to participant data and can answer questions about:

- **Participants**: names, status, intake dates, contact info, how many active/inactive
- **Goals**: what goals participants have, their progress, timeframes
- **Session Notes**: what was discussed, commitments made, session summaries
- **Recovery Assessments**: BARC-10 and MIRC-28 scores, trends over time
- **Scheduled Sessions**: upcoming appointments, planned sessions
- **Journey Tracker**: recovery progress across domains (substance use, housing, employment, etc.)
- **Readiness Items**: documents and requirements for reentry participants

When answering:
1. Be concise and helpful - get to the point quickly
2. Reference specific data when available (dates, scores, quotes from notes)
3. If you don't have data to answer, say so clearly
4. Protect privacy - only share data with authorized users (which they are)
5. Use a warm, supportive tone appropriate for peer support work

You cannot:
- Make up data that wasn't provided to you
- Access data from other organizations
- Modify any records (you're read-only)

Keep responses concise (under 200 words) unless the user asks for detail.`;

// ============================================================================
// POST - Handle chat messages
// ============================================================================

export async function POST(req: NextRequest) {
    try {
        const { messages, organizationId } = await req.json();

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        const lastMessage = messages[messages.length - 1]?.content || '';

        // Step 1: Analyze the question to determine what data to fetch
        const queryPlan = await analyzeQuestion(lastMessage, organizationId);

        // Step 2: Execute queries based on the plan
        const queryResults = await executeQueries(queryPlan, organizationId);

        // Step 3: Generate response with context
        const contextPrompt = buildContextPrompt(queryResults);

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: ALLY_INTELLIGENCE_SYSTEM_PROMPT },
                { role: 'system', content: `Here is the relevant data from the database:\n\n${contextPrompt}` },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const assistantMessage = completion.choices[0].message.content;

        return NextResponse.json({ message: assistantMessage });
    } catch (error: any) {
        console.error('Ally Intelligence error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process request' },
            { status: 500 }
        );
    }
}

// ============================================================================
// Analyze Question - Determine what data to fetch
// ============================================================================

async function analyzeQuestion(question: string, organizationId: string): Promise<any> {
    const analysisPrompt = `Analyze this question and determine what database queries are needed.

Question: "${question}"

Return a JSON object with:
{
    "participantName": "name if mentioned, or null",
    "needsParticipantList": true/false (for questions like "how many participants"),
    "needsGoals": true/false,
    "needsSessionNotes": true/false,
    "needsAssessments": true/false,
    "needsScheduledSessions": true/false,
    "needsJourneyStatus": true/false,
    "needsReadinessItems": true/false,
    "timeframe": "recent" | "all" | null
}

Examples:
- "How many active participants do I have?" → needsParticipantList: true
- "What was Marc's last goal?" → participantName: "Marc", needsGoals: true
- "When is my next session with Sarah?" → participantName: "Sarah", needsScheduledSessions: true
- "What did Michelle commit to in our last session?" → participantName: "Michelle", needsSessionNotes: true

Return ONLY the JSON object, no other text.`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0,
        max_tokens: 300
    });

    try {
        const content = completion.choices[0].message.content || '{}';
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return { needsParticipantList: true };
    }
}

// ============================================================================
// Execute Queries
// ============================================================================

async function executeQueries(plan: any, organizationId: string): Promise<QueryResult[]> {
    const results: QueryResult[] = [];

    // If a participant name is mentioned, find them first
    let participantId: string | null = null;
    let participantInfo: any = null;

    if (plan.participantName) {
        const searchName = plan.participantName.toLowerCase();
        const participants = await sql`
            SELECT id, first_name, last_name, preferred_name, status, intake_date, 
                   referral_source, internal_notes, is_reentry_participant
            FROM participants
            WHERE organization_id = ${organizationId}
            AND (
                LOWER(first_name) LIKE ${`%${searchName}%`}
                OR LOWER(last_name) LIKE ${`%${searchName}%`}
                OR LOWER(preferred_name) LIKE ${`%${searchName}%`}
            )
            LIMIT 1
        `;

        if (participants.length > 0) {
            participantInfo = participants[0];
            participantId = participantInfo.id;
            results.push({
                type: 'participant',
                data: participantInfo
            });
        } else {
            results.push({
                type: 'participant_not_found',
                data: { searchedName: plan.participantName }
            });
            return results;
        }
    }

    // Get participant list/counts if needed
    if (plan.needsParticipantList) {
        const counts = await sql`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'active') as active_count,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
                COUNT(*) FILTER (WHERE status = 'discharged') as discharged_count,
                COUNT(*) as total_count
            FROM participants
            WHERE organization_id = ${organizationId}
        `;

        const recentParticipants = await sql`
            SELECT first_name, last_name, preferred_name, status, intake_date
            FROM participants
            WHERE organization_id = ${organizationId}
            ORDER BY intake_date DESC
            LIMIT 10
        `;

        results.push({
            type: 'participant_stats',
            data: { counts: counts[0], recent: recentParticipants }
        });
    }

    // Get goals if needed
    if (plan.needsGoals && participantId) {
        const goals = await sql`
            SELECT smart_goal, goal_area, desired_outcome, status, progress, 
                   timeframe, created_at
            FROM saved_goals
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY created_at DESC
            LIMIT 5
        `;
        results.push({ type: 'goals', data: goals });
    }

    // Get session notes if needed
    if (plan.needsSessionNotes && participantId) {
        const notes = await sql`
            SELECT id, pss_note, pss_summary, metadata, created_at
            FROM session_notes
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY created_at DESC
            LIMIT 5
        `;
        results.push({ type: 'session_notes', data: notes });
    }

    // Get assessments if needed
    if (plan.needsAssessments && participantId) {
        const assessments = await sql`
            SELECT assessment_type, total_score, domain_scores, notes, 
                   assessment_date, created_at
            FROM recovery_assessments
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY created_at DESC
            LIMIT 5
        `;
        results.push({ type: 'assessments', data: assessments });
    }

    // Get scheduled sessions if needed
    if (plan.needsScheduledSessions) {
        let sessionsQuery;
        if (participantId) {
            sessionsQuery = await sql`
                SELECT sp.planned_date, sp.planned_duration, sp.service_type, 
                       sp.setting, sp.notes, sp.status,
                       p.first_name, p.last_name, p.preferred_name
                FROM service_plans sp
                LEFT JOIN participants p ON p.id = sp.participant_id
                WHERE sp.organization_id = ${organizationId}
                AND sp.participant_id = ${participantId}
                AND sp.status = 'planned'
                AND sp.planned_date >= CURRENT_DATE
                ORDER BY sp.planned_date ASC
                LIMIT 5
            `;
        } else {
            sessionsQuery = await sql`
                SELECT sp.planned_date, sp.planned_duration, sp.service_type, 
                       sp.setting, sp.notes, sp.status,
                       p.first_name, p.last_name, p.preferred_name
                FROM service_plans sp
                LEFT JOIN participants p ON p.id = sp.participant_id
                WHERE sp.organization_id = ${organizationId}
                AND sp.status = 'planned'
                AND sp.planned_date >= CURRENT_DATE
                ORDER BY sp.planned_date ASC
                LIMIT 10
            `;
        }
        results.push({ type: 'scheduled_sessions', data: sessionsQuery });
    }

    // Get journey status if needed
    if (plan.needsJourneyStatus && participantId) {
        const journeyStatus = await sql`
            SELECT jd.domain_label, jd.domain_key, je.status_label, 
                   je.entry_date, je.notes, je.is_milestone
            FROM journey_entries je
            JOIN journey_domains jd ON jd.id = je.domain_id
            WHERE je.participant_id = ${participantId}
            AND je.organization_id = ${organizationId}
            ORDER BY je.entry_date DESC
            LIMIT 10
        `;
        results.push({ type: 'journey_status', data: journeyStatus });
    }

    // Get readiness items if needed
    if (plan.needsReadinessItems && participantId) {
        const readinessItems = await sql`
            SELECT item_key, status, obtained_date, notes
            FROM participant_readiness_items
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY item_key
        `;
        results.push({ type: 'readiness_items', data: readinessItems });
    }

    return results;
}

// ============================================================================
// Build Context Prompt
// ============================================================================

function buildContextPrompt(results: QueryResult[]): string {
    if (results.length === 0) {
        return 'No relevant data found for this query.';
    }

    const sections: string[] = [];

    for (const result of results) {
        switch (result.type) {
            case 'participant':
                const p = result.data;
                sections.push(`**Participant Found:**
- Name: ${p.preferred_name || p.first_name} ${p.last_name}
- Status: ${p.status}
- Intake Date: ${p.intake_date}
- Referral: ${p.referral_source || 'N/A'}
- Reentry Participant: ${p.is_reentry_participant ? 'Yes' : 'No'}
- Notes: ${p.internal_notes || 'None'}`);
                break;

            case 'participant_not_found':
                sections.push(`**Participant Not Found:** No participant matching "${result.data.searchedName}" was found.`);
                break;

            case 'participant_stats':
                const c = result.data.counts;
                sections.push(`**Participant Statistics:**
- Active: ${c.active_count}
- Inactive: ${c.inactive_count}
- Discharged: ${c.discharged_count}
- Total: ${c.total_count}

Recent Participants: ${result.data.recent.map((r: any) => 
    `${r.preferred_name || r.first_name} ${r.last_name} (${r.status})`
).join(', ')}`);
                break;

            case 'goals':
                if (result.data.length === 0) {
                    sections.push('**Goals:** No goals found.');
                } else {
                    sections.push(`**Goals:**\n${result.data.map((g: any) => 
                        `- ${g.smart_goal || g.desired_outcome} [${g.goal_area}] - ${g.status}, ${g.progress}% complete (created: ${g.created_at})`
                    ).join('\n')}`);
                }
                break;

            case 'session_notes':
                if (result.data.length === 0) {
                    sections.push('**Session Notes:** No session notes found.');
                } else {
                    sections.push(`**Recent Session Notes:**\n${result.data.map((n: any) => {
                        const pssNote = typeof n.pss_note === 'object' ? n.pss_note : null;
                        const overview = pssNote?.sessionOverview || n.pss_summary || 'No summary';
                        const interventions = pssNote?.interventions || '';
                        const plan = pssNote?.planForNextSession || '';
                        return `- ${new Date(n.created_at).toLocaleDateString()}: ${overview}${interventions ? ` | Interventions: ${interventions}` : ''}${plan ? ` | Plan: ${plan}` : ''}`;
                    }).join('\n')}`);
                }
                break;

            case 'assessments':
                if (result.data.length === 0) {
                    sections.push('**Assessments:** No assessments found.');
                } else {
                    sections.push(`**Recovery Assessments:**\n${result.data.map((a: any) => 
                        `- ${a.assessment_type.toUpperCase()} on ${a.assessment_date || a.created_at}: Score ${a.total_score}${a.notes ? ` - "${a.notes}"` : ''}`
                    ).join('\n')}`);
                }
                break;

            case 'scheduled_sessions':
                if (result.data.length === 0) {
                    sections.push('**Scheduled Sessions:** No upcoming sessions found.');
                } else {
                    sections.push(`**Upcoming Sessions:**\n${result.data.map((s: any) => {
                        const name = s.preferred_name || s.first_name || 'Unassigned';
                        return `- ${new Date(s.planned_date).toLocaleDateString()} (${s.planned_duration} min ${s.service_type}) with ${name}${s.notes ? `: ${s.notes}` : ''}`;
                    }).join('\n')}`);
                }
                break;

            case 'journey_status':
                if (result.data.length === 0) {
                    sections.push('**Journey Status:** No journey entries found.');
                } else {
                    sections.push(`**Journey Tracker:**\n${result.data.map((j: any) => 
                        `- ${j.domain_label}: ${j.status_label} (${j.entry_date})${j.is_milestone ? ' ⭐ MILESTONE' : ''}${j.notes ? ` - "${j.notes}"` : ''}`
                    ).join('\n')}`);
                }
                break;

            case 'readiness_items':
                if (result.data.length === 0) {
                    sections.push('**Readiness Items:** No readiness items found.');
                } else {
                    const obtained = result.data.filter((r: any) => r.status === 'obtained');
                    const missing = result.data.filter((r: any) => r.status === 'missing');
                    sections.push(`**Readiness Checklist:**
- Obtained (${obtained.length}): ${obtained.map((r: any) => r.item_key.replace(/_/g, ' ')).join(', ') || 'None'}
- Missing (${missing.length}): ${missing.map((r: any) => r.item_key.replace(/_/g, ' ')).join(', ') || 'None'}`);
                }
                break;
        }
    }

    return sections.join('\n\n');
}
