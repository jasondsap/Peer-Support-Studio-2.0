// app/api/recovery-assessments/[id]/analyze/route.ts
// AI analysis endpoint for recovery assessments — via RAG service

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// ============================================================================
// Question definitions — needed to provide item-level detail to the AI
// ============================================================================

const BARC10_QUESTIONS = [
    { id: 1, text: "There are more important things to me in life than using substances.", domain: "human", shortLabel: "Purpose & Meaning", reverse: false },
    { id: 2, text: "In general I am happy with my life.", domain: "human", shortLabel: "Life Satisfaction", reverse: false },
    { id: 3, text: "I have enough energy to complete the tasks I set myself.", domain: "human", shortLabel: "Energy & Vitality", reverse: false },
    { id: 4, text: "I am proud of the community I live in and feel part of it.", domain: "social", shortLabel: "Community Connection", reverse: false },
    { id: 5, text: "I get lots of support from friends.", domain: "social", shortLabel: "Friend Support", reverse: false },
    { id: 6, text: "I regard my life as challenging and fulfilling without the need for using drugs or alcohol.", domain: "human", shortLabel: "Fulfillment in Recovery", reverse: false },
    { id: 7, text: "My living space has helped to drive my recovery journey.", domain: "physical", shortLabel: "Supportive Environment", reverse: false },
    { id: 8, text: "I take full responsibility for my actions.", domain: "human", shortLabel: "Personal Responsibility", reverse: false },
    { id: 9, text: "I am happy dealing with a range of professional people.", domain: "cultural", shortLabel: "Professional Engagement", reverse: false },
    { id: 10, text: "I am making good progress on my recovery journey.", domain: "cultural", shortLabel: "Recovery Progress", reverse: false },
];

const MIRC28_QUESTIONS = [
    { id: 1, text: "I actively support other people who are in recovery.", domain: "social", shortLabel: "Peer Support", reverse: false },
    { id: 2, text: "My family makes my recovery more difficult.", domain: "social", shortLabel: "Family Barriers", reverse: true },
    { id: 3, text: "I have at least one friend who supports my recovery.", domain: "social", shortLabel: "Friend Support", reverse: false },
    { id: 4, text: "My family supports my recovery.", domain: "social", shortLabel: "Family Support", reverse: false },
    { id: 5, text: "Some people in my life do not think I'll make it in my recovery.", domain: "social", shortLabel: "Negative Beliefs", reverse: true },
    { id: 6, text: "I feel alone.", domain: "social", shortLabel: "Loneliness", reverse: true },
    { id: 7, text: "I feel like I'm part of a recovery community.", domain: "social", shortLabel: "Community Belonging", reverse: false },
    { id: 8, text: "My housing situation is helpful for my recovery.", domain: "physical", shortLabel: "Housing Support", reverse: false },
    { id: 9, text: "I have difficulty getting transportation.", domain: "physical", shortLabel: "Transportation Barriers", reverse: true },
    { id: 10, text: "My housing situation is unstable.", domain: "physical", shortLabel: "Housing Instability", reverse: true },
    { id: 11, text: "I have enough money every week to buy the basic things I need.", domain: "physical", shortLabel: "Basic Needs", reverse: false },
    { id: 12, text: "Not having enough money makes my recovery more difficult.", domain: "physical", shortLabel: "Financial Barriers", reverse: true },
    { id: 13, text: "I can afford the care I need for my health, mental health, and recovery.", domain: "physical", shortLabel: "Affordable Care", reverse: false },
    { id: 14, text: "I have reliable access to a phone and the internet.", domain: "physical", shortLabel: "Connectivity", reverse: false },
    { id: 15, text: "I find it hard to have fun.", domain: "human", shortLabel: "Enjoyment Barriers", reverse: true },
    { id: 16, text: "I feel physically healthy most days.", domain: "human", shortLabel: "Physical Health", reverse: false },
    { id: 17, text: "I am struggling with guilt or shame.", domain: "human", shortLabel: "Guilt & Shame", reverse: true },
    { id: 18, text: "I am experiencing a lot of stress.", domain: "human", shortLabel: "Stress Level", reverse: true },
    { id: 19, text: "My education and training have prepared me to handle life's challenges.", domain: "human", shortLabel: "Preparedness", reverse: false },
    { id: 20, text: "I have problems with my mental health.", domain: "human", shortLabel: "Mental Health", reverse: true },
    { id: 21, text: "I feel my life has purpose and meaning.", domain: "human", shortLabel: "Purpose & Meaning", reverse: false },
    { id: 22, text: "It's hard for me to trust others.", domain: "cultural", shortLabel: "Trust Barriers", reverse: true },
    { id: 23, text: "I have opportunities to participate in fun activities that do not involve drugs and alcohol.", domain: "cultural", shortLabel: "Sober Activities", reverse: false },
    { id: 24, text: "I feel disconnected from my culture or not part of any culture.", domain: "cultural", shortLabel: "Cultural Disconnection", reverse: true },
    { id: 25, text: "I feel like an outcast.", domain: "cultural", shortLabel: "Social Exclusion", reverse: true },
    { id: 26, text: "There are helpful services and resources accessible to me.", domain: "cultural", shortLabel: "Resource Access", reverse: false },
    { id: 27, text: "It's hard to let go of the part of my identity that was linked to my drinking or drug use.", domain: "cultural", shortLabel: "Identity Attachment", reverse: true },
    { id: 28, text: "My neighborhood or town feels safe.", domain: "cultural", shortLabel: "Neighborhood Safety", reverse: false },
];

