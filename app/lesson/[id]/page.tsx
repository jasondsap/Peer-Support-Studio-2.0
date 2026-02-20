'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, ChevronDown, ShieldCheck, Download } from 'lucide-react';
import { generateLessonPDF } from '../../utils/generatePDF';

interface SourceCitation {
    doc: string;
    section: string;
    pages?: string;
    usage?: string;
}

interface SavedLesson {
    id: string;
    title: string;
    topic: string;
    facilitator_guide: string;
    participant_handout: string;
    lesson_json: string | null;
    session_type: string;
    group_size: string | null;
    session_length: string;
    recovery_model: string;
    setting_type: string;
    group_composition: string | null;
    created_at: string;
}

export default function LessonDetail() {
    const router = useRouter();
    const params = useParams();
    const { data: session, status: authStatus } = useSession();

    const [lesson, setLesson] = useState<SavedLesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [sourcesOpen, setSourcesOpen] = useState(false);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }

        if (authStatus === 'authenticated' && params.id) {
            fetchLesson();
        }
    }, [authStatus, params.id, router]);

    const fetchLesson = async () => {
        try {
            const response = await fetch(`/api/lessons/${params.id}`);
            if (!response.ok) throw new Error('Failed to fetch lesson');
            const data = await response.json();
            setLesson(data.lesson);
        } catch (error) {
            console.error('Error fetching lesson:', error);
            router.push('/library');
        } finally {
            setLoading(false);
        }
    };

    // Parse sourcesCited from the stored lesson JSON
    const getSourcesCited = (): SourceCitation[] => {
        if (!lesson?.lesson_json) return [];
        try {
            const parsed = JSON.parse(lesson.lesson_json);
            return parsed.sourcesCited || [];
        } catch {
            return [];
        }
    };

    // Parse the full lesson plan for PDF generation
    const getParsedLessonPlan = () => {
        if (!lesson?.lesson_json) return null;
        try {
            return JSON.parse(lesson.lesson_json);
        } catch {
            return null;
        }
    };

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading lesson...</p>
                </div>
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Lesson not found</p>
                    <button
                        onClick={() => router.push('/library')}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        ← Back to Library
                    </button>
                </div>
            </div>
        );
    }

    const sourcesCited = getSourcesCited();
    const parsedLessonPlan = getParsedLessonPlan();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.push('/library')}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Library
                    </button>

                    {/* PDF Download */}
                    {parsedLessonPlan && (
                        <button
                            onClick={() => generateLessonPDF(parsedLessonPlan)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg font-medium hover:bg-[#156090] transition-colors text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                    )}
                </div>

                {/* Facilitator Guide */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">{lesson.title}</h1>
                    <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                            {lesson.facilitator_guide}
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
                                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
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
                                                        {source.pages && <span className="text-gray-500"> — pp. {source.pages}</span>}
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

                {/* Participant Handout */}
                <div className="bg-white rounded-lg shadow-lg p-8 border-4 border-indigo-200">
                    <h2 className="text-2xl font-bold text-indigo-600 mb-4">Participant Handout</h2>
                    <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                            {lesson.participant_handout}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}
