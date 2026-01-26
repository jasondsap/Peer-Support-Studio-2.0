import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
});

export async function POST(request: Request) {
    try {
        const { surveyId } = await request.json();

        if (!surveyId) {
            return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
        }

        // Fetch survey with lesson info and all responses
        const { data: survey, error: surveyError } = await supabase
            .from('lesson_surveys')
            .select(`
                *,
                saved_lessons (title, topic),
                survey_responses (*)
            `)
            .eq('id', surveyId)
            .single();

        if (surveyError || !survey) {
            return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
        }

        const responses = survey.survey_responses || [];

        if (responses.length === 0) {
            return NextResponse.json({ 
                error: 'No responses to analyze yet' 
            }, { status: 400 });
        }

        // Calculate statistics
        const stats = {
            totalResponses: responses.length,
            avgHelpful: (responses.reduce((sum: number, r: any) => sum + r.rating_helpful, 0) / responses.length).toFixed(1),
            avgWillUse: (responses.reduce((sum: number, r: any) => sum + r.rating_will_use, 0) / responses.length).toFixed(1),
            avgFacilitator: responses.filter((r: any) => r.rating_facilitator).length > 0
                ? (responses.filter((r: any) => r.rating_facilitator).reduce((sum: number, r: any) => sum + r.rating_facilitator, 0) / responses.filter((r: any) => r.rating_facilitator).length).toFixed(1)
                : null,
            recommendYes: responses.filter((r: any) => r.would_recommend === 'yes').length,
            recommendMaybe: responses.filter((r: any) => r.would_recommend === 'maybe').length,
            recommendNo: responses.filter((r: any) => r.would_recommend === 'no').length
        };

        // Collect qualitative feedback
        const valuableFeedback: string[] = responses.map((r: any) => r.most_valuable).filter(Boolean);
        const improvementFeedback: string[] = responses.map((r: any) => r.improvements).filter(Boolean);
        const additionalFeedback: string[] = responses.map((r: any) => r.additional_feedback).filter(Boolean);

        // Generate AI analysis
        const prompt = `You are analyzing feedback from a peer support group session. Provide helpful insights for the peer support specialist.

SESSION INFORMATION:
- Lesson Title: ${survey.saved_lessons?.title || 'Peer Support Session'}
- Topic: ${survey.saved_lessons?.topic || 'Not specified'}
- Number of Responses: ${stats.totalResponses}

QUANTITATIVE RATINGS (1-5 scale):
- Average "How helpful was the session?": ${stats.avgHelpful}/5
- Average "How likely to use what learned?": ${stats.avgWillUse}/5
${stats.avgFacilitator ? `- Average facilitator rating: ${stats.avgFacilitator}/5` : ''}

RECOMMENDATION:
- Would recommend: Yes (${stats.recommendYes}), Maybe (${stats.recommendMaybe}), No (${stats.recommendNo})

QUALITATIVE FEEDBACK:

What participants found most valuable:
${valuableFeedback.length > 0 ? valuableFeedback.map(f => `- "${f}"`).join('\n') : '(No responses)'}

Suggested improvements:
${improvementFeedback.length > 0 ? improvementFeedback.map(f => `- "${f}"`).join('\n') : '(No responses)'}

Additional comments:
${additionalFeedback.length > 0 ? additionalFeedback.map(f => `- "${f}"`).join('\n') : '(No responses)'}

Please provide:

1. **Summary** (2-3 sentences): Overall assessment of how the session was received.

2. **Key Strengths** (3-4 bullet points): What worked well based on feedback.

3. **Areas for Growth** (2-3 bullet points): Constructive suggestions for improvement.

4. **Participant Insights** (2-3 bullet points): Notable patterns or themes in the feedback.

5. **Action Items** (2-3 specific, actionable recommendations): What the peer specialist could do differently next time.

Keep the tone supportive and constructive - this is meant to help the peer specialist grow professionally. Focus on actionable insights.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert in peer support training and professional development. Provide constructive, actionable feedback analysis.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        const analysisText = completion.choices[0]?.message?.content || '';

        // Parse the analysis into structured sections
        const analysis = {
            generatedAt: new Date().toISOString(),
            statistics: stats,
            insights: analysisText,
            rawFeedback: {
                valuable: valuableFeedback,
                improvements: improvementFeedback,
                additional: additionalFeedback
            }
        };

        // Save analysis to survey
        const { error: updateError } = await supabase
            .from('lesson_surveys')
            .update({ analysis })
            .eq('id', surveyId);

        if (updateError) {
            console.error('Failed to save analysis:', updateError);
        }

        return NextResponse.json({ analysis });

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to generate analysis' },
            { status: 500 }
        );
    }
}
