'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';  // CHANGED: from useAuth
import dynamic from 'next/dynamic';
import {
    ArrowLeft, ChevronRight, Mic, Phone, MessageCircle,
    Sparkles, Heart, Brain, Users, Shield, Lightbulb,
    Target, FileText, MapPin, Loader2, CheckCircle,
    ArrowRight, Clock, RotateCcw, Download, Copy, Check,
    Save, BookOpen
} from 'lucide-react';
// REMOVED: useAuth and createClient imports

// Dynamically import the voice chat component to avoid SSR issues
const PeerAdvisorChat = dynamic(
    () => import('../components/PeerAdvisorChat'),
    { ssr: false, loading: () => <LoadingState /> }
);

function LoadingState() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[#00BCD4] mx-auto mb-4" />
                <p className="text-gray-600">Loading voice interface...</p>
            </div>
        </div>
    );
}

interface SessionSummary {
    summary: string;
    mainTopics: string[];
    ideasDiscussed: string[];
    suggestedNextSteps: string[];
    toolSuggestions: {
        recoveryGoalGenerator: { suggestion: string; prompt: string } | null;
        lessonBuilder: { suggestion: string; prompt: string } | null;
        resourceNavigator: { suggestion: string; prompt: string } | null;
    };
    encouragement: string;
}

type ViewState = 'welcome' | 'chat' | 'summary';

