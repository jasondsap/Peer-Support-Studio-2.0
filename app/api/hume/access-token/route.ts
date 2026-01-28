// app/api/hume/access-token/route.ts
// DIAGNOSTIC VERSION - Shows detailed token info

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const apiKey = process.env.HUME_API_KEY || '';
        const secretKey = process.env.HUME_SECRET_KEY || '';

        // Log key presence (not values!)
        console.log('HUME_API_KEY present:', !!apiKey, 'length:', apiKey.length);
        console.log('HUME_SECRET_KEY present:', !!secretKey, 'length:', secretKey.length);

        if (!apiKey || !secretKey) {
            return NextResponse.json({
                error: 'Missing Hume credentials',
                details: {
                    hasApiKey: !!apiKey,
                    hasSecretKey: !!secretKey
                }
            }, { status: 500 });
        }

        // Method 1: Try the SDK method first
        let sdkToken = null;
        let sdkError = null;
        try {
            const { fetchAccessToken } = await import('hume');
            sdkToken = await fetchAccessToken({
                apiKey,
                secretKey,
            });
            console.log('SDK token received, length:', sdkToken?.length || 0);
            console.log('SDK token preview:', sdkToken?.substring(0, 50) + '...');
        } catch (e: any) {
            sdkError = e.message;
            console.error('SDK fetchAccessToken error:', e);
        }

        // Method 2: Direct API call as fallback
        let directToken = null;
        let directError = null;
        try {
            // Create Basic auth header
            const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
            
            const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=client_credentials',
            });

            const data = await response.json();
            console.log('Direct API response status:', response.status);
            console.log('Direct API response:', JSON.stringify(data).substring(0, 200));

            if (!response.ok) {
                directError = data.error || data.message || `HTTP ${response.status}`;
            } else {
                directToken = data.access_token;
                console.log('Direct token received, length:', directToken?.length || 0);
                console.log('Direct token preview:', directToken?.substring(0, 50) + '...');
            }
        } catch (e: any) {
            directError = e.message;
            console.error('Direct API call error:', e);
        }

        // Validate token format (should be a JWT starting with eyJ)
        const validateToken = (token: string | null) => {
            if (!token) return { valid: false, reason: 'no token' };
            if (token.length < 100) return { valid: false, reason: 'too short (should be 100+ chars)' };
            if (!token.startsWith('eyJ')) return { valid: false, reason: 'not a JWT (should start with eyJ)' };
            if (token.split('.').length !== 3) return { valid: false, reason: 'invalid JWT structure' };
            return { valid: true, reason: null };
        };

        const sdkValidation = validateToken(sdkToken);
        const directValidation = validateToken(directToken);

        // Use the valid token (prefer direct if SDK fails)
        const accessToken = directValidation.valid ? directToken : 
                          sdkValidation.valid ? sdkToken : 
                          (directToken || sdkToken);

        // Return diagnostic info in development, just token in production
        if (process.env.NODE_ENV === 'development' || process.env.HUME_DEBUG === 'true') {
            return NextResponse.json({
                accessToken,
                diagnostics: {
                    sdkMethod: {
                        token: sdkToken ? `${sdkToken.substring(0, 20)}... (${sdkToken.length} chars)` : null,
                        error: sdkError,
                        validation: sdkValidation
                    },
                    directMethod: {
                        token: directToken ? `${directToken.substring(0, 20)}... (${directToken.length} chars)` : null,
                        error: directError,
                        validation: directValidation
                    },
                    recommendation: !sdkValidation.valid && !directValidation.valid 
                        ? 'Both methods failed. Check your HUME_API_KEY and HUME_SECRET_KEY in Vercel.'
                        : directValidation.valid ? 'Using direct API method' : 'Using SDK method'
                }
            });
        }

        if (!accessToken) {
            throw new Error('Failed to fetch access token from both methods');
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
