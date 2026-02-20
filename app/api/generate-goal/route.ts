import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const ragApiUrl = process.env.RAG_API_URL;
        const ragApiKey = process.env.RAG_API_KEY;

        if (!ragApiUrl || !ragApiKey) {
            console.error('RAG_API_URL or RAG_API_KEY is not set');
            return NextResponse.json(
                { error: 'RAG service not configured' },
                { status: 500 }
            );
        }

        const {
            goalArea,
            participantName,
            desiredOutcome,
            motivation,
            strengths,
            challenges,
            timeframe,
        } = await req.json();

        console.log('Generating goal for:', participantName, 'Area:', goalArea);

        // Build a clear query for the RAG system
        const query = `Generate a comprehensive SMART recovery goal plan for ${goalArea}. ` +
            `The participant wants to: ${desiredOutcome}. ` +
            `Timeframe: ${timeframe} days. ` +
            `Strengths: ${strengths.join(', ')}. ` +
            `Challenges: ${challenges.join(', ')}.`;

        // Call the RAG service
        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'goal_generator',
                query,
                context: {
                    participant_name: participantName,
                    goal_area: goalArea,
                    desired_outcome: desiredOutcome,
                    motivation,
                    strengths,
                    challenges,
                    timeframe,
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            throw new Error(errorData.error || `RAG service returned ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();

        // Parse the goal JSON from the RAG answer
        let goal;
        try {
            let answerText = ragData.answer.trim();

            // Strip markdown fences if present
            if (answerText.startsWith('```json')) {
                answerText = answerText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (answerText.startsWith('```')) {
                answerText = answerText.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            goal = JSON.parse(answerText);
        } catch (parseError) {
            console.error('Failed to parse goal JSON from RAG:', parseError);
            console.error('Raw answer:', ragData.answer?.substring(0, 500));
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        // Return the same shape the frontend expects
        return NextResponse.json({
            goal,
            sources: ragData.sources || [],
        });

    } catch (error) {
        console.error('Error generating goal:', error);
        return NextResponse.json(
            { error: `Failed to generate goal: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
