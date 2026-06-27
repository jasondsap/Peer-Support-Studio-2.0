// app/api/participant-documents/route.ts
// Participant / intake document attachments (S3-backed).
//
// Flow:
//   POST  (no action)        -> { uploadUrl, s3_key }     presigned PUT, no DB row yet
//   POST ?action=confirm     -> { document }              inserts participant_documents row
//   GET  ?participant_id=    -> { documents: [...] }       metadata list
//   GET  ?id=&download=1     -> { url, expiresIn }         short-lived presigned GET
//   DELETE ?id=              -> { success }                deletes row + best-effort S3 object
//
// Every request is org-scoped (requireOrgAccess) and verifies the participant
// belongs to the org before issuing URLs. Mirrors the S3 client/env setup in
// app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

const ALLOWED_DOC_TYPES = ['insurance_card', 'consent', 'referral_order', 'other'];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB guardrail

// Lazy init — Amplify Lambda env vars aren't available at module load time.
let _s3Client: S3Client | null = null;

function getBucket(): string | null {
    return (
        process.env.APP_AWS_S3_BUCKET ||
        process.env.PARTICIPANT_DOCS_BUCKET ||
        null
    );
}

/** True only when every piece of S3 config is present. */
function isS3Configured(): boolean {
    return Boolean(
        getBucket() &&
        process.env.APP_AWS_ACCESS_KEY_ID &&
        process.env.APP_AWS_SECRET_ACCESS_KEY
    );
}

