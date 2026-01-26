'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';  // CHANGED: from useAuth
import {
    ArrowLeft, ChevronRight, Mic, Calendar, Clock,
    Trash2, Eye, Loader2, MessageCircle, Sparkles,
    Search, Filter, MoreVertical, BookOpen, Heart,
    Target, FileText, MapPin, ArrowRight, X,
    Lightbulb, CheckCircle
} from 'lucide-react';
// REMOVED: useAuth and createClient imports

interface SessionSummary {
    summary: string;
    mainTopics: string[];
    ideasDiscussed: string[];
    suggestedNextSteps: string[];
    toolSuggestions: {
        recoveryGoalGenerator: { suggestion: string; prompt: string } | string | null;
        lessonBuilder: { suggestion: string; prompt: string } | string | null;
        resourceNavigator: { suggestion: string; prompt: string } | string | null;
    };
    encouragement: string;
}

interface AdvisorSession {
    id: string;
    title: string;
    transcript: string;
    summary: SessionSummary;
    created_at: string;
}

export default function AdvisorLibrary() {
    const router = useRouter();
    const { data: session, status } = useSession();  // CHANGED: from useAuth
    // REMOVED: const supabase = createClient();

    const [sessions, setSessions] = useState<AdvisorSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState<AdvisorSession | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        // CHANGED: auth check for NextAuth
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchSessions();
        }
    }, [status, router]);

    // CHANGED: fetch via API instead of direct Supabase
    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/advisor-sessions');
            const data = await response.json();
            
            if (data.success) {
                setSessions(data.sessions || []);
            } else {
                console.error('Error fetching sessions:', data.error);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // CHANGED: delete via API instead of direct Supabase
    const deleteSession = async (id: string) => {
        try {
            const response = await fetch(`/api/advisor-sessions?id=${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
            
            setSessions(sessions.filter(s => s.id !== id));
            setShowDeleteConfirm(null);
            if (selectedSession?.id === id) {
                setSelectedSession(null);
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const filteredSessions = sessions.filter(session => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            session.title.toLowerCase().includes(query) ||
            session.summary?.summary?.toLowerCase().includes(query) ||
            session.summary?.mainTopics?.some(t => t.toLowerCase().includes(query))
        );
    });

    // Helper to extract prompt from tool suggestion (handles both old and new formats)
    const getToolPrompt = (toolSuggestion: { suggestion: string; prompt: string } | string | null): string => {
        if (!toolSuggestion) return '';
        if (typeof toolSuggestion === 'string') return toolSuggestion;
        return toolSuggestion.prompt || toolSuggestion.suggestion || '';
    };

    const getToolSuggestionText = (toolSuggestion: { suggestion: string; prompt: string } | string | null): string => {
        if (!toolSuggestion) return '';
        if (typeof toolSuggestion === 'string') return toolSuggestion;
        return toolSuggestion.suggestion || '';
    };

    // Navigation handlers that pass context
    const navigateToGoalGenerator = (toolSuggestion: { suggestion: string; prompt: string } | string | null) => {
        const prompt = getToolPrompt(toolSuggestion);
        router.push(`/goal-generator?prompt=${encodeURIComponent(prompt)}`);
    };

    const navigateToLessonBuilder = (toolSuggestion: { suggestion: string; prompt: string } | string | null) => {
        const prompt = getToolPrompt(toolSuggestion);
        router.push(`/lesson-builder?topic=${encodeURIComponent(prompt)}`);
    };

    const navigateToResourceNavigator = (toolSuggestion: { suggestion: string; prompt: string } | string | null) => {
        const prompt = getToolPrompt(toolSuggestion);
        router.push(`/resource-navigator?search=${encodeURIComponent(prompt)}`);
    };

    // CHANGED: loading check for NextAuth
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00BCD4]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header */}
            <header className="bg-white border-b border-[#E7E9EC] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/peer-advisor')}
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
                                <button 
                                    onClick={() => router.push('/peer-advisor')}
                                    className="text-[#1A73A8] hover:underline"
                                >
                                    Peer Advisor
                                </button>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600 font-medium">Session Library</span>
                            </nav>
                        </div>

                        <button
                            onClick={() => router.push('/peer-advisor')}
                            className="flex items-center gap-2 px-4 py-2 bg-[#00BCD4] text-white rounded-xl font-medium hover:bg-[#0097A7] transition-colors"
                        >
                            <Mic className="w-4 h-4" />
                            New Session
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#0E2235]">Session Library</h1>
                            <p className="text-gray-600">Review and revisit your Peer Advisor conversations</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search sessions..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00BCD4] focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-[#00BCD4]" />
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <Mic className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">
                            {searchQuery ? 'No matching sessions' : 'No saved sessions yet'}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {searchQuery 
                                ? 'Try a different search term' 
                                : 'Start a voice session with your Peer Advisor and save it to see it here.'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => router.push('/peer-advisor')}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#00BCD4] text-white rounded-xl font-medium hover:bg-[#0097A7] transition-colors"
                            >
                                <Mic className="w-5 h-5" />
                                Start a Session
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-6">
                        {/* Sessions List */}
                        <div className={`${selectedSession ? 'w-1/3' : 'w-full'} space-y-3 transition-all`}>
                            {filteredSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                                        selectedSession?.id === session.id 
                                            ? 'border-[#00BCD4] ring-2 ring-[#00BCD4]/20' 
                                            : 'border-gray-200 hover:border-[#00BCD4]/50 hover:shadow-md'
                                    }`}
                                    onClick={() => setSelectedSession(session)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-[#00BCD4]/10 flex items-center justify-center">
                                                <Mic className="w-4 h-4 text-[#00BCD4]" />
                                            </div>
                                            <h3 className="font-medium text-[#0E2235] line-clamp-1">
                                                {session.title}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDeleteConfirm(session.id);
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                                        {session.summary?.summary}
                                    </p>

                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(session.created_at)}
                                        </span>
                                    </div>

                                    {session.summary?.mainTopics?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-3">
                                            {session.summary.mainTopics.slice(0, 2).map((topic, i) => (
                                                <span 
                                                    key={i}
                                                    className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full text-xs"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Session Detail */}
                        {selectedSession && (
                            <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] flex items-center justify-center">
                                            <Mic className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-[#0E2235]">{selectedSession.title}</h2>
                                            <p className="text-sm text-gray-500">{formatDate(selectedSession.created_at)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSession(null)}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
                                    {/* Summary */}
                                    <div>
                                        <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-[#00BCD4]" />
                                            Summary
                                        </h3>
                                        <p className="text-gray-700">{selectedSession.summary?.summary}</p>
                                    </div>

                                    {/* Topics */}
                                    {selectedSession.summary?.mainTopics?.length > 0 && (
                                        <div>
                                            <h3 className="font-semibold text-[#0E2235] mb-2">Topics</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSession.summary.mainTopics.map((topic, i) => (
                                                    <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                                                        {topic}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ideas */}
                                    {selectedSession.summary?.ideasDiscussed?.length > 0 && (
                                        <div>
                                            <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                                Ideas Discussed
                                            </h3>
                                            <ul className="space-y-2">
                                                {selectedSession.summary.ideasDiscussed.map((idea, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-gray-700">
                                                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                                        {idea}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Next Steps */}
                                    {selectedSession.summary?.suggestedNextSteps?.length > 0 && (
                                        <div>
                                            <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                                <ArrowRight className="w-4 h-4 text-[#00BCD4]" />
                                                Next Steps
                                            </h3>
                                            <ol className="space-y-2">
                                                {selectedSession.summary.suggestedNextSteps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-gray-700">
                                                        <span className="w-5 h-5 rounded-full bg-[#00BCD4] text-white flex items-center justify-center text-xs flex-shrink-0">
                                                            {i + 1}
                                                        </span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* Tool Suggestions */}
                                    {(selectedSession.summary?.toolSuggestions?.recoveryGoalGenerator || 
                                      selectedSession.summary?.toolSuggestions?.lessonBuilder || 
                                      selectedSession.summary?.toolSuggestions?.resourceNavigator) && (
                                        <div className="bg-cyan-50 rounded-xl p-4">
                                            <h3 className="font-semibold text-[#0E2235] mb-3">Continue in Other Tools</h3>
                                            <div className="space-y-2">
                                                {selectedSession.summary.toolSuggestions.recoveryGoalGenerator && (
                                                    <button
                                                        onClick={() => navigateToGoalGenerator(selectedSession.summary.toolSuggestions.recoveryGoalGenerator)}
                                                        className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all text-left group"
                                                    >
                                                        <Target className="w-5 h-5 text-[#30B27A]" />
                                                        <span className="flex-1 text-sm text-gray-700 group-hover:text-[#30B27A]">
                                                            {getToolSuggestionText(selectedSession.summary.toolSuggestions.recoveryGoalGenerator)}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                                {selectedSession.summary.toolSuggestions.lessonBuilder && (
                                                    <button
                                                        onClick={() => navigateToLessonBuilder(selectedSession.summary.toolSuggestions.lessonBuilder)}
                                                        className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all text-left group"
                                                    >
                                                        <FileText className="w-5 h-5 text-[#1A73A8]" />
                                                        <span className="flex-1 text-sm text-gray-700 group-hover:text-[#1A73A8]">
                                                            {getToolSuggestionText(selectedSession.summary.toolSuggestions.lessonBuilder)}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                                {selectedSession.summary.toolSuggestions.resourceNavigator && (
                                                    <button
                                                        onClick={() => navigateToResourceNavigator(selectedSession.summary.toolSuggestions.resourceNavigator)}
                                                        className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all text-left group"
                                                    >
                                                        <MapPin className="w-5 h-5 text-[#9B59B6]" />
                                                        <span className="flex-1 text-sm text-gray-700 group-hover:text-[#9B59B6]">
                                                            {getToolSuggestionText(selectedSession.summary.toolSuggestions.resourceNavigator)}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Encouragement */}
                                    {selectedSession.summary?.encouragement && (
                                        <div className="bg-gradient-to-r from-[#00BCD4] to-[#0097A7] rounded-xl p-4 text-white">
                                            <div className="flex items-start gap-3">
                                                <Heart className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                                <p>{selectedSession.summary.encouragement}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Transcript */}
                                    {selectedSession.transcript && (
                                        <div>
                                            <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                                <MessageCircle className="w-4 h-4 text-gray-500" />
                                                Full Transcript
                                            </h3>
                                            <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                                                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                                                    {selectedSession.transcript}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">Delete Session?</h3>
                        <p className="text-gray-600 mb-6">
                            This will permanently delete this session and its summary. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteSession(showDeleteConfirm)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
