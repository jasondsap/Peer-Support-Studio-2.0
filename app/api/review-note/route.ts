import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
});

// The rubric criteria embedded as system context
const RUBRIC_SYSTEM_PROMPT = `You are an expert peer support documentation auditor. You review session notes against the official Peer Support Note Rubric used by auditors to determine billing compliance.

## SCORING RUBRIC

Each category is scored 0, 1, or 2 points. Maximum total: 16 points.

### 1. PROFESSIONALISM (spelling, grammar, word choice)
- 0 points: Significant errors (over 3) OR significant judgment of client/client's actions
- 1 point: 2-3 spelling/grammar errors OR opinions used instead of objective statements
- 2 points: 0-1 spelling/grammar errors AND no personal opinions present

### 2. DESCRIPTION OF SESSION (symptoms/concerns reported)
- 0 points: Section left blank or missing
- 1 point: Needs additional detail (minimal symptoms documented) OR only documented type of session
- 2 points: Meets medical necessity by detailed documenting of symptoms/issues reported in session, or gives detail of group discussion

### 3. INTERVENTIONS USED DURING SESSION
- 0 points: Section missing OR no interventions are marked as used
- 1 point: N/A (this category only has 0 or 2)
- 2 points: Interventions used during session are clearly marked/documented

### 4. SOCIAL/EMOTIONAL SUPPORT PROVIDED
- 0 points: Section missing or left blank
- 1 point: Documents an overly vague support (i.e., "support provided") but needs more detail
- 2 points: Clearly documents and describes the social support provided

### 5. CLIENT'S RESPONSE TO SERVICES
- 0 points: Section missing or left blank
- 1 point: Documents an overly vague response (i.e., "client did well") and needs more detail
- 2 points: Clearly documents client's response using quotations, documents client's behavior or attitude

### 6. CLIENT'S PARTICIPATION
- 0 points: N/A (this category only has 1 or 2)
- 1 point: Section missing or nothing is marked in this area
- 2 points: Client's level of participation clearly marked

### 7. CLIENT'S MOTIVATION
- 0 points: N/A (this category only has 1 or 2)
- 1 point: Section missing or nothing is marked in this area
- 2 points: Client's level of motivation clearly marked

### 8. TREATMENT PLAN
- 0 points: TP missing, or if interim plan is in place, this is not documented in the note
- 1 point: Some portion of treatment plan is attached but missing a component (Problem/Goal attached but objective/intervention not) OR PSS has not signed the PCRP signature page
- 2 points: TP attached and the attached portion is relevant to peer support services

## QUALITY SCORE DETERMINATION

Based on total points:
- SCORE 1 (Not Billable): 9 points or below, OR more than two billing components missing, OR more than two components do not meet medical necessity
- SCORE 2 (Not Billable): 10-12 points, OR missing two billing components, OR two or more components do not meet medical necessity
- SCORE 3 (Mostly Billable): 13-14 points, OR missing TP or one billable component, OR one billing component does not meet medical necessity
- SCORE 4 (Billable): 15 points, one section needs elaboration, or note heading needs to be edited
- SCORE 5 (Billable AND meets medical necessity): 16 points

## YOUR TASK

Analyze the provided session note and:
1. Score each of the 8 categories (0, 1, or 2 points)
2. Calculate total points and quality score (1-5)
3. Determine if billable (scores 3-5) or not billable (scores 1-2)
4. For any category scoring less than 2, provide specific feedback on what's missing
5. Provide a suggested rewrite that would score full points

Respond ONLY with valid JSON in this exact format:
{
    "scores": {
        "professionalism": <0|1|2>,
        "description": <0|1|2>,
        "interventions": <0|1|2>,
        "socialSupport": <0|1|2>,
        "clientResponse": <0|1|2>,
        "participation": <0|1|2>,
        "motivation": <0|1|2>,
        "treatmentPlan": <0|1|2>
    },
    "totalPoints": <0-16>,
    "qualityScore": <1-5>,
    "isBillable": <true|false>,
    "feedback": {
        "professionalism": {
            "score": <0|1|2>,
            "issue": "<specific issue or null if score is 2>",
            "suggestion": "<specific suggestion or null if score is 2>",
            "originalText": "<relevant excerpt from note>",
            "improvedText": "<improved version or null if score is 2>"
        },
        "description": { ... same structure ... },
        "interventions": { ... same structure ... },
        "socialSupport": { ... same structure ... },
        "clientResponse": { ... same structure ... },
        "participation": { ... same structure ... },
        "motivation": { ... same structure ... },
        "treatmentPlan": { ... same structure ... }
    },
    "summary": "<1-2 sentence overall assessment>",
    "improvedNote": "<complete rewritten version of the note that would score 16/16>"
}`;

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { noteText, saveReview = true } = await request.json();

        if (!noteText || noteText.trim().length < 50) {
            return NextResponse.json(
                { error: 'Please provide a complete session note (at least 50 characters)' },
                { status: 400 }
            );
        }

        // Call OpenAI to analyze the note
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: RUBRIC_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: `Please analyze this peer support session note against the rubric:\n\n${noteText}`
                }
            ],
            temperature: 0.3, // Lower temperature for more consistent scoring
            max_tokens: 3000,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0]?.message?.content || '';
        
        let analysis;
        try {
            analysis = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            return NextResponse.json(
                { error: 'Failed to analyze note. Please try again.' },
                { status: 500 }
            );
        }

        // Validate the response structure
        if (!analysis.scores || !analysis.feedback || typeof analysis.qualityScore !== 'number') {
            console.error('Invalid AI response structure:', analysis);
            return NextResponse.json(
                { error: 'Invalid analysis response. Please try again.' },
                { status: 500 }
            );
        }

        // Save the review if requested
        let savedReviewId = null;
        if (saveReview) {
            try {
                // Get internal user ID from Cognito sub
                const userId = await getInternalUserId(session.user.id, session.user.email);
                
                if (userId) {
                    const result = await sql`
                        INSERT INTO note_reviews (
                            user_id,
                            original_note,
                            quality_score,
                            total_points,
                            is_billable,
                            score_professionalism,
                            score_description,
                            score_interventions,
                            score_social_support,
                            score_client_response,
                            score_participation,
                            score_motivation,
                            score_treatment_plan,
                            feedback,
                            improved_note
                        ) VALUES (
                            ${userId}::uuid,
                            ${noteText},
                            ${analysis.qualityScore},
                            ${analysis.totalPoints},
                            ${analysis.isBillable},
                            ${analysis.scores.professionalism},
                            ${analysis.scores.description},
                            ${analysis.scores.interventions},
                            ${analysis.scores.socialSupport},
                            ${analysis.scores.clientResponse},
                            ${analysis.scores.participation},
                            ${analysis.scores.motivation},
                            ${analysis.scores.treatmentPlan},
                            ${JSON.stringify(analysis.feedback)},
                            ${analysis.improvedNote}
                        )
                        RETURNING id
                    `;
                    savedReviewId = result[0]?.id;
                }
            } catch (saveError) {
                console.error('Failed to save review:', saveError);
                // Don't fail the request, just log the error
            }
        }

        return NextResponse.json({
            ...analysis,
            reviewId: savedReviewId
        });

    } catch (error) {
        console.error('Note review error:', error);
        return NextResponse.json(
            { error: 'Failed to review note. Please try again.' },
            { status: 500 }
        );
    }
}