const BARC10_LABELS: Record<number, string> = {
    1: "Strongly Disagree", 2: "Disagree", 3: "Somewhat Disagree",
    4: "Somewhat Agree", 5: "Agree", 6: "Strongly Agree"
};

const MIRC28_LABELS: Record<number, string> = {
    1: "Strongly Disagree", 2: "Disagree", 3: "Agree", 4: "Strongly Agree"
};

// ============================================================================
// Helper: build item-level summary for the AI prompt
// ============================================================================

function buildItemSummary(
    questions: typeof BARC10_QUESTIONS,
    responses: Record<string, number>,
    labels: Record<number, string>,
    maxLikert: number
): string {
    const lines: string[] = [];

    const domains = ['social', 'physical', 'human', 'cultural'];
    const domainNames: Record<string, string> = {
        social: 'Social Capital',
        physical: 'Physical Capital',
        human: 'Human Capital',
        cultural: 'Cultural Capital',
    };

    for (const domain of domains) {
        const domainQuestions = questions.filter(q => q.domain === domain);
        lines.push(`\n--- ${domainNames[domain]} ---`);
        for (const q of domainQuestions) {
            const rawScore = responses[`q${q.id}`];
            if (rawScore !== undefined && rawScore !== null) {
                const label = labels[rawScore] || `${rawScore}/${maxLikert}`;
                const reverseTag = q.reverse ? ' [REVERSE-SCORED]' : '';
                lines.push(`Q${q.id} (${q.shortLabel}): "${q.text}" → ${label} (${rawScore}/${maxLikert})${reverseTag}`);
            }
        }
    }

    return lines.join('\n');
}

// ============================================================================
// Helper: get score interpretation
// ============================================================================

function getInterpretation(percentage: number): string {
    if (percentage >= 75) return 'Strong Recovery Capital — robust resources supporting sustained recovery';
    if (percentage >= 50) return 'Moderate Recovery Capital — developing with room for targeted growth';
    if (percentage >= 25) return 'Low Recovery Capital — significant gaps requiring focused support';
    return 'Very Low Recovery Capital — critical need across multiple domains';
}

