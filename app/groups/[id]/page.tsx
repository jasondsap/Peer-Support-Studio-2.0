'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    Users,
    Clock,
    MapPin,
    CalendarDays,
    UserPlus,
    Search,
    X,
    Trash2,
    Pencil,
    FileText,
    ExternalLink,
    Paperclip,
} from 'lucide-react';
import { formatDateOnly } from '@/lib/dateUtils';
import LessonPicker, { AttachableLesson } from '@/app/components/LessonPicker';

const TYPE_OPTIONS = [
    { value: 'recovery_group', label: 'Recovery Group' },
    { value: 'outreach', label: 'Outreach' },
    { value: 'community_event', label: 'Community Event' },
    { value: 'class', label: 'Class' },
    { value: 'other', label: 'Other' },
];
const AUDIENCE_OPTIONS = ['recoverees', 'family', 'community', 'youth', 'general'];

interface RosterRow {
    id: string;
    participant_id: string;
    attendance_status: string;
    source: string;
    check_in_time: string;
    notes: string | null;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
}

interface Activity {
    id: string;
    name: string;
    activity_type: string;
    primary_audience: string | null;
    activity_date: string;
    start_time: string | null;
    duration_minutes: number | null;
    location_name: string | null;
    facilitator_name: string | null;
    headcount_total: number | null;
    notes: string | null;
    lesson_id?: string | null;
    lesson_source?: string | null;
    lesson_title?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
    recovery_group: 'Recovery Group',
    outreach: 'Outreach',
    community_event: 'Community Event',
    class: 'Class',
    other: 'Other',
};
const STATUSES = ['present', 'excused', 'no_show'];
const statusLabel = (s: string) => (s === 'no_show' ? 'No-show' : s.charAt(0).toUpperCase() + s.slice(1));
const pName = (r: { first_name: string; last_name: string; preferred_name: string | null }) =>
    `${r.preferred_name || r.first_name} ${r.last_name}`;
const formatDate = (d: string) =>
    formatDateOnly(d, { month: 'long', day: 'numeric', year: 'numeric' });

