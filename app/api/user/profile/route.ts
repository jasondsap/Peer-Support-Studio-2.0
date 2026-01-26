import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Fetch user profile
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

        // Fetch user profile
        const users = await sql`
            SELECT 
                id,
                email,
                display_name,
                phone,
                created_at,
                updated_at
            FROM users
            WHERE id = ${userId}::uuid
        `;

        if (users.length === 0) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ 
            profile: users[0]
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json(
            { error: 'Failed to fetch profile' },
            { status: 500 }
        );
    }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
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
        const { display_name, phone } = body;

        // Validate display name
        if (display_name !== undefined && typeof display_name !== 'string') {
            return NextResponse.json(
                { error: 'Invalid display name' },
                { status: 400 }
            );
        }

        // Validate phone (basic validation - allow null or string)
        if (phone !== undefined && phone !== null && typeof phone !== 'string') {
            return NextResponse.json(
                { error: 'Invalid phone number' },
                { status: 400 }
            );
        }

        // Update user profile
        const updatedUsers = await sql`
            UPDATE users
            SET 
                display_name = COALESCE(${display_name}, display_name),
                phone = ${phone},
                updated_at = NOW()
            WHERE id = ${userId}::uuid
            RETURNING id, email, display_name, phone, updated_at
        `;

        if (updatedUsers.length === 0) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ 
            success: true,
            profile: updatedUsers[0]
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        return NextResponse.json(
            { error: 'Failed to update profile' },
            { status: 500 }
        );
    }
}