// ============================================================================
// POST handler
// ============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ragApiUrl = process.env.RAG_API_URL;
        const ragApiKey = process.env.RAG_API_KEY;

        if (!ragApiUrl || !ragApiKey) {
            return NextResponse.json(
                { error: 'RAG service not configured' },
                { status: 500 }
            );
        }

        const assessmentId = params.id;

        // Fetch the assessment
        const assessments = await sql`
            SELECT * FROM recovery_assessments WHERE id = ${assessmentId}::uuid
        `;

        if (!assessments || assessments.length === 0) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
        }

        const assessment = assessments[0];
        const responses = assessment.responses || {};
        const domainScores = assessment.domain_scores || {};
        const totalScore = assessment.total_score;
        const isMirc = assessment.assessment_type === 'mirc28';
        const maxScore = isMirc ? 112 : 60;
        const maxLikert = isMirc ? 4 : 6;
        const percentage = Math.round((totalScore / maxScore) * 100);
        const questions = isMirc ? MIRC28_QUESTIONS : BARC10_QUESTIONS;
        const labels = isMirc ? MIRC28_LABELS : BARC10_LABELS;
        const assessmentLabel = isMirc ? 'MIRC-28' : 'BARC-10';
        const participantName = assessment.participant_name || 'the participant';

        // Build detailed item-level summary
        const itemSummary = buildItemSummary(questions, responses, labels, maxLikert);

        // Identify lowest-scoring items for targeted analysis
        const scoredItems = questions
            .map(q => {
                const raw = responses[`q${q.id}`];
                if (raw === undefined || raw === null) return null;
                // For reverse-scored items, effective score = (max + 1) - raw
                const effective = q.reverse ? (maxLikert + 1 - raw) : raw;
                return { ...q, rawScore: raw, effectiveScore: effective };
            })
            .filter(Boolean) as any[];

        const weakest = [...scoredItems].sort((a, b) => a.effectiveScore - b.effectiveScore).slice(0, 5);
        const strongest = [...scoredItems].sort((a, b) => b.effectiveScore - a.effectiveScore).slice(0, 5);

        const interpretation = getInterpretation(percentage);

        // ====================================================================
        // Build the rich query prompt
        // ====================================================================

        const query = `You are a recovery capital analysis expert for peer support professionals. Analyze this ${assessmentLabel} recovery capital assessment and return a comprehensive, strength-based analysis.

=== PARTICIPANT ===
Name: ${participantName}
Assessment: ${assessmentLabel}
Date: ${new Date(assessment.created_at).toLocaleDateString()}

=== OVERALL SCORES ===
Total: ${totalScore}/${maxScore} (${percentage}%)
Interpretation: ${interpretation}
Social Capital: ${domainScores.social?.percentage || domainScores.social || 0}%
Physical Capital: ${domainScores.physical?.percentage || domainScores.physical || 0}%
Human Capital: ${domainScores.human?.percentage || domainScores.human || 0}%
Cultural Capital: ${domainScores.cultural?.percentage || domainScores.cultural || 0}%

=== ITEM-LEVEL RESPONSES ===
${itemSummary}

=== STRONGEST AREAS (highest effective scores) ===
${strongest.map(s => `- ${s.shortLabel} (${s.domain}): ${s.effectiveScore}/${maxLikert}`).join('\n')}

=== AREAS NEEDING SUPPORT (lowest effective scores) ===
${weakest.map(w => `- ${w.shortLabel} (${w.domain}): ${w.effectiveScore}/${maxLikert}`).join('\n')}

=== ANALYSIS INSTRUCTIONS ===
1. Use strength-based, person-first language throughout
2. Identify specific strengths from high-scoring items and explain why they matter for recovery
3. Identify growth opportunities from low-scoring items with empathy — frame as "opportunities" not "deficits"
4. For reverse-scored items, remember that a LOW raw score is actually POSITIVE (e.g., "I feel alone" scored 1 = good)
5. Generate 3-4 specific, actionable recovery goals based on the weakest domains with concrete action steps a peer support specialist can facilitate
6. Include a weekly challenge that is small, achievable, and directly tied to a growth area
7. Ground your analysis in recovery capital theory (Granfield & Cloud, SAMHSA recovery dimensions, Bowen et al. MIRC framework)
8. Write the encouragement statement as if speaking directly to the participant

=== REQUIRED JSON OUTPUT ===
Return ONLY valid JSON with this EXACT structure. No markdown, no backticks, no text outside the JSON:

{
    "overallSummary": "A 3-4 sentence paragraph summarizing the overall recovery capital profile. Reference specific scores and what they indicate. Use strength-based language.",

    "strengthsHighlight": {
        "title": "Recovery Strengths",
        "items": [
            "Strength 1 — explain what the high score on [specific item] tells us and why it matters for sustained recovery",
            "Strength 2 — same pattern",
            "Strength 3 — same pattern"
        ]
    },

    "growthOpportunities": {
        "title": "Growth Opportunities",
        "items": [
            "Opportunity 1 — identify the low-scoring area, explain its impact on recovery, and briefly suggest a direction",
            "Opportunity 2 — same pattern",
            "Opportunity 3 — same pattern"
        ]
    },

    "domainInsights": {
        "social": "2-3 sentences analyzing Social Capital items specifically. Reference individual question responses.",
        "physical": "2-3 sentences analyzing Physical Capital items specifically.",
        "human": "2-3 sentences analyzing Human Capital items specifically.",
        "cultural": "2-3 sentences analyzing Cultural Capital items specifically."
    },

    "recommendedGoals": [
        {
            "title": "Short goal title (e.g., 'Build Recovery Community Connections')",
            "domain": "social",
            "description": "1-2 sentence description of the goal tied to specific assessment findings",
            "rationale": "Why this goal matters based on the scores",
            "actionSteps": [
                "Concrete step 1 a peer support specialist can facilitate",
                "Concrete step 2",
                "Concrete step 3"
            ],
            "timeframe": "30 days"
        },
        {
            "title": "Goal 2 title",
            "domain": "physical",
            "description": "Description",
            "rationale": "Rationale",
            "actionSteps": ["Step 1", "Step 2", "Step 3"],
            "timeframe": "30 days"
        },
        {
            "title": "Goal 3 title",
            "domain": "human",
            "description": "Description",
            "rationale": "Rationale",
            "actionSteps": ["Step 1", "Step 2", "Step 3"],
            "timeframe": "30 days"
        }
    ],

    "weeklyChallenge": {
        "title": "This Week's Challenge",
        "description": "A specific, small, achievable action the participant can take this week. Make it concrete and encouraging.",
        "domain": "the domain this challenge addresses"
    },

    "encouragement": "A warm, personal 2-3 sentence encouragement message written directly to the participant. Reference something specific from their strengths.",

    "sourcesCited": [
        {
            "doc": "Source document name (e.g., 'SAMHSA TIP 64', 'Bowen et al. 2023 MIRC', 'Granfield & Cloud 1999')",
            "section": "Relevant section or concept",
            "usage": "Brief note on how this source informed the analysis"
        }
    ]
}`;

        // ====================================================================
        // Call RAG service
        // ====================================================================

        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'recovery_capital',
                query,
                context: {
                    participant_name: participantName,
                    assessment_type: assessment.assessment_type,
                    total_score: totalScore,
                    max_score: maxScore,
                    percentage,
                    domain_scores: {
                        social: domainScores.social?.percentage || domainScores.social,
                        physical: domainScores.physical?.percentage || domainScores.physical,
                        human: domainScores.human?.percentage || domainScores.human,
                        cultural: domainScores.cultural?.percentage || domainScores.cultural,
                    },
                    responses,
                    output_format: 'json',
                    instruction: 'Return ONLY valid JSON matching the schema in the query. No markdown, no backticks, no additional text.',
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            return NextResponse.json(
                { error: errorData.error || 'RAG analysis failed' },
                { status: 500 }
            );
        }

        const ragData = await ragResponse.json();

        // Parse JSON from RAG answer — handle various wrapping
        let answerText = (ragData.answer || '').trim();
        if (answerText.startsWith('```json')) {
            answerText = answerText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (answerText.startsWith('```')) {
            answerText = answerText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let analysis;
        try {
            analysis = JSON.parse(answerText);
        } catch (parseError) {
            console.error('JSON parse error, attempting extraction:', parseError);
            // Try to find JSON object in the response
            const jsonMatch = answerText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse analysis response as JSON');
            }
        }

        // Ensure recommendedGoals always exists (even if RAG missed it)
        if (!analysis.recommendedGoals || !Array.isArray(analysis.recommendedGoals)) {
            analysis.recommendedGoals = [];
        }

        // Ensure domainInsights exists
        if (!analysis.domainInsights) {
            analysis.domainInsights = {};
        }

        // Save analysis to database
        await sql`
            UPDATE recovery_assessments 
            SET ai_analysis = ${JSON.stringify(analysis)}
            WHERE id = ${assessmentId}::uuid
        `;

        return NextResponse.json({
            success: true,
            analysis,
        });

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze assessment' },
            { status: 500 }
        );
    }
}