export default function PeerAdvisor() {
    const router = useRouter();
    const { data: session, status } = useSession();  // CHANGED: from useAuth
    // REMOVED: const supabase = createClient();

    const [view, setView] = useState<ViewState>('welcome');
    const [transcript, setTranscript] = useState<string>('');
    const [summary, setSummary] = useState<SessionSummary | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        // CHANGED: auth check for NextAuth
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const handleSessionEnd = (sessionTranscript: string, messages: any[]) => {
        setTranscript(sessionTranscript);
        setView('summary');
    };

    const generateSummary = async () => {
        if (!transcript) return;

        setIsGeneratingSummary(true);
        try {
            const response = await fetch('/api/advisor-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });

            const data = await response.json();
            if (data.success) {
                setSummary(data.summary);
            }
        } catch (error) {
            console.error('Summary error:', error);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    // CHANGED: saveSession now uses API instead of direct Supabase
    const saveSession = async () => {
        if (!summary || !session?.user) return;

        setIsSaving(true);
        try {
            // Generate title from first topic or summary
            const title = summary.mainTopics[0] || 
                summary.summary.substring(0, 50) + '...' ||
                `Session ${new Date().toLocaleDateString()}`;

            const response = await fetch('/api/advisor-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    transcript,
                    summary
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to save');
            }
            setIsSaved(true);
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save session. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const startNewSession = () => {
        setTranscript('');
        setSummary(null);
        setIsSaved(false);
        setView('welcome');
    };

    const copyTranscript = () => {
        navigator.clipboard.writeText(transcript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Navigation handlers that pass context to other tools
    const navigateToGoalGenerator = () => {
        const prompt = summary?.toolSuggestions.recoveryGoalGenerator?.prompt || '';
        router.push(`/goal-generator?prompt=${encodeURIComponent(prompt)}`);
    };

    const navigateToLessonBuilder = () => {
        const prompt = summary?.toolSuggestions.lessonBuilder?.prompt || '';
        router.push(`/lesson-builder?topic=${encodeURIComponent(prompt)}`);
    };

    const navigateToResourceNavigator = () => {
        const prompt = summary?.toolSuggestions.resourceNavigator?.prompt || '';
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
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => view === 'chat' ? setView('welcome') : router.push('/')}
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
                                <span className="text-gray-600 font-medium">Peer Advisor</span>
                            </nav>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push('/advisor-library')}
                                className="flex items-center gap-2 px-3 py-1.5 text-[#00BCD4] hover:bg-[#00BCD4]/10 rounded-lg text-sm font-medium"
                            >
                                <BookOpen className="w-4 h-4" />
                                Session Library
                            </button>
                            {view !== 'welcome' && (
                                <button
                                    onClick={startNewSession}
                                    className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    New Session
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Welcome View */}
            {view === 'welcome' && (
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="max-w-3xl w-full">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Mic className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-[#0E2235] mb-2">
                                Peer Support Advisor
                            </h1>
                            <p className="text-gray-600 max-w-lg mx-auto">
                                Your emotionally intelligent voice companion for guidance, 
                                encouragement, and problem-solving support.
                            </p>
                        </div>

                        {/* What You Can Do */}
                        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
                            <h2 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#00BCD4]" />
                                How I Can Help
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 p-3 bg-cyan-50 rounded-xl">
                                    <Brain className="w-6 h-6 text-[#00BCD4] flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-[#0E2235]">Brainstorm Ideas</p>
                                        <p className="text-sm text-gray-600">Group topics, activities, recovery strategies</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-cyan-50 rounded-xl">
                                    <Users className="w-6 h-6 text-[#00BCD4] flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-[#0E2235]">Navigate Situations</p>
                                        <p className="text-sm text-gray-600">Work through participant challenges</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-cyan-50 rounded-xl">
                                    <Shield className="w-6 h-6 text-[#00BCD4] flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-[#0E2235]">Practice Boundaries</p>
                                        <p className="text-sm text-gray-600">Role-play difficult conversations</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-cyan-50 rounded-xl">
                                    <Heart className="w-6 h-6 text-[#00BCD4] flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-[#0E2235]">Get Support</p>
                                        <p className="text-sm text-gray-600">Process difficult emotions and moments</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Example Prompts */}
                        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
                            <h2 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#00BCD4]" />
                                Things You Might Say
                            </h2>
                            <div className="space-y-2">
                                <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm italic">
                                    "Someone relapsed and is ashamed to return — how do I support them?"
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm italic">
                                    "I need ideas for a 45-minute group on building recovery capital."
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm italic">
                                    "I think a participant is becoming too dependent on me. How do I handle this?"
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm italic">
                                    "I'm feeling overwhelmed and discouraged today."
                                </div>
                            </div>
                        </div>

                        {/* Start Button */}
                        <div className="text-center">
                            <button
                                onClick={() => setView('chat')}
                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00BCD4] to-[#0097A7] text-white rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                            >
                                <Phone className="w-6 h-6" />
                                Start Voice Session
                            </button>
                            <p className="text-sm text-gray-500 mt-3">
                                Uses Hume AI's Empathic Voice Interface
                            </p>
                        </div>
                    </div>
                </main>
            )}

            {/* Chat View */}
            {view === 'chat' && (
                <PeerAdvisorChat
                    onSessionEnd={handleSessionEnd}
                    onBack={() => setView('welcome')}
                />
            )}

            {/* Summary View */}
            {view === 'summary' && (
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-[#0E2235] mb-2">
                                Session Complete
                            </h1>
                            <p className="text-gray-600">
                                Review your conversation and generate an AI summary.
                            </p>
                        </div>

                        {/* Transcript */}
                        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-[#0E2235] flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-[#00BCD4]" />
                                    Conversation Transcript
                                </h2>
                                <button
                                    onClick={copyTranscript}
                                    className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto bg-gray-50 rounded-xl p-4">
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                                    {transcript || 'No transcript available.'}
                                </pre>
                            </div>
                        </div>

                        {/* Generate Summary Button */}
                        {!summary && (
                            <div className="text-center mb-6">
                                <button
                                    onClick={generateSummary}
                                    disabled={isGeneratingSummary || !transcript}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#00BCD4] text-white rounded-xl font-medium hover:bg-[#0097A7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isGeneratingSummary ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Generating Summary...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            Generate AI Summary
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Summary Display */}
                        {summary && (
                            <div className="space-y-4">
                                {/* Save Button */}
                                {!isSaved && (
                                    <div className="flex justify-center">
                                        <button
                                            onClick={saveSession}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#30B27A] text-white rounded-xl font-medium hover:bg-[#27ae60] disabled:opacity-50 transition-colors"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-5 h-5" />
                                                    Save to Library
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {isSaved && (
                                    <div className="flex justify-center">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm">
                                            <CheckCircle className="w-4 h-4" />
                                            Saved to Library
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                <div className="bg-white rounded-2xl shadow-md p-6">
                                    <h2 className="text-lg font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-[#00BCD4]" />
                                        Summary
                                    </h2>
                                    <p className="text-gray-700">{summary.summary}</p>
                                </div>

                                {/* Main Topics */}
                                {summary.mainTopics.length > 0 && (
                                    <div className="bg-white rounded-2xl shadow-md p-6">
                                        <h2 className="text-lg font-semibold text-[#0E2235] mb-3">Main Topics</h2>
                                        <div className="flex flex-wrap gap-2">
                                            {summary.mainTopics.map((topic, i) => (
                                                <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Ideas Discussed */}
                                {summary.ideasDiscussed.length > 0 && (
                                    <div className="bg-white rounded-2xl shadow-md p-6">
                                        <h2 className="text-lg font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                            <Lightbulb className="w-5 h-5 text-amber-500" />
                                            Ideas Discussed
                                        </h2>
                                        <ul className="space-y-2">
                                            {summary.ideasDiscussed.map((idea, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                                                    <span className="text-gray-700">{idea}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Next Steps */}
                                {summary.suggestedNextSteps.length > 0 && (
                                    <div className="bg-white rounded-2xl shadow-md p-6">
                                        <h2 className="text-lg font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                            <ArrowRight className="w-5 h-5 text-[#00BCD4]" />
                                            Suggested Next Steps
                                        </h2>
                                        <ol className="space-y-2">
                                            {summary.suggestedNextSteps.map((step, i) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-[#00BCD4] text-white flex items-center justify-center text-sm flex-shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-gray-700">{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Tool Suggestions */}
                                {(summary.toolSuggestions.recoveryGoalGenerator || 
                                  summary.toolSuggestions.lessonBuilder || 
                                  summary.toolSuggestions.resourceNavigator) && (
                                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-200">
                                        <h2 className="text-lg font-semibold text-[#0E2235] mb-4">
                                            Continue in Other Tools
                                        </h2>
                                        <div className="space-y-3">
                                            {summary.toolSuggestions.recoveryGoalGenerator && (
                                                <button
                                                    onClick={navigateToGoalGenerator}
                                                    className="w-full flex items-center gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-all text-left group"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-[#30B27A]/10 flex items-center justify-center">
                                                        <Target className="w-6 h-6 text-[#30B27A]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-[#0E2235] group-hover:text-[#30B27A]">
                                                            Recovery Goal Generator
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {summary.toolSuggestions.recoveryGoalGenerator.suggestion}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#30B27A]" />
                                                </button>
                                            )}

                                            {summary.toolSuggestions.lessonBuilder && (
                                                <button
                                                    onClick={navigateToLessonBuilder}
                                                    className="w-full flex items-center gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-all text-left group"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-[#1A73A8]/10 flex items-center justify-center">
                                                        <FileText className="w-6 h-6 text-[#1A73A8]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-[#0E2235] group-hover:text-[#1A73A8]">
                                                            Lesson Builder
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {summary.toolSuggestions.lessonBuilder.suggestion}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#1A73A8]" />
                                                </button>
                                            )}

                                            {summary.toolSuggestions.resourceNavigator && (
                                                <button
                                                    onClick={navigateToResourceNavigator}
                                                    className="w-full flex items-center gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-all text-left group"
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-[#9B59B6]/10 flex items-center justify-center">
                                                        <MapPin className="w-6 h-6 text-[#9B59B6]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-[#0E2235] group-hover:text-[#9B59B6]">
                                                            Resource Navigator
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            {summary.toolSuggestions.resourceNavigator.suggestion}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#9B59B6]" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Encouragement */}
                                <div className="bg-gradient-to-r from-[#00BCD4] to-[#0097A7] rounded-2xl p-6 text-white">
                                    <div className="flex items-start gap-3">
                                        <Heart className="w-6 h-6 flex-shrink-0 mt-0.5" />
                                        <p className="text-lg">{summary.encouragement}</p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-center gap-4 pt-4">
                                    <button
                                        onClick={startNewSession}
                                        className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                        New Session
                                    </button>
                                    <button
                                        onClick={() => router.push('/')}
                                        className="flex items-center gap-2 px-6 py-3 bg-[#00BCD4] text-white rounded-xl font-medium hover:bg-[#0097A7] transition-colors"
                                    >
                                        Back to Dashboard
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            )}
        </div>
    );
}
