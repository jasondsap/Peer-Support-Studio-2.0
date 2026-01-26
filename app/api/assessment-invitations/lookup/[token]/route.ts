// app/api/assessment-invitations/lookup/[token]/route.ts
// PUBLIC API - No auth required
// Used by participant app to look up invitation details

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    try {
        const { token } = params;

        if (!token || token.length < 6) {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 400 }
            );
        }

        // Look up invitation with participant and PSS info
        const result = await sql`
            SELECT 
                ai.id,
                ai.token,
                ai.assessment_type,
                ai.status,
                ai.message,
                ai.expires_at,
                ai.created_at,
                ai.organization_id,
                ai.participant_id,
                p.first_name as participant_first_name,
                p.last_name as participant_last_name,
                p.preferred_name as participant_preferred_name,
                u.first_name as pss_first_name,
                u.last_name as pss_last_name,
                o.name as organization_name
            FROM assessment_invitations ai
            JOIN participants p ON ai.participant_id = p.id
            JOIN users u ON ai.created_by = u.id
            JOIN organizations o ON ai.organization_id = o.id
            WHERE ai.token = ${token.toUpperCase()}
        `;

        if (!result || result.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Invitation not found' },
                { status: 404 }
            );
        }

        const invitation = result[0];

        // Check if expired
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
            return NextResponse.json({
                success: false,
                error: 'This assessment link has expired. Please contact your peer support specialist for a new link.',
                expired: true,
            }, { status: 410 });
        }

        // Check if already completed
        if (invitation.status === 'completed') {
            return NextResponse.json({
                success: false,
                error: 'This assessment has already been completed.',
                completed: true,
            }, { status: 410 });
        }

        // Check if cancelled
        if (invitation.status === 'cancelled') {
            return NextResponse.json({
                success: false,
                error: 'This assessment link is no longer active.',
                cancelled: true,
            }, { status: 410 });
        }

        // Return invitation details (safe for participant to see)
        return NextResponse.json({
            success: true,
            invitation: {
                id: invitation.id,
                token: invitation.token,
                assessment_type: invitation.assessment_type,
                message: invitation.message,
                participant: {
                    id: invitation.participant_id,
                    first_name: invitation.participant_first_name,
                    last_name: invitation.participant_last_name,
                    preferred_name: invitation.participant_preferred_name,
                    display_name: invitation.participant_preferred_name || invitation.participant_first_name,
                },
                specialist: {
                    first_name: invitation.pss_first_name,
                    last_name: invitation.pss_last_name,
                    full_name: `${invitation.pss_first_name} ${invitation.pss_last_name}`,
                },
                organization: {
                    id: invitation.organization_id,
                    name: invitation.organization_name,
                },
            },
        });

    } catch (error) {
        console.error('Invitation lookup error:', error);
        return NextResponse.json(
            { success: false, error: 'Unable to load invitation' },
            { status: 500 }
        );
    }
}