// GET - Fetch user's review history
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID from Cognito sub
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const reviewId = searchParams.get('reviewId');
        const limit = parseInt(searchParams.get('limit') || '10');

        // Fetch single review by ID
        if (reviewId) {
            const reviews = await sql`
                SELECT * FROM note_reviews
                WHERE id = ${reviewId}::uuid
                AND user_id = ${userId}::uuid
            `;

            if (reviews.length === 0) {
                return NextResponse.json({ error: 'Review not found' }, { status: 404 });
            }

            return NextResponse.json(reviews[0]);
        }

        // Fetch user's review history
        const reviews = await sql`
            SELECT * FROM note_reviews
            WHERE user_id = ${userId}::uuid
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        // Calculate user stats
        const statsResult = await sql`
            SELECT 
                COUNT(*)::int as total_reviews,
                ROUND(AVG(quality_score)::numeric, 1) as avg_quality_score,
                ROUND(AVG(total_points)::numeric, 1) as avg_total_points,
                COUNT(*) FILTER (WHERE is_billable = true)::int as billable_count,
                COUNT(*) FILTER (WHERE is_billable = false)::int as not_billable_count
            FROM note_reviews
            WHERE user_id = ${userId}::uuid
        `;

        return NextResponse.json({
            reviews: reviews || [],
            stats: statsResult[0] || null
        });

    } catch (error) {
        console.error('GET reviews error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reviews' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a review
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID from Cognito sub
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const reviewId = searchParams.get('reviewId');

        if (!reviewId) {
            return NextResponse.json({ error: 'reviewId required' }, { status: 400 });
        }

        // Delete only if it belongs to this user
        await sql`
            DELETE FROM note_reviews
            WHERE id = ${reviewId}::uuid
            AND user_id = ${userId}::uuid
        `;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('DELETE review error:', error);
        return NextResponse.json(
            { error: 'Failed to delete review' },
            { status: 500 }
        );
    }
}