function getS3Client(): S3Client {
    if (!_s3Client) {
        _s3Client = new S3Client({
            region: process.env.APP_AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
            },
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }
    return _s3Client;
}

/** Sanitize a filename so it's safe inside an S3 key. */
function safeFileName(name: string): string {
    return (name || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(-120); // keep the tail (extension) if very long
}

/** Confirm the participant exists and belongs to the org. */
async function participantInOrg(orgId: string, participantId: string): Promise<boolean> {
    try {
        const rows = await sql`
            SELECT id FROM participants
            WHERE id = ${participantId}::uuid AND organization_id = ${orgId}::uuid
            LIMIT 1
        `;
        return Boolean(rows[0]);
    } catch {
        return false;
    }
}

function s3UnavailableResponse() {
    return NextResponse.json(
        { error: 'Document storage is not configured. File uploads are unavailable.' },
        { status: 503 }
    );
}

function handleAuthError(error: any) {
    const msg = error?.message || '';
    if (msg === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (msg === 'Organization access denied') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }
    return null;
}

// ============================================================================
// POST — presigned upload URL (default) OR confirm (?action=confirm)
// ============================================================================
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: any = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const organizationId = body.organization_id;
        const participantId = body.participant_id;

        if (!organizationId || !participantId) {
            return NextResponse.json(
                { error: 'organization_id and participant_id are required' },
                { status: 400 }
            );
        }

        // Org membership
        await requireOrgAccess(organizationId);

        // Participant must belong to the org
        if (!(await participantInOrg(organizationId, participantId))) {
            return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        }

        if (!isS3Configured()) {
            return s3UnavailableResponse();
        }

        const docType = ALLOWED_DOC_TYPES.includes(body.doc_type) ? body.doc_type : 'other';

        // ---- CONFIRM: insert the metadata row after a successful PUT ----------
        if (action === 'confirm') {
            const s3Key = body.s3_key;
            if (!s3Key || typeof s3Key !== 'string') {
                return NextResponse.json({ error: 's3_key is required' }, { status: 400 });
            }
            // Key must be scoped to this org + participant (defense against tampering)
            const expectedPrefix = `org/${organizationId}/participant/${participantId}/`;
            if (!s3Key.startsWith(expectedPrefix)) {
                return NextResponse.json({ error: 'Invalid s3_key' }, { status: 400 });
            }

            const sizeBytes =
                typeof body.size_bytes === 'number' && body.size_bytes >= 0
                    ? Math.round(body.size_bytes)
                    : null;
            if (sizeBytes != null && sizeBytes > MAX_SIZE_BYTES) {
                return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 400 });
            }

            const uploadedBy = await getInternalUserId(session.user.id, session.user.email);

            const inserted = await sql`
                INSERT INTO participant_documents
                    (organization_id, participant_id, intake_id, doc_type,
                     file_name, s3_key, content_type, size_bytes, uploaded_by)
                VALUES (
                    ${organizationId}::uuid,
                    ${participantId}::uuid,
                    ${body.intake_id || null}::uuid,
                    ${docType},
                    ${body.file_name || null},
                    ${s3Key},
                    ${body.content_type || null},
                    ${sizeBytes},
                    ${uploadedBy}::uuid
                )
                RETURNING id, organization_id, participant_id, intake_id, doc_type,
                          file_name, s3_key, content_type, size_bytes, uploaded_by, created_at
            `;

            const doc = inserted[0];

            await logAuditEvent(
                uploadedBy,
                organizationId,
                'create',
                'participant_document',
                doc?.id,
                { participant_id: participantId, doc_type: docType, file_name: body.file_name }
            );

            return NextResponse.json({ document: doc });
        }

        // ---- DEFAULT: issue a presigned PUT URL ------------------------------
        const fileName = safeFileName(body.file_name || 'file');
        const contentType = body.content_type || 'application/octet-stream';
        const s3Key = `org/${organizationId}/participant/${participantId}/${randomUUID()}-${fileName}`;

        let uploadUrl: string;
        try {
            const command = new PutObjectCommand({
                Bucket: getBucket()!,
                Key: s3Key,
                ContentType: contentType,
            });
            uploadUrl = await getSignedUrl(getS3Client(), command, {
                expiresIn: 300, // 5 minutes to complete the upload
                unhoistableHeaders: new Set(['x-amz-checksum-mode']),
            });
        } catch (e: any) {
            console.error('participant-documents presign PUT error:', e);
            return NextResponse.json(
                { error: 'Failed to prepare upload. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ uploadUrl, s3_key: s3Key, expiresIn: 300 });
    } catch (error: any) {
        const authResp = handleAuthError(error);
        if (authResp) return authResp;
        console.error('participant-documents POST error:', error);
        return NextResponse.json(
            { error: `Failed to process request: ${error.message}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// GET — list (?participant_id=) OR download URL (?id=&download=1)
// ============================================================================
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');
        const docId = searchParams.get('id');
        const download = searchParams.get('download');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
        }

        await requireOrgAccess(organizationId);

        // ---- Download a single document --------------------------------------
        if (docId && download) {
            if (!isS3Configured()) return s3UnavailableResponse();

            const rows = await sql`
                SELECT id, s3_key, file_name, content_type
                FROM participant_documents
                WHERE id = ${docId}::uuid AND organization_id = ${organizationId}::uuid
                LIMIT 1
            `;
            const doc = rows[0];
            if (!doc) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            try {
                const command = new GetObjectCommand({
                    Bucket: getBucket()!,
                    Key: doc.s3_key,
                    ResponseContentType: doc.content_type || undefined,
                    ResponseContentDisposition: doc.file_name
                        ? `attachment; filename="${doc.file_name.replace(/"/g, '')}"`
                        : undefined,
                });
                const url = await getSignedUrl(getS3Client(), command, {
                    expiresIn: 300,
                    unhoistableHeaders: new Set(['x-amz-checksum-mode']),
                });
                return NextResponse.json({ url, expiresIn: 300 });
            } catch (e: any) {
                console.error('participant-documents presign GET error:', e);
                return NextResponse.json(
                    { error: 'Failed to generate download link.' },
                    { status: 500 }
                );
            }
        }

        // ---- List metadata ----------------------------------------------------
        if (!participantId) {
            return NextResponse.json(
                { error: 'participant_id is required' },
                { status: 400 }
            );
        }

        const documents = await sql`
            SELECT id, organization_id, participant_id, intake_id, doc_type,
                   file_name, content_type, size_bytes, uploaded_by, created_at
            FROM participant_documents
            WHERE organization_id = ${organizationId}::uuid
              AND participant_id = ${participantId}::uuid
            ORDER BY created_at DESC
        `;

        return NextResponse.json({ documents });
    } catch (error: any) {
        const authResp = handleAuthError(error);
        if (authResp) return authResp;
        console.error('participant-documents GET error:', error);
        return NextResponse.json(
            { error: `Failed to load documents: ${error.message}` },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE — remove the row + best-effort S3 object delete
// ============================================================================
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const docId = searchParams.get('id');

        if (!organizationId || !docId) {
            return NextResponse.json(
                { error: 'organization_id and id are required' },
                { status: 400 }
            );
        }

        const { session } = await requireOrgAccess(organizationId);

        const rows = await sql`
            SELECT id, s3_key, participant_id, doc_type, file_name
            FROM participant_documents
            WHERE id = ${docId}::uuid AND organization_id = ${organizationId}::uuid
            LIMIT 1
        `;
        const doc = rows[0];
        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Delete the DB row first (source of truth for the UI).
        await sql`
            DELETE FROM participant_documents
            WHERE id = ${docId}::uuid AND organization_id = ${organizationId}::uuid
        `;

        // Best-effort: remove the S3 object. Never block the request on this.
        if (isS3Configured() && doc.s3_key) {
            try {
                await getS3Client().send(
                    new DeleteObjectCommand({ Bucket: getBucket()!, Key: doc.s3_key })
                );
            } catch (e) {
                console.error('participant-documents S3 delete (non-fatal):', e);
            }
        }

        const uploadedBy = await getInternalUserId(session.user.id, session.user.email);
        await logAuditEvent(
            uploadedBy,
            organizationId,
            'delete',
            'participant_document',
            docId,
            { participant_id: doc.participant_id, doc_type: doc.doc_type, file_name: doc.file_name }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const authResp = handleAuthError(error);
        if (authResp) return authResp;
        console.error('participant-documents DELETE error:', error);
        return NextResponse.json(
            { error: `Failed to delete document: ${error.message}` },
            { status: 500 }
        );
    }
}
