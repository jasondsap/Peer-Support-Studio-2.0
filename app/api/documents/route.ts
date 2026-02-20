// app/api/documents/route.ts
// Reference Document Library API
// GET — list all documents
// GET ?slug=tip-64 — get presigned URL for a specific document

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function GET(req: NextRequest) {
    try {
        // Auth — must be logged in
        await getSessionWithUserId();

        const { searchParams } = new URL(req.url);
        const slug = searchParams.get('slug');

        if (slug) {
            // Get presigned URL for a specific document
            const doc = await sql`
                SELECT id, slug, title, short_title, s3_bucket, s3_key
                FROM reference_documents
                WHERE slug = ${slug} AND is_active = true
            `;

            if (!doc[0]) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            const command = new GetObjectCommand({
                Bucket: doc[0].s3_bucket,
                Key: doc[0].s3_key,
                ResponseContentType: 'application/pdf',
                ResponseContentDisposition: `inline; filename="${doc[0].slug}.pdf"`,
            });

            // URL expires in 60 minutes
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

            return NextResponse.json({
                document: {
                    id: doc[0].id,
                    slug: doc[0].slug,
                    title: doc[0].title,
                    shortTitle: doc[0].short_title,
                },
                url: presignedUrl,
                expiresIn: 3600,
            });
        } else {
            // List all active documents
            const docs = await sql`
                SELECT 
                    id, slug, title, short_title, description,
                    publisher, year, page_count, file_size_bytes,
                    category, tags, badge_color, sort_order
                FROM reference_documents
                WHERE is_active = true
                ORDER BY sort_order ASC
            `;

            return NextResponse.json({ documents: docs });
        }
    } catch (error: any) {
        console.error('Documents API error:', error);

        if (error.message === 'Unauthorized' || error.message === 'User not found in database') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: `Failed to load documents: ${error.message}` },
            { status: 500 }
        );
    }
}
