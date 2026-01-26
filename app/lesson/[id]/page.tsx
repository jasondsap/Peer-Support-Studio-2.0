'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface SavedLesson {
    id: string;
    title: string;
    topic: string;
    facilitator_guide: string;
    participant_handout: string;
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/library')}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-6 font-medium"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Library
                </button>

                {/* Facilitator Guide */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">{lesson.title}</h1>
                    <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                            {lesson.facilitator_guide}
                        </pre>
                    </div>
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
