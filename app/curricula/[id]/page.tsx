'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    GraduationCap,
    Clock,
    BookOpen,
    Users,
    Plus,
    Search,
    X,
    CheckCircle2,
    CalendarDays,
    MapPin,
    BarChart3,
    Trash2,
    Paperclip,
    FileText,
    Download,
    ExternalLink,
} from 'lucide-react';
import { formatDateOnly } from '@/lib/dateUtils';
import LessonPicker, { AttachableLesson } from '@/app/components/LessonPicker';

interface Module {
    id: string;
    module_number: number;
    title: string;
    description: string | null;
    minimum_minutes: number | null;
    minimum_hours: number | null;
    lesson_id?: string | null;
    lesson_source?: string | null;
    lesson_title?: string | null;
}

interface Curriculum {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    total_hours: number | null;
    status: string;
    modules: Module[];
}

interface Enrollment {
    id: string;
    participant_id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    status: string;
    enrolled_at: string;
    modules_completed: number;
}

interface ParticipantOption {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
}

interface LocationOption {
    id: string;
    name: string;
}

interface Session {
    id: string;
    module_id: string;
    module_number: number;
    module_title: string;
    session_date: string;
    start_time: string | null;
    duration_minutes: number | null;
    facilitator_name: string | null;
    location_name: string | null;
    attendee_count: number;
    present_count: number;
    notes: string | null;
}

interface AttendanceRow {
    participant_id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    status: string;
}

type SessionDetail = Session & { attendance: AttendanceRow[] };

const ATTENDANCE_STATUSES = ['present', 'absent', 'excused', 'late'] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const ATTENDANCE_STYLES: Record<AttendanceStatus, string> = {
    present: 'text-green-700 bg-green-50',
    absent: 'text-red-700 bg-red-50',
    excused: 'text-amber-700 bg-amber-50',
    late: 'text-amber-700 bg-amber-50',
};

const ENROLL_STATUS_STYLES: Record<string, string> = {
    active: 'text-green-700 bg-green-50',
    completed: 'text-blue-700 bg-blue-50',
    withdrawn: 'text-red-700 bg-red-50',
    paused: 'text-amber-700 bg-amber-50',
};

const displayName = (p: { first_name: string; last_name: string; preferred_name?: string | null }) =>
    `${p.preferred_name || p.first_name} ${p.last_name}`;

