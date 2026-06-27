'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Users, Target, FileText, Activity,
    ArrowRight, Loader2, Sparkles,
    BookOpen, ClipboardList, MessageSquare,
    Building2, ClipboardCheck, Search,
    Plus, Map, Mail, Library, Tablet,
    GraduationCap, AlertTriangle, CalendarDays,
    ClipboardEdit, Inbox, CheckCircle2, ChevronRight,
} from 'lucide-react';
import AllyIntelligenceChat from './components/AllyIntelligenceChat';

interface Organization {
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
}

// ── Dashboard data shape (mirrors GET /api/dashboard) ──────────────────────
interface CaseloadItem { id: string; name: string; status: string | null; last_session: string | null; last_assessment: string | null; }
interface NoteItem { id: string; created_at: string; review_status?: string; submitted_at?: string | null; participant_id: string | null; participant_name: string | null; author_name?: string; }
interface PlanItem { id: string; plan_name: string | null; next_review_date: string | null; participant_id: string | null; participant_name: string | null; }
interface AssessmentItem { id: string; participant_id: string | null; assessment_type: string; next_due_date: string | null; participant_name: string | null; }
interface GroupItem { id: string; source: string; name: string; activity_type: string; start_time: string | null; attendee_count?: number; href: string; }
interface Section<T> { count: number; items: T[]; }