export default function ActivityDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;
    const activityId = params.id as string;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [roster, setRoster] = useState<RosterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [headcount, setHeadcount] = useState('');

    const [showAdd, setShowAdd] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);

    const [showEdit, setShowEdit] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Group → note bridge state.
    const [draftOpen, setDraftOpen] = useState(false);
    const [draftingNotes, setDraftingNotes] = useState(false);
    const [draftResult, setDraftResult] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/group-activities/${activityId}`);
            if (!res.ok) throw new Error('not found');
            const data = await res.json();
            setActivity(data.activity);
            setRoster(data.roster || []);
            setHeadcount(data.activity?.headcount_total != null ? String(data.activity.headcount_total) : '');
        } catch {
            router.push('/groups');
        } finally {
            setLoading(false);
        }
    }, [activityId, router]);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated' && activityId) load();
    }, [authStatus, activityId, load]);

    // Participant search for the add modal
    useEffect(() => {
        if (!showAdd || !currentOrg?.id || searchQ.trim().length < 2) {
            setResults([]);
            return;
        }
        let active = true;
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/participants?organization_id=${currentOrg.id}&search=${encodeURIComponent(searchQ)}&status=active`
                );
                const data = await res.json();
                if (active) setResults(data.participants || []);
            } catch {
                if (active) setResults([]);
            } finally {
                if (active) setSearching(false);
            }
        }, 250);
        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [searchQ, showAdd, currentOrg?.id]);

    const alreadyIn = new Set(roster.map((r) => r.participant_id));

    const addAttendee = async (participantId: string) => {
        setAdding(true);
        try {
            const res = await fetch(`/api/group-activities/${activityId}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantIds: [participantId] }),
            });
            if (!res.ok) throw new Error('add failed');
            await load();
            setSearchQ('');
            setResults([]);
        } catch {
            alert('Could not add attendee.');
        } finally {
            setAdding(false);
        }
    };

    const updateStatus = async (attendanceId: string, status: string) => {
        setRoster((r) => r.map((row) => (row.id === attendanceId ? { ...row, attendance_status: status } : row)));
        await fetch(`/api/group-activities/${activityId}/attendance`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attendance_id: attendanceId, attendance_status: status }),
        }).catch(() => {});
    };

    const removeAttendee = async (attendanceId: string) => {
        if (!confirm('Remove this attendee?')) return;
        const res = await fetch(`/api/group-activities/${activityId}/attendance?attendance_id=${attendanceId}`, {
            method: 'DELETE',
        });
        if (res.ok) setRoster((r) => r.filter((row) => row.id !== attendanceId));
    };

    const saveHeadcount = async () => {
        await fetch(`/api/group-activities/${activityId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headcount_total: headcount === '' ? null : Number(headcount) }),
        }).catch(() => {});
    };

    const handleDelete = async () => {
        if (!confirm('Delete this activity? It will be removed from the list. Attendance records are kept.')) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/group-activities/${activityId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            router.push('/groups');
        } catch {
            alert('Could not delete the activity. You may not have permission.');
            setDeleting(false);
        }
    };

    // Group → note bridge: one draft session note per present attendee, linked to
    // this activity via group_activity_id (passed to the shared POST /api/session-notes).
    const draftNotesForActivity = async () => {
        if (!activity) return;
        const present = roster.filter((r) => r.attendance_status !== 'no_show');
        if (present.length === 0) return;
        setDraftingNotes(true);
        let created = 0;
        try {
            for (const r of present) {
                const metadata = {
                    groupTopic: activity.lesson_title || activity.name,
                    sessionType: 'group',
                    source: 'group',
                    group_name: activity.name,
                    duration_minutes: activity.duration_minutes,
                    sessionDate: activity.activity_date ? String(activity.activity_date).slice(0, 10) : undefined,
                };
                const pss_note = {
                    sessionOverview: `Group activity: ${activity.name}${
                        activity.duration_minutes ? ` — ${activity.duration_minutes} min` : ''
                    }.`,
                    topicsDiscussed: [activity.lesson_title || activity.name],
                    strengthsObserved: [],
                    recoverySupportProvided: [],
                    actionItems: [],
                    followUpNeeded: [],
                };
                const res = await fetch('/api/session-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        metadata,
                        pss_note,
                        source: 'group',
                        organization_id: currentOrg?.id,
                        participant_id: r.participant_id,
                        group_activity_id: activity.id,
                    }),
                });
                if (res.ok) created++;
            }
            setDraftResult(`Created ${created} draft note${created === 1 ? '' : 's'}. Finish and submit them under Session Notes.`);
        } catch {
            setDraftResult('Some notes could not be drafted. Please try again from Session Notes.');
        } finally {
            setDraftingNotes(false);
        }
    };

    const lessonHref = (a: Activity) =>
        a.lesson_source === 'template' ? `/lesson-library/${a.lesson_id}` : `/lesson/${a.lesson_id}`;

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }
    if (!activity) return null;

    const presentCount = roster.filter((r) => r.attendance_status !== 'no_show').length;

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/groups')} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <nav className="flex items-center gap-2 text-sm min-w-0">
                        <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline flex-shrink-0">
                            Dashboard
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <button onClick={() => router.push('/groups')} className="text-[#1A73A8] hover:underline flex-shrink-0">
                            Group Activities
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 font-medium truncate">{activity.name}</span>
                    </nav>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Activity header */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8 mb-6">
                    <div className="flex items-start justify-between gap-4">
                        <span className="inline-flex items-center text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full mb-3">
                            {TYPE_LABELS[activity.activity_type] || activity.activity_type}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowEdit(true)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Delete
                            </button>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-[#0E2235] mb-4">{activity.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-gray-400" />
                            {formatDate(activity.activity_date)}
                        </span>
                        {activity.start_time && (
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {activity.start_time.slice(0, 5)}
                                {activity.duration_minutes ? ` · ${activity.duration_minutes} min` : ''}
                            </span>
                        )}
                        {activity.location_name && (
                            <span className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {activity.location_name}
                            </span>
                        )}
                        {activity.facilitator_name && <span>Facilitator: {activity.facilitator_name}</span>}
                    </div>
                    {activity.lesson_id && (
                        <a
                            href={lessonHref(activity)}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1A73A8] hover:underline"
                        >
                            <FileText className="w-4 h-4" />
                            Deliver this lesson{activity.lesson_title ? `: ${activity.lesson_title}` : ''}
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                    {activity.notes && <p className="text-gray-600 mt-4">{activity.notes}</p>}
                </div>

                {/* Bulk headcount */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-5 mb-6 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Total headcount (optional)</span>
                    <input
                        type="number"
                        min="0"
                        value={headcount}
                        onChange={(e) => setHeadcount(e.target.value)}
                        onBlur={saveHeadcount}
                        placeholder="e.g. 14"
                        className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                    />
                    <span className="text-xs text-gray-400">
                        Use this for a quick total when you aren't recording each person by name.
                    </span>
                </div>

                {/* Roster */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-[#0E2235] flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#30B27A]" />
                            Attendance
                            <span className="text-sm font-normal text-gray-400">({presentCount})</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            {presentCount > 0 && (
                                <button
                                    onClick={() => {
                                        setDraftResult(null);
                                        setDraftOpen(true);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-[#1A73A8] border border-[#1A73A8]/30 rounded-lg hover:bg-[#1A73A8]/5 flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Draft notes
                                </button>
                            )}
                            <button
                                onClick={() => setShowAdd(true)}
                                className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                <UserPlus className="w-4 h-4" />
                                Add attendee
                            </button>
                        </div>
                    </div>

                    {roster.length === 0 ? (
                        <div className="px-6 py-10 text-center text-gray-500 text-sm">
                            No individual attendance recorded yet.
                        </div>
                    ) : (
                        roster.map((r) => (
                            <div
                                key={r.id}
                                className="flex items-center gap-4 px-6 py-3 border-b border-gray-50 hover:bg-gray-50"
                            >
                                <button
                                    onClick={() => router.push(`/participants/${r.participant_id}`)}
                                    className="flex-1 text-left text-sm font-medium text-[#0E2235] hover:text-[#1A73A8]"
                                >
                                    {pName(r)}
                                </button>
                                {r.source === 'kiosk' && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">kiosk</span>
                                )}
                                <select
                                    value={r.attendance_status}
                                    onChange={(e) => updateStatus(r.id, e.target.value)}
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                >
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {statusLabel(s)}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => removeAttendee(r.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Edit activity modal */}
            {showEdit && (
                <EditActivityModal
                    activity={activity}
                    orgId={currentOrg?.id}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => {
                        setShowEdit(false);
                        load();
                    }}
                />
            )}

            {/* Add attendee modal */}
            {showAdd && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h3 className="font-semibold text-[#0E2235]">Add attendee</h3>
                            <button
                                onClick={() => {
                                    setShowAdd(false);
                                    setSearchQ('');
                                    setResults([]);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search participants by name..."
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-sm"
                                />
                            </div>
                        </div>
                        <div className="px-5 pb-5 overflow-y-auto">
                            {searching ? (
                                <div className="py-6 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#1A73A8] mx-auto" />
                                </div>
                            ) : searchQ.trim().length < 2 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">Type at least 2 characters.</p>
                            ) : results.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">No participants found.</p>
                            ) : (
                                results.map((p) => {
                                    const inRoster = alreadyIn.has(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            disabled={inRoster || adding}
                                            onClick={() => addAttendee(p.id)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left"
                                        >
                                            <span className="text-sm text-[#0E2235]">
                                                {(p.preferred_name || p.first_name)} {p.last_name}
                                            </span>
                                            {inRoster ? (
                                                <span className="text-xs text-gray-400">Added</span>
                                            ) : (
                                                <UserPlus className="w-4 h-4 text-[#1A73A8]" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Draft notes for attendees */}
            {draftOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-[#0E2235]">Draft notes for attendees</h3>
                            <button onClick={() => setDraftOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-4">
                            {draftResult ? (
                                <p className="text-sm text-gray-700">{draftResult}</p>
                            ) : (
                                <p className="text-sm text-gray-600">
                                    Create a draft session note for each of the{' '}
                                    <span className="font-medium text-[#0E2235]">{presentCount}</span> present attendee
                                    {presentCount === 1 ? '' : 's'} of{' '}
                                    <span className="font-medium text-[#0E2235]">{activity.name}</span>. Each note is prefilled
                                    with the activity name and duration; you finish and submit them under Session Notes.
                                </p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                            {draftResult ? (
                                <button
                                    onClick={() => setDraftOpen(false)}
                                    className="px-5 py-2 text-white font-medium rounded-lg hover:opacity-90"
                                    style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                                >
                                    Done
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setDraftOpen(false)} className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={draftNotesForActivity}
                                        disabled={draftingNotes}
                                        className="px-5 py-2 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                                    >
                                        {draftingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                        Draft notes
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function EditActivityModal({
    activity,
    orgId,
    onClose,
    onSaved,
}: {
    activity: any;
    orgId?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [locations, setLocations] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [lessonOpen, setLessonOpen] = useState(false);
    const [lesson, setLesson] = useState<{ id: string | null; source: string | null; title: string | null }>({
        id: activity.lesson_id || null,
        source: activity.lesson_source || null,
        title: activity.lesson_title || null,
    });
    const [form, setForm] = useState({
        name: activity.name || '',
        activity_type: activity.activity_type || 'recovery_group',
        primary_audience: activity.primary_audience || 'recoverees',
        activity_date: activity.activity_date ? String(activity.activity_date).slice(0, 10) : '',
        start_time: activity.start_time ? String(activity.start_time).slice(0, 5) : '',
        duration_minutes: activity.duration_minutes != null ? String(activity.duration_minutes) : '',
        location_id: activity.location_id || '',
        facilitator_id: activity.facilitator_id || '',
        notes: activity.notes || '',
    });

    useEffect(() => {
        if (!orgId) return;
        fetch(`/api/locations?organization_id=${orgId}`)
            .then((r) => r.json())
            .then((d) => setLocations(d.locations || []))
            .catch(() => {});
        fetch(`/api/organizations/members?organization_id=${orgId}`)
            .then((r) => r.json())
            .then((d) => setMembers(d.members || d.users || []))
            .catch(() => {});
    }, [orgId]);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
    const memberName = (m: any) =>
        m.display_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member';
    const memberId = (m: any) => m.user_id || m.id;

    const save = async () => {
        if (!form.name || !form.activity_date) {
            alert('Name and date are required.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/group-activities/${activity.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
                    start_time: form.start_time || null,
                    location_id: form.location_id || null,
                    facilitator_id: form.facilitator_id || null,
                    lesson_id: lesson.id,
                    lesson_source: lesson.source,
                }),
            });
            if (!res.ok) throw new Error();
            onSaved();
        } catch {
            alert('Could not save changes. You may not have permission.');
            setSaving(false);
        }
    };

    const inputCls =
        'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-sm';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
                    <h3 className="font-semibold text-[#0E2235]">Edit activity</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Activity name *</label>
                        <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select className={inputCls} value={form.activity_type} onChange={(e) => set('activity_type', e.target.value)}>
                                {TYPE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                            <select className={inputCls} value={form.primary_audience} onChange={(e) => set('primary_audience', e.target.value)}>
                                {AUDIENCE_OPTIONS.map((o) => (
                                    <option key={o} value={o}>
                                        {o.charAt(0).toUpperCase() + o.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input type="date" className={inputCls} value={form.activity_date} onChange={(e) => set('activity_date', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                            <input type="time" className={inputCls} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                            <input type="number" min="0" className={inputCls} value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                            <select className={inputCls} value={form.location_id} onChange={(e) => set('location_id', e.target.value)}>
                                <option value="">— None —</option>
                                {locations.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Facilitator</label>
                            <select className={inputCls} value={form.facilitator_id} onChange={(e) => set('facilitator_id', e.target.value)}>
                                <option value="">— None —</option>
                                {members.map((m) => (
                                    <option key={memberId(m)} value={memberId(m)}>
                                        {memberName(m)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Attached lesson</label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 truncate">
                                {lesson.id ? lesson.title || 'Lesson attached' : <span className="text-gray-400">No lesson attached</span>}
                            </div>
                            <button
                                type="button"
                                onClick={() => setLessonOpen(true)}
                                className="px-3 py-2 text-sm font-medium text-[#1A73A8] border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
                            >
                                <Paperclip className="w-4 h-4" />
                                {lesson.id ? 'Change' : 'Attach'}
                            </button>
                        </div>
                    </div>
                </div>

                <LessonPicker
                    open={lessonOpen}
                    onClose={() => setLessonOpen(false)}
                    onSelect={(l: AttachableLesson | null) => {
                        setLesson({ id: l?.id ?? null, source: l?.source ?? null, title: l?.title ?? null });
                        setLessonOpen(false);
                    }}
                    currentLesson={{ id: lesson.id, title: lesson.title }}
                />

                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-6 py-2.5 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save changes'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
