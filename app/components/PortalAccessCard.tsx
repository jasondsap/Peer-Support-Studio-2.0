'use client';

// ============================================================================
// Portal Access Card Component
// Add this to: /app/components/PortalAccessCard.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { Smartphone, Loader2, Check, X, AlertCircle, ExternalLink } from 'lucide-react';

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
    organizationId
}: PortalAccessCardProps) {
    const [status, setStatus] = useState<PortalStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState(participantEmail || '');

    useEffect(() => {
        fetchPortalStatus();
    }, [participantId, organizationId]);

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
        if (!emailInput.trim()) {
            setError('Email is required to enable portal access');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        try {
            setUpdating(true);
            setError(null);
            
            const res = await fetch(`/api/participants/${participantId}/portal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: organizationId,
                    email: emailInput.trim()
                })
            });

            const data = await res.json();
            
            if (res.ok) {
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

    async function disablePortalAccess() {
        if (!confirm(`Are you sure you want to disable portal access for ${participantName}?`)) {
            return;
        }

        try {
            setUpdating(true);
            setError(null);
            
            const res = await fetch(
                `/api/participants/${participantId}/portal?organization_id=${organizationId}`,
                { method: 'DELETE' }
            );

            const data = await res.json();
            
            if (res.ok) {
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

            {isEnabled ? (
                // Portal is enabled
                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Email:</span>
                                <span className="font-medium">{status?.credentials?.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status:</span>
                                <span className="font-medium capitalize">{status?.credentials?.status}</span>
                            </div>
                            {lastLogin && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Last Login:</span>
                                    <span className="font-medium">
                                        {new Date(lastLogin).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            )}
                            {!lastLogin && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Last Login:</span>
                                    <span className="text-gray-400 italic">Never logged in</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-500">
                        {participantName} can access the portal at{' '}
                        <a 
                            href="https://portal.peersupportstudio.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#1A73A8] hover:underline inline-flex items-center gap-1"
                        >
                            portal.peersupportstudio.com
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </p>

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
                // Portal not enabled
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Enable portal access to allow {participantName} to message you and view their goals from their phone or computer.
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This email will be used to sign in to the portal
                        </p>
                    </div>

                    <button
                        onClick={enablePortalAccess}
                        disabled={updating || !emailInput.trim()}
                        className="w-full py-2 px-4 bg-[#1A73A8] text-white rounded-lg hover:bg-[#15608a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {updating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        Enable Portal Access
                    </button>

                    <p className="text-xs text-gray-500">
                        After enabling, the participant will need to create an account at the portal using this email address.
                    </p>
                </div>
            )}
        </div>
    );
}
