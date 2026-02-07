'use client';

import { useState, useRef, useMemo } from 'react';
import {
    Heart, Home, Briefcase, Scale, Flag, Brain,
    Activity, ZoomIn, ZoomOut,
    Sparkles, AlertTriangle, TrendingUp,
    Eye, EyeOff, Loader2
} from 'lucide-react';

// ============================================================
// TYPES — These match your existing interfaces
// ============================================================
interface DomainStatus {
    key: string;
    label: string;
    color: string;
    order: number;
}

interface Domain {
    domain_id: string;
    domain_key: string;
    domain_label: string;
    description?: string;
    color: string;
    icon: string;
    statuses: DomainStatus[];
    current_status: {
        status_key: string;
        status_label: string;
        entry_date: string;
        notes?: string;
        is_milestone: boolean;
    } | null;
    entry_count: number;
    first_entry: string | null;
    last_entry: string | null;
}

interface JourneyEntry {
    id: string;
    participant_id: string;
    domain_id: string;
    domain_key: string;
    domain_label: string;
    domain_color: string;
    status_key: string;
    status_label: string;
    entry_date: string;
    notes?: string;
    contributing_factors?: string[];
    is_milestone: boolean;
    milestone_type?: string;
    created_at: string;
    created_by_name?: string;
}

interface Insight {
    type: 'positive' | 'warning' | 'insight';
    text: string;
}

interface JourneySwimlaneProps {
    domains: Domain[];
    entries: JourneyEntry[];
    insights?: Insight[];
    insightsLoading?: boolean;
    /** Number of months to display. Default 6 */
    monthsBack?: number;
}

// ============================================================
// ICON MAP
// ============================================================
const DOMAIN_ICONS: Record<string, any> = {
    substance_use: Heart,
    housing: Home,
    employment: Briefcase,
    legal: Scale,
    program_phase: Flag,
    mental_health: Brain,
    default: Activity,
};

