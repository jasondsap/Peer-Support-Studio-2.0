'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
    BarChart3,
    FileText,
    ClipboardCheck,
    CheckCircle2,
    AlertTriangle,
    Activity,
    CalendarClock,
    ShieldAlert,
    Loader2,
} from 'lucide-react';

const LEADERSHIP_ROLES = ['supervisor', 'admin', 'owner'];

interface AnalyticsData {
    generatedAt: string;
    ranges: {
        notesPerPssDays: number;
        assessmentsDays: number;
        activeSupportDays: number;
        serviceActivityDays: number;
    };
    notesPerPss: Array<{ userId: string | null; name: string; count: number }>;
    noteReviewStatus: Record<string, number>;
    billingReadiness: { ready: number; notReady: number; total: number } | null;
    assessmentCompletion: {
        byType: Array<{ type: string; count: number }>;
        overdueSchedules: number | null;
    };
    caseloadDistribution: {
        byPss: Array<{ pssId: string; name: string; count: number }>;
        unassigned: number;
    };
    activeSupport: { active14d: number; totalActive: number } | null;
    serviceActivity: { byStatus: Array<{ status: string; count: number }> } | null;
    failedMetrics: string[];
}

// ── Small presentational helpers ─────────────────────────────────────────────
function StatCard({
    icon,
    label,
    value,
    sub,
    tone = 'default',
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    tone?: 'default' | 'good' | 'warn';
}) {
    const toneCls =
        tone === 'good'
            ? 'text-[#30B27A]'
            : tone === 'warn'
            ? 'text-amber-600'
            : 'text-[#0E2235]';
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                {icon}
                <span>{label}</span>
            </div>
            <div className={`text-3xl font-bold ${toneCls}`}>{value}</div>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}

