'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, ChevronRight, Loader2, Search, Plus,
    Heart, Home, Briefcase, Scale, Flag, Brain,
    Activity, Users, Calendar, TrendingUp, History,
    CheckCircle, AlertCircle, ChevronDown, ChevronUp,
    X, Save, Sparkles, ArrowUpRight, ArrowDownRight,
    Minus, Clock, FileText, Target, BarChart3,
    Layers  // <-- ADDED: icon for the swimlane tab
} from 'lucide-react';

// ADDED: Import the swimlane component
import JourneySwimlane from '@/components/JourneySwimlane';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
}

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

// ADDED: Insight type for the insights API
interface Insight {
    type: 'positive' | 'warning' | 'insight';
    text: string;
}

const DOMAIN_ICONS: Record<string, any> = {
    substance_use: Heart,
    housing: Home,
    employment: Briefcase,
    legal: Scale,
    program_phase: Flag,
    mental_health: Brain,
    default: Activity
};

export default function JourneyTrackerPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    // States
    const [loading, setLoading] = useState(true);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    const [domains, setDomains] = useState<Domain[]>([]);
    const [entries, setEntries] = useState<JourneyEntry[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Add Entry Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
    const [newEntry, setNewEntry] = useState({
        status_key: '',
        status_label: '',
        entry_date: new Date().toISOString().split('T')[0],
        notes: '',
        is_milestone: false
    });
    const [saving, setSaving] = useState(false);

    // View state — CHANGED: added 'swimlane' option
    const [activeView, setActiveView] = useState<'overview' | 'timeline' | 'swimlane' | 'domain'>('overview');
    const [selectedDomainView, setSelectedDomainView] = useState<string | null>(null);

    // ADDED: Insights state
    const [insights, setInsights] = useState<Insight[]>([]);
    const [insightsLoading, setInsightsLoading] = useState(false);

    // Auth check
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        } else if (status === 'authenticated') {
            setLoading(false);
        }
    }, [status, router]);

    // Search participants
    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${participantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setParticipants(data.participants || []))
                .catch(() => setParticipants([]));
        }
    }, [participantSearch, currentOrg?.id]);

    // Fetch journey data when participant selected
    useEffect(() => {
        if (selectedParticipant && currentOrg?.id) {
            fetchJourneyData();
        }
    }, [selectedParticipant, currentOrg?.id]);

    const fetchJourneyData = async () => {
        if (!selectedParticipant || !currentOrg?.id) return;
        
        setLoadingData(true);
        try {
            // Fetch summary (domains + current status)
            const summaryRes = await fetch(
                `/api/journey-entries/summary?organization_id=${currentOrg.id}&participant_id=${selectedParticipant.id}`
            );
            const summaryData = await summaryRes.json();
            if (summaryData.success) {
                setDomains(summaryData.summary);
            }

            // Fetch all entries for timeline
            const entriesRes = await fetch(
                `/api/journey-entries?organization_id=${currentOrg.id}&participant_id=${selectedParticipant.id}&limit=200`
            );
            const entriesData = await entriesRes.json();
            if (entriesData.success) {
                setEntries(entriesData.entries);
            }

            // ADDED: Fetch insights
            fetchInsights();
        } catch (e) {
            console.error('Error fetching journey data:', e);
        } finally {
            setLoadingData(false);
        }
    };

    // ADDED: Fetch insights from the new API route
    const fetchInsights = async () => {
        if (!selectedParticipant || !currentOrg?.id) return;
        
        setInsightsLoading(true);
        try {
            const res = await fetch(
                `/api/journey-entries/insights?organization_id=${currentOrg.id}&participant_id=${selectedParticipant.id}`
            );
            const data = await res.json();
            if (data.success) {
                setInsights(data.insights);
            }
        } catch (e) {
            console.error('Error fetching insights:', e);
            setInsights([]);
        } finally {
            setInsightsLoading(false);
        }
    };

    const selectParticipant = (p: Participant) => {
        setSelectedParticipant(p);
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const openAddEntry = (domain: Domain) => {
        setSelectedDomain(domain);
        setNewEntry({
            status_key: '',
            status_label: '',
            entry_date: new Date().toISOString().split('T')[0],
            notes: '',
            is_milestone: false
        });
        setShowAddModal(true);
    };

    const handleSaveEntry = async () => {
        if (!selectedParticipant || !selectedDomain || !newEntry.status_key) return;
        
        setSaving(true);
        try {
            const statusObj = selectedDomain.statuses.find(s => s.key === newEntry.status_key);
            
            const res = await fetch('/api/journey-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: selectedParticipant.id,
                    domain_id: selectedDomain.domain_id,
                    status_key: newEntry.status_key,
                    status_label: statusObj?.label || newEntry.status_key,
                    entry_date: newEntry.entry_date,
                    notes: newEntry.notes,
                    is_milestone: newEntry.is_milestone
                })
            });
            
            if (res.ok) {
                setShowAddModal(false);
                fetchJourneyData(); // This now also re-fetches insights
            }
        } catch (e) {
            console.error('Error saving entry:', e);
        } finally {
            setSaving(false);
        }
    };

    const getIcon = (iconName: string) => {
        return DOMAIN_ICONS[iconName] || DOMAIN_ICONS.default;
    };

    const getStatusColor = (domain: Domain, statusKey: string) => {
        const status = domain.statuses.find(s => s.key === statusKey);
        return status?.color || '#6B7280';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Group entries by date for timeline
    const groupedEntries = entries.reduce((acc, entry) => {
        const date = entry.entry_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, JourneyEntry[]>);

    const sortedDates = Object.keys(groupedEntries).sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
    );

    if (loading || status === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header */}
            <div className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <Link href="/" className="text-[#1A73A8] hover:underline">Dashboard</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Journey Tracker</span>
                        </nav>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Hero */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#0E2235] mb-2">Journey Tracker</h1>
                    <p className="text-gray-600">Track recovery pathways across multiple life domains</p>
                </div>

                {/* Participant Selector */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Participant</label>
                    <div className="relative">
                        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={selectedParticipant 
                                    ? `${selectedParticipant.preferred_name || selectedParticipant.first_name} ${selectedParticipant.last_name}` 
                                    : participantSearch}
                                onChange={(e) => {
                                    setParticipantSearch(e.target.value);
                                    setShowParticipantDropdown(true);
                                    setSelectedParticipant(null);
                                }}
                                onFocus={() => setShowParticipantDropdown(true)}
                                placeholder="Search participants..."
                                className="flex-1 bg-transparent border-none outline-none"
                            />
                            {selectedParticipant && (
                                <button
                                    onClick={() => { 
                                        setSelectedParticipant(null); 
                                        setParticipantSearch(''); 
                                        setDomains([]);
                                        setEntries([]);
                                        setInsights([]); // ADDED: clear insights
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>
                        {showParticipantDropdown && participantSearch.length >= 2 && participants.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-10">
                                {participants.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => selectParticipant(p)}
                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
                                            {p.first_name[0]}{p.last_name[0]}
                                        </div>
                                        <span className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content - Show when participant selected */}
                {selectedParticipant && (
                    <>
                        {loadingData ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                            </div>
                        ) : (
                            <>
                                {/* View Tabs — CHANGED: added Swimlane tab */}
                                <div className="flex gap-2 mb-6">
                                    <button
                                        onClick={() => setActiveView('overview')}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            activeView === 'overview'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <BarChart3 className="w-4 h-4 inline mr-2" />
                                        Overview
                                    </button>
                                    <button
                                        onClick={() => setActiveView('swimlane')}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            activeView === 'swimlane'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Layers className="w-4 h-4 inline mr-2" />
                                        Journey View
                                    </button>
                                    <button
                                        onClick={() => setActiveView('timeline')}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            activeView === 'timeline'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <History className="w-4 h-4 inline mr-2" />
                                        Timeline
                                    </button>
                                </div>

                                {/* OVERVIEW VIEW */}
                                {activeView === 'overview' && (
                                    <div className="space-y-4">
                                        {/* Stats Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                        <Activity className="w-5 h-5 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-[#0E2235]">
                                                            {domains.filter(d => d.current_status).length}
                                                        </p>
                                                        <p className="text-sm text-gray-500">Domains Tracked</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-[#0E2235]">{entries.length}</p>
                                                        <p className="text-sm text-gray-500">Total Entries</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-[#0E2235]">
                                                            {entries.filter(e => e.is_milestone).length}
                                                        </p>
                                                        <p className="text-sm text-gray-500">Milestones</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                                        <Calendar className="w-5 h-5 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-2xl font-bold text-[#0E2235]">
                                                            {entries.length > 0 
                                                                ? formatDate(entries[entries.length - 1]?.entry_date)
                                                                : '—'}
                                                        </p>
                                                        <p className="text-sm text-gray-500">First Entry</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Domain Cards */}
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {domains.map((domain) => {
                                                const Icon = getIcon(domain.domain_key);
                                                const hasStatus = domain.current_status !== null;
                                                
                                                return (
                                                    <div
                                                        key={domain.domain_id}
                                                        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                                                    >
                                                        <div className="p-4">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div 
                                                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                                        style={{ backgroundColor: `${domain.color}20` }}
                                                                    >
                                                                        <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-semibold text-[#0E2235]">{domain.domain_label}</h3>
                                                                        {domain.description && (
                                                                            <p className="text-xs text-gray-500">{domain.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => openAddEntry(domain)}
                                                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-purple-600"
                                                                >
                                                                    <Plus className="w-5 h-5" />
                                                                </button>
                                                            </div>

                                                            {hasStatus ? (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="px-3 py-1 rounded-full text-sm font-medium"
                                                                            style={{
                                                                                backgroundColor: `${getStatusColor(domain, domain.current_status!.status_key)}20`,
                                                                                color: getStatusColor(domain, domain.current_status!.status_key)
                                                                            }}
                                                                        >
                                                                            {domain.current_status!.status_label}
                                                                        </span>
                                                                        {domain.current_status!.is_milestone && (
                                                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                        <span className="flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {formatDate(domain.current_status!.entry_date)}
                                                                        </span>
                                                                        <span className="flex items-center gap-1">
                                                                            <History className="w-3 h-3" />
                                                                            {domain.entry_count} entries
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4">
                                                                    <p className="text-sm text-gray-400">No entries yet</p>
                                                                    <button
                                                                        onClick={() => openAddEntry(domain)}
                                                                        className="mt-2 text-sm text-purple-600 hover:underline"
                                                                    >
                                                                        Add first entry
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Status Progress Bar */}
                                                        {hasStatus && (
                                                            <div className="px-4 pb-4">
                                                                <div className="flex gap-1">
                                                                    {domain.statuses.map((s, i) => {
                                                                        const isActive = s.key === domain.current_status?.status_key;
                                                                        const isPast = domain.statuses.findIndex(st => st.key === domain.current_status?.status_key) > i;
                                                                        return (
                                                                            <div
                                                                                key={s.key}
                                                                                className="flex-1 h-2 rounded-full transition-colors"
                                                                                style={{
                                                                                    backgroundColor: isActive || isPast ? s.color : '#E5E7EB'
                                                                                }}
                                                                                title={s.label}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ============================================= */}
                                {/* ADDED: SWIMLANE VIEW                          */}
                                {/* ============================================= */}
                                {activeView === 'swimlane' && (
                                    <JourneySwimlane
                                        domains={domains}
                                        entries={entries}
                                        insights={insights}
                                        insightsLoading={insightsLoading}
                                        monthsBack={6}
                                    />
                                )}

                                {/* TIMELINE VIEW */}
                                {activeView === 'timeline' && (
                                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-lg font-semibold text-[#0E2235]">Journey Timeline</h2>
                                            <span className="text-sm text-gray-500">{entries.length} entries</span>
                                        </div>

                                        {entries.length === 0 ? (
                                            <div className="text-center py-12">
                                                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500">No journey entries yet</p>
                                                <p className="text-sm text-gray-400 mt-1">Start tracking by adding entries to any domain</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {sortedDates.map((date) => (
                                                    <div key={date} className="relative">
                                                        <div className="flex items-center gap-4 mb-3">
                                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                            <span className="text-sm font-medium text-gray-700">
                                                                {formatDate(date)}
                                                            </span>
                                                        </div>
                                                        <div className="ml-5 pl-4 border-l-2 border-gray-200 space-y-3">
                                                            {groupedEntries[date].map((entry) => {
                                                                const domain = domains.find(d => d.domain_id === entry.domain_id);
                                                                const Icon = getIcon(entry.domain_key);
                                                                
                                                                return (
                                                                    <div
                                                                        key={entry.id}
                                                                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                                                                    >
                                                                        <div className="flex items-start gap-3">
                                                                            <div
                                                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                                                style={{ backgroundColor: `${entry.domain_color}20` }}
                                                                            >
                                                                                <Icon className="w-4 h-4" style={{ color: entry.domain_color }} />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="text-sm font-medium text-gray-700">
                                                                                        {entry.domain_label}
                                                                                    </span>
                                                                                    <span className="text-gray-400">→</span>
                                                                                    <span
                                                                                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                                                        style={{
                                                                                            backgroundColor: `${domain ? getStatusColor(domain, entry.status_key) : entry.domain_color}20`,
                                                                                            color: domain ? getStatusColor(domain, entry.status_key) : entry.domain_color
                                                                                        }}
                                                                                    >
                                                                                        {entry.status_label}
                                                                                    </span>
                                                                                    {entry.is_milestone && (
                                                                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                                                                    )}
                                                                                </div>
                                                                                {entry.notes && (
                                                                                    <p className="text-sm text-gray-500 mt-1">{entry.notes}</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* Empty State */}
                {!selectedParticipant && (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2">Select a Participant</h2>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Search for a participant above to view and track their recovery journey across multiple life domains.
                        </p>
                    </div>
                )}
            </main>

            {/* Add Entry Modal */}
            {showAddModal && selectedDomain && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[#0E2235]">Update {selectedDomain.domain_label}</h2>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Status Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                                <div className="space-y-2">
                                    {selectedDomain.statuses.map((status) => (
                                        <button
                                            key={status.key}
                                            type="button"
                                            onClick={() => setNewEntry({ ...newEntry, status_key: status.key, status_label: status.label })}
                                            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                                newEntry.status_key === status.key
                                                    ? 'border-purple-500 bg-purple-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: status.color }}
                                                />
                                                <span className="font-medium text-gray-700">{status.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={newEntry.entry_date}
                                    onChange={(e) => setNewEntry({ ...newEntry, entry_date: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                                <textarea
                                    value={newEntry.notes}
                                    onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="What led to this change? Any context to remember..."
                                />
                            </div>

                            {/* Milestone Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newEntry.is_milestone}
                                    onChange={(e) => setNewEntry({ ...newEntry, is_milestone: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                    <span className="font-medium text-gray-700">Mark as Milestone</span>
                                    <p className="text-xs text-gray-500">Highlight this as a significant achievement</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEntry}
                                disabled={!newEntry.status_key || saving}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {saving ? 'Saving...' : 'Save Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
