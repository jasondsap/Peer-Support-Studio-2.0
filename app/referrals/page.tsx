'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Loader2, ClipboardList, Phone, Globe, MapPin,
    Calendar, Save, CheckCircle2, ExternalLink, User, AlertCircle,
} from 'lucide-react';

interface Referral {
    id: string;
    participant_id: string;
    participant_first_name?: string | null;
    participant_last_name?: string | null;
    participant_preferred_name?: string | null;
    referred_to: string;
    referral_type: string | null;
    contact_info: { phone?: string | null; website?: string | null; address?: string | null } | null;
    reason: string | null;
    status: string;
    follow_up_date: string | null;
    referred_at: string | null;
    notes: string | null;
    outcome: string | null;
    closed_at: string | null;
}

const STATUS_OPTIONS = ['referred', 'contacted', 'scheduled', 'enrolled', 'declined', 'closed'];
const OPEN_STATUSES = ['referred', 'contacted', 'scheduled'];

const STATUS_STYLES: Record<string, string> = {
    referred: 'bg-blue-100 text-blue-700 border-blue-200',
    contacted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    scheduled: 'bg-amber-100 text-amber-700 border-amber-200',
    enrolled: 'bg-green-100 text-green-700 border-green-200',
    declined: 'bg-gray-100 text-gray-600 border-gray-200',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function ReferralsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization as { id: string; name: string } | null;

    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [showClosed, setShowClosed] = useState(false);

    // Per-row local edits (status/follow_up/notes) before saving.
    const [edits, setEdits] = useState<Record<string, { status: string; follow_up_date: string; notes: string }>>({});

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/auth/signin');
    }, [status, router]);

    const fetchReferrals = useCallback(async () => {
        if (!currentOrg?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/referrals?organization_id=${currentOrg.id}`);
            const data = await res.json();
            const list: Referral[] = data.referrals || [];
            setReferrals(list);
            const initial: Record<string, { status: string; follow_up_date: string; notes: string }> = {};
            for (const r of list) {
                initial[r.id] = {
                    status: r.status,
                    follow_up_date: r.follow_up_date ? r.follow_up_date.slice(0, 10) : '',
                    notes: r.notes || '',
                };
            }
            setEdits(initial);
        } catch (e) {
            console.error('Failed to load referrals:', e);
        } finally {
            setLoading(false);
        }
    }, [currentOrg?.id]);

    useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

    const setEdit = (id: string, patch: Partial<{ status: string; follow_up_date: string; notes: string }>) => {
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const saveReferral = async (r: Referral) => {
        if (!currentOrg?.id) return;
        const e = edits[r.id];
        if (!e) return;
        setSavingId(r.id);
        try {
            const res = await fetch('/api/referrals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: r.id,
                    organization_id: currentOrg.id,
                    status: e.status,
                    follow_up_date: e.follow_up_date || null,
                    notes: e.notes,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                alert(d.error || 'Could not save referral.');
                return;
            }
            await fetchReferrals();
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setSavingId(null);
        }
    };

    const participantName = (r: Referral) =>
        `${r.participant_preferred_name || r.participant_first_name || 'Unknown'} ${r.participant_last_name || ''}`.trim();

    const isDirty = (r: Referral) => {
        const e = edits[r.id];
        if (!e) return false;
        return (
            e.status !== r.status ||
            e.follow_up_date !== (r.follow_up_date ? r.follow_up_date.slice(0, 10) : '') ||
            e.notes !== (r.notes || '')
        );
    };

    const openReferrals = referrals.filter(r => OPEN_STATUSES.includes(r.status));
    const closedReferrals = referrals.filter(r => !OPEN_STATUSES.includes(r.status));
    const visible = showClosed ? closedReferrals : openReferrals;

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const renderCard = (r: Referral) => {
        const e = edits[r.id] || { status: r.status, follow_up_date: '', notes: '' };
        return (
            <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-[#0E2235]">{participantName(r)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] || STATUS_STYLES.referred}`}>
                                {r.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-700">
                            Referred to <span className="font-medium">{r.referred_to}</span>
                            {r.referral_type ? <span className="text-gray-400"> · {r.referral_type}</span> : null}
                        </p>
                        {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                            {r.contact_info?.phone && (
                                <a href={`tel:${r.contact_info.phone}`} className="flex items-center gap-1 text-[#1A73A8] hover:underline">
                                    <Phone className="w-3 h-3" /> {r.contact_info.phone}
                                </a>
                            )}
                            {r.contact_info?.website && (
                                <a
                                    href={r.contact_info.website.startsWith('http') ? r.contact_info.website : `https://${r.contact_info.website}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[#1A73A8] hover:underline"
                                >
                                    <Globe className="w-3 h-3" /> Website <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            )}
                            {r.contact_info?.address && (
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {r.contact_info.address}</span>
                            )}
                        </div>
                        {r.referred_at && (
                            <p className="text-xs text-gray-400 mt-1">
                                Referred {new Date(r.referred_at).toLocaleDateString()}
                                {r.closed_at && ` · Closed ${new Date(r.closed_at).toLocaleDateString()}`}
                            </p>
                        )}
                    </div>

                    {/* Inline controls */}
                    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                        <select
                            value={e.status}
                            onChange={(ev) => setEdit(r.id, { status: ev.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                        >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={e.follow_up_date}
                                onChange={(ev) => setEdit(r.id, { follow_up_date: ev.target.value })}
                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                <textarea
                    value={e.notes}
                    onChange={(ev) => setEdit(r.id, { notes: ev.target.value })}
                    placeholder="Add a follow-up note..."
                    rows={2}
                    className="w-full mt-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent resize-y"
                />

                <div className="flex justify-end mt-2">
                    <button
                        onClick={() => saveReferral(r)}
                        disabled={!isDirty(r) || savingId === r.id}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#1A73A8] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                        {savingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A73A8] to-[#0E5A8A] flex items-center justify-center shadow-lg">
                            <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[#0E2235]">Referrals</h1>
                            <p className="text-xs text-gray-500">Track and close the loop on participant referrals</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex items-center gap-2 mb-6">
                    <button
                        onClick={() => setShowClosed(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!showClosed ? 'bg-[#1A73A8] text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                    >
                        Open ({openReferrals.length})
                    </button>
                    <button
                        onClick={() => setShowClosed(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showClosed ? 'bg-[#1A73A8] text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                    >
                        Closed ({closedReferrals.length})
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
                        {showClosed ? (
                            <>
                                <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No closed referrals yet.</p>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 mb-2">No open referrals.</p>
                                <button
                                    onClick={() => router.push('/resource-navigator')}
                                    className="text-sm text-[#1A73A8] hover:underline"
                                >
                                    Find a treatment facility to refer a participant
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visible.map(renderCard)}
                    </div>
                )}
            </main>
        </div>
    );
}