interface DashboardData {
    role: string;
    isSupervisor: boolean;
    activeSupportCount: number;
    myCaseload: Section<CaseloadItem>;
    myOpenNotes: Section<NoteItem>;
    notesAwaitingReview: Section<NoteItem> | null;
    overduePlanReviews: Section<PlanItem>;
    assessmentsDue: Section<AssessmentItem>;
    todaysGroups: Section<GroupItem>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function relativeFromNow(value: string | null | undefined): string {
    if (!value) return 'never';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}
function prettyAssessment(type: string): string {
    const map: Record<string, string> = { barc10: 'BARC-10', mirc28: 'MIRC-28', phq4: 'PHQ-4', phq9: 'PHQ-9', gad7: 'GAD-7' };
    return map[type] || type.toUpperCase();
}

// No Organization Modal Component
function NoOrganizationModal({ userName }: { userName: string }) {
    const router = useRouter();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#1A73A8] via-[#156a9a] to-[#0E4D6F] px-6 py-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Welcome{userName ? `, ${userName}` : ''}! 🎉
                        </h2>
                        <p className="text-blue-100">
                            One more step to get started
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 text-center mb-6">
                        You need to be part of an organization to use Peer Support Studio.
                        Create your own or join an existing one.
                    </p>

                    {/* Options */}
                    <div className="space-y-3">
                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-teal-50 border-2 border-[#1A73A8]/30 rounded-xl hover:border-[#1A73A8] hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#1A73A8]/10 flex items-center justify-center group-hover:bg-[#1A73A8]/20 transition-colors">
                                <Building2 className="w-6 h-6 text-[#1A73A8]" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Create Organization</p>
                                <p className="text-sm text-gray-500">Start fresh as an admin</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-[#1A73A8]/50 group-hover:translate-x-1 group-hover:text-[#1A73A8] transition-all" />
                        </button>

                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                <Users className="w-6 h-6 text-gray-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Join with Invite Code</p>
                                <p className="text-sm text-gray-500">Your admin shared a code</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <p className="text-xs text-gray-400 text-center mt-6">
                        Organizations keep your data secure and let you collaborate with your team.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Reusable dashboard section card ────────────────────────────────────────
function SectionCard({
    title, icon: Icon, accent, count, viewAllHref, viewAllLabel, children,
}: {
    title: string;
    icon: any;
    accent: string;        // tailwind bg-* for icon chip
    count?: number;
    viewAllHref?: string;
    viewAllLabel?: string;
    children: ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${accent} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    {typeof count === 'number' && count > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                            {count}
                        </span>
                    )}
                </div>
                {viewAllHref && (
                    <Link href={viewAllHref} className="text-sm text-[#1A73A8] hover:text-[#156a9a] font-medium flex items-center gap-1">
                        {viewAllLabel || 'View all'}
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>
            <div className="p-3 flex-1">{children}</div>
        </div>
    );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-8 px-4">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <Icon className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    );
}

function RowLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
        >
            {children}
        </Link>
    );
}

export default function HomePage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    // Organization state
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);
    const [hasOrganization, setHasOrganization] = useState(false);

    // Dashboard state
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [dashLoading, setDashLoading] = useState(true);

    const userName = session?.user?.name?.split(' ')[0] || 'there';

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch organization
    useEffect(() => {
        async function fetchOrganization() {
            if (status !== 'authenticated') {
                setOrgLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/user/organizations');
                const data = await res.json();

                if (data.organizations && data.organizations.length > 0) {
                    setOrganization(data.organizations[0]);
                    setHasOrganization(true);
                } else {
                    setOrganization(null);
                    setHasOrganization(false);
                }
            } catch (e) {
                console.error('Error fetching organization:', e);
                setHasOrganization(false);
            } finally {
                setOrgLoading(false);
            }
        }

        fetchOrganization();
    }, [status]);

    // Fetch the work-queue dashboard once we know the org
    useEffect(() => {
        if (status !== 'authenticated' || !organization?.id) return;
        let cancelled = false;
        setDashLoading(true);
        fetch(`/api/dashboard?organization_id=${organization.id}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                if (data && !data.error) setDashboard(data as DashboardData);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setDashLoading(false); });
        return () => { cancelled = true; };
    }, [status, organization?.id]);

    // Show loading while checking auth and org
    if (status === 'loading' || orgLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    // Don't render anything if unauthenticated (will redirect)
    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const orgId = organization?.id;

    // Quick links — keep existing navigation reachable from the dashboard.
    const quickLinks = [
        { title: 'Participants', icon: Users, href: '/participants', color: 'bg-[#1A73A8]' },
        { title: 'Recovery Plans', icon: ClipboardList, href: '/recovery-plans', color: 'bg-[#30B27A]' },
        { title: 'Session Notes', icon: FileText, href: '/session-notes', color: 'bg-amber-500' },
        { title: 'Note Reviewer', icon: ClipboardCheck, href: '/note-reviewer', color: 'bg-amber-400' },
        { title: 'Service Planner', icon: ClipboardList, href: '/service-log', color: 'bg-amber-600' },
        { title: 'Goal Generator', icon: Target, href: '/goals/new', color: 'bg-green-500' },
        { title: 'BARC-10', icon: Activity, href: '/assessments/barc10', color: 'bg-purple-500' },
        { title: 'Journey Tracker', icon: Map, href: '/journey-tracker', color: 'bg-pink-500' },
        { title: 'Peer Advisor', icon: MessageSquare, href: '/peer-advisor', color: 'bg-blue-400' },
        { title: 'Treatment Locator', icon: Search, href: '/resource-navigator', color: 'bg-teal-500' },
        { title: 'Lesson Builder', icon: BookOpen, href: '/lesson-builder', color: 'bg-indigo-500' },
        { title: 'Lesson Library', icon: Library, href: '/lesson-library', color: 'bg-emerald-500' },
        { title: 'Curriculum Manager', icon: GraduationCap, href: '/curricula', color: 'bg-purple-500' },
        { title: 'Group Attendance', icon: Users, href: '/groups', color: 'bg-cyan-500' },
        { title: 'Service & Resource Log', icon: ClipboardList, href: '/service-resource-log', color: 'bg-amber-500' },
        { title: 'Kiosk', icon: Tablet, href: '/settings/kiosk', color: 'bg-violet-500' },
        { title: 'Messages', icon: Mail, href: '/messages', color: 'bg-sky-500' },
    ];

    const stat = (label: string, value: number | string, Icon: any, tone: string) => (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${tone} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* Show modal if user has no organization */}
                {!hasOrganization && <NoOrganizationModal userName={userName} />}

                {/* Greeting */}
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Welcome back, {userName}!
                        </h1>
                        <p className="text-gray-600">
                            {organization ? `${organization.name} · here's your day` : "Here's your dashboard overview"}
                        </p>
                    </div>
                    <Link
                        href="/participants/new"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A73A8] text-white text-sm font-medium hover:bg-[#156a9a] transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> New Participant
                    </Link>
                </div>

                {/* Loading skeleton for the dashboard body */}
                {dashLoading && !dashboard ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-7 h-7 animate-spin text-[#1A73A8]" />
                    </div>
                ) : (
                    <>
                        {/* Stat row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {stat('Active support (14d)', dashboard?.activeSupportCount ?? 0, Activity, 'bg-gradient-to-br from-[#30B27A] to-[#4AC490]')}
                            {stat('My caseload', dashboard?.myCaseload.count ?? 0, Users, 'bg-gradient-to-br from-[#1A73A8] to-[#2B8FBF]')}
                            {stat('My open notes', dashboard?.myOpenNotes.count ?? 0, ClipboardEdit, 'bg-gradient-to-br from-amber-500 to-amber-400')}
                            {dashboard?.isSupervisor
                                ? stat('Awaiting my review', dashboard?.notesAwaitingReview?.count ?? 0, Inbox, 'bg-gradient-to-br from-purple-500 to-purple-400')
                                : stat('Overdue plan reviews', dashboard?.overduePlanReviews.count ?? 0, AlertTriangle, 'bg-gradient-to-br from-rose-500 to-rose-400')}
                        </div>

                        {/* Work-queue grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                            {/* My Caseload */}
                            <SectionCard title="My Caseload" icon={Users} accent="bg-[#1A73A8]" count={dashboard?.myCaseload.count} viewAllHref="/participants">
                                {!dashboard?.myCaseload.items.length ? (
                                    <EmptyState icon={Users} message="No participants assigned to you yet." />
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {dashboard.myCaseload.items.map(p => (
                                            <RowLink key={p.id} href={`/participants/${p.id}`}>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">{p.name || 'Unnamed'}</p>
                                                    <p className="text-xs text-gray-500">Last note {relativeFromNow(p.last_session)}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] flex-shrink-0" />
                                            </RowLink>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            {/* My Open Notes */}
                            <SectionCard title="My Open Notes" icon={ClipboardEdit} accent="bg-amber-500" count={dashboard?.myOpenNotes.count} viewAllHref="/session-notes">
                                {!dashboard?.myOpenNotes.items.length ? (
                                    <EmptyState icon={CheckCircle2} message="No notes awaiting — you're caught up." />
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {dashboard.myOpenNotes.items.map(n => (
                                            <RowLink key={n.id} href={`/session-notes/${n.id}`}>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">{n.participant_name || 'Note'}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {n.review_status === 'changes_requested' ? 'Changes requested' : 'Draft'} · {formatDate(n.created_at)}
                                                    </p>
                                                </div>
                                                {n.review_status === 'changes_requested'
                                                    ? <span className="text-xs font-medium text-rose-600 flex-shrink-0">Action needed</span>
                                                    : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] flex-shrink-0" />}
                                            </RowLink>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            {/* Needs My Review (supervisors only) */}
                            {dashboard?.isSupervisor && dashboard.notesAwaitingReview && (
                                <SectionCard title="Needs My Review" icon={Inbox} accent="bg-purple-500" count={dashboard.notesAwaitingReview.count} viewAllHref="/session-notes/reviews">
                                    {!dashboard.notesAwaitingReview.items.length ? (
                                        <EmptyState icon={CheckCircle2} message="No notes awaiting review — all clear." />
                                    ) : (
                                        <div className="divide-y divide-gray-50">
                                            {dashboard.notesAwaitingReview.items.map(n => (
                                                <RowLink key={n.id} href={`/session-notes/${n.id}`}>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">{n.participant_name || 'Note'}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {n.author_name ? `by ${n.author_name} · ` : ''}submitted {relativeFromNow(n.submitted_at || n.created_at)}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] flex-shrink-0" />
                                                </RowLink>
                                            ))}
                                        </div>
                                    )}
                                </SectionCard>
                            )}

                            {/* Overdue Plan Reviews */}
                            <SectionCard title="Overdue Plan Reviews" icon={AlertTriangle} accent="bg-rose-500" count={dashboard?.overduePlanReviews.count} viewAllHref="/recovery-plans">
                                {!dashboard?.overduePlanReviews.items.length ? (
                                    <EmptyState icon={CheckCircle2} message="No overdue reviews — plans are up to date." />
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {dashboard.overduePlanReviews.items.map(pl => (
                                            <RowLink key={pl.id} href={`/recovery-plans?view=${pl.id}`}>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">
                                                        {pl.participant_name || pl.plan_name || 'Recovery plan'}
                                                    </p>
                                                    <p className="text-xs text-rose-600">Review was due {formatDate(pl.next_review_date)}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] flex-shrink-0" />
                                            </RowLink>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            {/* Assessments Due */}
                            <SectionCard title="Assessments Due" icon={Activity} accent="bg-purple-500" count={dashboard?.assessmentsDue.count}>
                                {!dashboard?.assessmentsDue.items.length ? (
                                    <EmptyState icon={CheckCircle2} message="No assessments due right now." />
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {dashboard.assessmentsDue.items.map(a => (
                                            <RowLink key={a.id} href={a.participant_id ? `/participants/${a.participant_id}` : '/participants'}>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">{a.participant_name || 'Participant'}</p>
                                                    <p className="text-xs text-gray-500">{prettyAssessment(a.assessment_type)} · due {formatDate(a.next_due_date)}</p>
                                                </div>
                                                <span className="text-xs font-medium text-amber-600 flex-shrink-0">Due</span>
                                            </RowLink>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            {/* Today's Groups */}
                            <SectionCard title="Today's Groups" icon={CalendarDays} accent="bg-cyan-500" count={dashboard?.todaysGroups.count} viewAllHref="/groups">
                                {!dashboard?.todaysGroups.items.length ? (
                                    <EmptyState icon={CalendarDays} message="No groups scheduled today." />
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {dashboard.todaysGroups.items.map(g => (
                                            <RowLink key={`${g.source}-${g.id}`} href={g.href}>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-[#1A73A8]">{g.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {g.start_time ? String(g.start_time).slice(0, 5) : 'All day'}
                                                        {typeof g.attendee_count === 'number' ? ` · ${g.attendee_count} attending` : ''}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] flex-shrink-0" />
                                            </RowLink>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    </>
                )}

                {/* Quick links — keep all existing navigation reachable */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-1">Quick Links</h2>
                    <p className="text-sm text-gray-500 mb-4">Jump to any tool</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {quickLinks.map(link => (
                            <Link
                                key={link.title}
                                href={link.href}
                                className="group bg-white rounded-xl p-3 border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all flex items-center gap-2.5"
                            >
                                <div className={`w-8 h-8 rounded-lg ${link.color} flex items-center justify-center flex-shrink-0`}>
                                    <link.icon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A73A8] truncate">{link.title}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-gray-400 text-sm">
                        Peer Support Studio by MADE180 2026
                    </p>
                </div>
            </div>

            {/* Ally Intelligence Chat - Floating Assistant */}
            {orgId && (
                <AllyIntelligenceChat organizationId={orgId} />
            )}
        </div>
    );
}
