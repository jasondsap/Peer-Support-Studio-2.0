import { NextResponse } from 'next/server';

export async function GET() {
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    const clientId = process.env.COGNITO_CLIENT_ID;
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const logoutUri = encodeURIComponent(`${baseUrl}/auth/signin`);
    
    if (!cognitoDomain || !clientId) {
        // Fallback to just redirecting to signin if Cognito vars not set
        return NextResponse.redirect(new URL('/auth/signin', baseUrl));
    }
    
    const logoutUrl = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
    
    return NextResponse.redirect(logoutUrl);
}
