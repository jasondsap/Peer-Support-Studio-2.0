'use client';

// ============================================================================
// Portal Access Card Component
// File: /app/components/PortalAccessCard.tsx
//
// Enabling portal access auto-creates the participant's Cognito login and
// emails them their credentials (temporary password Peer!1234) via Resend.
// Once enabled, staff can re-send the invite or reset the temp password.
// ============================================================================

import { useState, useEffect } from 'react';
import {
    Smartphone,
    Loader2,
    Check,
    X,
    AlertCircle,
    ExternalLink,
    Mail,
    KeyRound,
    Send,
} from 'lucide-react';

const PORTAL_URL = 'https://my.peersupportstudio.com';

interface PortalAccessCardProps {
    participantId: string;
    participantEmail?: string;
    participantName: string;
    organizationId: string;
}

interface PortalStatus {
    has_portal_access: boolean;
    portal_enabled: boolean;
    credentials?: {
        id: string;
        email: string;
        status: string;
        last_login_at?: string;
        created_at: string;
    };
}

export default function PortalAccessCard({
    participantId,
    participantEmail,
    participantName,
    organizationId,
}: PortalAccessCardProps) {
    const [status, setStatus] = useState<PortalStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState(participantEmail || '');

    useEffect(() => {
        fetchPortalStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [participantId, organizationId]);

    function resetMessages() {
        setError(null);
        setSuccess(null);
        setWarning(null);
    }

    async function fetchPortalStatus() {
        try {
            setLoading(true);
            const res = await fetch(
                `/api/participants/${participantId}/portal?organization_id=${organizationId}`
            );
            const data = await res.json();

            if (res.ok) {
                setStatus(data);
                if (data.credentials?.email) {
                    setEmailInput(data.credentials.email);
                }
            } else {
                setError(data.error || 'Failed to fetch status');
            }
        } catch (err) {
            console.error('Error fetching portal status:', err);
            setError('Failed to fetch portal status');
        } finally {
            setLoading(false);
        }
    }

    async function enablePortalAccess() {
        const email = emailInput.trim();
        if (!email) {
            setError('Email is required to enable portal access');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        try {
            setUpdating(true);
            resetMessages();

            const res = await fetch(`/api/participants/${participantId}/portal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_id: organizationId, email }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(data.message || 'Portal access enabled');
                if (data.warning) setWarning(data.warning);
                await fetchPortalStatus();
            } else {
                setError(data.error || 'Failed to enable portal access');
            }
        } catch (err) {
            console.error('Error enabling portal:', err);
            setError('Failed to enable portal access');
        } finally {
            setUpdating(false);
        }
    }

    async function patchPortal(action: 'resend' | 'reset_password') {
        if (
            action === 'reset_password' &&
            !confirm(
                `Reset ${participantName}'s password to the temporary password (Peer!1234) and email it to them? They'll be asked to set a new password on their next sign-in.`
            )
        ) {
            return;
        }

        try {
            setUpdating(true);
            resetMessages();

            const res = await fetch(`/api/participants/${participantId}/portal`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_id: organizationId, action }),
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(data.message || 'Done');
            } else {
                setError(data.error || 'Action failed');
            }
        } catch (err) {
            console.error('Error updating portal:', err);
            setError('Action failed');
        } finally {
            setUpdating(false);
        }
    }

    async function disablePortalAccess() {
        if (
            !confirm(`Are you sure you want to disable portal access for ${participantName}?`)
        ) {
            return;
        }

        try {
            setUpdating(true);
            resetMessages();

            const res = await fetch(
                `/api/participants/${participantId}/portal?organization_id=${organizationId}`,
                { method: 'DELETE' }
            );
            const data = await res.json();

            if (res.ok) {
                setSuccess('Portal access disabled');
                await fetchPortalStatus();
            } else {
                setError(data.error || 'Failed to disable portal access');
            }
        } catch (err) {
            console.error('Error disabling portal:', err);
            setError('Failed to disable portal access');
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="text-gray-500">Loading portal status...</span>
                </div>
            </div>
        );
    }

    const isEnabled = status?.portal_enabled;
    const lastLogin = status?.credentials?.last_login_at;

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0E2235] flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-[#1A73A8]" />
                    Participant Portal
                </h3>
                {isEnabled && (
                    <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <Check className="w-4 h-4" />
                        Enabled
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    {success}
                </div>
            )}

            {warning && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {warning}
                </div>
            )}

            {isEnabled ? (
                // ── Portal is enabled ──
                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Login email:</span>
                                <span className="font-medium">{status?.credentials?.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status:</span>
                                <span className="font-medium capitalize">
                                    {status?.credentials?.status}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Last login:</span>
                                {lastLogin ? (
                                    <span className="font-medium">
                                        {new Date(lastLogin).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 italic">Never logged in</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500">
                        {participantName} can sign in at{' '}
                        <a
                            href={PORTAL_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1A73A8] hover:underline inline-flex items-center gap-1"
                        >
                            my.peersupportstudio.com
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => patchPortal('resend')}
                            disabled={updating}
                            className="py-2 px-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                            <Send className="w-4 h-4" />
                            Resend invite
                        </button>
                        <button
                            onClick={() => patchPortal('reset_password')}
                            disabled={updating}
                            className="py-2 px-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                            <KeyRound className="w-4 h-4" />
                            Reset password
                        </button>
                    </div>

                    <button
                        onClick={disablePortalAccess}
                        disabled={updating}
                        className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {updating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <X className="w-4 h-4" />
                        )}
                        Disable Portal Access
                    </button>
                </div>
            ) : (
                // ── Portal not enabled ──
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Enable portal access to allow {participantName} to message you and view
                        their goals from their phone or computer.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Participant Email *
                        </label>
                        <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="participant@email.com"
                            disabled={updating}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Their login and welcome email will be sent here.
                        </p>
                    </div>

                    <button
                        onClick={enablePortalAccess}
                        disabled={updating || !emailInput.trim()}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    >
                        {updating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Setting up portal...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Enable Portal Access
                            </>
                        )}
                    </button>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                        <p className="font-medium mb-1 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            What happens next
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                            <li>A secure portal login is created automatically</li>
                            <li>{participantName} gets an email with a temporary password</li>
                            <li>They sign in and set their own password on first login</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
