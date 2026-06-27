import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { MIRC28_QUESTIONS, MIRC28_DOMAINS, type Mirc28Domain } from '@/lib/assessments/questionnaires';

// MIRC-28 domain structure + question text are derived from the canonical
// question bank in lib/assessments/questionnaires.ts so the item text, order,
// and reverse-scoring flags stay identical to the participant-facing form.
const DOMAINS = (Object.keys(MIRC28_DOMAINS) as Mirc28Domain[]).reduce((acc, key) => {
    const qs = MIRC28_QUESTIONS.filter(q => q.domain === key);
    acc[key] = {
        name: MIRC28_DOMAINS[key],
        questions: qs.map(q => q.id),
        reverseScored: qs.filter(q => q.reverse).map(q => q.id),
    };
    return acc;
}, {} as Record<Mirc28Domain, { name: string; questions: number[]; reverseScored: number[] }>);

const QUESTION_TEXT: { [key: number]: string } = Object.fromEntries(
    MIRC28_QUESTIONS.map(q => [q.id, q.text])
);

interface Answers { [key: string]: number; }

interface Scores {
    total: number;
    maxScore: number;
    percentage: number;
    domains: {
        social: { raw: number; max: number; percentage: number };
        physical: { raw: number; max: number; percentage: number };
        human: { raw: number; max: number; percentage: number };
        cultural: { raw: number; max: number; percentage: number };
    };
}

function getScoreInterpretation(percentage: number): { level: string; description: string } {
    if (percentage >= 75) {
        return {
            level: "Strong Recovery Capital",
            description: "You have developed robust resources across multiple domains. Your recovery foundation is solid, with meaningful connections, stable resources, and strong internal strengths."
        };
    } else if (percentage >= 50) {
        return {
            level: "Building Recovery Capital",
            description: "You're actively developing recovery resources and making progress. Some domains are stronger than others, which is completely normal."
        };
    } else if (percentage >= 25) {
        return {
            level: "Developing Recovery Capital",
            description: "You're in a critical growth phase of building recovery capital. Focus on one or two domains where small improvements can create momentum."
        };
    } else {
        return {
            level: "Early Recovery Capital",
            description: "Building recovery capital is a journey, and you're at the beginning. Small, consistent actions in any domain can start to shift the balance."
        };
    }
}

// ─── AI Analysis via RAG service ───

