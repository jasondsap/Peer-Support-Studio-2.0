// app/api/assessment-invitations/submit/route.ts
// PUBLIC API - No auth required
// Used by participant app to submit completed assessments

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            token,
            answers,
            totalScore,
            maxScore,
            percentage,
            domainScores,
        } = body;

        // Validate required fields
        if (!token || !answers || totalScore === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Look up invitation
        const invitationResult = await sql`
            SELECT 
                ai.*,
                p.first_name as participant_first_name,
                p.last_name as participant_last_name,
                p.preferred_name as participant_preferred_name
            FROM assessment_invitations ai
            JOIN participants p ON ai.participant_id = p.id
            WHERE ai.token = ${token.toUpperCase()}
        `;

        if (!invitationResult || invitationResult.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Invalid invitation token' },
                { status: 404 }
            );
        }

        const invitation = invitationResult[0];

        // Validate invitation status
        if (invitation.status !== 'pending') {
            return NextResponse.json(
                { success: false, error: 'This invitation is no longer active' },
                { status: 410 }
            );
        }

        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
            return NextResponse.json(
                { success: false, error: 'This invitation has expired' },
                { status: 410 }
            );
        }

        // Construct participant name for display
        const participantName = invitation.participant_preferred_name 
            || invitation.participant_first_name 
            || 'Participant';

        // Create the assessment record
        const assessmentResult = await sql`
            INSERT INTO recovery_assessments (
                user_id,
                organization_id,
                participant_id,
                invitation_id,
                participant_name,
                assessment_type,
                total_score,
                domain_scores,
                responses,
                notes
            ) VALUES (
                ${invitation.created_by},
                ${invitation.organization_id},
                ${invitation.participant_id},
                ${invitation.id},
                ${participantName},
                ${invitation.assessment_type},
                ${totalScore},
                ${JSON.stringify(domainScores)},
                ${JSON.stringify(answers)},
                ${'Submitted via participant app'}
            )
            RETURNING id
        `;

        const assessmentId = assessmentResult[0].id;

        // Mark invitation as completed
        await sql`
            UPDATE assessment_invitations
            SET 
                status = 'completed',
                completed_at = NOW(),
                assessment_id = ${assessmentId},
                updated_at = NOW()
            WHERE id = ${invitation.id}
        `;

        return NextResponse.json({
            success: true,
            assessmentId,
            message: 'Assessment submitted successfully',
            scores: {
                total: totalScore,
                max: maxScore,
                percentage,
                domains: domainScores,
            },
        });

    } catch (error) {
        console.error('Assessment submit error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to submit assessment' },
            { status: 500 }
        );
    }
}
