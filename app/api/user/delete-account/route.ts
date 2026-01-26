import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { 
    CognitoIdentityProviderClient, 
    DeleteUserCommand 
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

// DELETE - Delete user account
export async function DELETE(request: NextRequest) {
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

        // Delete user data from database in order (respecting foreign keys)
        // This uses a transaction to ensure all-or-nothing deletion
        try {
            await sql.begin(async (sql) => {
                // Delete session notes
                await sql`DELETE FROM session_notes WHERE user_id = ${userId}::uuid`;
                
                // Delete recovery goals
                await sql`DELETE FROM recovery_goals WHERE user_id = ${userId}::uuid`;
                
                // Delete service logs
                await sql`DELETE FROM service_logs WHERE user_id = ${userId}::uuid`;
                
                // Delete advisor sessions
                await sql`DELETE FROM advisor_sessions WHERE user_id = ${userId}::uuid`;
                
                // Delete lessons
                await sql`DELETE FROM lessons WHERE user_id = ${userId}::uuid`;
                
                // Delete supervision entries
                await sql`DELETE FROM supervision_entries WHERE user_id = ${userId}::uuid`;
                
                // Delete training records
                await sql`DELETE FROM training_records WHERE user_id = ${userId}::uuid`;
                
                // Delete participants (if user owns them)
                await sql`DELETE FROM participants WHERE created_by = ${userId}::uuid`;
                
                // Delete organization memberships
                await sql`DELETE FROM organization_members WHERE user_id = ${userId}::uuid`;
                
                // Finally, delete the user
                await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
            });
        } catch (dbError) {
            console.error('Database deletion error:', dbError);
            return NextResponse.json(
                { error: 'Failed to delete user data' },
                { status: 500 }
            );
        }

        // Delete user from Cognito
        const accessToken = (session as any).accessToken;

        if (accessToken) {
            try {
                const command = new DeleteUserCommand({
                    AccessToken: accessToken,
                });

                await cognitoClient.send(command);
            } catch (cognitoError) {
                // Log but don't fail - database deletion was successful
                console.error('Cognito user deletion error:', cognitoError);
            }
        }

        return NextResponse.json({ 
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        return NextResponse.json(
            { error: 'Failed to delete account' },
            { status: 500 }
        );
    }
}
