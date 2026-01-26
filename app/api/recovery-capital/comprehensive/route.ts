import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import OpenAI from 'openai';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// MIRC-28 Domain structure
const DOMAINS = {
    social: {
        name: "Social Capital",
        questions: [1, 2, 3, 4, 5, 6, 7],
        reverseScored: [2, 5, 6]
    },
    physical: {
        name: "Physical Capital",
        questions: [8, 9, 10, 11, 12, 13, 14],
        reverseScored: [9, 10, 12]
    },
    human: {
        name: "Human Capital",
        questions: [15, 16, 17, 18, 19, 20, 21],
        reverseScored: [16, 17, 18]
    },
    cultural: {
        name: "Cultural Capital",
        questions: [22, 23, 24, 25, 26, 27, 28],
        reverseScored: [23, 25]
    }
};

const QUESTION_TEXT: { [key: number]: string } = {
    1: "I actively support other people who are in recovery.",
    2: "My family makes my recovery more difficult.",
    3: "I have at least one friend who supports my recovery.",
    4: "My family supports my recovery.",
    5: "Some people in my life do not think I'll make it in my recovery.",
    6: "I feel alone.",
    7: "I feel like I'm part of a recovery community.",
    8: "My housing situation is helpful for my recovery.",
    9: "I have difficulty getting transportation.",
    10: "My housing situation is unstable.",
    11: "I have enough money every week to buy the basic things I need.",
    12: "Not having enough money makes my recovery more difficult.",
    13: "I can afford the care I need for my health, mental health, and recovery.",
    14: "I have reliable access to a phone and the internet.",
    15: "I am hopeful about my future.",
    16: "I have difficulty managing stress.",
    17: "My physical health makes my recovery more difficult.",
    18: "I struggle with my mental health.",
    19: "I have the skills to cope with challenges in my recovery.",
    20: "I am motivated to continue my recovery.",
    21: "I feel good about myself.",
    22: "I know where to go in my community if I need help with my recovery.",
    23: "My community has limited resources for people in recovery.",
    24: "I participate in activities that give my life meaning.",
    25: "I lack access to recovery support services in my community.",
    26: "My cultural or spiritual beliefs support my recovery.",
    27: "I have a sense of purpose in my life.",
    28: "I feel connected to my community."
};

interface Answers {
    [key: string]: number;
}

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

async function generateComprehensiveAnalysis(
    answers: Answers, 
    scores: Scores, 
    participantName?: string
) {
    const interpretation = getScoreInterpretation(scores.percentage);

    const domainDetails = Object.entries(DOMAINS).map(([domainKey, domain]) => {
        const domainScore = scores.domains[domainKey as keyof typeof scores.domains];
        const questionDetails = domain.questions.map(qNum => {
            const rawAnswer = answers[`q${qNum}`] || 2;
            const isReverse = domain.reverseScored.includes(qNum);
            const effectiveScore = isReverse ? (5 - rawAnswer) : rawAnswer;
            return {
                question: QUESTION_TEXT[qNum],
                rawAnswer,
                effectiveScore,
                isReverse,
                isStrength: effectiveScore >= 3,
                isChallenge: effectiveScore <= 2
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

    const systemPrompt = `You are a Recovery Capital Coach providing comprehensive analysis for a 28-item MIRC assessment inside "Peer Support Studio", a digital workspace for Peer Support Specialists.

ASSESSMENT RESULTS:
${participantName ? `Participant: ${participantName}` : 'Self-Assessment'}

OVERALL:
- Total Score: ${scores.total}/${scores.maxScore} (${scores.percentage}%)
- Level: ${interpretation.level}

DOMAIN BREAKDOWN:
${domainDetails.map(d => `
${d.name.toUpperCase()} (${d.score.percentage}%):
Strengths: ${d.strengths.length > 0 ? d.strengths.join('; ') : '(none at highest levels)'}
Challenges: ${d.challenges.length > 0 ? d.challenges.join('; ') : '(none at lowest levels)'}
`).join('\n')}

Create a comprehensive, actionable analysis. Return ONLY valid JSON:

{
    "overallSummary": "3-4 sentences summarizing the full recovery capital profile.",
    "scoreInterpretation": {
        "level": "${interpretation.level}",
        "description": "2-3 sentences interpreting what this score means."
    },
    "domainInsights": [
        {
            "domain": "social",
            "domainName": "Social Capital",
            "summary": "2-3 sentences analyzing their social capital.",
            "strengths": ["Specific strength 1", "Strength 2"],
            "growthAreas": ["Growth area 1", "Growth area 2"]
        }
    ],
    "prioritizedGoals": [
        {
            "domain": "domain name",
            "title": "Clear, actionable goal title",
            "description": "2-3 sentences describing the goal",
            "actionSteps": ["Step 1", "Step 2", "Step 3"],
            "whyItMatters": "1-2 sentences connecting this goal to recovery capital",
            "priority": "high|medium|low"
        }
    ],
    "immediateActions": ["Action 1", "Action 2", "Action 3"],
    "weeklyPlan": {
        "week1": ["Focus area 1", "Action"],
        "week2": ["Build on week 1"],
        "week3": ["Expand efforts"],
        "week4": ["Consolidate gains"]
    },
    "encouragement": "3-4 sentences of personalized encouragement."
}

Be warm, hopeful, and specific. Use peer support language throughout.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Generate the comprehensive recovery capital analysis.' }
            ],
            max_tokens: 3500,
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';
        let cleanContent = content.trim();
        
        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        return JSON.parse(cleanContent);
    } catch (e) {
        console.error('Failed to generate/parse AI analysis:', e);
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
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        const body = await request.json();
        const { action, answers, scores, participantName, organization_id, participant_id } = body;

        if (action === 'analyze') {
            const analysis = await generateComprehensiveAnalysis(answers, scores, participantName);

            // Save to database if user is authenticated and org provided
            let assessmentId = null;
            if (session?.user && organization_id) {
                const userResult = await query(
                    'SELECT id FROM users WHERE cognito_sub = $1',
                    [(session.user as any).sub || session.user.id]
                );

                if (userResult.rows.length > 0) {
                    const userId = userResult.rows[0].id;
                    
                    const result = await query(
                        `INSERT INTO recovery_assessments (
                            user_id, organization_id, participant_id, participant_name,
                            assessment_type, total_score, domain_scores, responses, ai_analysis
                        ) VALUES ($1, $2, $3, $4, 'mirc28', $5, $6, $7, $8)
                        RETURNING id`,
                        [
                            userId,
                            organization_id,
                            participant_id || null,
                            participantName || null,
                            scores.total,
                            JSON.stringify(scores.domains),
                            JSON.stringify(answers),
                            JSON.stringify(analysis)
                        ]
                    );
                    
                    assessmentId = result.rows[0]?.id;
                }
            }

            return NextResponse.json({
                success: true,
                analysis,
                assessmentId
            });
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
