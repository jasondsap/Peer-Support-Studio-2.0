'use client';

import { useState, useEffect } from 'react';
import { formatDateOnly } from '@/lib/dateUtils';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    FileText, Plus, Search, Filter, Calendar, Clock,
    User, Users, Building2, Loader2, ChevronRight,
    Mic, Edit3, MoreVertical, Trash2, Eye
} from 'lucide-react';

interface SessionNote {
    id: string;
    metadata: {
        date: string;
        duration: string;
        sessionType: string;
        setting: string;
        participantName?: string;
    };
    pss_note: {
        sessionOverview: string;
        topicsDiscussed: string[];
    };
    source: string;
    status: string;
    created_at: string;
    participant_name?: string;
}

const SETTINGS_MAP: Record<string, string> = {
    'outpatient': 'Outpatient',
    'residential': 'Residential',
    'correctional': 'Jail/Correctional',
    'hospital': 'Hospital/Inpatient',
    'community': 'Community Outreach',
    'dual-diagnosis': 'Dual Diagnosis',
    'mental-health': 'Mental Health',
    'youth': 'Youth/Adolescent',
    'therapeutic-rehab': 'Therapeutic Rehab',
};

const STATUS_COLORS: Record<string, string> = {
    'draft': 'bg-yellow-100 text-yellow-800',
    'review': 'bg-blue-100 text-blue-800',
    'approved': 'bg-green-100 text-green-800',
    'archived': 'bg-gray-100 text-gray-800',
};

