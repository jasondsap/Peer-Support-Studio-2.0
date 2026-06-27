'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Loader2, BookOpen, Library, Unlink } from 'lucide-react';

export interface AttachableLesson {
    id: string;
    source: 'saved' | 'template';
    title: string;
    category?: string | null;
}

// Modal picker that merges the org's saved lessons with system lesson templates.
// Calls onSelect with the chosen lesson, or null to detach an existing one.
export default function LessonPicker({
    open,
    onClose,
    onSelect,
    currentLesson,
}: {
    open: boolean;
    onClose: () => void;
    onSelect: (lesson: AttachableLesson | null) => void;
    currentLesson?: { id: string | null; title?: string | null } | null;
}) {
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState<AttachableLesson[]>([]);
    const [templates, setTemplates] = useState<AttachableLesson[]>([]);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setQuery('');
        Promise.all([
            fetch('/api/lessons')
                .then((r) => (r.ok ? r.json() : { lessons: [] }))
                .catch(() => ({ lessons: [] })),
            fetch('/api/lesson-templates')
                .then((r) => (r.ok ? r.json() : { templates: [] }))
                .catch(() => ({ templates: [] })),
        ])
            .then(([l, t]) => {
                setSaved(
                    (l.lessons || []).map((x: any) => ({
                        id: x.id,
                        source: 'saved' as const,
                        title: x.title || x.topic || 'Untitled lesson',
                    }))
                );
                setTemplates(
                    (t.templates || []).map((x: any) => ({
                        id: x.id,
                        source: 'template' as const,
                        title: x.title || 'Untitled template',
                        category: x.category,
                    }))
                );
            })
            .finally(() => setLoading(false));
    }, [open]);

    const filteredSaved = useMemo(
        () => saved.filter((l) => !query || l.title.toLowerCase().includes(query.toLowerCase())),
        [saved, query]
    );
    const filteredTemplates = useMemo(
        () => templates.filter((l) => !query || l.title.toLowerCase().includes(query.toLowerCase())),
        [templates, query]
    );

    if (!open) return null;

    const Row = ({ l }: { l: AttachableLesson }) => (
        <button
            type="button"
            onClick={() => onSelect(l)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left"
        >
            {l.source === 'saved' ? (
                <BookOpen className="w-4 h-4 text-[#30B27A] flex-shrink-0" />
            ) : (
                <Library className="w-4 h-4 text-[#1A73A8] flex-shrink-0" />
            )}
            <span className="text-sm text-gray-700 flex-1 truncate">{l.title}</span>
            <span
                className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                    l.source === 'saved' ? 'bg-[#30B27A]/10 text-[#30B27A]' : 'bg-[#1A73A8]/10 text-[#1A73A8]'
                }`}
            >
                {l.source === 'saved' ? 'My lesson' : 'Template'}
            </span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-[#0E2235]">Attach a lesson</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search lessons & templates..."
                            className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-[#1A73A8]" />
                        </div>
                    ) : filteredSaved.length === 0 && filteredTemplates.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">No lessons found.</p>
                    ) : (
                        <>
                            {filteredSaved.length > 0 && (
                                <>
                                    <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        My lessons
                                    </div>
                                    {filteredSaved.map((l) => (
                                        <Row key={`saved-${l.id}`} l={l} />
                                    ))}
                                </>
                            )}
                            {filteredTemplates.length > 0 && (
                                <>
                                    <div className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        Lesson library templates
                                    </div>
                                    {filteredTemplates.map((l) => (
                                        <Row key={`tpl-${l.id}`} l={l} />
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>

                {currentLesson?.id && (
                    <div className="px-6 py-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => onSelect(null)}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-2"
                        >
                            <Unlink className="w-4 h-4" />
                            Remove attached lesson{currentLesson.title ? ` (${currentLesson.title})` : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
