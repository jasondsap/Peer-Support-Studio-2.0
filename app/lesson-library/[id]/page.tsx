'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    ChevronDown,
    Loader2,
    ShieldCheck,
    Users,
    Clock,
    Sparkles,
} from 'lucide-react';

interface SourceCitation {
    doc: string;
    section: string;
    pages?: string;
    usage?: string;
}

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
    facilitator_guide: string | null;
    participant_handout: string | null;
    lesson_json: string | null;
    use_count: number;
    created_at: string;
}

const titleCase = (s: string) =>
    s
        .replace(/-/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

export default function LessonTemplateDetail() {
    const router = useRouter();
    const params = useParams();
    const { status: authStatus } = useSession();

    const [template, setTemplate] = useState<LessonTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [cloning, setCloning] = useState(false);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated' && params.id) {
            fetchTemplate();
        }
    }, [authStatus, params.id, router]);

    const fetchTemplate = async () => {
        try {
            const response = await fetch(`/api/lesson-templates/${params.id}`);
            if (!response.ok) throw new Error('Failed to fetch template');
            const data = await response.json();
            setTemplate(data.template);
        } catch (error) {
            console.error('Error fetching template:', error);
            router.push('/lesson-library');
        } finally {
            setLoading(false);
        }
    };

    const handleUseLesson = async () => {
        if (!template) return;
        setCloning(true);
        try {
            const response = await fetch(`/api/lesson-templates/${template.id}/clone`, {
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
            setCloning(false);
        }
    };

    const getSourcesCited = (): SourceCitation[] => {
        if (!template?.lesson_json) return [];
        try {
            const parsed = JSON.parse(template.lesson_json);
            return parsed.sourcesCited || [];
        } catch {
            return [];
        }
    };

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#1A73A8] mx-auto mb-4" />
                    <p className="text-gray-600">Loading lesson...</p>
                </div>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Lesson not found</p>
                    <button
                        onClick={() => router.push('/lesson-library')}
                        className="text-[#1A73A8] hover:underline font-medium"
                    >
                        ← Back to Library
                    </button>
                </div>
            </div>
        );
    }

    const sourcesCited = getSourcesCited();

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header with Breadcrumb */}
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/lesson-library')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm min-w-0">
                            <button
                                onClick={() => router.push('/')}
                                className="text-[#1A73A8] hover:underline flex-shrink-0"
                            >
                                Dashboard
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <button
                                onClick={() => router.push('/lesson-library')}
                                className="text-[#1A73A8] hover:underline flex-shrink-0"
                            >
                                Lesson Library
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600 font-medium truncate">{template.title}</span>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Title + metadata + CTAs */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8 mb-6">
                    <span className="inline-flex items-center text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full mb-3">
                        {template.category}
                    </span>
                    <h1 className="text-3xl font-bold text-[#0E2235] mb-3">{template.title}</h1>

                    {template.description && (
                        <p className="text-gray-600 mb-5">{template.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 mb-6">
                        <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="capitalize">{template.session_type} session</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {template.session_length || '60'} minutes
                        </span>
                        <span>{titleCase(template.setting_type)}</span>
                        {template.use_count > 0 && (
                            <span className="flex items-center gap-1.5 text-[#30B27A]">
                                <Sparkles className="w-4 h-4" />
                                Used by {template.use_count} facilitator
                                {template.use_count !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleUseLesson}
                            disabled={cloning}
                            className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            style={{
                                background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                            }}
                        >
                            {cloning ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Adding to your library...
                                </>
                            ) : (
                                'Use this lesson'
                            )}
                        </button>
                        <button
                            onClick={() => router.push('/lesson-library')}
                            className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Back to Library
                        </button>
                    </div>
                </div>

                {/* Facilitator Guide */}
                {template.facilitator_guide && (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8 mb-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-4">Facilitator Guide</h2>
                        <div className="prose max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                                {template.facilitator_guide}
                            </pre>
                        </div>

                        {/* Evidence Sources — collapsible */}
                        {sourcesCited.length > 0 && (
                            <div className="border-t border-gray-200 mt-8 pt-6">
                                <button
                                    onClick={() => setSourcesOpen(!sourcesOpen)}
                                    className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[#1A73A8] transition-colors w-full"
                                >
                                    <ShieldCheck className="w-4 h-4 text-[#30B27A]" />
                                    <span>Evidence Sources ({sourcesCited.length})</span>
                                    <ChevronDown
                                        className={`w-4 h-4 ml-auto transition-transform ${sourcesOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {sourcesOpen && (
                                    <div className="mt-3 bg-gray-50 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 mb-3">
                                            This lesson was built using the following authoritative sources from our knowledge base.
                                        </p>
                                        <ul className="space-y-2">
                                            {sourcesCited.map((source, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                    <span className="text-[#30B27A] font-bold mt-0.5">✓</span>
                                                    <div>
                                                        <span className="font-medium text-gray-800">
                                                            {source.doc}, {source.section}
                                                            {source.pages && (
                                                                <span className="text-gray-500"> — pp. {source.pages}</span>
                                                            )}
                                                        </span>
                                                        {source.usage && (
                                                            <span className="text-gray-500"> — {source.usage}</span>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Participant Handout */}
                {template.participant_handout && (
                    <div className="bg-white rounded-2xl shadow-sm border-2 border-[#1A73A8]/20 p-8">
                        <h2 className="text-2xl font-bold text-[#1A73A8] mb-4">Participant Handout</h2>
                        <div className="prose max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                                {template.participant_handout}
                            </pre>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
