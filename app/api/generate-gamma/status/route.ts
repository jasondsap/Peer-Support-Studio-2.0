// ============================================================================
// /app/api/generate-gamma/status/route.ts
//
// Polled by the client every ~3s after /start has returned a generationId.
// Each call is short (~1–2s): checks Gamma status and, when the generation
// completes, persists the URL back to saved_lessons.
//
// Query params:
//   generationId  (required) — returned from /api/generate-gamma/start
//   lessonId      (optional) — saved_lessons.id to update with gamma URL
//
// Response shapes:
//   { status: 'pending' }
//   { status: 'completed', gammaUrl: 'https://...' }
//   { status: 'failed', error: '...' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const generationId = searchParams.get('generationId');
        const lessonId = searchParams.get('lessonId');

        if (!generationId) {
            return NextResponse.json(
                { error: 'Missing generationId' },
                { status: 400 }
            );
        }

        const gammaApiKey = process.env.GAMMA_API_KEY;
        if (!gammaApiKey) {
            return NextResponse.json(
                { error: 'Gamma API key not configured' },
                { status: 500 }
            );
        }

        // ── Check Gamma generation status ──
        const statusResponse = await fetch(
            `https://public-api.gamma.app/v1.0/generations/${generationId}`,
            {
                headers: {
                    'X-API-KEY': gammaApiKey,
                },
            }
        );

        if (!statusResponse.ok) {
            // Transient upstream issue — surface as pending so the client keeps polling
            console.error(
                `Gamma status check returned ${statusResponse.status} for ${generationId}`
            );
            return NextResponse.json({ status: 'pending' });
        }

        const statusData = await statusResponse.json();
        const gammaStatus = statusData.status || 'unknown';

        const url =
            statusData.webUrl ||
            statusData.gamma_url ||
            statusData.gammaUrl ||
            statusData.url ||
            statusData.publicUrl;

        // ── Completed: persist URL and return it ──
        if (gammaStatus === 'completed' && url) {
            if (lessonId) {
                try {
                    console.log(`📝 Updating database for lesson: ${lessonId}`);
                    await sql`
                        UPDATE saved_lessons
                        SET 
                            gamma_presentation_url = ${url},
                            updated_at = NOW()
                        WHERE id = ${lessonId}::uuid
                    `;
                    console.log(`✅ Gamma URL saved for lesson: ${lessonId}`);
                } catch (dbError) {
                    // Non-fatal: the user still gets the URL even if DB write fails.
                    console.error('❌ Database update error:', dbError);
                }
            }

            return NextResponse.json({
                status: 'completed',
                gammaUrl: url,
                generationId,
            });
        }

        // ── Failed ──
        if (gammaStatus === 'failed' || gammaStatus === 'error') {
            const errorMsg =
                statusData.error ||
                statusData.errorMessage ||
                'Gamma generation failed';
            return NextResponse.json({
                status: 'failed',
                error: errorMsg,
                generationId,
            });
        }

        // ── Still pending ──
        return NextResponse.json({
            status: 'pending',
            gammaStatus,
            generationId,
        });
    } catch (error) {
        console.error('Error checking Gamma status:', error);
        return NextResponse.json(
            {
                error: 'Failed to check generation status',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
