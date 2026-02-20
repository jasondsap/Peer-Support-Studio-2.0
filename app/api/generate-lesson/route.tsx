import { NextResponse } from 'next/server';

// Setting descriptions — kept here to build human-readable context
// for the RAG query. These are UI labels, not domain knowledge.
const settingDescriptions: Record<string, string> = {
    'outpatient': 'outpatient treatment setting',
    'residential': 'residential treatment facility',
    'jail': 'jail or correctional facility',
    'hospital': 'hospital or inpatient psychiatric unit',
    'outreach': 'community outreach or field-based setting',
    'dual-diagnosis': 'dual diagnosis program (co-occurring mental health and substance use)',
    'mh-only': 'mental health only program',
    'youth': 'youth or adolescent program',
    'therapeutic-rehab': 'therapeutic rehabilitative program for individuals with intellectual disabilities'
};

const compositionDescriptions: Record<string, string> = {
    'mixed': 'mixed gender/co-ed group',
    'male': 'male-only group',
    'female': 'female-only group'
};

export async function POST(request: Request) {
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
            topic,
            sessionType,
            groupSize,
            sessionLength,
            recoveryModel,
            settingType,
            groupComposition
        } = await request.json();

        console.log('Generating lesson for topic:', topic, 'Type:', sessionType);

        const isIndividual = sessionType === 'individual';
        const settingLabel = settingDescriptions[settingType] || settingType;
        const compositionLabel = compositionDescriptions[groupComposition] || groupComposition;

        // Build a clear query for the RAG system
        const query = isIndividual
            ? `Create an individual one-on-one peer support session guide about: ${topic}. Setting: ${settingLabel}. Duration: ${sessionLength} minutes.`
            : `Create a group peer support lesson plan about: ${topic}. Setting: ${settingLabel}. Group: ${compositionLabel}, ${groupSize} people. Duration: ${sessionLength} minutes.`;

        // Call the RAG service
        const ragResponse = await fetch(ragApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ragApiKey,
            },
            body: JSON.stringify({
                module: 'lesson_builder',
                query,
                context: {
                    topic,
                    session_type: sessionType,
                    session_length: sessionLength,
                    recovery_model: recoveryModel,
                    setting_type: settingType,
                    setting_description: settingLabel,
                    group_size: isIndividual ? null : groupSize,
                    group_composition: isIndividual ? null : compositionLabel,
                },
            }),
        });

        if (!ragResponse.ok) {
            const errorData = await ragResponse.json().catch(() => ({}));
            console.error('RAG service error:', ragResponse.status, errorData);
            throw new Error(errorData.error || `RAG service returned ${ragResponse.status}`);
        }

        const ragData = await ragResponse.json();

        // Parse the lesson plan JSON from the RAG answer
        let lessonPlan;
        try {
            let answerText = ragData.answer.trim();

            // Strip markdown fences if present
            if (answerText.startsWith('```json')) {
                answerText = answerText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (answerText.startsWith('```')) {
                answerText = answerText.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            lessonPlan = JSON.parse(answerText);
        } catch (parseError) {
            console.error('Failed to parse lesson JSON from RAG:', parseError);
            console.error('Raw answer:', ragData.answer?.substring(0, 500));
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        // Return the same shape the frontend expects
        // sources is a new bonus field — frontend can use it or ignore it
        return NextResponse.json({
            lessonPlan,
            sources: ragData.sources || [],
        });

    } catch (error) {
        console.error('Error generating lesson:', error);
        return NextResponse.json(
            { error: `Failed to generate lesson plan: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