export default function CurriculumDetailPage() {
    const router = useRouter();
    const params = useParams();
    const curriculumId = params.id as string;
    const { data: session, status: authStatus } = useSession();
    const orgId = (session as any)?.currentOrganization?.id;
    const role = (session as any)?.currentOrganization?.role || '';
    const canManage = ['owner', 'admin', 'supervisor'].includes(role);

    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [totalModules, setTotalModules] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'enrollments' | 'sessions' | 'reports'>('overview');

    const [showEnroll, setShowEnroll] = useState(false);
    const [participants, setParticipants] = useState<ParticipantOption[]>([]);
    const [enrollSearch, setEnrollSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [enrolling, setEnrolling] = useState(false);

    const [sessions, setSessions] = useState<Session[]>([]);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [showLogSession, setShowLogSession] = useState(false);
    const [logging, setLogging] = useState(false);
    const [logModuleId, setLogModuleId] = useState('');
    const [logDate, setLogDate] = useState('');
    const [logDuration, setLogDuration] = useState('');
    const [logLocationId, setLogLocationId] = useState('');
    const [logNotes, setLogNotes] = useState('');
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

    const [editSession, setEditSession] = useState<SessionDetail | null>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editDate, setEditDate] = useState('');
    const [editDuration, setEditDuration] = useState('');
    const [editLocationId, setEditLocationId] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editAttendance, setEditAttendance] = useState<Record<string, AttendanceStatus>>({});

    // Lesson attach (per-module) + reports + group→note bridge state.
    const [attachModule, setAttachModule] = useState<Module | null>(null);
    const [reports, setReports] = useState<any>(null);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [draftPrompt, setDraftPrompt] = useState<
        { sessionId: string; moduleTitle: string; duration: number | null; attendees: { participant_id: string; name: string }[] } | null
    >(null);
    const [draftingNotes, setDraftingNotes] = useState(false);
    const [draftResult, setDraftResult] = useState<string | null>(null);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') {
            fetchCurriculum();
            fetchEnrollments();
            fetchSessions();
        }
    }, [authStatus, curriculumId]);

    const fetchCurriculum = async () => {
        try {
            const res = await fetch(`/api/curricula/${curriculumId}`);
            if (!res.ok) {
                if (res.status === 404) router.push('/curricula');
                return;
            }
            const data = await res.json();
            setCurriculum(data.curriculum);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrollments = async () => {
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/enrollments`);
            if (!res.ok) return;
            const data = await res.json();
            setEnrollments(data.enrollments || []);
            setTotalModules(data.total_modules || 0);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSessions = async () => {
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/sessions`);
            if (!res.ok) return;
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (e) {
            console.error(e);
        }
    };

    const openLogSession = async () => {
        // Default the form: first module, today, all active enrollees present.
        setLogModuleId(curriculum?.modules[0]?.id || '');
        setLogDate(new Date().toISOString().slice(0, 10));
        setLogDuration('');
        setLogLocationId('');
        setLogNotes('');
        const initial: Record<string, AttendanceStatus> = {};
        enrollments
            .filter((e) => e.status === 'active')
            .forEach((e) => {
                initial[e.participant_id] = 'present';
            });
        setAttendance(initial);
        setShowLogSession(true);
        if (locations.length === 0 && orgId) {
            try {
                const res = await fetch(`/api/locations?organization_id=${orgId}`);
                if (res.ok) {
                    const data = await res.json();
                    setLocations(data.locations || []);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const cycleAttendance = (participantId: string) => {
        setAttendance((prev) => {
            const current = prev[participantId] || 'present';
            const idx = ATTENDANCE_STATUSES.indexOf(current);
            const next = ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length];
            return { ...prev, [participantId]: next };
        });
    };

    const submitSession = async () => {
        if (!logModuleId || !logDate) return;
        setLogging(true);
        try {
            const attendees = Object.entries(attendance).map(([participant_id, status]) => ({
                participant_id,
                status,
            }));
            const res = await fetch(`/api/curricula/${curriculumId}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module_id: logModuleId,
                    session_date: logDate,
                    duration_minutes: logDuration ? Number(logDuration) : null,
                    location_id: logLocationId || null,
                    notes: logNotes || null,
                    attendees,
                }),
            });
            if (res.ok) {
                const data = await res.json().catch(() => null);
                setShowLogSession(false);
                await Promise.all([fetchSessions(), fetchEnrollments()]);

                // Offer to draft a session note for each PRESENT attendee.
                const sessionId = data?.session?.id;
                if (sessionId) {
                    const present = enrollments
                        .filter((e) => attendance[e.participant_id] === 'present')
                        .map((e) => ({ participant_id: e.participant_id, name: displayName(e) }));
                    const moduleTitle = curriculum?.modules.find((m) => m.id === logModuleId)?.title || 'Session';
                    if (present.length > 0) {
                        setDraftResult(null);
                        setDraftPrompt({
                            sessionId,
                            moduleTitle,
                            duration: logDuration ? Number(logDuration) : null,
                            attendees: present,
                        });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLogging(false);
        }
    };

    // Group → note bridge: create one draft session note per present attendee by
    // calling the shared POST /api/session-notes. Linking columns (curriculum_session_id,
    // source) are passed through so notes attach to this delivery once the notes API
    // persists them.
    const draftNotesForSession = async () => {
        if (!draftPrompt) return;
        setDraftingNotes(true);
        let created = 0;
        try {
            for (const a of draftPrompt.attendees) {
                const metadata = {
                    groupTopic: draftPrompt.moduleTitle,
                    sessionType: 'group',
                    source: 'curriculum',
                    curriculum_name: curriculum?.name || null,
                    duration_minutes: draftPrompt.duration,
                    sessionDate: new Date().toISOString().slice(0, 10),
                };
                const pss_note = {
                    sessionOverview: `Group curriculum session: ${draftPrompt.moduleTitle}${
                        curriculum?.name ? ` (${curriculum.name})` : ''
                    }${draftPrompt.duration ? ` — ${draftPrompt.duration} min` : ''}.`,
                    topicsDiscussed: [draftPrompt.moduleTitle],
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
                        source: 'curriculum',
                        organization_id: orgId,
                        participant_id: a.participant_id,
                        curriculum_session_id: draftPrompt.sessionId,
                    }),
                });
                if (res.ok) created++;
            }
            setDraftResult(`Created ${created} draft note${created === 1 ? '' : 's'}. Find them under Session Notes to finish and submit.`);
        } catch (e) {
            console.error(e);
            setDraftResult('Some notes could not be drafted. Please try again from Session Notes.');
        } finally {
            setDraftingNotes(false);
        }
    };

    const fetchReports = async () => {
        setReportsLoading(true);
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/reports`);
            if (res.ok) setReports(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setReportsLoading(false);
        }
    };

    // Attach / change / detach a lesson on a module.
    const attachLessonToModule = async (lesson: AttachableLesson | null) => {
        if (!attachModule) return;
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/modules`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module_id: attachModule.id,
                    lesson_id: lesson?.id ?? null,
                    lesson_source: lesson?.source ?? null,
                }),
            });
            if (res.ok) await fetchCurriculum();
        } catch (e) {
            console.error(e);
        } finally {
            setAttachModule(null);
        }
    };

    const lessonHref = (m: Module) =>
        m.lesson_source === 'template' ? `/lesson-library/${m.lesson_id}` : `/lesson/${m.lesson_id}`;

    const deleteSession = async (sessionId: string) => {
        if (!confirm('Delete this session? Attendance records will be removed. Module completions stay intact.')) return;
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/sessions/${sessionId}`, { method: 'DELETE' });
            if (res.ok) await fetchSessions();
        } catch (e) {
            console.error(e);
        }
    };

    const openSession = async (sessionId: string) => {
        setEditLoading(true);
        setEditSession(null);
        if (locations.length === 0 && orgId) {
            fetch(`/api/locations?organization_id=${orgId}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => d && setLocations(d.locations || []))
                .catch(() => {});
        }
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/sessions/${sessionId}`);
            if (!res.ok) return;
            const data = await res.json();
            const s: SessionDetail = data.session;
            setEditSession(s);
            setEditDate((s.session_date || '').slice(0, 10));
            setEditDuration(s.duration_minutes != null ? String(s.duration_minutes) : '');
            setEditNotes(s.notes || '');
            const att: Record<string, AttendanceStatus> = {};
            (s.attendance || []).forEach((a) => {
                att[a.participant_id] = (ATTENDANCE_STATUSES as readonly string[]).includes(a.status)
                    ? (a.status as AttendanceStatus)
                    : 'present';
            });
            setEditAttendance(att);
        } catch (e) {
            console.error(e);
        } finally {
            setEditLoading(false);
        }
    };

    // location_id isn't returned by the list query, so resolve it once locations load.
    useEffect(() => {
        if (editSession) setEditLocationId((editSession as any).location_id || '');
    }, [editSession]);

    // Refresh reports each time the tab is opened so it reflects newly logged sessions.
    useEffect(() => {
        if (tab === 'reports') fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const cycleEditAttendance = (participantId: string) => {
        setEditAttendance((prev) => {
            const current = prev[participantId] || 'present';
            const idx = ATTENDANCE_STATUSES.indexOf(current);
            const next = ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length];
            return { ...prev, [participantId]: next };
        });
    };

    const submitEditSession = async () => {
        if (!editSession) return;
        setSavingEdit(true);
        try {
            const attendancePayload = Object.entries(editAttendance).map(([participant_id, status]) => ({
                participant_id,
                status,
            }));
            const res = await fetch(`/api/curricula/${curriculumId}/sessions/${editSession.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_date: editDate || undefined,
                    duration_minutes: editDuration ? Number(editDuration) : null,
                    location_id: editLocationId || null,
                    notes: editNotes,
                    attendance: attendancePayload,
                }),
            });
            if (res.ok) {
                setEditSession(null);
                await Promise.all([fetchSessions(), fetchEnrollments()]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSavingEdit(false);
        }
    };

    const openEnroll = async () => {
        setShowEnroll(true);
        setSelected(new Set());
        setEnrollSearch('');
        if (participants.length === 0 && orgId) {
            try {
                const res = await fetch(`/api/participants?organization_id=${orgId}&status=active`);
                if (res.ok) {
                    const data = await res.json();
                    setParticipants(data.participants || []);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const toggleSelected = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const submitEnroll = async () => {
        if (selected.size === 0) return;
        setEnrolling(true);
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/enrollments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participant_ids: Array.from(selected) }),
            });
            if (res.ok) {
                setShowEnroll(false);
                await fetchEnrollments();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setEnrolling(false);
        }
    };

    const updateEnrollment = async (enrollmentId: string, status: string) => {
        try {
            const res = await fetch(`/api/curricula/${curriculumId}/enrollments/${enrollmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) await fetchEnrollments();
        } catch (e) {
            console.error(e);
        }
    };

    const enrolledIds = new Set(enrollments.map((e) => e.participant_id));
    const filteredParticipants = participants.filter((p) => {
        if (enrolledIds.has(p.id)) return false;
        if (!enrollSearch) return true;
        return displayName(p).toLowerCase().includes(enrollSearch.toLowerCase());
    });

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (!curriculum) return null;

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/curricula')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <button onClick={() => router.push('/curricula')} className="text-[#1A73A8] hover:underline">
                                Curriculum Manager
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium truncate max-w-[240px]">{curriculum.name}</span>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">{curriculum.name}</h1>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {curriculum.source && <span>{curriculum.source}</span>}
                            <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" /> {curriculum.modules.length} modules
                            </span>
                            {curriculum.total_hours != null && (
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" /> {curriculum.total_hours}h
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 border-b border-[#E7E9EC] mb-6">
                    {(['overview', 'enrollments', 'sessions', 'reports'] as const).map((t) => {
                        const labels: Record<typeof t, string> = {
                            overview: 'Overview',
                            enrollments: `Enrollments (${enrollments.length})`,
                            sessions: `Sessions (${sessions.length})`,
                            reports: 'Reports',
                        };
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                    tab === t
                                        ? 'border-[#1A73A8] text-[#1A73A8]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {labels[t]}
                            </button>
                        );
                    })}
                </div>

                {tab === 'overview' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6">
                        {curriculum.description && (
                            <p className="text-gray-600 mb-6">{curriculum.description}</p>
                        )}
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Modules</h2>
                        <div className="divide-y divide-gray-50">
                            {curriculum.modules.length === 0 ? (
                                <p className="text-gray-400 text-sm py-4">No modules defined.</p>
                            ) : (
                                curriculum.modules.map((m) => (
                                    <div key={m.id} className="flex items-start gap-3 py-3">
                                        <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium flex items-center justify-center">
                                            {m.module_number}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-[#0E2235]">{m.title}</div>
                                            {m.description && <div className="text-sm text-gray-500">{m.description}</div>}
                                            <div className="flex items-center gap-3 mt-1">
                                                {m.lesson_id ? (
                                                    <a
                                                        href={lessonHref(m)}
                                                        className="text-xs font-medium text-[#1A73A8] hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Deliver this lesson{m.lesson_title ? `: ${m.lesson_title}` : ''}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">No lesson attached</span>
                                                )}
                                                {canManage && (
                                                    <button
                                                        onClick={() => setAttachModule(m)}
                                                        className="text-xs text-gray-500 hover:text-[#1A73A8] inline-flex items-center gap-1"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                        {m.lesson_id ? 'Change' : 'Attach lesson'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {m.minimum_minutes != null && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                <Clock className="w-3.5 h-3.5" /> {m.minimum_minutes} min
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {tab === 'enrollments' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={openEnroll}
                                className="px-5 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                <Plus className="w-4 h-4" /> Enroll Participant
                            </button>
                        </div>

                        {enrollments.length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                                <Users className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No participants enrolled</h3>
                                <p className="text-gray-500">Enroll participants to start tracking their progress.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    <div className="col-span-4">Participant</div>
                                    <div className="col-span-2">Enrolled</div>
                                    <div className="col-span-4">Progress</div>
                                    <div className="col-span-2 text-right">Status</div>
                                </div>
                                {enrollments.map((e) => {
                                    const pct = totalModules > 0 ? Math.round((e.modules_completed / totalModules) * 100) : 0;
                                    return (
                                        <div key={e.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 items-center">
                                            <div className="col-span-4">
                                                <button
                                                    onClick={() => router.push(`/participants/${e.participant_id}`)}
                                                    className="text-sm font-medium text-[#0E2235] hover:text-[#1A73A8] hover:underline text-left"
                                                >
                                                    {displayName(e)}
                                                </button>
                                            </div>
                                            <div className="col-span-2 text-sm text-gray-500">
                                                {formatDateOnly(e.enrolled_at, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="col-span-4">
                                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                                    <span>{e.modules_completed}/{totalModules} modules</span>
                                                    <span className="font-medium">{pct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-[#30B27A] to-[#4AC490]"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <select
                                                    value={e.status}
                                                    onChange={(ev) => updateEnrollment(e.id, ev.target.value)}
                                                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1A73A8] ${ENROLL_STATUS_STYLES[e.status] || 'text-gray-500 bg-gray-100'}`}
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="paused">Paused</option>
                                                    <option value="withdrawn">Withdrawn</option>
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'sessions' && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={openLogSession}
                                disabled={curriculum.modules.length === 0}
                                className="px-5 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                <Plus className="w-4 h-4" /> Log Session
                            </button>
                        </div>

                        {sessions.length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                                <CalendarDays className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions logged</h3>
                                <p className="text-gray-500">
                                    Log a delivered session to record attendance and mark module completions.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    <div className="col-span-2">Date</div>
                                    <div className="col-span-4">Module</div>
                                    <div className="col-span-3">Location</div>
                                    <div className="col-span-2">Attendance</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {sessions.map((s) => (
                                    <div
                                        key={s.id}
                                        onClick={() => openSession(s.id)}
                                        className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 items-center cursor-pointer hover:bg-gray-50"
                                    >
                                        <div className="col-span-2 text-sm text-gray-600">
                                            {formatDateOnly(s.session_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div className="col-span-4">
                                            <span className="text-sm font-medium text-[#0E2235]">
                                                <span className="text-gray-400">#{s.module_number}</span> {s.module_title}
                                            </span>
                                            {s.duration_minutes != null && (
                                                <span className="ml-2 text-xs text-gray-400">{s.duration_minutes} min</span>
                                            )}
                                        </div>
                                        <div className="col-span-3 text-sm text-gray-500 flex items-center gap-1">
                                            {s.location_name ? (
                                                <>
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> {s.location_name}
                                                </>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-sm text-gray-600">
                                            <span className="text-green-700 font-medium">{s.present_count}</span>
                                            <span className="text-gray-400"> / {s.attendee_count} present</span>
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    deleteSession(s.id);
                                                }}
                                                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                                                title="Delete session"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'reports' && (
                    <div className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <a
                                href={`/api/curricula/${curriculumId}/export?type=roster`}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Roster / grant CSV
                            </a>
                            <a
                                href={`/api/curricula/${curriculumId}/export?type=attendance`}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Attendance CSV
                            </a>
                        </div>

                        {reportsLoading || !reports ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 flex justify-center">
                                <Loader2 className="w-7 h-7 animate-spin text-[#1A73A8]" />
                            </div>
                        ) : (
                            <>
                                {/* Summary cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Active', value: reports.enrollment_totals?.active ?? 0 },
                                        { label: 'Completed', value: reports.enrollment_totals?.completed ?? 0 },
                                        { label: 'Sessions logged', value: reports.attendance?.session_count ?? 0 },
                                        { label: 'Avg present / session', value: reports.attendance?.avg_present_per_session ?? 0 },
                                    ].map((s) => (
                                        <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-5">
                                            <div className="text-2xl font-bold text-[#0E2235]">{s.value}</div>
                                            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Per-module completion */}
                                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100">
                                        <h3 className="font-semibold text-[#0E2235]">Module completion</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Participants who have completed each module ({reports.enrollment_totals?.total ?? 0} enrolled)
                                        </p>
                                    </div>
                                    {(reports.per_module || []).length === 0 ? (
                                        <p className="px-6 py-8 text-center text-gray-400 text-sm">No modules defined.</p>
                                    ) : (
                                        (reports.per_module || []).map((m: any) => {
                                            const denom = reports.enrollment_totals?.total || 0;
                                            const pct = denom > 0 ? Math.round((m.completed_count / denom) * 100) : 0;
                                            return (
                                                <div key={m.module_id} className="px-6 py-3 border-b border-gray-50">
                                                    <div className="flex items-center justify-between text-sm mb-1">
                                                        <span className="text-[#0E2235]">
                                                            <span className="text-gray-400">#{m.module_number}</span> {m.title}
                                                        </span>
                                                        <span className="text-gray-500">
                                                            {m.completed_count}/{denom} · {pct}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-[#30B27A] to-[#4AC490]"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Attendance summary */}
                                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6">
                                    <h3 className="font-semibold text-[#0E2235] mb-3">Attendance summary</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-xl font-bold text-[#0E2235]">{reports.attendance?.session_count ?? 0}</div>
                                            <div className="text-xs text-gray-500">Sessions</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold text-green-700">{reports.attendance?.present_count ?? 0}</div>
                                            <div className="text-xs text-gray-500">Present marks</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold text-[#0E2235]">{reports.attendance?.total_attendance ?? 0}</div>
                                            <div className="text-xs text-gray-500">Total attendance rows</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>

            {showEnroll && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-[#0E2235]">Enroll Participants</h3>
                            <button onClick={() => setShowEnroll(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-3 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={enrollSearch}
                                    onChange={(e) => setEnrollSearch(e.target.value)}
                                    placeholder="Search participants..."
                                    className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-2">
                            {filteredParticipants.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm py-8">No participants available.</p>
                            ) : (
                                filteredParticipants.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(p.id)}
                                            onChange={() => toggleSelected(p.id)}
                                            className="w-4 h-4 rounded border-gray-300 text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{displayName(p)}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-sm text-gray-500">{selected.size} selected</span>
                            <button
                                onClick={submitEnroll}
                                disabled={selected.size === 0 || enrolling}
                                className="px-5 py-2 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Enroll
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLogSession && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-[#0E2235]">Log Session</h3>
                            <button onClick={() => setShowLogSession(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
                                <select
                                    value={logModuleId}
                                    onChange={(e) => setLogModuleId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                >
                                    {curriculum.modules.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            #{m.module_number} — {m.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={logDate}
                                        onChange={(e) => setLogDate(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={logDuration}
                                        onChange={(e) => setLogDuration(e.target.value)}
                                        placeholder="e.g. 60"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                    />
                                </div>
                            </div>

                            {locations.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <select
                                        value={logLocationId}
                                        onChange={(e) => setLogLocationId(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                    >
                                        <option value="">— None —</option>
                                        {locations.map((l) => (
                                            <option key={l.id} value={l.id}>
                                                {l.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Attendance</label>
                                    <span className="text-xs text-gray-400">Tap a status to cycle</span>
                                </div>
                                {enrollments.filter((e) => e.status === 'active').length === 0 ? (
                                    <p className="text-sm text-gray-400 py-2">No active enrollments to take attendance for.</p>
                                ) : (
                                    <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-52 overflow-y-auto">
                                        {enrollments
                                            .filter((e) => e.status === 'active')
                                            .map((e) => {
                                                const st = attendance[e.participant_id] || 'present';
                                                return (
                                                    <div key={e.participant_id} className="flex items-center justify-between px-3 py-2">
                                                        <span className="text-sm text-gray-700">{displayName(e)}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => cycleAttendance(e.participant_id)}
                                                            className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${ATTENDANCE_STYLES[st]}`}
                                                        >
                                                            {st}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={logNotes}
                                    onChange={(e) => setLogNotes(e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                Present + actively enrolled participants are marked complete for this module.
                            </span>
                            <button
                                onClick={submitSession}
                                disabled={!logModuleId || !logDate || logging}
                                className="px-5 py-2 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Save Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(editSession || editLoading) && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-semibold text-[#0E2235]">Session Detail</h3>
                                {editSession && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        #{editSession.module_number} — {editSession.module_title}
                                        {editSession.facilitator_name ? ` · ${editSession.facilitator_name}` : ''}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setEditSession(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {editLoading || !editSession ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-7 h-7 animate-spin text-[#1A73A8]" />
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={editDate}
                                                onChange={(e) => setEditDate(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={editDuration}
                                                onChange={(e) => setEditDuration(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                            />
                                        </div>
                                    </div>

                                    {locations.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                            <select
                                                value={editLocationId}
                                                onChange={(e) => setEditLocationId(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                            >
                                                <option value="">— None —</option>
                                                {locations.map((l) => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-sm font-medium text-gray-700">Attendance</label>
                                            <span className="text-xs text-gray-400">Tap a status to cycle</span>
                                        </div>
                                        {editSession.attendance.length === 0 ? (
                                            <p className="text-sm text-gray-400 py-2">No attendance was recorded for this session.</p>
                                        ) : (
                                            <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-52 overflow-y-auto">
                                                {editSession.attendance.map((a) => {
                                                    const st = editAttendance[a.participant_id] || 'present';
                                                    return (
                                                        <div key={a.participant_id} className="flex items-center justify-between px-3 py-2">
                                                            <span className="text-sm text-gray-700">{displayName(a)}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => cycleEditAttendance(a.participant_id)}
                                                                className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${ATTENDANCE_STYLES[st]}`}
                                                            >
                                                                {st}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                        <textarea
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            rows={2}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                        />
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                        Marking present back-fills module completion; switching away keeps it.
                                    </span>
                                    <button
                                        onClick={submitEditSession}
                                        disabled={savingEdit}
                                        className="px-5 py-2 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                                    >
                                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Save Changes
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <LessonPicker
                open={!!attachModule}
                onClose={() => setAttachModule(null)}
                onSelect={attachLessonToModule}
                currentLesson={attachModule ? { id: attachModule.lesson_id ?? null, title: attachModule.lesson_title } : null}
            />

            {draftPrompt && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-[#0E2235]">Draft notes for attendees</h3>
                            <button onClick={() => setDraftPrompt(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-4">
                            {draftResult ? (
                                <p className="text-sm text-gray-700">{draftResult}</p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Create a draft session note for each of the{' '}
                                        <span className="font-medium text-[#0E2235]">{draftPrompt.attendees.length}</span> present
                                        attendee{draftPrompt.attendees.length === 1 ? '' : 's'} of{' '}
                                        <span className="font-medium text-[#0E2235]">{draftPrompt.moduleTitle}</span>. Each note is
                                        prefilled with the lesson name and duration; you finish and submit them under Session Notes.
                                    </p>
                                    <div className="max-h-32 overflow-y-auto text-xs text-gray-500 border border-gray-100 rounded-lg p-2 mb-1">
                                        {draftPrompt.attendees.map((a) => (
                                            <div key={a.participant_id}>{a.name}</div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                            {draftResult ? (
                                <button
                                    onClick={() => setDraftPrompt(null)}
                                    className="px-5 py-2 text-white font-medium rounded-lg hover:opacity-90"
                                    style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                                >
                                    Done
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setDraftPrompt(null)}
                                        className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100"
                                    >
                                        Skip
                                    </button>
                                    <button
                                        onClick={draftNotesForSession}
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
