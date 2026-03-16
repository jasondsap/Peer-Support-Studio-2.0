// ============================================================================
// /api/generate-lesson/route.ts — Streaming version
//
// Sends keep-alive pings every 5 seconds while waiting for the RAG service,
// then flushes the full lesson JSON. This prevents Amplify's SSR Lambda
// timeout (~30 s) from killing the connection before the response arrives.
//
// Wire format (newline-delimited):
//   {"type":"ping"}                        ← heartbeat
//   {"type":"status","message":"..."}      ← optional progress update
//   {"type":"result","lessonPlan":{...},"sources":[...]}   ← final payload
//   {"type":"error","message":"..."}       ← on failure
// ============================================================================

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
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Helper: push a JSON line to the stream
            const send = (obj: Record<string, any>) => {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
            };

            // Keep-alive: ping every 5 s so the connection stays open
            const pingInterval = setInterval(() => {
                try {
                    send({ type: 'ping' });
                } catch {
                    clearInterval(pingInterval);
                }
            }, 5000);

            try {
                const ragApiUrl = process.env.RAG_API_URL;
                const ragApiKey = process.env.RAG_API_KEY;

                if (!ragApiUrl || !ragApiKey) {
                    console.error('RAG_API_URL or RAG_API_KEY is not set');
                    send({ type: 'error', message: 'RAG service not configured' });
                    controller.close();
                    clearInterval(pingInterval);
                    return;
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

                // Send an initial status so the frontend knows we're working
                send({ type: 'status', message: 'Searching knowledge base...' });

                // Call the RAG service (this is the slow part — 20-40+ seconds)
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

                send({ type: 'status', message: 'Building your lesson plan...' });

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
                    throw new Error('Failed to parse AI response');
                }

                // Send the final result
                send({
                    type: 'result',
                    lessonPlan,
                    sources: ragData.sources || [],
                });

            } catch (error) {
                console.error('Error generating lesson:', error);
                send({
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            } finally {
                clearInterval(pingInterval);
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Transfer-Encoding': 'chunked',
        },
    });
}
