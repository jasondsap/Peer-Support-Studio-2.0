'use client';

/**
 * Public assessment form. Renders one radio group per question and POSTs the
 * full response set + computed total to /api/assessment-invitations/[token].
 * Server re-derives the total before persisting.
 */

import { useMemo, useState } from 'react';
import type { AssessmentType } from '@/lib/assessments/questionnaires';

interface Question { id: number; text: string; }
interface ResponseOption { value: number; label: string; }

interface FormProps {
    token: string;
    assessmentType: AssessmentType;
    assessmentLabel: string;
    recipientFirstName: string;
    organizationName: string;
    questions: Question[];
    responseOptions: ResponseOption[];
}

export function AssessmentForm({
    token,
    assessmentType,
    assessmentLabel,
    recipientFirstName,
    organizationName,
    questions,
    responseOptions,
}: FormProps) {
    const [responses, setResponses] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{ total_score: number } | null>(null);

    const unanswered = useMemo(
        () => questions.filter(q => responses[`q${q.id}`] === undefined),
        [questions, responses]
    );

    const totalScore = useMemo(
        () => Object.values(responses).reduce((sum, v) => sum + (v ?? 0), 0),
        [responses]
    );

    const setResponse = (questionId: number, value: number) => {
        setResponses(prev => ({ ...prev, [`q${questionId}`]: value }));
        setError('');
    };

    const handleSubmit = async () => {
        if (unanswered.length > 0) {
            setError(
                `Please answer ${unanswered.length === 1
                    ? 'the remaining question'
                    : `the ${unanswered.length} remaining questions`}.`
            );
            const el = document.getElementById(`q-${unanswered[0].id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/assessment-invitations/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responses,
                    total_score: totalScore,
                }),
            });
            if (!res.ok) {
                let msg = 'Submission failed. Please try again.';
                try {
                    const data = await res.json();
                    if (res.status === 410) msg = 'This link has expired. Please contact your provider for a new one.';
                    else if (res.status === 409) msg = data.error || 'This assessment has already been submitted.';
                    else if (data?.error) msg = data.error;
                } catch { /* keep default */ }
                setError(msg);
                setSaving(false);
                return;
            }
            const data = await res.json();
            setSuccess({ total_score: data.total_score ?? totalScore });
        } catch {
            setError('Network error. Please check your connection and try again.');
            setSaving(false);
        }
    };

    if (success) {
        return (
            <div>
                <h1 style={{ color: '#0e7c66', fontSize: 22, margin: '0 0 12px 0' }}>
                    Thank you — your responses have been recorded
                </h1>
                <p style={{ color: '#374151', lineHeight: '24px', fontSize: 15 }}>
                    Your care team will review your answers. If they need to follow up,
                    they'll be in touch.
                </p>
            </div>
        );
    }

    const greeting = recipientFirstName ? `Hello ${recipientFirstName},` : 'Hello,';

    return (
        <div>
            <h1 style={titleStyle}>{assessmentLabel} check-in</h1>
            <p style={leadStyle}>{greeting}</p>
            <p style={leadStyle}>
                {organizationName
                    ? `Your care team at ${organizationName} has asked you to complete this brief questionnaire.`
                    : 'Your care team has asked you to complete this brief questionnaire.'}
                {' '}There are no right or wrong answers — your responses help your team support you.
            </p>

            {error && <div style={errorStyle}>{error}</div>}

            <div style={{ marginTop: 16 }}>
                {questions.map((q, qIdx) => {
                    const selectedValue = responses[`q${q.id}`];
                    const isUnansweredAfterError = selectedValue === undefined && !!error;
                    return (
                        <div
                            key={q.id}
                            id={`q-${q.id}`}
                            style={{
                                ...questionCardStyle,
                                border: isUnansweredAfterError ? '1px solid #fca5a5' : questionCardStyle.border,
                            }}
                        >
                            <div style={questionHeaderStyle}>
                                <span style={questionNumberStyle}>{qIdx + 1}.</span>
                                <span style={questionTextStyle}>
                                    {q.text}
                                    <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
                                </span>
                            </div>
                            <div style={optionsStyle}>
                                {responseOptions.map(opt => {
                                    const isSelected = selectedValue === opt.value;
                                    return (
                                        <label
                                            key={opt.value}
                                            style={{
                                                ...optionLabelStyle,
                                                background: isSelected ? '#dbeafe' : '#ffffff',
                                                borderColor: isSelected ? '#1A73A8' : '#d1d5db',
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name={`q${q.id}`}
                                                value={opt.value}
                                                checked={isSelected}
                                                onChange={() => setResponse(q.id, opt.value)}
                                                style={{ marginRight: 8 }}
                                            />
                                            <span style={{ fontSize: 14, color: '#1f2937' }}>
                                                {opt.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    style={primaryButtonStyle}
                >
                    {saving ? 'Submitting…' : 'Submit Responses'}
                </button>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                    {Object.keys(responses).length} of {questions.length} answered
                </span>
            </div>
        </div>
    );
}

const titleStyle: React.CSSProperties = {
    color: '#0E4D6F', fontSize: 22, margin: '0 0 8px 0', fontWeight: 700,
};
const leadStyle: React.CSSProperties = {
    color: '#374151', lineHeight: '22px', fontSize: 14, margin: '0 0 12px 0',
};
const errorStyle: React.CSSProperties = {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
    padding: '10px 14px', borderRadius: 6, fontSize: 14, marginBottom: 16,
};
const questionCardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 18px',
    marginBottom: 12,
    background: '#fafbfc',
};
const questionHeaderStyle: React.CSSProperties = {
    display: 'flex', gap: 8, marginBottom: 12, alignItems: 'baseline',
};
const questionNumberStyle: React.CSSProperties = {
    color: '#0E4D6F', fontWeight: 600, fontSize: 14, flexShrink: 0,
};
const questionTextStyle: React.CSSProperties = {
    color: '#1f2937', fontSize: 14, lineHeight: '20px',
};
const optionsStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 22,
};
const optionLabelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: 6, cursor: 'pointer', transition: 'all 0.1s',
};
const primaryButtonStyle: React.CSSProperties = {
    backgroundColor: '#1A73A8', color: '#ffffff', fontWeight: 600,
    fontSize: 14, padding: '12px 28px', borderRadius: 8, border: 'none',
    cursor: 'pointer',
};
