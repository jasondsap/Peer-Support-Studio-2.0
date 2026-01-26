// app/api/recovery-assessments/[id]/analyze/route.ts
// AI analysis endpoint for recovery assessments

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL!);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        const maxScore = assessment.assessment_type === 'mirc28' ? 140 : 60;
        const percentage = Math.round((totalScore / maxScore) * 100);

        // Build prompt for AI analysis
        const prompt = `You are a recovery capital assessment analyst helping peer support specialists understand their participants' recovery resources.

Assessment Type: ${assessment.assessment_type?.toUpperCase() || 'BARC-10'}
Total Score: ${totalScore}/${maxScore} (${percentage}%)

Domain Scores:
- Social Capital: ${domainScores.social?.percentage || domainScores.social || 'N/A'}%
- Physical Capital: ${domainScores.physical?.percentage || domainScores.physical || 'N/A'}%
- Human Capital: ${domainScores.human?.percentage || domainScores.human || 'N/A'}%
- Cultural Capital: ${domainScores.cultural?.percentage || domainScores.cultural || 'N/A'}%

Participant Responses:
${JSON.stringify(responses, null, 2)}

Please provide a comprehensive analysis in the following JSON format:
{
    "overallSummary": "2-3 sentence summary of overall recovery capital strength",
    "strengthsHighlight": {
        "title": "Key Strengths",
        "items": ["strength 1", "strength 2", "strength 3"]
    },
    "growthOpportunities": {
        "title": "Growth Opportunities", 
        "items": ["opportunity 1", "opportunity 2", "opportunity 3"]
    },
    "recommendedGoals": [
        {
            "domain": "domain name",
            "title": "Goal title",
            "description": "Why this goal matters",
            "actionSteps": ["step 1", "step 2", "step 3"],
            "whyItMatters": "Connection to recovery"
        }
    ],
    "weeklyChallenge": {
        "title": "This Week's Challenge",
        "description": "A specific, achievable challenge for this week",
        "domain": "related domain"
    },
    "encouragement": "A brief, personalized encouraging message"
}

Focus on strengths-based language and practical, achievable goals. Keep recommendations specific and actionable.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const analysisContent = completion.choices[0]?.message?.content;
        if (!analysisContent) {
            return NextResponse.json({ error: 'No analysis generated' }, { status: 500 });
        }

        const analysis = JSON.parse(analysisContent);

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
