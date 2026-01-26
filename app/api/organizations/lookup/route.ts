// app/api/organizations/lookup/route.ts
// Look up organization by invite code

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code || code.length < 4) {
            return NextResponse.json(
                { error: 'Invalid invite code' },
                { status: 400 }
            );
        }

        const result = await sql`
            SELECT id, name, type
            FROM organizations
            WHERE invite_code = ${code.toUpperCase()}
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'No organization found with that code' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            organization: {
                id: result[0].id,
                name: result[0].name,
                type: result[0].type,
            },
        });

    } catch (error) {
        console.error('Error looking up organization:', error);
        return NextResponse.json(
            { error: 'Failed to look up organization' },
            { status: 500 }
        );
    }
}
