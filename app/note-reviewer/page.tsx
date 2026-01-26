'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    FileText,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Sparkles,
    Copy,
    Download,
    History,
    ChevronDown,
    ChevronUp,
    Star,
    Clock,
    TrendingUp,
    AlertCircle,
    RefreshCw,
    Trash2,
    Eye
} from 'lucide-react';

interface CategoryFeedback {
    score: number;
    issue: string | null;
    suggestion: string | null;
    originalText: string | null;
    improvedText: string | null;
}

interface ReviewResult {
    scores: {
        professionalism: number;
        description: number;
        interventions: number;
        socialSupport: number;
        clientResponse: number;
        participation: number;
        motivation: number;
        treatmentPlan: number;
    };
    totalPoints: number;
    qualityScore: number;
    isBillable: boolean;
    feedback: {
        professionalism: CategoryFeedback;
        description: CategoryFeedback;
        interventions: CategoryFeedback;
        socialSupport: CategoryFeedback;
        clientResponse: CategoryFeedback;
        participation: CategoryFeedback;
        motivation: CategoryFeedback;
        treatmentPlan: CategoryFeedback;
    };
    summary: string;
    improvedNote: string;
    reviewId?: string;
}

interface SavedReview {
    id: string;
    original_note: string;
    quality_score: number;
    total_points: number;
    is_billable: boolean;
    created_at: string;
    feedback: any;
    improved_note: string;
}

interface UserStats {
    total_reviews: number;
    avg_quality_score: number;
    avg_total_points: number;
    billable_count: number;
    not_billable_count: number;
}

const CATEGORY_LABELS: Record<string, string> = {
    professionalism: 'Professionalism',
    description: 'Description of Session',
    interventions: 'Interventions Used',
    socialSupport: 'Social/Emotional Support',
    clientResponse: "Client's Response",
    participation: "Client's Participation",
    motivation: "Client's Motivation",
    treatmentPlan: 'Treatment Plan'
};

const QUALITY_LABELS: Record<number, { label: string; description: string; color: string }> = {
    1: { label: 'Not Billable', description: 'More than two billing components missing or do not meet medical necessity', color: 'red' },
    2: { label: 'Not Billable', description: 'Missing two billing components or two+ components do not meet medical necessity', color: 'red' },
    3: { label: 'Mostly Billable', description: 'Missing TP or one billable component, or one component does not meet medical necessity', color: 'amber' },
    4: { label: 'Billable', description: 'One section needs elaboration or note heading needs editing', color: 'green' },
    5: { label: 'Billable & Meets Necessity', description: 'Perfect score - meets all medical necessity requirements', color: 'green' }
};

