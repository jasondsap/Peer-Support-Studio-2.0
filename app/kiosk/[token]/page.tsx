'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle2, ArrowLeft, UserCheck, KeyRound } from 'lucide-react';

interface Activity {
    id: string;
    name: string;
    activity_type: string;
    start_time: string | null;
}

type Step = 'welcome' | 'event' | 'identify' | 'success' | 'notfound';

export default function KioskPage() {
    const params = useParams();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [orgName, setOrgName] = useState('');
    const [activities, setActivities] = useState<Activity[]>([]);

    const [step, setStep] = useState<Step>('welcome');
    const [activity, setActivity] = useState<Activity | null>(null);
    const [method, setMethod] = useState<'name_dob' | 'code'>('name_dob');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmName, setConfirmName] = useState('');

    const loadKiosk = useCallback(async () => {
        try {
            const res = await fetch(`/api/kiosk/${token}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Kiosk unavailable');
            setOrgName(data.organization_name || 'Recovery Center');
            setActivities(data.activities || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadKiosk();
    }, [loadKiosk]);

    const startCheckIn = () => {
        if (activities.length === 1) {
            setActivity(activities[0]);
            setStep('identify');
        } else {
            setStep('event');
        }
    };

    const reset = useCallback(() => {
        setStep('welcome');
        setActivity(null);
        setFirstName('');
        setLastName('');
        setDob('');
        setCode('');
        setConfirmName('');
        setMethod('name_dob');
        loadKiosk();
    }, [loadKiosk]);

    // Auto-return to welcome after a success or not-found screen.
    useEffect(() => {
        if (step === 'success' || step === 'notfound') {
            const t = setTimeout(reset, step === 'success' ? 3500 : 5000);
            return () => clearTimeout(t);
        }
    }, [step, reset]);

    const submit = async () => {
        if (!activity) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/kiosk/${token}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity_id: activity.id,
                    method,
                    first_name: firstName,
                    last_name: lastName,
                    dob,
                    code,
                }),
            });
            const data = await res.json();
            if (res.status === 429) {
                setError(data.error);
                return;
            }
            if (data.matched) {
                setConfirmName(data.first_name || '');
                setStep('success');
            } else {
                setStep('notfound');
            }
        } catch {
            setStep('notfound');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0E2235] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0E2235] flex items-center justify-center p-8 text-center">
                <div>
                    <p className="text-white text-2xl font-semibold mb-2">Kiosk unavailable</p>
                    <p className="text-white/60">{error}</p>
                </div>
            </div>
        );
    }

    const canSubmit =
        method === 'code' ? code.trim().length > 0 : !!(firstName.trim() && lastName.trim());

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0E2235] to-[#1A73A8] flex items-center justify-center p-6">
            <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-10">
                {/* WELCOME */}
                {step === 'welcome' && (
                    <div className="text-center">
                        <p className="text-sm uppercase tracking-wide text-[#1A73A8] font-semibold mb-2">{orgName}</p>
                        <h1 className="text-4xl font-bold text-[#0E2235] mb-3">Welcome</h1>
                        <p className="text-gray-500 mb-10 text-lg">Check in to today's group.</p>
                        <button
                            onClick={startCheckIn}
                            disabled={activities.length === 0}
                            className="w-full py-6 text-white text-2xl font-semibold rounded-2xl hover:opacity-90 disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            {activities.length === 0 ? 'No groups scheduled today' : 'Check in'}
                        </button>
                    </div>
                )}

                {/* PICK EVENT */}
                {step === 'event' && (
                    <div>
                        <button onClick={reset} className="flex items-center gap-2 text-gray-400 mb-6">
                            <ArrowLeft className="w-5 h-5" /> Start over
                        </button>
                        <h2 className="text-2xl font-bold text-[#0E2235] mb-6">Which group are you here for?</h2>
                        <div className="space-y-3">
                            {activities.map((a) => (
                                <button
                                    key={a.id}
                                    onClick={() => {
                                        setActivity(a);
                                        setStep('identify');
                                    }}
                                    className="w-full text-left p-5 rounded-2xl border-2 border-gray-100 hover:border-[#1A73A8] hover:bg-[#1A73A8]/5"
                                >
                                    <span className="text-xl font-semibold text-[#0E2235]">{a.name}</span>
                                    {a.start_time && (
                                        <span className="block text-gray-400 mt-1">{a.start_time.slice(0, 5)}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* IDENTIFY */}
                {step === 'identify' && (
                    <div>
                        <button
                            onClick={() => setStep(activities.length === 1 ? 'welcome' : 'event')}
                            className="flex items-center gap-2 text-gray-400 mb-6"
                        >
                            <ArrowLeft className="w-5 h-5" /> Back
                        </button>
                        <h2 className="text-2xl font-bold text-[#0E2235] mb-1">Tell us who you are</h2>
                        {activity && <p className="text-gray-400 mb-6">{activity.name}</p>}

                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setMethod('name_dob')}
                                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    method === 'name_dob' ? 'bg-[#1A73A8] text-white' : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                <UserCheck className="w-5 h-5" /> Name
                            </button>
                            <button
                                onClick={() => setMethod('code')}
                                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    method === 'code' ? 'bg-[#1A73A8] text-white' : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                <KeyRound className="w-5 h-5" /> My code
                            </button>
                        </div>

                        {method === 'name_dob' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        className="px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1A73A8]"
                                        placeholder="First name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                    <input
                                        className="px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1A73A8]"
                                        placeholder="Last name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <input
                                className="w-full px-4 py-4 text-2xl tracking-widest text-center uppercase border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1A73A8]"
                                placeholder="YOUR CODE"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                maxLength={10}
                            />
                        )}

                        <button
                            onClick={submit}
                            disabled={!canSubmit || submitting}
                            className="w-full mt-8 py-5 text-white text-xl font-semibold rounded-2xl hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Check in'}
                        </button>
                    </div>
                )}

                {/* SUCCESS */}
                {step === 'success' && (
                    <div className="text-center py-8">
                        <CheckCircle2 className="w-20 h-20 text-[#30B27A] mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-[#0E2235] mb-2">
                            You're checked in{confirmName ? `, ${confirmName}` : ''}!
                        </h2>
                        <p className="text-gray-500">Welcome. Enjoy your group.</p>
                    </div>
                )}

                {/* NOT FOUND */}
                {step === 'notfound' && (
                    <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-[#0E2235] mb-2">We couldn't find you</h2>
                        <p className="text-gray-500 mb-6">Please check in with the front desk and they'll help you.</p>
                        <button
                            onClick={reset}
                            className="px-8 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium"
                        >
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