async function generateComprehensiveAnalysis(
    answers: Answers,
    scores: Scores,
    participantName?: string
) {
    const ragApiUrl = process.env.RAG_API_URL;
    const ragApiKey = process.env.RAG_API_KEY;
    const interpretation = getScoreInterpretation(scores.percentage);

    // Build domain details for context
    const domainDetails = Object.entries(DOMAINS).map(([domainKey, domain]) => {
        const domainScore = scores.domains[domainKey as keyof typeof scores.domains];
        const questionDetails = domain.questions.map(qNum => {
            const rawAnswer = answers[`q${qNum}`];
            // Unanswered items are excluded from strength/challenge classification
            // rather than being coerced to a midpoint default.
            const answered = typeof rawAnswer === 'number';
            const isReverse = domain.reverseScored.includes(qNum);
            const effectiveScore = answered ? (isReverse ? (5 - rawAnswer) : rawAnswer) : null;
            return {
                question: QUESTION_TEXT[qNum],
                rawAnswer, effectiveScore, isReverse,
                isStrength: effectiveScore !== null && effectiveScore >= 3,
                isChallenge: effectiveScore !== null && effectiveScore <= 2
            };
        });
        return {
            domain: domainKey,
            name: domain.name,
            score: domainScore,
            questions: questionDetails,
            strengths: questionDetails.filter(q => q.isStrength).map(q => q.question),
            challenges: questionDetails.filter(q => q.isChallenge).map(q => q.question)
        };
    });

    // If RAG not configured, use static fallback
    if (!ragApiUrl || !ragApiKey) {
        console.warn('RAG service not configured — using static fallback');
        return buildFallbackAnalysis(scores, interpretation, domainDetails);
    }

    const ragQuery = `Analyze this MIRC-28 recovery capital assessment and provide a comprehensive, ` +
        `actionable interpretation. Overall score: ${scores.percentage}% (${interpretation.level}). ` +
        `Social Capital: ${scores.domains.social.percentage}%, ` +
        `Physical Capital: ${scores.domains.physical.percentage}%, ` +
        `Human Capital: ${scores.domains.human.percentage}%, ` +
        `Cultural Capital: ${scores.domains.cultural.percentage}%.`;

    try {
        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'recovery_capital',
                query: ragQuery,
                context: {
                    participant_name: participantName || 'Self-Assessment',
                    total_score: scores.total,
                    max_score: scores.maxScore,
                    percentage: scores.percentage,
                    interpretation_level: interpretation.level,
                    interpretation_description: interpretation.description,
                    domain_details: domainDetails.map(d => ({
                        domain: d.domain,
                        name: d.name,
                        percentage: d.score.percentage,
                        strengths: d.strengths,
                        challenges: d.challenges,
                    })),
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            throw new Error(errorData.error || `RAG service returned ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();

        let answerText = ragData.answer.trim();
        if (answerText.startsWith('```json')) {
            answerText = answerText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (answerText.startsWith('```')) {
            answerText = answerText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        // sourcesCited is embedded in the analysis JSON by the module config
        // It gets stored in ai_analysis and flows to modal/PDF automatically
        return JSON.parse(answerText);

    } catch (e) {
        console.error('Failed to generate/parse RAG analysis, using fallback:', e);
        return buildFallbackAnalysis(scores, interpretation, domainDetails);
    }
}

// ─── Static fallback ───

function buildFallbackAnalysis(
    scores: Scores,
    interpretation: { level: string; description: string },
    domainDetails: any[]
) {
    return {
        overallSummary: `Your assessment reveals ${interpretation.level.toLowerCase()} with a total score of ${scores.total} out of ${scores.maxScore}. ${interpretation.description}`,
        scoreInterpretation: interpretation,
        domainInsights: domainDetails.map(d => ({
            domain: d.domain,
            domainName: d.name,
            summary: `Your ${d.name.toLowerCase()} score of ${d.score.percentage}% shows ${d.score.percentage >= 50 ? 'developing resources' : 'opportunities for growth'}.`,
            strengths: d.strengths.slice(0, 3),
            growthAreas: d.challenges.slice(0, 3)
        })),
        prioritizedGoals: [],
        immediateActions: [
            "Identify one small step in your lowest-scoring domain",
            "Reach out to one supportive person",
            "Write down three things you're grateful for"
        ],
        weeklyPlan: {
            week1: ["Focus on your most immediate need"],
            week2: ["Build on week 1 progress"],
            week3: ["Add a goal in another domain"],
            week4: ["Review and celebrate progress"]
        },
        encouragement: "Every step forward matters. You've taken an important step by completing this assessment."
    };
}

// ─── POST handler ───

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const body = await request.json();
        const { action, answers, scores, participantName, organization_id, participant_id } = body;

        if (action === 'analyze') {
            const analysis = await generateComprehensiveAnalysis(answers, scores, participantName);

            let assessmentId = null;
            if (session?.user && organization_id) {
                const userResult = await query(
                    'SELECT id FROM users WHERE cognito_sub = $1',
                    [(session.user as any).sub || session.user.id]
                ) as { id: string }[];

                if (userResult.length > 0) {
                    const userId = userResult[0].id;
                    const result = await query(
                        `INSERT INTO recovery_assessments (
                            user_id, organization_id, participant_id, participant_name,
                            assessment_type, total_score, domain_scores, responses, ai_analysis
                        ) VALUES ($1, $2, $3, $4, 'mirc28', $5, $6, $7, $8)
                        RETURNING id`,
                        [
                            userId, organization_id,
                            participant_id || null, participantName || null,
                            scores.total,
                            JSON.stringify(scores.domains),
                            JSON.stringify(answers),
                            JSON.stringify(analysis)
                        ]
                    ) as { id: string }[];
                    assessmentId = result[0]?.id;
                }
            }

            return NextResponse.json({ success: true, analysis, assessmentId });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Comprehensive Assessment API error:', error);
        return NextResponse.json(
            { error: 'Failed to process assessment' },
            { status: 500 }
        );
    }
}
