import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';

const SUPERVISOR_ROLES = ['supervisor', 'admin', 'owner'];

// GET - Fetch all session notes for the current user
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

        // Get query params for filtering
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const source = searchParams.get('source'); // Filter by source (manual, recording, dictation, upload)
        const participantId = searchParams.get('participantId');
        const reviewStatus = searchParams.get('review_status'); // draft|submitted|approved|changes_requested
        const scope = searchParams.get('scope'); // 'team' to list org-wide notes (supervisors+)
        const orgIdParam = searchParams.get('organization_id');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Determine the scope of the query. Default is the caller's own notes.
        // 'team' scope lists every note in the org, but ONLY for supervisors+.
        let teamOrgId: string | null = null;
        if (scope === 'team') {
            const orgId = orgIdParam || (session as any).currentOrganization?.id || null;
            const orgRole = orgId
                ? session.organizations?.find((o) => o.id === orgId)?.role
                : undefined;
            if (orgId && orgRole && SUPERVISOR_ROLES.includes(orgRole)) {
                teamOrgId = orgId;
            }
            // Plain PSS (or no org match) silently fall back to their own notes —
            // never weaken the org guard.
        }

        // Build a parameterized WHERE clause dynamically.
        const where: string[] = ['sn.is_archived = false'];
        const queryParams: unknown[] = [];

        if (teamOrgId) {
            queryParams.push(teamOrgId);
            where.push(`sn.organization_id = $${queryParams.length}::uuid`);
        } else {
            queryParams.push(userId);
            where.push(`sn.user_id = $${queryParams.length}::uuid`);
        }

        if (status) {
            queryParams.push(status);
            where.push(`sn.status = $${queryParams.length}`);
        }
        if (reviewStatus) {
            queryParams.push(reviewStatus);
            where.push(`sn.review_status = $${queryParams.length}`);
        }
        if (participantId) {
            queryParams.push(participantId);
            where.push(`sn.participant_id = $${queryParams.length}::uuid`);
        }
        if (source) {
            queryParams.push(source);
            where.push(`sn.source = $${queryParams.length}`);
        }

        const whereClause = where.join(' AND ');

        const listParams = [...queryParams];
        listParams.push(limit);
        const limitIdx = listParams.length;
        listParams.push(offset);
        const offsetIdx = listParams.length;

        const notes = await sql(
            `SELECT
                sn.id,
                sn.user_id,
                sn.organization_id,
                sn.participant_id,
                sn.metadata,
                sn.pss_note,
                sn.pss_summary,
                sn.participant_summary,
                sn.source,
                sn.status,
                sn.review_status,
                sn.is_locked,
                sn.submitted_at,
                sn.reviewed_at,
                sn.last_review_score,
                sn.last_review_billable,
                sn.created_at,
                sn.updated_at,
                p.first_name || ' ' || p.last_name as participant_name,
                u.first_name || ' ' || u.last_name as author_name
            FROM session_notes sn
            LEFT JOIN participants p ON sn.participant_id = p.id
            LEFT JOIN users u ON sn.user_id = u.id
            WHERE ${whereClause}
            ORDER BY sn.created_at DESC
            LIMIT $${limitIdx}
            OFFSET $${offsetIdx}`,
            listParams
        );

        // Get total count for pagination (same filters, no limit/offset)
        const countResult = await sql(
            `SELECT COUNT(*) as total FROM session_notes sn WHERE ${whereClause}`,
            queryParams
        );

        return NextResponse.json({
            notes,
            pagination: {
                total: parseInt(countResult[0]?.total || '0'),
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Error fetching session notes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session notes' },
            { status: 500 }
        );
    }
}

// POST - Create a new session note
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get internal user ID
        const userId = await getInternalUserId(session.user.id, session.user.email);
        
        if (!userId) {
            return NextResponse.json(
                { error: 'User not found in database' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const {
            metadata,
            pss_note,
            pss_summary,
            participant_summary,
            transcript,
            source = 'manual',
            organization_id,
            participant_id,
            pss_coaching,
            conversation_analysis,
            clinical_data, // For manual notes - stores full clinical template data
        } = body;

        // Validate required fields
        if (!metadata) {
            return NextResponse.json(
                { error: 'metadata is required' },
                { status: 400 }
            );
        }

        // Server-side billing guard: a saved note must carry at least one
        // populated body field. (Client validation is not authoritative.)
        const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
        const pssNoteHasContent =
            pss_note && typeof pss_note === 'object' &&
            Object.values(pss_note).some((v) =>
                Array.isArray(v) ? v.length > 0 : hasText(v)
            );
        const hasBody =
            pssNoteHasContent ||
            hasText(pss_summary) ||
            hasText(participant_summary) ||
            hasText(transcript) ||
            !!clinical_data;

        if (!hasBody) {
            return NextResponse.json(
                { error: 'A note must include pss_note, clinical_data, a summary, or a transcript' },
                { status: 400 }
            );
        }

        // If clinical_data is provided but no pss_note, build a basic pss_note
        let finalPssNote = pss_note;
        if (!pss_note && clinical_data) {
            finalPssNote = {
                sessionOverview: metadata.groupTopic || clinical_data.intervention || 'Manual session note',
                topicsDiscussed: [metadata.groupTopic].filter(Boolean),
                strengthsObserved: [],
                recoverySupportProvided: [clinical_data.intervention].filter(Boolean),
                actionItems: [],
                followUpNeeded: clinical_data.justification ? [clinical_data.justification] : [],
            };
        }

        // Merge clinical_data into metadata for manual notes
        const finalMetadata = clinical_data 
            ? { ...metadata, clinical_data }
            : metadata;

        // Insert new note
        const newNotes = await sql`
            INSERT INTO session_notes (
                user_id,
                organization_id,
                participant_id,
                metadata,
                pss_note,
                pss_summary,
                participant_summary,
                transcript,
                source,
                status,
                pss_coaching,
                conversation_analysis,
                is_archived
            ) VALUES (
                ${userId}::uuid,
                ${organization_id || null}::uuid,
                ${participant_id || null}::uuid,
                ${JSON.stringify(finalMetadata)}::jsonb,
                ${JSON.stringify(finalPssNote)}::jsonb,
                ${pss_summary || null},
                ${participant_summary || null},
                ${transcript || null},
                ${source},
                'draft',
                ${pss_coaching ? JSON.stringify(pss_coaching) : null}::jsonb,
                ${conversation_analysis ? JSON.stringify(conversation_analysis) : null}::jsonb,
                false
            )
            RETURNING *
        `;

        await logAuditEvent(
            userId,
            organization_id || null,
            'create',
            'session_note',
            newNotes[0].id,
            { source }
        );

        return NextResponse.json({
            success: true,
            note: newNotes[0]
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating session note:', error);
        return NextResponse.json(
            { error: 'Failed to create session note' },
            { status: 500 }
        );
    }
}