export default function SessionNotesLibraryPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const PAGE_SIZE = 25;

    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    // Auth check
    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    // Debounce the search box so we don't hit the server on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Reset to first page whenever a filter changes.
    useEffect(() => {
        setPage(0);
    }, [debouncedSearch, filterStatus, dateFrom, dateTo]);

    // Fetch notes (server-side search + pagination)
    useEffect(() => {
        async function fetchNotes() {
            if (authStatus !== 'authenticated') return;

            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (filterStatus) params.set('status', filterStatus);
                if (debouncedSearch) params.set('search', debouncedSearch);
                if (dateFrom) params.set('date_from', dateFrom);
                if (dateTo) params.set('date_to', dateTo);
                params.set('limit', String(PAGE_SIZE));
                params.set('offset', String(page * PAGE_SIZE));

                const response = await fetch(`/api/session-notes?${params.toString()}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch notes');
                }

                const data = await response.json();
                setNotes(data.notes || []);
                setTotal(data.total ?? data.pagination?.total ?? 0);
            } catch (err) {
                console.error('Error fetching notes:', err);
            } finally {
                setIsLoading(false);
            }
        }

        if (authStatus === 'authenticated') {
            fetchNotes();
        }
    }, [authStatus, filterStatus, debouncedSearch, dateFrom, dateTo, page]);

    // Server already filtered/paginated — render rows as-is.
    const filteredNotes = notes;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Delete note
    const handleDelete = async (noteId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            const response = await fetch(`/api/session-notes/${noteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setNotes(notes.filter(n => n.id !== noteId));
            }
        } catch (err) {
            console.error('Error deleting note:', err);
        }
        setActiveMenu(null);
    };

    // Loading state — only block the whole page on the very first auth load.
    // Subsequent fetches (search/pagination) show an inline spinner so the
    // search box keeps focus.
    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#0E2235]">Session Notes Library</h1>
                            <p className="text-sm text-gray-500">{total} notes</p>
                        </div>
                        <button
                            onClick={() => router.push('/session-notes')}
                            className="px-4 py-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white rounded-lg hover:opacity-90 flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            New Note
                        </button>
                    </div>
                </div>
            </header>

            {/* Filters */}
            <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent appearance-none bg-white"
                        >
                            <option value="">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="review">Under Review</option>
                            <option value="approved">Approved</option>
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            title="From date"
                        />
                        <span className="text-gray-400 text-sm">to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            title="To date"
                        />
                        {(dateFrom || dateTo || filterStatus || searchQuery) && (
                            <button
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                    setFilterStatus('');
                                    setSearchQuery('');
                                }}
                                className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Notes List */}
            <main className="max-w-6xl mx-auto px-4 pb-8">
                {isLoading ? (
                    <div className="bg-white rounded-xl shadow-md p-12 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2">
                            {debouncedSearch || filterStatus || dateFrom || dateTo
                                ? 'No notes match your filters'
                                : 'No Session Notes Yet'}
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {debouncedSearch || filterStatus || dateFrom || dateTo
                                ? 'Try adjusting your search or date range.'
                                : 'Create your first session note using voice dictation or recording.'}
                        </p>
                        <button
                            onClick={() => router.push('/session-notes')}
                            className="px-6 py-3 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white rounded-lg hover:opacity-90 inline-flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Create First Note
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredNotes.map((note) => (
                            <div
                                key={note.id}
                                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer relative"
                                onClick={() => router.push(`/session-notes/${note.id}`)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        {/* Metadata Row */}
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {formatDateOnly(note.metadata?.date || note.created_at)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {note.metadata?.duration || '?'} min
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {note.metadata?.sessionType === 'group' ? (
                                                    <Users className="w-4 h-4" />
                                                ) : (
                                                    <User className="w-4 h-4" />
                                                )}
                                                {note.metadata?.sessionType || 'Individual'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Building2 className="w-4 h-4" />
                                                {SETTINGS_MAP[note.metadata?.setting] || note.metadata?.setting || 'Not set'}
                                            </div>
                                            {(note.metadata?.participantName || note.participant_name) && (
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                                    {note.metadata?.participantName || note.participant_name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Overview */}
                                        <p className="text-gray-700 line-clamp-2 mb-3">
                                            {note.pss_note?.sessionOverview || 'No overview available'}
                                        </p>

                                        {/* Topics */}
                                        {note.pss_note?.topicsDiscussed && note.pss_note.topicsDiscussed.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {note.pss_note.topicsDiscussed.slice(0, 3).map((topic, i) => (
                                                    <span
                                                        key={i}
                                                        className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs"
                                                    >
                                                        {topic.length > 30 ? topic.substring(0, 30) + '...' : topic}
                                                    </span>
                                                ))}
                                                {note.pss_note.topicsDiscussed.length > 3 && (
                                                    <span className="text-gray-400 text-xs py-1">
                                                        +{note.pss_note.topicsDiscussed.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side: Status, Source, Menu */}
                                    <div className="flex items-start gap-3 ml-4">
                                        {/* Status Badge */}
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[note.status] || STATUS_COLORS['draft']}`}>
                                            {note.status || 'draft'}
                                        </span>

                                        {/* Source Icon */}
                                        <div className="text-gray-400" title={note.source === 'dictation' ? 'Voice Dictation' : note.source === 'recording' ? 'Session Recording' : 'Manual Entry'}>
                                            {note.source === 'dictation' || note.source === 'recording' ? (
                                                <Mic className="w-5 h-5" />
                                            ) : (
                                                <Edit3 className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* Actions Menu */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenu(activeMenu === note.id ? null : note.id);
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <MoreVertical className="w-5 h-5 text-gray-400" />
                                            </button>
                                            
                                            {activeMenu === note.id && (
                                                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/session-notes/${note.id}`);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/session-notes/${note.id}/edit`);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(note.id);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* View Arrow */}
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300">
                                    <ChevronRight className="w-6 h-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && total > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-sm text-gray-500">
                            Showing {page * PAGE_SIZE + 1}–
                            {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-500">
                                Page {page + 1} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                                disabled={page + 1 >= totalPages}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Click outside to close menu */}
            {activeMenu && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setActiveMenu(null)}
                />
            )}
        </div>
    );
}
