'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    GraduationCap,
    Users,
    Clock,
    BookOpen,
    Plus,
    CheckCircle2,
} from 'lucide-react';

interface Curriculum {
    id: string;
    name: string;
    description: string | null;
    source: string | null;
    total_hours: number | null;
    status: string;
    module_count: number;
    active_enrollment_count: number;
    total_enrollment_count: number;
    completed_enrollment_count: number;
}

const STATUS_STYLES: Record<string, string> = {
    active: 'text-green-700 bg-green-50',
    draft: 'text-amber-700 bg-amber-50',
    archived: 'text-gray-500 bg-gray-100',
};

export default function CurriculaPage() {
    const router = useRouter();
    const { status: authStatus } = useSession();

    const [curricula, setCurricula] = useState<Curriculum[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') fetchCurricula();
    }, [authStatus]);

    const fetchCurricula = async () => {
        try {
            const res = await fetch('/api/curricula');
            if (!res.ok) throw new Error('Failed to fetch curricula');
            const data = await res.json();
            setCurricula(data.curricula || []);
        } catch (error) {
            console.error('Error fetching curricula:', error);
        } finally {
            setLoading(false);
        }
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
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline">
                                Dashboard
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Curriculum Manager</span>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">Curriculum Manager</h1>
                        <p className="text-gray-600 mt-1">Structured program delivery and tracking.</p>
                    </div>
                    <button
                        onClick={() => router.push('/curricula/new')}
                        className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                    >
                        <Plus className="w-4 h-4" />
                        Create Curriculum
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : curricula.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                        <GraduationCap className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No curricula yet</h3>
                        <p className="text-gray-500 mb-6">Create a curriculum to deliver and track structured programs.</p>
                        <button
                            onClick={() => router.push('/curricula/new')}
                            className="px-6 py-2.5 text-white font-medium rounded-lg"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            Create Curriculum
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {curricula.map((c) => {
                            const completionRate = c.total_enrollment_count > 0
                                ? Math.round((c.completed_enrollment_count / c.total_enrollment_count) * 100)
                                : 0;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => router.push(`/curricula/${c.id}`)}
                                    className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-5 text-left hover:shadow-md transition-shadow flex flex-col"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                            <GraduationCap className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLES[c.status] || 'text-gray-500 bg-gray-100'}`}>
                                            {c.status}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-semibold text-[#0E2235] mb-1">{c.name}</h3>
                                    {c.source && <p className="text-xs text-gray-400 mb-2">{c.source}</p>}
                                    {c.description && (
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-4">{c.description}</p>
                                    )}

                                    <div className="mt-auto space-y-3">
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <BookOpen className="w-3.5 h-3.5" /> {c.module_count} modules
                                            </span>
                                            {c.total_hours != null && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" /> {c.total_hours}h
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" /> {c.active_enrollment_count} active
                                            </span>
                                        </div>
                                        {c.total_enrollment_count > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#30B27A]" /> Completion
                                                    </span>
                                                    <span className="font-medium text-gray-700">{completionRate}%</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-[#30B27A] to-[#4AC490]"
                                                        style={{ width: `${completionRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
