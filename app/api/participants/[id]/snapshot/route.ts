import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// Types
// ============================================================================

interface SnapshotData {
    participant: any;
    journeySummary: any;
    recentEntries: any[];
    goals: any[];
    recentNotes: any[];
    assessments: any[];
    insights: any[];
}

// ============================================================================
// GET - Generate participant snapshot
// ============================================================================

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const participantId = params.id;
        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        // ====================================================================
        // 1. Fetch Participant Info
        // ====================================================================
        const participantResult = await sql`
            SELECT 
                id, first_name, last_name, preferred_name,
                date_of_birth, gender, status, intake_date,
                referral_source, internal_notes, is_reentry_participant
            FROM participants
            WHERE id = ${participantId}
            AND organization_id = ${organizationId}
        `;

        if (participantResult.length === 0) {
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        const participant = participantResult[0];

        // ====================================================================
        // 2. Fetch Journey Tracker Summary
        // ====================================================================
        const journeyDomains = await sql`
            SELECT 
                jd.id as domain_id,
                jd.domain_key,
                jd.domain_label,
                jd.color,
                jd.statuses,
                (
                    SELECT json_build_object(
                        'status_key', je.status_key,
                        'status_label', je.status_label,
                        'entry_date', je.entry_date,
                        'is_milestone', je.is_milestone
                    )
                    FROM journey_entries je
                    WHERE je.domain_id = jd.id
                    AND je.participant_id = ${participantId}
                    ORDER BY je.entry_date DESC, je.created_at DESC
                    LIMIT 1
                ) as current_status,
                (
                    SELECT COUNT(*)::int 
                    FROM journey_entries je 
                    WHERE je.domain_id = jd.id 
                    AND je.participant_id = ${participantId}
                ) as entry_count,
                (
                    SELECT COUNT(*)::int 
                    FROM journey_entries je 
                    WHERE je.domain_id = jd.id 
                    AND je.participant_id = ${participantId}
                    AND je.is_milestone = true
                ) as milestone_count
            FROM journey_domains jd
            WHERE jd.organization_id = ${organizationId}
            AND jd.is_active = true
            ORDER BY jd.display_order
        `;

        // ====================================================================
        // 3. Fetch Recent Journey Entries (last 90 days)
        // ====================================================================
        const recentEntries = await sql`
            SELECT 
                je.id,
                je.domain_id,
                jd.domain_label,
                je.status_key,
                je.status_label,
                je.entry_date,
                je.notes,
                je.is_milestone,
                je.milestone_type
            FROM journey_entries je
            JOIN journey_domains jd ON jd.id = je.domain_id
            WHERE je.participant_id = ${participantId}
            AND je.organization_id = ${organizationId}
            AND je.entry_date >= CURRENT_DATE - INTERVAL '90 days'
            ORDER BY je.entry_date DESC
            LIMIT 20
        `;

        // ====================================================================
        // 4. Fetch Goals
        // ====================================================================
        const goals = await sql`
            SELECT 
                id, smart_goal, goal_area, desired_outcome,
                status, progress, timeframe, created_at
            FROM saved_goals
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY 
                CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 10
        `;

        // ====================================================================
        // 5. Fetch Recent Session Notes (last 60 days)
        // ====================================================================
        const recentNotes = await sql`
            SELECT 
                id,
                metadata,
                pss_note,
                pss_summary,
                created_at
            FROM session_notes
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            AND created_at >= CURRENT_DATE - INTERVAL '60 days'
            ORDER BY created_at DESC
            LIMIT 10
        `;

        // ====================================================================
        // 6. Fetch Recent Assessments
        // ====================================================================
        const assessments = await sql`
            SELECT 
                id, assessment_type, total_score, domain_scores,
                ai_analysis, notes, assessment_date, created_at
            FROM recovery_assessments
            WHERE participant_id = ${participantId}
            AND organization_id = ${organizationId}
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // ====================================================================
        // 7. Calculate Days in Program
        // ====================================================================
        const intakeDate = participant.intake_date 
            ? new Date(participant.intake_date) 
            : null;
        const daysInProgram = intakeDate 
            ? Math.floor((Date.now() - intakeDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // ====================================================================
        // 8. Generate AI Summary
        // ====================================================================
        const snapshotData: SnapshotData = {
            participant,
            journeySummary: journeyDomains,
            recentEntries,
            goals,
            recentNotes,
            assessments,
            insights: []
        };

        const aiSummary = await generateAISummary(snapshotData, daysInProgram);

        // ====================================================================
        // Return Complete Snapshot
        // ====================================================================
        return NextResponse.json({
            success: true,
            snapshot: {
                generatedAt: new Date().toISOString(),
                participant: {
                    id: participant.id,
                    name: participant.preferred_name 
                        ? `${participant.preferred_name} (${participant.first_name} ${participant.last_name})`
                        : `${participant.first_name} ${participant.last_name}`,
                    status: participant.status,
                    intakeDate: participant.intake_date,
                    daysInProgram,
                    referralSource: participant.referral_source,
                    isReentryParticipant: participant.is_reentry_participant
                },
                journey: {
                    domains: journeyDomains.filter((d: any) => d.current_status !== null),
                    totalMilestones: journeyDomains.reduce((sum: number, d: any) => sum + (d.milestone_count || 0), 0),
                    recentEntries: recentEntries.slice(0, 5)
                },
                goals: {
                    active: goals.filter((g: any) => g.status === 'active'),
                    completed: goals.filter((g: any) => g.status === 'completed'),
                    totalCount: goals.length
                },
                sessions: {
                    recentCount: recentNotes.length,
                    notes: recentNotes.slice(0, 5)
                },
                assessments: {
                    latest: assessments[0] || null,
                    previous: assessments[1] || null,
                    totalCount: assessments.length
                },
                aiSummary
            }
        });

    } catch (error) {
        console.error('Error generating participant snapshot:', error);
        return NextResponse.json({ error: 'Failed to generate snapshot' }, { status: 500 });
    }
}

// ============================================================================
// AI Summary Generation
// ============================================================================

async function generateAISummary(data: SnapshotData, daysInProgram: number | null): Promise<any> {
    try {
        const { participant, journeySummary, recentEntries, goals, recentNotes, assessments } = data;

        // Build context for AI
        const participantName = participant.preferred_name || participant.first_name;
        
        // Journey summary
        const activeDomains = journeySummary
            .filter((d: any) => d.current_status)
            .map((d: any) => `${d.domain_label}: ${d.current_status?.status_label || 'Unknown'}`)
            .join(', ');

        const milestones = recentEntries
            .filter((e: any) => e.is_milestone)
            .map((e: any) => `${e.domain_label} - ${e.status_label} (${formatDate(e.entry_date)})`)
            .join('; ');

        // Goals summary
        const activeGoals = goals
            .filter((g: any) => g.status === 'active')
            .map((g: any) => `${g.smart_goal || g.desired_outcome} (${g.progress}% complete)`)
            .join('; ');

        const completedGoals = goals.filter((g: any) => g.status === 'completed').length;

        // Session themes (extract from notes)
        const sessionThemes = recentNotes
            .map((n: any) => {
                // pss_note is JSON with sessionOverview
                if (typeof n.pss_note === 'object' && n.pss_note?.sessionOverview) {
                    return n.pss_note.sessionOverview;
                }
                // Also check pss_summary
                if (n.pss_summary) {
                    return n.pss_summary;
                }
                return null;
            })
            .filter(Boolean)
            .slice(0, 5)
            .join(' | ');

        // Assessment trend
        let assessmentTrend = '';
        if (assessments.length >= 2) {
            const latest = assessments[0].total_score;
            const previous = assessments[1].total_score;
            const diff = latest - previous;
            assessmentTrend = diff > 0 
                ? `Recovery capital increased by ${diff} points` 
                : diff < 0 
                    ? `Recovery capital decreased by ${Math.abs(diff)} points`
                    : 'Recovery capital stable';
        } else if (assessments.length === 1) {
            assessmentTrend = `Current recovery capital score: ${assessments[0].total_score}`;
        }

        const prompt = `You are a clinical documentation assistant for peer support specialists. Generate a concise, professional snapshot summary for a participant's current status. Use recovery-oriented, strengths-based language.

PARTICIPANT: ${participantName}
DAYS IN PROGRAM: ${daysInProgram || 'Unknown'}
REFERRAL SOURCE: ${participant.referral_source || 'Not specified'}

CURRENT JOURNEY STATUS:
${activeDomains || 'No domains currently tracked'}

RECENT MILESTONES (Last 90 days):
${milestones || 'None recorded'}

ACTIVE GOALS:
${activeGoals || 'No active goals'}
Completed goals: ${completedGoals}

RECENT SESSION THEMES:
${sessionThemes || 'No recent sessions'}

ASSESSMENT TREND:
${assessmentTrend || 'No assessments on record'}

Generate a JSON response with this exact structure:
{
    "overallStatus": "One sentence summary of where they are in their recovery journey",
    "strengthsAndWins": ["3-4 bullet points highlighting recent progress, milestones, and strengths"],
    "areasOfFocus": ["2-3 bullet points on areas needing attention or support"],
    "sessionThemes": "Brief summary of what recent sessions have focused on",
    "recommendedNextSteps": ["2-3 actionable recommendations for the PSS"],
    "notablePattern": "One insight about cross-domain patterns or recovery trajectory"
}

Be specific, use the actual data provided, and keep language hopeful but realistic.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a clinical documentation assistant. Always respond with valid JSON only, no markdown.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800
        });

        const responseText = completion.choices[0]?.message?.content || '';
        
        // Parse JSON response
        try {
            const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanedResponse);
        } catch {
            // Fallback if JSON parsing fails
            return {
                overallStatus: 'Snapshot generated - please review participant data for details.',
                strengthsAndWins: ['Engaged in program services'],
                areasOfFocus: ['Continue current support plan'],
                sessionThemes: 'Review session notes for details',
                recommendedNextSteps: ['Schedule follow-up session'],
                notablePattern: 'Data available for review'
            };
        }

    } catch (error) {
        console.error('Error generating AI summary:', error);
        return {
            overallStatus: 'Unable to generate AI summary',
            strengthsAndWins: [],
            areasOfFocus: [],
            sessionThemes: '',
            recommendedNextSteps: [],
            notablePattern: ''
        };
    }
}

function formatDate(date: any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
