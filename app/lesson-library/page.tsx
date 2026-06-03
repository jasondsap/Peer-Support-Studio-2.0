'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    Search,
    Loader2,
    Grid,
    List,
    Users,
    Clock,
    ArrowRight,
    BookOpen,
    Sparkles,
    Presentation,
    Library as LibraryIcon,
} from 'lucide-react';

interface LessonTemplate {
    id: string;
    title: string;
    topic: string;
    description: string | null;
    category: string;
    category_order: number;
    session_type: string;
    setting_type: string;
    session_length: string | null;
    recovery_model: string | null;
    group_size: string | null;
    group_composition: string | null;
    gamma_presentation_url: string | null;
    use_count: number;
    created_at: string;
}

const SESSION_TYPES = ['group', 'individual', 'both'];
const SETTING_TYPES = [
    'general',
    'jail',
    'residential',
    'mental-health',
    'developmental-disability',
    'youth',
    'outpatient',
];

const titleCase = (s: string) =>
    s
        .replace(/-/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

export default function LessonLibrary() {
    const router = useRouter();
    const { status: authStatus } = useSession();

    const [templates, setTemplates] = useState<LessonTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('all');
    const [settingFilter, setSettingFilter] = useState<string>('all');

    // Pagination state (-1 means "All")
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState(1);

    // Clone state
    const [cloningId, setCloningId] = useState<string | null>(null);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') {
            fetchTemplates();
        }
    }, [authStatus]);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/lesson-templates');
            if (!response.ok) throw new Error('Failed to fetch templates');
            const data = await response.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUseLesson = async (templateId: string) => {
        setCloningId(templateId);
        try {
            const response = await fetch(`/api/lesson-templates/${templateId}/clone`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok || !data.lesson?.id) {
                throw new Error(data.error || 'Failed to use lesson');
            }
            router.push(`/lesson/${data.lesson.id}`);
        } catch (error) {
            console.error('Error cloning template:', error);
            alert('Could not add this lesson to your library. Please try again.');
            setCloningId(null);
        }
    };

    // Categories present in the data, ordered by category_order
    const categories = useMemo(() => {
        const map = new Map<string, number>();
        templates.forEach((t) => {
            if (!map.has(t.category)) map.set(t.category, t.category_order);
        });
        return Array.from(map.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([name]) => name);
    }, [templates]);

    const filteredTemplates = templates.filter((t) => {
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (sessionTypeFilter !== 'all' && t.session_type !== sessionTypeFilter) return false;
        if (settingFilter !== 'all' && t.setting_type !== settingFilter) return false;
        if (searchQuery && !(t.title || '').toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    // Pagination calculations
    const totalTemplates = filteredTemplates.length;
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalTemplates / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIdx = pageSize === -1 ? 0 : (safeCurrentPage - 1) * pageSize;
    const endIdx = pageSize === -1 ? totalTemplates : Math.min(startIdx + pageSize, totalTemplates);
    const paginatedTemplates =
        pageSize === -1 ? filteredTemplates : filteredTemplates.slice(startIdx, endIdx);

    // Reset to page 1 when search, page size, or any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, pageSize, categoryFilter, sessionTypeFilter, settingFilter]);

    const clearFilters = () => {
        setCategoryFilter('all');
        setSessionTypeFilter('all');
        setSettingFilter('all');
        setSearchQuery('');
    };

    const getPageNumbers = (): (number | '...')[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [1];
        const cp = safeCurrentPage;
        if (cp > 3) pages.push('...');
        const start = Math.max(2, cp - 1);
        const end = Math.min(totalPages - 1, cp + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (cp < totalPages - 2) pages.push('...');
        pages.push(totalPages);
        return pages;
    };

    const shortDescription = (desc: string | null) => {
        if (!desc) return '';
        return desc.length > 120 ? `${desc.slice(0, 120).trimEnd()}…` : desc;
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header with Breadcrumb */}
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>

                            <nav className="flex items-center gap-2 text-sm">
                                <button
                                    onClick={() => router.push('/')}
                                    className="text-[#1A73A8] hover:underline"
                                >
                                    Dashboard
                                </button>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600 font-medium">Lesson Library</span>
                            </nav>
                        </div>

                        <button
                            onClick={() => signOut()}
                            className="text-sm text-gray-600 hover:text-[#1A73A8] transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#0E2235]">Lesson Library</h1>
                    <p className="text-gray-600 mt-1">
                        Browse premade lessons created by the PSS team.
                    </p>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-4 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                aria-label="Filter by category"
                            >
                                <option value="all">All categories</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={sessionTypeFilter}
                                onChange={(e) => setSessionTypeFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                aria-label="Filter by session type"
                            >
                                <option value="all">All session types</option>
                                {SESSION_TYPES.map((s) => (
                                    <option key={s} value={s}>
                                        {titleCase(s)}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={settingFilter}
                                onChange={(e) => setSettingFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                aria-label="Filter by setting"
                            >
                                <option value="all">All settings</option>
                                {SETTING_TYPES.map((s) => (
                                    <option key={s} value={s}>
                                        {titleCase(s)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search lessons..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-56 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent text-sm"
                                />
                            </div>

                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                aria-label="Lessons per page"
                            >
                                <option value={25}>25 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={200}>200 / page</option>
                                <option value={-1}>Show all</option>
                            </select>

                            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                                >
                                    <List className="w-4 h-4 text-gray-600" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                                >
                                    <Grid className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Templates Display */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                        <LibraryIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No lessons match these filters
                        </h3>
                        <p className="text-gray-500 mb-6">
                            Try broadening your search or clearing the filters.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="px-6 py-2.5 text-white font-medium rounded-lg"
                            style={{
                                background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                            }}
                        >
                            Clear filters
                        </button>
                    </div>
                ) : viewMode === 'list' ? (
                    /* ==================== LIST VIEW ==================== */
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                            <div className="col-span-5">Lesson</div>
                            <div className="col-span-2">Category</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Setting</div>
                            <div className="col-span-1"></div>
                        </div>

                        {paginatedTemplates.map((t) => (
                            <div
                                key={t.id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors items-center"
                            >
                                <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-[#30B27A]/10 flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="w-5 h-5 text-[#30B27A]" />
                                    </div>
                                    <div className="min-w-0">
                                        <button
                                            onClick={() => router.push(`/lesson-library/${t.id}`)}
                                            className="text-sm font-medium text-[#0E2235] hover:text-[#1A73A8] truncate block text-left"
                                        >
                                            {t.title}
                                        </button>
                                        <div className="flex items-center gap-3">
                                            {t.gamma_presentation_url && (
                                                <a
                                                    href={t.gamma_presentation_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[#1A73A8] hover:underline inline-flex items-center gap-1"
                                                >
                                                    <Presentation className="w-3 h-3" />
                                                    Presentation
                                                </a>
                                            )}
                                            {t.use_count > 0 && (
                                                <span className="text-xs text-gray-400">
                                                    Used {t.use_count} time{t.use_count !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-sm text-gray-600 truncate">
                                    {t.category}
                                </div>
                                <div className="col-span-2 text-sm text-gray-600 capitalize">
                                    {t.session_type}
                                </div>
                                <div className="col-span-2 text-sm text-gray-600">
                                    {titleCase(t.setting_type)}
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => handleUseLesson(t.id)}
                                        disabled={cloningId === t.id}
                                        className="text-xs font-medium text-[#1A73A8] hover:text-[#156090] disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                                    >
                                        {cloningId === t.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                Use
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* ==================== GRID VIEW ==================== */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedTemplates.map((t) => (
                            <div
                                key={t.id}
                                className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 hover:shadow-md transition-shadow flex flex-col"
                            >
                                {/* Category badge */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="inline-flex items-center text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full">
                                        {t.category}
                                    </span>
                                    {t.gamma_presentation_url && (
                                        <a
                                            href={t.gamma_presentation_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full hover:bg-[#1A73A8]/20 transition-colors"
                                        >
                                            <Presentation className="w-3 h-3" />
                                            Presentation
                                        </a>
                                    )}
                                    {t.use_count > 0 && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#30B27A] bg-[#30B27A]/10 px-2 py-1 rounded-full">
                                            <Sparkles className="w-3 h-3" />
                                            Used {t.use_count}×
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <button
                                    onClick={() => router.push(`/lesson-library/${t.id}`)}
                                    className="text-left font-semibold text-[#0E2235] text-lg mb-2 hover:text-[#1A73A8] transition-colors"
                                >
                                    {t.title}
                                </button>

                                {/* Short description */}
                                {t.description && (
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-3">
                                        {shortDescription(t.description)}
                                    </p>
                                )}

                                {/* Session Details */}
                                <div className="space-y-2 mb-4 mt-auto">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        <span className="capitalize">{t.session_type} session</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{t.session_length || '60'} minutes</span>
                                        <span>•</span>
                                        <span>{titleCase(t.setting_type)}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => router.push(`/lesson-library/${t.id}`)}
                                        className="text-sm font-medium text-gray-600 hover:text-[#1A73A8] flex items-center gap-1"
                                    >
                                        View Details
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleUseLesson(t.id)}
                                        disabled={cloningId === t.id}
                                        className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                        }}
                                    >
                                        {cloningId === t.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Adding...
                                            </>
                                        ) : (
                                            'Use this lesson'
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ==================== PAGINATION FOOTER ==================== */}
                {!loading && totalTemplates > 0 && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl shadow-sm border border-[#E7E9EC] px-4 py-3">
                        <div className="text-sm text-gray-600">
                            {pageSize === -1 ? (
                                <>
                                    Showing all{' '}
                                    <span className="font-medium text-[#0E2235]">{totalTemplates}</span>{' '}
                                    lessons
                                </>
                            ) : (
                                <>
                                    Showing <span className="font-medium text-[#0E2235]">{startIdx + 1}</span>–
                                    <span className="font-medium text-[#0E2235]">{endIdx}</span> of{' '}
                                    <span className="font-medium text-[#0E2235]">{totalTemplates}</span> lessons
                                </>
                            )}
                        </div>

                        {pageSize !== -1 && totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                                    disabled={safeCurrentPage === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>

                                {getPageNumbers().map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                                                p === safeCurrentPage
                                                    ? 'bg-[#1A73A8] text-white'
                                                    : 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