function BarRow({
    label,
    count,
    max,
    color = '#1A73A8',
}: {
    label: string;
    count: number;
    max: number;
    color?: string;
}) {
    const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
    return (
        <div className="flex items-center gap-3 py-1.5">
            <div className="w-40 truncate text-sm text-gray-700 capitalize" title={label}>
                {label}
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                    className="h-3 rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <div className="w-10 text-right text-sm font-medium text-[#0E2235]">{count}</div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="mb-3">
                <h3 className="font-semibold text-[#0E2235]">{title}</h3>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

function EmptyNote({ text }: { text: string }) {
    return <p className="text-sm text-gray-400 py-2">{text}</p>;
}

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentOrg = (session as any)?.currentOrganization;
    const role: string | undefined = currentOrg?.role;
    const isLeadership = !!role && LEADERSHIP_ROLES.includes(role);

    useEffect(() => {
        if (status !== 'authenticated' || !currentOrg?.id || !isLeadership) {
            if (status !== 'loading') setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`/api/analytics?organization_id=${encodeURIComponent(currentOrg.id)}`)
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || 'Failed to load analytics');
                return body;
            })
            .then((body) => {
                if (!cancelled) setData(body);
            })
            .catch((e) => {
                if (!cancelled) setError(e.message || 'Failed to load analytics');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [status, currentOrg?.id, isLeadership]);

    // ── Auth / access states ────────────────────────────────────────────────
    if (status === 'loading') {
        return (
            <div className="max-w-7xl mx-auto px-6 py-10 flex items-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
        );
    }

    if (status !== 'authenticated') {
        return (
            <div className="max-w-7xl mx-auto px-6 py-16 text-center">
                <ShieldAlert className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-[#0E2235]">Sign in required</h1>
                <p className="text-gray-500 mt-1">Please sign in to view agency analytics.</p>
            </div>
        );
    }

    if (!isLeadership) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-16 text-center">
                <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-[#0E2235]">Leadership access only</h1>
                <p className="text-gray-500 mt-1 max-w-md mx-auto">
                    Agency Analytics is available to supervisors, admins, and owners.
                    {role && (
                        <>
                            {' '}Your role in {currentOrg?.name || 'this organization'} is{' '}
                            <span className="font-medium capitalize">{role}</span>.
                        </>
                    )}
                </p>
            </div>
        );
    }

    // ── Header ──────────────────────────────────────────────────────────────
    const header = (
        <div className="mb-6">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-[#0E2235]">Agency Analytics</h1>
                    <p className="text-sm text-gray-500">
                        Org-wide oversight for {currentOrg?.name || 'your organization'} · rolling
                        last 30 / 90 days
                    </p>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-8">
                {header}
                <div className="flex items-center gap-2 text-gray-500 py-10">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics…
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-8">
                {header}
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-5">
                    {error || 'No analytics data available.'}
                </div>
            </div>
        );
    }

    // ── Derived values ──────────────────────────────────────────────────────
    const review = data.noteReviewStatus || {};
    const reviewTotal =
        (review.draft || 0) +
        (review.submitted || 0) +
        (review.approved || 0) +
        (review.changes_requested || 0);

    const billing = data.billingReadiness;
    const billingPct =
        billing && billing.total > 0
            ? Math.round((billing.ready / billing.total) * 100)
            : null;

    const active = data.activeSupport;
    const activePct =
        active && active.totalActive > 0
            ? Math.round((active.active14d / active.totalActive) * 100)
            : null;

    const notesMax = Math.max(1, ...data.notesPerPss.map((n) => n.count));
    const caseloadMax = Math.max(
        1,
        data.caseloadDistribution.unassigned,
        ...data.caseloadDistribution.byPss.map((c) => c.count)
    );
    const assessMax = Math.max(1, ...data.assessmentCompletion.byType.map((a) => a.count));

    const reviewRows = [
        { key: 'approved', label: 'Approved', color: '#30B27A' },
        { key: 'submitted', label: 'Submitted (awaiting)', color: '#1A73A8' },
        { key: 'changes_requested', label: 'Changes requested', color: '#D97706' },
        { key: 'draft', label: 'Draft', color: '#9CA3AF' },
    ];
    const reviewMax = Math.max(1, ...reviewRows.map((r) => review[r.key] || 0));

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {header}

            {data.failedMetrics?.length > 0 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                        Some metrics are unavailable and were skipped:{' '}
                        <span className="font-medium">{data.failedMetrics.join(', ')}</span>.
                    </span>
                </div>
            )}

            {/* Top-line stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon={<Activity className="w-4 h-4" />}
                    label="Active support (14d)"
                    value={active ? `${active.active14d}/${active.totalActive}` : '—'}
                    sub={
                        activePct !== null
                            ? `${activePct}% of active participants engaged`
                            : 'Active participants with recent contact'
                    }
                    tone={activePct !== null && activePct < 60 ? 'warn' : 'good'}
                />
                <StatCard
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    label="Billing ready"
                    value={billing ? `${billing.ready}/${billing.total}` : '—'}
                    sub={
                        billingPct !== null
                            ? `${billingPct}% of completed intakes clear`
                            : 'Completed intakes with zero holds'
                    }
                    tone={billingPct !== null && billingPct < 75 ? 'warn' : 'good'}
                />
                <StatCard
                    icon={<ClipboardCheck className="w-4 h-4" />}
                    label="Notes awaiting review"
                    value={review.submitted || 0}
                    sub={`${review.changes_requested || 0} need changes · ${reviewTotal} total`}
                    tone={(review.submitted || 0) > 0 ? 'warn' : 'good'}
                />
                <StatCard
                    icon={<CalendarClock className="w-4 h-4" />}
                    label="Reassessments overdue"
                    value={
                        data.assessmentCompletion.overdueSchedules === null
                            ? '—'
                            : data.assessmentCompletion.overdueSchedules
                    }
                    sub="Schedules past their next due date"
                    tone={
                        (data.assessmentCompletion.overdueSchedules || 0) > 0 ? 'warn' : 'good'
                    }
                />
            </div>

            {/* Breakdown panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel
                    title="Notes per PSS"
                    subtitle={`Session notes authored · last ${data.ranges.notesPerPssDays} days`}
                >
                    {data.notesPerPss.length === 0 ? (
                        <EmptyNote text="No session notes in this window." />
                    ) : (
                        data.notesPerPss.map((n) => (
                            <BarRow
                                key={n.userId || n.name}
                                label={n.name}
                                count={n.count}
                                max={notesMax}
                            />
                        ))
                    )}
                </Panel>

                <Panel title="Note review status" subtitle="All un-archived notes in the org">
                    {reviewTotal === 0 ? (
                        <EmptyNote text="No notes to review yet." />
                    ) : (
                        reviewRows.map((r) => (
                            <BarRow
                                key={r.key}
                                label={r.label}
                                count={review[r.key] || 0}
                                max={reviewMax}
                                color={r.color}
                            />
                        ))
                    )}
                </Panel>

                <Panel
                    title="Caseload distribution"
                    subtitle="Active participants by primary PSS"
                >
                    {data.caseloadDistribution.byPss.length === 0 &&
                    data.caseloadDistribution.unassigned === 0 ? (
                        <EmptyNote text="No active participants." />
                    ) : (
                        <>
                            {data.caseloadDistribution.byPss.map((c) => (
                                <BarRow
                                    key={c.pssId}
                                    label={c.name}
                                    count={c.count}
                                    max={caseloadMax}
                                />
                            ))}
                            {data.caseloadDistribution.unassigned > 0 && (
                                <BarRow
                                    label="Unassigned"
                                    count={data.caseloadDistribution.unassigned}
                                    max={caseloadMax}
                                    color="#D97706"
                                />
                            )}
                        </>
                    )}
                </Panel>

                <Panel
                    title="Assessments administered"
                    subtitle={`By type · last ${data.ranges.assessmentsDays} days`}
                >
                    {data.assessmentCompletion.byType.length === 0 ? (
                        <EmptyNote text="No assessments administered in this window." />
                    ) : (
                        data.assessmentCompletion.byType.map((a) => (
                            <BarRow
                                key={a.type}
                                label={a.type}
                                count={a.count}
                                max={assessMax}
                                color="#30B27A"
                            />
                        ))
                    )}
                </Panel>

                {data.serviceActivity && (
                    <Panel
                        title="Service activity"
                        subtitle={`Service plans by status · last ${data.ranges.serviceActivityDays} days`}
                    >
                        {data.serviceActivity.byStatus.length === 0 ? (
                            <EmptyNote text="No service plans in this window." />
                        ) : (
                            data.serviceActivity.byStatus.map((s) => (
                                <BarRow
                                    key={s.status}
                                    label={s.status}
                                    count={s.count}
                                    max={Math.max(
                                        1,
                                        ...data.serviceActivity!.byStatus.map((x) => x.count)
                                    )}
                                />
                            ))
                        )}
                    </Panel>
                )}
            </div>

            <p className="text-xs text-gray-400 mt-6 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Read-only rollups · generated {new Date(data.generatedAt).toLocaleString()}
            </p>
        </div>
    );
}
