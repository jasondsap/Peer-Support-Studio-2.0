/**
 * React Email template for assessment-completion invitations.
 *
 * One template covers both BARC-10 and MIRC-28 — copy adapts via assessmentLabel.
 */

import * as React from 'react';
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';

export interface AssessmentInviteEmailProps {
    inviteUrl: string;
    senderDisplayName: string;
    /** Human-friendly assessment name, e.g. "BARC-10" or "MIRC-28" */
    assessmentLabel: string;
    recipientFirstName?: string;
}

export function AssessmentInviteEmail({
    inviteUrl,
    senderDisplayName,
    assessmentLabel,
    recipientFirstName,
}: AssessmentInviteEmailProps) {
    const greeting = recipientFirstName ? `Hello ${recipientFirstName},` : 'Hello,';

    return (
        <Html>
            <Head />
            <Preview>Please complete a brief check-in</Preview>
            <Body style={bodyStyle}>
                <Container style={containerStyle}>
                    <Section style={cardStyle}>
                        <Heading as="h2" style={headingStyle}>
                            Please complete your {assessmentLabel} check-in
                        </Heading>
                        <Text style={paragraphStyle}>{greeting}</Text>
                        <Text style={paragraphStyle}>
                            Your provider has asked you to complete a brief questionnaire as part
                            of your care plan. It takes about 5 minutes and your answers help
                            your team support you better.
                        </Text>

                        <Section style={buttonRowStyle}>
                            <Button href={inviteUrl} style={primaryButtonStyle}>
                                START QUESTIONNAIRE
                            </Button>
                        </Section>

                        <Text style={separatorStyle}>OR</Text>

                        <Text style={fallbackLabelStyle}>Open this link in your browser</Text>
                        <Link href={inviteUrl} style={fallbackLinkStyle}>
                            {inviteUrl}
                        </Link>
                    </Section>

                    <Text style={footerStyle}>
                        Sent by {senderDisplayName}. If you did not expect this message, you
                        can safely ignore it. The link expires in 7 days.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

export default AssessmentInviteEmail;

const bodyStyle: React.CSSProperties = {
    backgroundColor: '#F2F0EF',
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: '24px 0',
};
const containerStyle: React.CSSProperties = {
    maxWidth: '560px', margin: '0 auto', padding: '0 16px',
};
const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px 28px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const headingStyle: React.CSSProperties = {
    color: '#0E4D6F', fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0',
};
const paragraphStyle: React.CSSProperties = {
    color: '#1f2937', fontSize: '15px', lineHeight: '22px', margin: '0 0 16px 0',
};
const buttonRowStyle: React.CSSProperties = {
    textAlign: 'center' as const, margin: '24px 0 8px 0',
};
const primaryButtonStyle: React.CSSProperties = {
    backgroundColor: '#1A73A8', color: '#ffffff', fontWeight: 600,
    fontSize: '14px', letterSpacing: '0.5px', padding: '12px 28px',
    borderRadius: '8px', textDecoration: 'none', display: 'inline-block',
};
const separatorStyle: React.CSSProperties = {
    textAlign: 'center' as const, color: '#6b7280', fontSize: '13px',
    margin: '20px 0 12px 0',
};
const fallbackLabelStyle: React.CSSProperties = {
    textAlign: 'center' as const, color: '#374151', fontSize: '13px',
    margin: '12px 0 4px 0',
};
const fallbackLinkStyle: React.CSSProperties = {
    display: 'block', textAlign: 'center' as const, color: '#1A73A8',
    fontSize: '12px', wordBreak: 'break-all', margin: '0 0 8px 0',
};
const footerStyle: React.CSSProperties = {
    color: '#6b7280', fontSize: '12px', textAlign: 'center' as const,
    marginTop: '20px', lineHeight: '18px',
};
