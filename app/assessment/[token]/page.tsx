/**
 * /assessment/[token]
 *
 * Public participant-facing page to complete BARC-10 or MIRC-28. No auth —
 * the token is the credential. Server component validates the invitation;
 * AssessmentForm (client) handles the form + submit.
 */

import { sql } from '@/lib/db';
import { AssessmentForm } from './AssessmentForm';
import {
    ASSESSMENT_LABELS,
    BARC10_QUESTIONS,
    BARC10_RESPONSE_OPTIONS,
    MIRC28_QUESTIONS,
    MIRC28_RESPONSE_OPTIONS,
    type AssessmentType,
} from '@/lib/assessments/questionnaires';

interface PageProps {
    params: { token: string };
}

interface InvitationRow {
    id: string;
    assessment_type: AssessmentType;
    status: 'sent' | 'opened' | 'completed' | 'expired' | 'superseded';
    expires_at: Date;
    participant_first_name: string | null;
    organization_name: string | null;
}

export const dynamic = 'force-dynamic';

export default async function AssessmentInvitePage({ params }: PageProps) {
    const token = params.token;

    const rows = (await sql`
        SELECT id, assessment_type, status, expires_at,
               participant_first_name, organization_name
        FROM assessment_invitations
        WHERE token = ${token}
        LIMIT 1
    `) as InvitationRow[];
    const invite = rows[0];

    if (!invite) {
        return (
            <Frame>
                <Notice tone="error" title="Link not recognized">
                    This assessment link is invalid or has been removed. If you believe this is
                    a mistake, please contact your provider.
                </Notice>
            </Frame>
        );
    }

    if (invite.status === 'completed') {
        return (
            <Frame>
                <Notice tone="success" title="Thank you — your responses were received">
                    We've recorded your latest check-in. There's nothing more to do.
                </Notice>
            </Frame>
        );
    }
    if (invite.status === 'superseded') {
        return (
            <Frame>
                <Notice tone="info" title="A newer link was sent">
                    This link has been replaced by a more recent one. Please check your most
                    recent email or text message for the active link.
                </Notice>
            </Frame>
        );
    }
    if (new Date(invite.expires_at) < new Date()) {
        return (
            <Frame>
                <Notice tone="info" title="This link has expired">
                    For your security, assessment links expire after 7 days. Please contact your
                    provider to receive a new one.
                </Notice>
            </Frame>
        );
    }

    if (invite.status === 'sent') {
        await sql`UPDATE assessment_invitations SET status = 'opened', opened_at = NOW() WHERE id = ${invite.id}`;
    }

    const questions =
        invite.assessment_type === 'barc10'
            ? BARC10_QUESTIONS.map(q => ({ id: q.id, text: q.text }))
            : MIRC28_QUESTIONS.map(q => ({ id: q.id, text: q.text }));

    const responseOptions =
        invite.assessment_type === 'barc10' ? BARC10_RESPONSE_OPTIONS : MIRC28_RESPONSE_OPTIONS;

    return (
        <Frame wide>
            <AssessmentForm
                token={token}
                assessmentType={invite.assessment_type}
                assessmentLabel={ASSESSMENT_LABELS[invite.assessment_type]}
                recipientFirstName={invite.participant_first_name ?? ''}
                organizationName={invite.organization_name ?? ''}
                questions={questions}
                responseOptions={responseOptions}
            />
        </Frame>
    );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function Frame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <main style={frameStyle}>
            <div style={{ ...cardStyle, maxWidth: wide ? '720px' : '560px' }}>
                <header style={headerStyle}>
                    <div style={brandStyle}>Peer Support Studio</div>
                </header>
                <div style={contentStyle}>{children}</div>
                <footer style={footerStyle}>
                    Your responses are confidential and shared only with your care team.
                </footer>
            </div>
        </main>
    );
}

function Notice({ tone, title, children }: {
    tone: 'success' | 'info' | 'error';
    title: string;
    children: React.ReactNode;
}) {
    const color =
        tone === 'success' ? '#0e7c66' :
        tone === 'error' ? '#b91c1c' : '#0E4D6F';
    return (
        <div>
            <h1 style={{ color, fontSize: '22px', margin: '0 0 12px 0' }}>{title}</h1>
            <p style={{ color: '#374151', lineHeight: '24px', fontSize: '15px' }}>{children}</p>
        </div>
    );
}

const frameStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#F2F0EF', padding: '32px 16px',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};
const cardStyle: React.CSSProperties = {
    width: '100%', background: '#ffffff', borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
};
const headerStyle: React.CSSProperties = {
    background: '#0E4D6F', color: '#ffffff', padding: '16px 24px',
};
const brandStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '14px', letterSpacing: '0.3px',
};
const contentStyle: React.CSSProperties = { padding: '28px 24px' };
const footerStyle: React.CSSProperties = {
    borderTop: '1px solid #e5e7eb', padding: '14px 24px',
    fontSize: '12px', color: '#6b7280', textAlign: 'center',
};
