// app/api/hume/api-key/route.ts
// ⚠️ WARNING: This exposes your API key to the client. 
// Use only for testing/demo. For production, use access token auth.

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const apiKey = process.env.HUME_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'HUME_API_KEY not configured' },
                { status: 500 }
            );
        }

        // Log for debugging (remove in production)
        console.log('Providing Hume API key for direct auth (demo mode)');

        return NextResponse.json({ apiKey });

    } catch (error: any) {
        console.error('Hume API key error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get API key' },
            { status: 500 }
        );
    }
}