// ============================================================
// HELPERS
// ============================================================
const parseDate = (d: any): Date => {
    if (!d) return new Date();
    // If it's already a Date object, return it
    if (d instanceof Date) {
        return isNaN(d.getTime()) ? new Date() : d;
    }
    // If it's a string, parse it
    if (typeof d === 'string') {
        const dateStr = d.includes('T') ? d : d + 'T00:00:00';
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    // Fallback
    return new Date();
};

const formatDateStr = (d: Date): string => {
    try {
        return d.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
};

const formatDateFull = (d: any) => {
    try {
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return String(d);
    }
};

const formatMonth = (d: Date) => {
    try {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
        return '';
    }
};

const daysBetween = (a: string, b: string) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);
    return Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================================
// RISK CLUSTER DETECTION (client-side, for visual highlighting)
// ============================================================
interface RiskCluster {
    key: string;
    entries: JourneyEntry[];
    startDate: string;
    endDate: string;
    domains: string[];
}

function detectRiskClusters(entries: JourneyEntry[], domains: Domain[]): RiskCluster[] {
    const clusters: RiskCluster[] = [];
    const sorted = [...entries].sort((a, b) =>
        parseDate(a.entry_date).getTime() - parseDate(b.entry_date).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        const domain = domains.find(d => d.domain_id === entry.domain_id);
        if (!domain) continue;
        const status = domain.statuses.find(s => s.key === entry.status_key);
        if (!status || status.order > 2) continue;

        const nearby = sorted.filter(e => {
            if (e.id === entry.id || e.domain_id === entry.domain_id) return false;
            const gap = Math.abs(daysBetween(entry.entry_date, e.entry_date));
            if (gap > 7) return false;
            const eDomain = domains.find(d => d.domain_id === e.domain_id);
            const eStatus = eDomain?.statuses.find(s => s.key === e.status_key);
            return eStatus && eStatus.order <= 2;
        });

        if (nearby.length >= 1) {
            const allEntries = [entry, ...nearby];
            const clusterKey = allEntries.map(e => e.id).sort().join('-');
            if (!clusters.find(c => c.key === clusterKey)) {
                clusters.push({
                    key: clusterKey,
                    entries: allEntries,
                    startDate: allEntries.reduce((min, e) => e.entry_date < min ? e.entry_date : min, allEntries[0].entry_date),
                    endDate: allEntries.reduce((max, e) => e.entry_date > max ? e.entry_date : max, allEntries[0].entry_date),
                    domains: Array.from(new Set(allEntries.map(e => e.domain_id))),
                });
            }
        }
    }
    return clusters;
}

// ============================================================
// INSIGHT ICON MAP
// ============================================================
const INSIGHT_ICONS: Record<string, any> = {
    positive: Sparkles,
    warning: AlertTriangle,
    insight: TrendingUp,
};

const INSIGHT_STYLES: Record<string, { bg: string; border: string; iconColor: string; textColor: string }> = {
    positive: { bg: '#F0FDF4', border: '#BBF7D0', iconColor: '#16A34A', textColor: '#15803D' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', iconColor: '#D97706', textColor: '#92400E' },
    insight: { bg: '#F5F3FF', border: '#DDD6FE', iconColor: '#7C3AED', textColor: '#5B21B6' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function JourneySwimlane({
    domains,
    entries,
    insights,
    insightsLoading = false,
    monthsBack = 6,
}: JourneySwimlaneProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hoveredEntry, setHoveredEntry] = useState<JourneyEntry | null>(null);
    const [hoveredCluster, setHoveredCluster] = useState<RiskCluster | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
    const [showInsights, setShowInsights] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);

    // Compute date range
    const dateRange = useMemo(() => {
        const now = new Date();
        
        if (entries.length === 0) {
            const end = new Date(now);
            const start = new Date(now);
            start.setMonth(start.getMonth() - monthsBack);
            return { start, end };
        }
        
        // Filter out any entries with invalid dates
        const validDates = entries
            .map(e => parseDate(e.entry_date))
            .filter(d => !isNaN(d.getTime()));
        
        if (validDates.length === 0) {
            const end = new Date(now);
            const start = new Date(now);
            start.setMonth(start.getMonth() - monthsBack);
            return { start, end };
        }
        
        const timestamps = validDates.map(d => d.getTime());
        const maxDate = new Date(Math.max(...timestamps));
        // Extend end date a bit past latest entry for breathing room
        const end = new Date(maxDate);
        end.setDate(end.getDate() + 7);
        const start = new Date(maxDate);
        start.setMonth(start.getMonth() - monthsBack);
        return { start, end };
    }, [entries, monthsBack]);

    const totalDays = useMemo(
        () => Math.max(1, Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))),
        [dateRange]
    );

    const chartWidth = totalDays * 4.5 * zoomLevel;
    const LANE_HEIGHT = 72;
    const LANE_GAP = 4;
    const LABEL_WIDTH = 180;
    const HEADER_HEIGHT = 48;
    const PADDING_RIGHT = 40;

    const visibleDomains = domains.filter(d => !hiddenDomains.has(d.domain_id));
    const chartHeight = visibleDomains.length * (LANE_HEIGHT + LANE_GAP) + HEADER_HEIGHT + 20;

    const riskClusters = useMemo(() => detectRiskClusters(entries, domains), [entries, domains]);

    const dateToX = (dateStr: string) => {
        const d = parseDate(dateStr);
        const dayOffset = (d.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
        return (dayOffset / totalDays) * chartWidth;
    };

    const monthMarkers = useMemo(() => {
        const markers: { date: string; label: string }[] = [];
        const current = new Date(dateRange.start);
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
        while (current <= dateRange.end) {
            markers.push({
                date: formatDateStr(current),
                label: formatMonth(current),
            });
            current.setMonth(current.getMonth() + 1);
        }
        return markers;
    }, [dateRange, totalDays]);

    // Build segments for each domain
    const domainSegments = useMemo(() => {
        const segMap: Record<string, any[]> = {};
        visibleDomains.forEach(domain => {
            const domainEntries = entries
                .filter(e => e.domain_id === domain.domain_id)
                .sort((a, b) => parseDate(a.entry_date).getTime() - parseDate(b.entry_date).getTime());

            const segments: any[] = [];
            for (let i = 0; i < domainEntries.length; i++) {
                const entry = domainEntries[i];
                const nextEntry = domainEntries[i + 1];
                const status = domain.statuses.find(s => s.key === entry.status_key);
                segments.push({
                    entry,
                    status,
                    startDate: entry.entry_date,
                    endDate: nextEntry ? nextEntry.entry_date : formatDateStr(dateRange.end),
                });
            }
            segMap[domain.domain_id] = segments;
        });
        return segMap;
    }, [visibleDomains, entries, dateRange]);

    const toggleDomain = (domainId: string) => {
        setHiddenDomains(prev => {
            const next = new Set(prev);
            if (next.has(domainId)) next.delete(domainId);
            else next.add(domainId);
            return next;
        });
    };

    const handleEntryHover = (entry: JourneyEntry, event: React.MouseEvent) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const container = scrollRef.current?.parentElement?.getBoundingClientRect();
        setTooltipPos({
            x: rect.left - (container?.left || 0) + rect.width / 2,
            y: rect.top - (container?.top || 0) - 8,
        });
        setHoveredEntry(entry);
    };

    // Empty state
    if (domains.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No domains configured yet</p>
                <p className="text-sm text-gray-400 mt-1">Add journey domains to start tracking</p>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No journey entries yet</p>
                <p className="text-sm text-gray-400 mt-1">
                    Start adding entries to domains to see the cross-domain visualization
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header Bar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-[#0E2235]">
                        Cross-Domain Journey View
                    </h2>
                    <p className="text-sm text-gray-500">
                        {monthsBack}-month recovery pathway · {entries.length} entries across {domains.filter(d => d.current_status).length} domains
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {insights && insights.length > 0 && (
                        <button
                            onClick={() => setShowInsights(!showInsights)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                showInsights ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Insights
                        </button>
                    )}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setZoomLevel(Math.max(0.75, zoomLevel - 0.25))}
                            className="p-1.5 rounded-md hover:bg-white transition-colors"
                            title="Zoom out"
                        >
                            <ZoomOut className="w-4 h-4 text-gray-500" />
                        </button>
                        <span className="px-2 text-xs text-gray-500 font-medium min-w-[3rem] text-center">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                            onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                            className="p-1.5 rounded-md hover:bg-white transition-colors"
                            title="Zoom in"
                        >
                            <ZoomIn className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Insight Cards */}
            {showInsights && insightsLoading && (
                <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-purple-50 rounded-xl border border-purple-100">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    <span className="text-sm text-purple-600">Analyzing cross-domain patterns...</span>
                </div>
            )}
            {showInsights && insights && insights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                    {insights.map((insight, i) => {
                        const Icon = INSIGHT_ICONS[insight.type] || INSIGHT_ICONS.insight;
                        const s = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.insight;
                        return (
                            <div
                                key={i}
                                className="rounded-xl p-3.5 flex items-start gap-3 border"
                                style={{ backgroundColor: s.bg, borderColor: s.border }}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: `${s.iconColor}18` }}
                                >
                                    <Icon className="w-4 h-4" style={{ color: s.iconColor }} />
                                </div>
                                <p className="text-sm leading-relaxed" style={{ color: s.textColor }}>
                                    {insight.text}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Domain Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
                {domains.map(domain => {
                    const hidden = hiddenDomains.has(domain.domain_id);
                    const Icon = DOMAIN_ICONS[domain.domain_key] || DOMAIN_ICONS.default;
                    return (
                        <button
                            key={domain.domain_id}
                            onClick={() => toggleDomain(domain.domain_id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                            style={{
                                backgroundColor: hidden ? '#F9FAFB' : `${domain.color}12`,
                                borderColor: hidden ? '#E5E7EB' : `${domain.color}40`,
                                color: hidden ? '#9CA3AF' : domain.color,
                                opacity: hidden ? 0.6 : 1,
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {domain.domain_label}
                            {hidden ? <EyeOff className="w-3 h-3 ml-0.5" /> : <Eye className="w-3 h-3 ml-0.5" />}
                        </button>
                    );
                })}
            </div>

            {/* Chart Container */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                <div className="flex relative">
                    {/* Fixed Domain Labels Column */}
                    <div
                        className="flex-shrink-0 border-r border-gray-100"
                        style={{ width: LABEL_WIDTH, backgroundColor: '#FAFBFC' }}
                    >
                        <div
                            className="flex items-center px-4 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            Domain
                        </div>
                        {visibleDomains.map((domain, i) => {
                            const Icon = DOMAIN_ICONS[domain.domain_key] || DOMAIN_ICONS.default;
                            const currentStatus = domain.current_status
                                ? domain.statuses.find(s => s.key === domain.current_status!.status_key)
                                : null;

                            return (
                                <div
                                    key={domain.domain_id}
                                    className="flex items-center gap-2.5 px-4 border-b border-gray-100"
                                    style={{ height: LANE_HEIGHT + LANE_GAP }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${domain.color}14` }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: domain.color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-[#0E2235] truncate">
                                            {domain.domain_label}
                                        </div>
                                        {currentStatus && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: currentStatus.color }}
                                                />
                                                <span className="text-xs text-gray-500 truncate">
                                                    {currentStatus.label}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Scrollable Chart Area */}
                    <div ref={scrollRef} className="flex-1 overflow-x-auto relative">
                        <div style={{ width: chartWidth + PADDING_RIGHT, minHeight: chartHeight, position: 'relative' }}>
                            {/* Month markers & grid lines */}
                            {monthMarkers.map(marker => {
                                const x = dateToX(marker.date);
                                return (
                                    <div key={marker.date}>
                                        <div
                                            className="text-xs font-medium text-gray-400"
                                            style={{
                                                position: 'absolute',
                                                left: x,
                                                top: 0,
                                                height: HEADER_HEIGHT,
                                                display: 'flex',
                                                alignItems: 'center',
                                                transform: 'translateX(-50%)',
                                                whiteSpace: 'nowrap',
                                                zIndex: 5,
                                            }}
                                        >
                                            {marker.label}
                                        </div>
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: x,
                                                top: HEADER_HEIGHT,
                                                bottom: 0,
                                                width: 1,
                                                backgroundColor: '#F3F4F6',
                                            }}
                                        />
                                    </div>
                                );
                            })}

                            {/* Header border */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: HEADER_HEIGHT,
                                    left: 0,
                                    right: 0,
                                    height: 1,
                                    backgroundColor: '#F3F4F6',
                                }}
                            />

                            {/* Risk Cluster Highlights */}
                            {riskClusters.map(cluster => {
                                const x1 = dateToX(cluster.startDate) - 8;
                                const x2 = dateToX(cluster.endDate) + 8;
                                const involvedLaneIndices = cluster.domains
                                    .map(dId => visibleDomains.findIndex(d => d.domain_id === dId))
                                    .filter(i => i >= 0);
                                if (involvedLaneIndices.length === 0) return null;
                                const minLane = Math.min(...involvedLaneIndices);
                                const maxLane = Math.max(...involvedLaneIndices);
                                const y1 = HEADER_HEIGHT + minLane * (LANE_HEIGHT + LANE_GAP);
                                const y2 = HEADER_HEIGHT + (maxLane + 1) * (LANE_HEIGHT + LANE_GAP);

                                return (
                                    <div
                                        key={cluster.key}
                                        onMouseEnter={() => setHoveredCluster(cluster)}
                                        onMouseLeave={() => setHoveredCluster(null)}
                                        style={{
                                            position: 'absolute',
                                            left: x1,
                                            top: y1,
                                            width: Math.max(x2 - x1, 24),
                                            height: y2 - y1,
                                            backgroundColor: hoveredCluster?.key === cluster.key ? '#FEF2F230' : '#FEF2F218',
                                            border: `1.5px dashed ${hoveredCluster?.key === cluster.key ? '#F87171' : '#FECACA'}`,
                                            borderRadius: 12,
                                            zIndex: 2,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                                            style={{
                                                position: 'absolute',
                                                top: -10,
                                                right: -4,
                                                backgroundColor: '#FEE2E2',
                                                fontSize: 10,
                                                color: '#DC2626',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <AlertTriangle className="w-3 h-3" />
                                            Risk
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Swimlanes */}
                            {visibleDomains.map((domain, laneIndex) => {
                                const segments = domainSegments[domain.domain_id] || [];
                                const laneY = HEADER_HEIGHT + laneIndex * (LANE_HEIGHT + LANE_GAP);

                                return (
                                    <div key={domain.domain_id}>
                                        {/* Lane background */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: laneY,
                                                right: 0,
                                                height: LANE_HEIGHT,
                                                backgroundColor: laneIndex % 2 === 0 ? '#FAFBFC' : '#FFFFFF',
                                            }}
                                        />
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: laneY + LANE_HEIGHT,
                                                right: 0,
                                                height: 1,
                                                backgroundColor: '#F3F4F6',
                                            }}
                                        />

                                        {/* Status segments */}
                                        {segments.map((seg: any) => {
                                            if (!seg.status) return null;
                                            const x1 = dateToX(seg.startDate);
                                            const x2 = dateToX(seg.endDate);
                                            const width = Math.max(x2 - x1, 3);

                                            return (
                                                <div
                                                    key={`seg-${seg.entry.id}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: x1,
                                                        top: laneY + 20,
                                                        width: width,
                                                        height: 32,
                                                        backgroundColor: `${seg.status.color}20`,
                                                        borderTop: `3px solid ${seg.status.color}`,
                                                        borderRadius: '0 0 4px 4px',
                                                        transition: 'all 0.15s ease',
                                                        zIndex: 3,
                                                    }}
                                                >
                                                    {width > 70 && (
                                                        <div
                                                            className="truncate px-2 pt-1"
                                                            style={{
                                                                fontSize: 11,
                                                                fontWeight: 500,
                                                                color: seg.status.color,
                                                                lineHeight: '1.4',
                                                            }}
                                                        >
                                                            {seg.status.label}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Entry dots */}
                                        {entries
                                            .filter(e => e.domain_id === domain.domain_id)
                                            .map(entry => {
                                                const x = dateToX(entry.entry_date);
                                                const status = domain.statuses.find(s => s.key === entry.status_key);
                                                const isHovered = hoveredEntry?.id === entry.id;

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        onMouseEnter={(e) => handleEntryHover(entry, e)}
                                                        onMouseLeave={() => setHoveredEntry(null)}
                                                        style={{
                                                            position: 'absolute',
                                                            left: x - (entry.is_milestone ? 10 : 7),
                                                            top: laneY + (entry.is_milestone ? 12 : 15),
                                                            width: entry.is_milestone ? 20 : 14,
                                                            height: entry.is_milestone ? 20 : 14,
                                                            borderRadius: entry.is_milestone ? 6 : '50%',
                                                            backgroundColor: status?.color || domain.color,
                                                            border: '2px solid #FFFFFF',
                                                            boxShadow: isHovered
                                                                ? `0 0 0 3px ${status?.color || domain.color}40, 0 2px 8px rgba(0,0,0,0.15)`
                                                                : '0 1px 3px rgba(0,0,0,0.12)',
                                                            cursor: 'pointer',
                                                            zIndex: isHovered ? 20 : 10,
                                                            transition: 'all 0.15s ease',
                                                            transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        {entry.is_milestone && (
                                                            <Sparkles className="w-3 h-3" style={{ color: '#FFFFFF' }} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                );
                            })}

                            {/* Today marker */}
                            {(() => {
                                const today = new Date().toISOString().split('T')[0];
                                const x = dateToX(today);
                                if (x < 0 || x > chartWidth) return null;
                                return (
                                    <div style={{ position: 'absolute', left: x, top: 0, bottom: 0, zIndex: 15, pointerEvents: 'none' }}>
                                        <div
                                            style={{
                                                width: 2,
                                                height: '100%',
                                                background: 'linear-gradient(to bottom, #7C3AED, #7C3AED60, transparent)',
                                            }}
                                        />
                                        <div
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-b-md"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                backgroundColor: '#7C3AED',
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: '#FFFFFF',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Today
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Tooltip */}
                        {hoveredEntry && (
                            <div
                                className="pointer-events-none"
                                style={{
                                    position: 'absolute',
                                    left: tooltipPos.x,
                                    top: tooltipPos.y,
                                    transform: 'translate(-50%, -100%)',
                                    zIndex: 50,
                                }}
                            >
                                <div className="rounded-xl p-3 shadow-xl border border-gray-200 bg-white" style={{ minWidth: 220, maxWidth: 300 }}>
                                    {(() => {
                                        const domain = domains.find(d => d.domain_id === hoveredEntry.domain_id);
                                        const status = domain?.statuses.find(s => s.key === hoveredEntry.status_key);
                                        const Icon = DOMAIN_ICONS[domain?.domain_key || 'default'] || DOMAIN_ICONS.default;
                                        return (
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Icon className="w-4 h-4" style={{ color: domain?.color }} />
                                                    <span className="text-sm font-semibold text-[#0E2235]">
                                                        {domain?.domain_label}
                                                    </span>
                                                    {hoveredEntry.is_milestone && (
                                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status?.color }} />
                                                    <span className="text-sm font-medium" style={{ color: status?.color }}>
                                                        {status?.label}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mb-1">
                                                    {formatDateFull(hoveredEntry.entry_date)}
                                                </div>
                                                {hoveredEntry.notes && (
                                                    <p className="text-xs leading-relaxed mt-2 pt-2 border-t border-gray-100 text-gray-500">
                                                        {hoveredEntry.notes}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div
                                    style={{
                                        width: 10,
                                        height: 10,
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E5E7EB',
                                        borderTop: 'none',
                                        borderLeft: 'none',
                                        transform: 'rotate(45deg)',
                                        position: 'absolute',
                                        bottom: -5,
                                        left: '50%',
                                        marginLeft: -5,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm" />
                    Entry
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-4 h-4 rounded-md bg-amber-500 border-2 border-white shadow-sm flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                    Milestone
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-6 h-3 rounded-sm" style={{ backgroundColor: '#DC262620', borderTop: '2px solid #DC2626' }} />
                    Crisis / Setback
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-6 h-3 rounded-sm" style={{ backgroundColor: '#22C55E20', borderTop: '2px solid #22C55E' }} />
                    Stable / Positive
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-4 h-3 rounded border border-dashed" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F220' }} />
                    Risk Cluster
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-0.5 h-3" style={{ backgroundColor: '#7C3AED' }} />
                    Today
                </div>
            </div>
        </div>
    );
}
