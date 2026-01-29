// app/api/hume/access-token/route.ts
import { fetchAccessToken } from 'hume';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const accessToken = await fetchAccessToken({
            apiKey: process.env.HUME_API_KEY || '',
            secretKey: process.env.HUME_SECRET_KEY || '',
        });

        if (!accessToken) {
            throw new Error('Failed to fetch access token');
        }

        return NextResponse.json({ accessToken });
    } catch (error: any) {
        console.error('Hume access token error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get access token' },
            { status: 500 }
        );
    }
}
