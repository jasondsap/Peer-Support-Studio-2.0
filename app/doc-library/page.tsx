// app/doc-library/page.tsx
// Reference Document Library — browse and view SAMHSA & NAADAC source documents

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    BookOpen,
    Search,
    FileText,
    ExternalLink,
    Download,
    Loader2,
    Shield,
    X,
    ChevronRight,
    Library,
    Filter,
    Calendar,
    Building2,
} from 'lucide-react';

// ─── TYPES ───

interface ReferenceDocument {
    id: string;
    slug: string;
    title: string;
    short_title: string;
    description: string;
    publisher: string;
    year: number;
    page_count: number | null;
    file_size_bytes: number | null;
    category: string;
    tags: string[];
    badge_color: string;
    sort_order: number;
}

// ─── HELPERS ───

const BADGE_COLORS: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    teal: 'bg-teal-100 text-teal-800 border-teal-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
};

const CATEGORY_LABELS: Record<string, string> = {
    'treatment-improvement': 'Treatment Improvement Protocol',
    framework: 'Recovery Framework',
    competencies: 'Professional Competencies',
    ethics: 'Code of Ethics',
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
    'treatment-improvement': FileText,
    framework: BookOpen,
    competencies: Shield,
    ethics: Shield,
};

function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── COMPONENTS ───

function DocumentCard({
    doc,
    onView,
}: {
    doc: ReferenceDocument;
    onView: (slug: string) => void;
}) {
    const colorClass = BADGE_COLORS[doc.badge_color] || BADGE_COLORS.gray;
    const categoryLabel = CATEGORY_LABELS[doc.category] || doc.category;
    const CategoryIcon = CATEGORY_ICONS[doc.category] || FileText;

    return (
        <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all group">
            {/* Color accent bar */}
            <div className={`h-1.5 rounded-t-xl ${colorClass.split(' ')[0]}`} />

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${colorClass}`}>
                        {doc.short_title}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Building2 className="w-3 h-3" />
                        {doc.publisher}
                    </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-[#0E2235] text-sm leading-snug mb-2">
                    {doc.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">
                    {doc.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                        <CategoryIcon className="w-3 h-3" />
                        {categoryLabel}
                    </span>
                    {doc.year && (
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {doc.year}
                        </span>
                    )}
                    {doc.file_size_bytes && (
                        <span>{formatFileSize(doc.file_size_bytes)}</span>
                    )}
                </div>

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                        {doc.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Action */}
                <button
                    onClick={() => onView(doc.slug)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0E2235] text-white text-sm font-medium hover:bg-[#1a3654] transition-colors group-hover:bg-[#1A73A8]"
                >
                    <BookOpen className="w-4 h-4" />
                    View Document
                </button>
            </div>
        </div>
    );
}

function PDFViewer({
    url,
    title,
    onClose,
}: {
    url: string;
    title: string;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-[#1A73A8] flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-[#0E2235] truncate">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open in New Tab
                        </a>
                        <a
                            href={url}
                            download
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </a>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* PDF embed */}
                <div className="flex-1 bg-gray-100">
                    <iframe
                        src={`${url}#toolbar=1&navpanes=1`}
                        className="w-full h-full border-0"
                        title={title}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── MAIN PAGE ───

export default function DocLibraryPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // PDF viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerUrl, setViewerUrl] = useState('');
    const [viewerTitle, setViewerTitle] = useState('');
    const [loadingPdf, setLoadingPdf] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Load documents
    useEffect(() => {
        async function loadDocs() {
            try {
                const res = await fetch('/api/documents');
                if (res.ok) {
                    const data = await res.json();
                    setDocuments(data.documents || []);
                }
            } catch (err) {
                console.error('Failed to load documents:', err);
            } finally {
                setLoadingDocs(false);
            }
        }
        if (status === 'authenticated') {
            loadDocs();
        }
    }, [status]);

    // Open PDF viewer
    const handleViewDocument = async (slug: string) => {
        setLoadingPdf(true);
        try {
            const res = await fetch(`/api/documents?slug=${slug}`);
            if (res.ok) {
                const data = await res.json();
                setViewerUrl(data.url);
                setViewerTitle(data.document.title);
                setViewerOpen(true);
            }
        } catch (err) {
            console.error('Failed to get document URL:', err);
        } finally {
            setLoadingPdf(false);
        }
    };

    // Filter documents
    const filteredDocs = documents.filter(doc => {
        const matchesSearch = !search ||
            doc.title.toLowerCase().includes(search.toLowerCase()) ||
            doc.description.toLowerCase().includes(search.toLowerCase()) ||
            doc.short_title.toLowerCase().includes(search.toLowerCase()) ||
            (doc.tags && doc.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));

        const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    // Get unique categories
    const categories = ['all', ...Array.from(new Set(documents.map(d => d.category)))];

    if (status === 'loading' || loadingDocs) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <div className="w-8 h-8 border-4 border-[#1A73A8] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-[calc(100vh-64px)] bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#1A73A8]/10 flex items-center justify-center">
                                <Library className="w-5 h-5 text-[#1A73A8]" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Reference Library</h1>
                                <p className="text-sm text-gray-500">
                                    Authoritative source documents powering every Peer Advisor response
                                </p>
                            </div>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            {documents.length} documents
                        </span>
                    </div>

                    {/* Search + Filter */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search documents by title, topic, or tag..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/40 focus:border-[#1A73A8] placeholder:text-gray-400"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        categoryFilter === cat
                                            ? 'bg-[#0E2235] text-white'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {filteredDocs.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-400">No documents match your search</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDocs.map(doc => (
                            <DocumentCard key={doc.id} doc={doc} onView={handleViewDocument} />
                        ))}
                    </div>
                )}

                {/* Footer note */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400">
                        SAMHSA publications are in the public domain as U.S. government works.
                        NAADAC Code of Ethics is provided for educational reference.
                    </p>
                </div>
            </div>

            {/* PDF Loading overlay */}
            {loadingPdf && (
                <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
                    <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-xl">
                        <Loader2 className="w-5 h-5 animate-spin text-[#1A73A8]" />
                        <span className="text-sm font-medium text-[#0E2235]">Loading document...</span>
                    </div>
                </div>
            )}

            {/* PDF Viewer modal */}
            {viewerOpen && (
                <PDFViewer
                    url={viewerUrl}
                    title={viewerTitle}
                    onClose={() => setViewerOpen(false)}
                />
            )}
        </div>
    );
}
