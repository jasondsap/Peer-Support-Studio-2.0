import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
    CognitoIdentityProviderClient, 
    ChangePasswordCommand 
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

// POST - Change user password
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current password and new password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Get the access token from the session
        // Note: This requires the session to include the access token
        const accessToken = (session as any).accessToken;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Session does not contain access token. Please sign in again.' },
                { status: 401 }
            );
        }

        try {
            // Change password in Cognito
            const command = new ChangePasswordCommand({
                AccessToken: accessToken,
                PreviousPassword: currentPassword,
                ProposedPassword: newPassword,
            });

            await cognitoClient.send(command);

            return NextResponse.json({ 
                success: true,
                message: 'Password changed successfully'
            });
        } catch (cognitoError: any) {
            console.error('Cognito change password error:', cognitoError);

            // Handle specific Cognito errors
            if (cognitoError.name === 'NotAuthorizedException') {
                return NextResponse.json(
                    { error: 'Current password is incorrect' },
                    { status: 400 }
                );
            }

            if (cognitoError.name === 'InvalidPasswordException') {
                return NextResponse.json(
                    { error: 'New password does not meet requirements. Password must contain uppercase, lowercase, number, and special character.' },
                    { status: 400 }
                );
            }

            if (cognitoError.name === 'LimitExceededException') {
                return NextResponse.json(
                    { error: 'Too many attempts. Please try again later.' },
                    { status: 429 }
                );
            }

            throw cognitoError;
        }
    } catch (error) {
        console.error('Error changing password:', error);
        return NextResponse.json(
            { error: 'Failed to change password' },
            { status: 500 }
        );
    }
}
