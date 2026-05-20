'use client';

import { useState } from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import type { AssessmentType } from '@/lib/assessments/questionnaires';

const TYPE_LABELS: Record<AssessmentType, string> = {
    barc10: 'BARC-10',
    mirc28: 'MIRC-28',
};

interface Props {
    organizationId: string;
    participantId: string;
    assessmentType: AssessmentType;
    participantEmail: string | null;
    participantPhone: string | null;
}

export function SendAssessmentCard({
    organizationId,
    participantId,
    assessmentType,
    participantEmail,
    participantPhone,
}: Props) {
    const [sending, setSending] = useState<'email' | 'sms' | null>(null);
    const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    const send = async (channel: 'email' | 'sms') => {
        setSending(channel);
        setMsg(null);
        try {
            const res = await fetch(`/api/participants/${participantId}/assessment/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel,
                    assessment_type: assessmentType,
                    organization_id: organizationId,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.success === false) {
                setMsg({ kind: 'error', text: data.message || data.error || 'Send failed.' });
            } else {
                setMsg({ kind: 'success', text: data.message || 'Sent.' });
            }
        } catch {
            setMsg({ kind: 'error', text: 'Network error. Please try again.' });
        } finally {
            setSending(null);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-emerald-500">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Send className="w-4 h-4 text-emerald-600" />
                        <h3 className="font-semibold text-gray-900 text-sm">
                            Or send the {TYPE_LABELS[assessmentType]} link to the participant
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500">
                        Sends a tokenized link so the participant can complete the assessment on
                        their own. Link expires in 7 days.
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        type="button"
                        disabled={!participantEmail || sending !== null}
                        onClick={() => send('email')}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        title={!participantEmail ? 'No email address on file' : ''}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        {sending === 'email' ? 'Sending…' : 'Send by Email'}
                    </button>
                    <button
                        type="button"
                        disabled={!participantPhone || sending !== null}
                        onClick={() => send('sms')}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        title={!participantPhone ? 'No phone number on file' : ''}
                    >
                        <Phone className="w-3.5 h-3.5" />
                        {sending === 'sms' ? 'Sending…' : 'Send by Text'}
                    </button>
                </div>
            </div>
            {msg && (
                <div className={`mt-3 p-2.5 rounded-lg text-xs ${
                    msg.kind === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                    {msg.text}
                </div>
            )}
        </div>
    );
}

export default SendAssessmentCard;
