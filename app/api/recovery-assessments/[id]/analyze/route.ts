// app/api/recovery-assessments/[id]/analyze/route.ts
// AI analysis endpoint for recovery assessments — now via RAG service

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

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
        const maxScore = assessment.assessment_type === 'mirc28' ? 140 : 60;
        const percentage = Math.round((totalScore / maxScore) * 100);

        // Build query and context for RAG
        const query = `Analyze this ${assessment.assessment_type?.toUpperCase() || 'BARC-10'} recovery capital assessment. ` +
            `Total score: ${totalScore}/${maxScore} (${percentage}%). ` +
            `Social Capital: ${domainScores.social?.percentage || domainScores.social || 'N/A'}%, ` +
            `Physical Capital: ${domainScores.physical?.percentage || domainScores.physical || 'N/A'}%, ` +
            `Human Capital: ${domainScores.human?.percentage || domainScores.human || 'N/A'}%, ` +
            `Cultural Capital: ${domainScores.cultural?.percentage || domainScores.cultural || 'N/A'}%.`;

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
                    participant_name: assessment.participant_name || 'Self-Assessment',
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

        // Parse JSON from RAG answer
        let answerText = ragData.answer.trim();
        if (answerText.startsWith('```json')) {
            answerText = answerText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (answerText.startsWith('```')) {
            answerText = answerText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const analysis = JSON.parse(answerText);

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
