'use client';

// ============================================================================
// AssessmentTrendChart
// Lightweight, dependency-free trend visualization for recovery-capital
// assessments. Plots total_score over time as an inline SVG line/spark chart,
// and surfaces the delta vs. the prior assessment plus % of the instrument max.
//
// Reused by app/recovery-capital/page.tsx and app/participants/[id]/page.tsx.
// ============================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendPoint {
    id?: string;
    total_score: number;
    assessment_date?: string | null;
    created_at?: string | null;
}

// Known instrument maxima (mirror lib/assessments/questionnaires.ts:
// scoreBarc10 -> 60, scoreMirc28 -> 112).
const ASSESSMENT_MAX: Record<string, number> = {
    barc10: 60,
    mirc28: 112,
};

function pointDate(p: TrendPoint): number {
    const v = p.assessment_date || p.created_at;
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
}

export function getAssessmentMax(assessmentType: string): number {
    return ASSESSMENT_MAX[assessmentType] ?? 60;
}

interface Props {
    assessments: TrendPoint[];
    assessmentType: string;
    maxScore?: number;
    label?: string;
    color?: string;
}

export default function AssessmentTrendChart({
    assessments,
    assessmentType,
    maxScore,
    label,
    color = '#1A73A8',
}: Props) {
    const max = maxScore ?? getAssessmentMax(assessmentType);

    // Sort oldest -> newest so the line reads left (first) to right (latest).
    const points = [...(assessments || [])]
        .filter(a => typeof a.total_score === 'number')
        .sort((a, b) => pointDate(a) - pointDate(b));

    if (points.length === 0) {
        return (
            <div className="text-sm text-gray-400 py-6 text-center">
                No {label || assessmentType.toUpperCase()} assessments to chart yet.
            </div>
        );
    }

    const latest = points[points.length - 1];
    const prior = points.length > 1 ? points[points.length - 2] : null;
    const delta = prior ? latest.total_score - prior.total_score : 0;
    const pct = Math.round((latest.total_score / max) * 100);

    const direction = !prior
        ? 'baseline'
        : delta > 0
        ? 'improved'
        : delta < 0
        ? 'declined'
        : 'stable';

    const dirMeta: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
        improved: { label: 'Improved', color: '#10B981', bg: 'bg-green-50 text-green-700', Icon: TrendingUp },
        declined: { label: 'Declined', color: '#EF4444', bg: 'bg-red-50 text-red-700', Icon: TrendingDown },
        stable: { label: 'Stable', color: '#6B7280', bg: 'bg-gray-100 text-gray-600', Icon: Minus },
        baseline: { label: 'Baseline', color: '#6B7280', bg: 'bg-gray-100 text-gray-600', Icon: Minus },
    };
    const meta = dirMeta[direction];

    // ── SVG geometry ────────────────────────────────────────────────────────
    const W = 320;
    const H = 88;
    const padX = 8;
    const padY = 12;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;

    const n = points.length;
    const x = (i: number) => (n === 1 ? W / 2 : padX + (i / (n - 1)) * innerW);
    // Scale absolute score against the full 0..max range.
    const y = (score: number) => padY + innerH - (Math.max(0, Math.min(score, max)) / max) * innerH;

    const linePath = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.total_score).toFixed(1)}`)
        .join(' ');
    const areaPath =
        `M ${x(0).toFixed(1)} ${(H - padY).toFixed(1)} ` +
        points.map((p, i) => `L ${x(i).toFixed(1)} ${y(p.total_score).toFixed(1)}`).join(' ') +
        ` L ${x(n - 1).toFixed(1)} ${(H - padY).toFixed(1)} Z`;

    const fmt = (p: TrendPoint) => {
        const v = p.assessment_date || p.created_at;
        if (!v) return '';
        try {
            return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        } catch {
            return '';
        }
    };

    const DirIcon = meta.Icon;
    const gradId = `trend-grad-${assessmentType}`;

    return (
        <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0E2235]">
                        {label || assessmentType.toUpperCase()} Trend
                    </span>
                    <span className="text-xs text-gray-400">{n} assessment{n !== 1 ? 's' : ''}</span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${meta.bg}`}>
                    <DirIcon className="w-3.5 h-3.5" />
                    {meta.label}
                    {prior && delta !== 0 && (
                        <span className="font-semibold">
                            {delta > 0 ? '+' : ''}{delta}
                        </span>
                    )}
                </span>
            </div>

            <div className="flex items-end gap-4">
                {/* Score summary */}
                <div className="flex-shrink-0">
                    <p className="text-2xl font-bold" style={{ color }}>
                        {latest.total_score}
                        <span className="text-sm font-medium text-gray-400"> / {max}</span>
                    </p>
                    <p className="text-xs text-gray-500">{pct}% of max</p>
                    {prior && (
                        <p className="text-xs text-gray-400 mt-0.5">
                            prev {prior.total_score}
                        </p>
                    )}
                </div>

                {/* Spark/line chart */}
                <div className="flex-1 min-w-0">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" role="img"
                        aria-label={`${label || assessmentType.toUpperCase()} score trend`}>
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {n > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}
                        {n > 1 && (
                            <path d={linePath} fill="none" stroke={color} strokeWidth={2}
                                strokeLinejoin="round" strokeLinecap="round" />
                        )}
                        {points.map((p, i) => {
                            const isLast = i === n - 1;
                            return (
                                <circle
                                    key={p.id || i}
                                    cx={x(i)}
                                    cy={y(p.total_score)}
                                    r={isLast ? 4 : 2.5}
                                    fill={isLast ? color : '#fff'}
                                    stroke={color}
                                    strokeWidth={1.5}
                                >
                                    <title>{`${fmt(p)}: ${p.total_score}/${max}`}</title>
                                </circle>
                            );
                        })}
                    </svg>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                        <span>{fmt(points[0])}</span>
                        {n > 1 && <span>{fmt(latest)}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