export default function NoteReviewerPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const authLoading = status === 'loading';
    const user = session?.user;

    // State
    const [noteText, setNoteText] = useState('');
    const [isReviewing, setIsReviewing] = useState(false);
    const [result, setResult] = useState<ReviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedImproved, setCopiedImproved] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [reviewHistory, setReviewHistory] = useState<SavedReview[]>([]);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'review' | 'improved'>('review');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/signin');
        }
    }, [user, authLoading, router]);

    const handleReview = async () => {
        if (!noteText.trim()) {
            setError('Please paste your session note to review');
            return;
        }

        if (noteText.trim().length < 50) {
            setError('Please provide a complete session note (at least 50 characters)');
            return;
        }

        setIsReviewing(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/review-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteText: noteText.trim(),
                    saveReview: true
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to review note');
            }

            setResult(data);

            // Auto-expand categories that need improvement
            const needsImprovement = new Set<string>();
            Object.entries(data.scores).forEach(([key, score]) => {
                if (score < 2) needsImprovement.add(key);
            });
            setExpandedCategories(needsImprovement);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to review note');
        } finally {
            setIsReviewing(false);
        }
    };

    const fetchHistory = async () => {
        if (!user) return;

        setLoadingHistory(true);
        try {
            const response = await fetch(`/api/review-note?limit=10`);
            const data = await response.json();

            if (response.ok) {
                setReviewHistory(data.reviews || []);
                setUserStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadReview = (review: SavedReview) => {
        setNoteText(review.original_note);
        setResult({
            scores: {
                professionalism: 0,
                description: 0,
                interventions: 0,
                socialSupport: 0,
                clientResponse: 0,
                participation: 0,
                motivation: 0,
                treatmentPlan: 0
            },
            totalPoints: review.total_points,
            qualityScore: review.quality_score,
            isBillable: review.is_billable,
            feedback: review.feedback,
            summary: '',
            improvedNote: review.improved_note
        });
        setShowHistory(false);
    };

    const deleteReview = async (reviewId: string) => {
        if (!confirm('Delete this review from your history?')) return;

        try {
            const response = await fetch(`/api/review-note?reviewId=${reviewId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setReviewHistory(prev => prev.filter(r => r.id !== reviewId));
            }
        } catch (err) {
            console.error('Failed to delete review:', err);
        }
    };

    const copyImprovedNote = async () => {
        if (!result?.improvedNote) return;

        try {
            await navigator.clipboard.writeText(result.improvedNote);
            setCopiedImproved(true);
            setTimeout(() => setCopiedImproved(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const getScoreIcon = (score: number) => {
        if (score === 2) return <CheckCircle className="w-5 h-5 text-green-500" />;
        if (score === 1) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        return <XCircle className="w-5 h-5 text-red-500" />;
    };

    const getQualityColor = (score: number) => {
        if (score >= 4) return 'green';
        if (score === 3) return 'amber';
        return 'red';
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-200 via-blue-100 to-cyan-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-200 via-blue-100 to-cyan-100">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-[#0E2235]">Note Reviewer</h1>
                            <p className="text-sm text-gray-500">Check if your notes meet billing requirements</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowHistory(!showHistory);
                            if (!showHistory && reviewHistory.length === 0) {
                                fetchHistory();
                            }
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            showHistory ? 'bg-[#1A73A8] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">History</span>
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* History Panel */}
                {showHistory && (
                    <div className="mb-6 bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-[#0E2235]">Review History</h2>
                            {userStats && (
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1 text-gray-600">
                                        <FileText className="w-4 h-4" />
                                        <span>{userStats.total_reviews} reviews</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-green-600">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>Avg: {userStats.avg_quality_score ?? 'N/A'}/5</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {loadingHistory ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-[#1A73A8]" />
                            </div>
                        ) : reviewHistory.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No reviews yet. Start by reviewing a note!</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {reviewHistory.map((review) => (
                                    <div
                                        key={review.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                                                review.is_billable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {review.quality_score}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-700 truncate">
                                                    {review.original_note.substring(0, 50)}...
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(review.created_at).toLocaleDateString()} • {review.total_points}/16 pts
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => loadReview(review)}
                                                className="p-2 text-gray-400 hover:text-[#1A73A8] transition-colors"
                                                title="View review"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteReview(review.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Delete review"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Review Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                    <div className="p-6">
                        {!result ? (
                            /* Input State */
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Paste Your Session Note
                                    </label>
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => {
                                            setNoteText(e.target.value);
                                            setError(null);
                                        }}
                                        placeholder="Paste your complete session note here for review..."
                                        className="w-full h-64 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8] text-sm"
                                    />
                                    {error && (
                                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {error}
                                        </p>
                                    )}
                                </div>

                                <button
                                    onClick={handleReview}
                                    disabled={isReviewing || !noteText.trim()}
                                    className="w-full py-4 bg-gradient-to-r from-[#1A73A8] to-[#155a8a] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                >
                                    {isReviewing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Analyzing Note...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            Review My Note
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            /* Results State */
                            <>
                                {/* Score Overview */}
                                <div className={`mb-6 p-6 rounded-xl ${
                                    getQualityColor(result.qualityScore) === 'green' ? 'bg-green-50 border border-green-200' :
                                    getQualityColor(result.qualityScore) === 'amber' ? 'bg-amber-50 border border-amber-200' :
                                    'bg-red-50 border border-red-200'
                                }`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">Quality Score</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-4xl font-bold ${
                                                    getQualityColor(result.qualityScore) === 'green' ? 'text-green-700' :
                                                    getQualityColor(result.qualityScore) === 'amber' ? 'text-amber-700' :
                                                    'text-red-700'
                                                }`}>
                                                    {result.qualityScore}
                                                </span>
                                                <span className="text-gray-400 text-xl">/5</span>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-2 rounded-full font-medium ${
                                            result.isBillable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {result.isBillable ? '✓ Billable' : '✗ Not Billable'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 bg-white/50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 mb-1">Total Points</p>
                                            <p className="text-lg font-bold text-gray-700">{result.totalPoints}/16</p>
                                        </div>
                                        <div className="flex-1 bg-white/50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500 mb-1">Status</p>
                                            <p className="text-lg font-bold text-gray-700">
                                                {QUALITY_LABELS[result.qualityScore]?.label}
                                            </p>
                                        </div>
                                    </div>

                                    {result.summary && (
                                        <p className="mt-4 text-sm text-gray-600">{result.summary}</p>
                                    )}
                                </div>

                                {/* Tabs */}
                                <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setActiveTab('review')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                            activeTab === 'review'
                                                ? 'bg-white shadow text-[#1A73A8]'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        Category Breakdown
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('improved')}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                            activeTab === 'improved'
                                                ? 'bg-white shadow text-[#1A73A8]'
                                                : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                    >
                                        Improved Version
                                    </button>
                                </div>

                                {activeTab === 'review' ? (
                                    /* Category Breakdown Tab */
                                    <div className="space-y-3">
                                        {Object.entries(result.scores).map(([key, score]) => {
                                            const feedback = result.feedback[key as keyof typeof result.feedback];
                                            const needsImprovement = score < 2;
                                            const isExpanded = expandedCategories.has(key);

                                            return (
                                                <div
                                                    key={key}
                                                    className={`rounded-xl border transition-colors ${needsImprovement
                                                            ? 'border-amber-200 bg-amber-50/50'
                                                            : 'border-gray-100 bg-gray-50'
                                                        }`}
                                                >
                                                    <button
                                                        onClick={() => needsImprovement && toggleCategory(key)}
                                                        className={`w-full p-3 flex items-center justify-between ${needsImprovement ? 'cursor-pointer' : 'cursor-default'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {getScoreIcon(score)}
                                                            <span className="font-medium text-gray-700">
                                                                {CATEGORY_LABELS[key]}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold ${score === 2 ? 'text-green-600' :
                                                                    score === 1 ? 'text-amber-600' : 'text-red-600'
                                                                }`}>
                                                                {score}/2
                                                            </span>
                                                            {needsImprovement && (
                                                                isExpanded ?
                                                                    <ChevronUp className="w-4 h-4 text-gray-400" /> :
                                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                            )}
                                                        </div>
                                                    </button>

                                                    {isExpanded && feedback && (
                                                        <div className="px-3 pb-3 pt-0 border-t border-amber-200">
                                                            {feedback.issue && (
                                                                <div className="mt-3">
                                                                    <p className="text-xs font-medium text-amber-700 mb-1">Issue:</p>
                                                                    <p className="text-sm text-gray-700">{feedback.issue}</p>
                                                                </div>
                                                            )}
                                                            {feedback.originalText && (
                                                                <div className="mt-3">
                                                                    <p className="text-xs font-medium text-gray-500 mb-1">Your Text:</p>
                                                                    <p className="text-sm text-gray-600 italic bg-white p-2 rounded-lg">
                                                                        &quot;{feedback.originalText}&quot;
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {feedback.improvedText && (
                                                                <div className="mt-3">
                                                                    <p className="text-xs font-medium text-green-700 mb-1">✨ Suggested Improvement:</p>
                                                                    <p className="text-sm text-gray-700 bg-green-50 p-2 rounded-lg border border-green-200">
                                                                        &quot;{feedback.improvedText}&quot;
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Improved Version Tab */
                                    <div>
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-center gap-2 text-green-700 mb-2">
                                                <Sparkles className="w-5 h-5" />
                                                <span className="font-medium">AI-Improved Version</span>
                                            </div>
                                            <p className="text-sm text-green-600">
                                                This version addresses all identified issues and should score 16/16 points.
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                {result.improvedNote}
                                            </p>
                                        </div>

                                        <button
                                            onClick={copyImprovedNote}
                                            className="w-full mt-4 py-3 bg-[#30B27A] text-white rounded-xl font-semibold hover:bg-[#28995c] flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {copiedImproved ? (
                                                <>
                                                    <CheckCircle className="w-5 h-5" />
                                                    Copied to Clipboard!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-5 h-5" />
                                                    Copy Improved Note
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Review Again Button */}
                                <button
                                    onClick={() => {
                                        setResult(null);
                                        setNoteText('');
                                    }}
                                    className="w-full mt-4 py-2 text-[#1A73A8] font-medium hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Review Another Note
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Rubric Reference */}
                <div className="mt-8 bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6">
                    <h3 className="text-lg font-semibold text-[#0E2235] mb-4">Scoring Guide</h3>
                    <div className="grid md:grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5].map((score) => {
                            const info = QUALITY_LABELS[score];
                            return (
                                <div
                                    key={score}
                                    className={`p-4 rounded-xl border ${info.color === 'green' ? 'bg-green-50 border-green-200' :
                                            info.color === 'amber' ? 'bg-amber-50 border-amber-200' :
                                                'bg-red-50 border-red-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-2xl font-bold ${info.color === 'green' ? 'text-green-700' :
                                                info.color === 'amber' ? 'text-amber-700' :
                                                    'text-red-700'
                                            }`}>
                                            {score}
                                        </span>
                                        <Star className={`w-5 h-5 ${info.color === 'green' ? 'text-green-500' :
                                                info.color === 'amber' ? 'text-amber-500' :
                                                    'text-red-500'
                                            }`} />
                                    </div>
                                    <p className={`text-sm font-medium ${info.color === 'green' ? 'text-green-700' :
                                            info.color === 'amber' ? 'text-amber-700' :
                                                'text-red-700'
                                        }`}>
                                        {info.label}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">{info.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
