'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { formatDateOnly } from '@/lib/dateUtils';
import {
    ArrowLeft, Loader2, ShieldCheck, ThumbsUp, AlertCircle,
    User, Clock, Eye, Inbox
} from 'lucide-react';

interface ReviewNote {
    id: string;
    organization_id?: string;
    participant_name?: string | null;
    author_name?: string | null;
    source: string;
    review_status: string;
    submitted_at?: string | null;
    created_at: string;
    metadata?: { date?: string };
    pss_summary?: string;
    pss_note?: { sessionOverview?: string; content?: string } | null;
}

const SUPERVISOR_ROLES = ['supervisor', 'admin', 'owner'];

function snippet(note: ReviewNote): string {
    return (
        note.pss_note?.sessionOverview ||
        note.pss_note?.content ||
        note.pss_summary ||
        'No preview available'
    ).slice(0, 160);
}

export default function ReviewQueuePage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const currentOrg = (session as any)?.currentOrganization;
    const role = currentOrg?.role;
    const isSupervisor = SUPERVISOR_ROLES.includes(role);

    const [notes, setNotes] = useState<ReviewNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [changesFor, setChangesFor] = useState<string | null>(null);
    const [changesNotes, setChangesNotes] = useState('');

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    const fetchQueue = async () => {
        if (!currentOrg?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/session-notes?scope=team&review_status=submitted&organization_id=${currentOrg.id}`
            );
            const data = await res.json();
            if (res.ok) {
                setNotes(data.notes || []);
            }
        } catch (err) {
            console.error('Error fetching review queue:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (authStatus === 'authenticated' && isSupervisor) {
            fetchQueue();
        } else if (authStatus === 'authenticated') {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authStatus, currentOrg?.id]);

    const act = async (noteId: string, action: 'approve' | 'request_changes', reviewNotes?: string) => {
        setBusyId(noteId);
        setError(null);
        try {
            const res = await fetch(`/api/session-notes/${noteId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, review_notes: reviewNotes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');
            // Remove from the queue (no longer "submitted")
            setNotes((prev) => prev.filter((n) => n.id !== noteId));
            setChangesFor(null);
            setChangesNotes('');
        } catch (err: any) {
            setError(err.message || 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.push('/session-notes')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-[#0E2235]">Note Reviews</h1>
                        <p className="text-sm text-gray-500">Approve or return submitted session notes</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {!isSupervisor ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">Supervisor access required</h3>
                        <p className="text-gray-500">
                            Only supervisors, admins, or owners can review team notes.
                        </p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">Nothing to review</h3>
                        <p className="text-gray-500">Submitted notes will appear here for approval.</p>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                        <div className="space-y-4">
                            {notes.map((note) => (
                                <div key={note.id} className="bg-white rounded-xl shadow-sm p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                                {note.author_name && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <User className="w-3.5 h-3.5" /> {note.author_name}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {note.submitted_at
                                                        ? new Date(note.submitted_at).toLocaleDateString()
                                                        : formatDateOnly(note.metadata?.date || note.created_at)}
                                                </span>
                                                <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                                                    {note.source}
                                                </span>
                                            </div>
                                            {note.participant_name && (
                                                <p className="font-medium text-[#0E2235]">{note.participant_name}</p>
                                            )}
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{snippet(note)}</p>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/session-notes/${note.id}`)}
                                            className="p-2 text-gray-400 hover:text-[#1A73A8] transition-colors flex-shrink-0"
                                            title="View note"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {changesFor === note.id ? (
                                        <div className="mt-4">
                                            <textarea
                                                value={changesNotes}
                                                onChange={(e) => setChangesNotes(e.target.value)}
                                                rows={3}
                                                placeholder="What needs to be revised?"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] resize-none text-sm"
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => { setChangesFor(null); setChangesNotes(''); }}
                                                    className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => act(note.id, 'request_changes', changesNotes)}
                                                    disabled={busyId === note.id || !changesNotes.trim()}
                                                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                                >
                                                    {busyId === note.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    Send back
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => act(note.id, 'approve')}
                                                disabled={busyId === note.id}
                                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                                            >
                                                {busyId === note.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                                                Approve & Lock
                                            </button>
                                            <button
                                                onClick={() => { setChangesFor(note.id); setChangesNotes(''); }}
                                                disabled={busyId === note.id}
                                                className="py-2 px-4 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                                            >
                                                <AlertCircle className="w-4 h-4" />
                                                Request changes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
