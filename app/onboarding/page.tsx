'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Building2, Users, Plus, ArrowRight, Loader2,
    CheckCircle2, AlertCircle, Sparkles, Key
} from 'lucide-react';

type OnboardingStep = 'choice' | 'create-org' | 'join-org' | 'complete';

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, status, update: updateSession } = useSession();
    
    const [step, setStep] = useState<OnboardingStep>('choice');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Create org form
    const [orgName, setOrgName] = useState('');
    const [orgType, setOrgType] = useState('peer_org');
    
    // Join org form
    const [inviteCode, setInviteCode] = useState('');
    const [foundOrg, setFoundOrg] = useState<{ id: string; name: string } | null>(null);

    // Check if user already has an org
    useEffect(() => {
        async function checkOrgs() {
            if (status !== 'authenticated') return;
            
            try {
                const res = await fetch('/api/user/organizations');
                const data = await res.json();
                
                if (data.organizations && data.organizations.length > 0) {
                    // User already has an org, redirect to dashboard
                    router.push('/dashboard');
                }
            } catch (e) {
                console.error('Error checking orgs:', e);
            }
        }
        
        checkOrgs();
    }, [status, router]);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) {
            setError('Please enter an organization name');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: orgName.trim(),
                    type: orgType,
                }),
            });

            const data = await res.json();

            if (data.success || data.organization) {
                // Update session to include new org
                await updateSession();
                setStep('complete');
                
                // Redirect after a moment
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            } else {
                setError(data.error || 'Failed to create organization');
            }
        } catch (e) {
            console.error('Error creating org:', e);
            setError('Failed to create organization. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLookupCode = async () => {
        if (inviteCode.length < 4) {
            setError('Please enter a valid invite code');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/organizations/lookup?code=${inviteCode.toUpperCase()}`);
            const data = await res.json();

            if (data.organization) {
                setFoundOrg(data.organization);
            } else {
                setError('No organization found with that code');
            }
        } catch (e) {
            setError('Failed to look up code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinOrg = async () => {
        if (!foundOrg) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/organizations/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: foundOrg.id,
                    invite_code: inviteCode.toUpperCase(),
                }),
            });

            const data = await res.json();

            if (data.success) {
                await updateSession();
                setStep('complete');
                
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            } else {
                setError(data.error || 'Failed to join organization');
            }
        } catch (e) {
            setError('Failed to join organization. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Welcome to Peer Support Studio</h1>
                    <p className="text-purple-200">Let's get you set up</p>
                </div>

                {/* Step: Choice */}
                {step === 'choice' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setStep('create-org')}
                            className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 text-left hover:bg-white/20 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center group-hover:bg-purple-500/50 transition-colors">
                                    <Plus className="w-6 h-6 text-purple-300" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white mb-1">Create New Organization</h3>
                                    <p className="text-purple-200 text-sm">Start fresh with your own organization. You'll be the admin.</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        <button
                            onClick={() => setStep('join-org')}
                            className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 text-left hover:bg-white/20 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/50 transition-colors">
                                    <Users className="w-6 h-6 text-blue-300" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white mb-1">Join Existing Organization</h3>
                                    <p className="text-purple-200 text-sm">Have an invite code? Join your team's organization.</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        <p className="text-center text-purple-300 text-sm mt-6">
                            Not sure? You can always join more organizations later.
                        </p>
                    </div>
                )}

                {/* Step: Create Organization */}
                {step === 'create-org' && (
                    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
                        <button
                            onClick={() => { setStep('choice'); setError(null); }}
                            className="text-purple-300 text-sm mb-4 hover:text-white"
                        >
                            ← Back
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/30 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-purple-300" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Create Organization</h2>
                                <p className="text-sm text-purple-200">Set up your organization</p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleCreateOrg} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-2">
                                    Organization Name *
                                </label>
                                <input
                                    type="text"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    placeholder="e.g., Louisville Recovery Center"
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-2">
                                    Organization Type
                                </label>
                                <select
                                    value={orgType}
                                    onChange={(e) => setOrgType(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="peer_org" className="bg-slate-800">Peer Support Organization</option>
                                    <option value="treatment_center" className="bg-slate-800">Treatment Center</option>
                                    <option value="recovery_house" className="bg-slate-800">Recovery House</option>
                                    <option value="independent" className="bg-slate-800">Independent Practice</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Create Organization
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Step: Join Organization */}
                {step === 'join-org' && (
                    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
                        <button
                            onClick={() => { setStep('choice'); setError(null); setFoundOrg(null); setInviteCode(''); }}
                            className="text-purple-300 text-sm mb-4 hover:text-white"
                        >
                            ← Back
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/30 flex items-center justify-center">
                                <Key className="w-5 h-5 text-blue-300" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Join Organization</h2>
                                <p className="text-sm text-purple-200">Enter your invite code</p>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        )}

                        {!foundOrg ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">
                                        Invite Code
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        placeholder="e.g., ABC123"
                                        maxLength={10}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-2xl tracking-widest font-mono"
                                    />
                                    <p className="text-xs text-purple-300 mt-2 text-center">
                                        Ask your organization admin for this code
                                    </p>
                                </div>

                                <button
                                    onClick={handleLookupCode}
                                    disabled={loading || inviteCode.length < 4}
                                    className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Looking up...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowRight className="w-5 h-5" />
                                            Find Organization
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-500/30 flex items-center justify-center">
                                            <Building2 className="w-5 h-5 text-green-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-green-200">Organization found</p>
                                            <p className="font-semibold text-white">{foundOrg.name}</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleJoinOrg}
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Joining...
                                        </>
                                    ) : (
                                        <>
                                            <Users className="w-5 h-5" />
                                            Join {foundOrg.name}
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setFoundOrg(null); setInviteCode(''); }}
                                    className="w-full py-2 text-purple-300 hover:text-white text-sm"
                                >
                                    Use a different code
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step: Complete */}
                {step === 'complete' && (
                    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">You're All Set!</h2>
                        <p className="text-purple-200 mb-4">Redirecting to your dashboard...</p>
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                    </div>
                )}
            </div>
        </div>
    );
}
