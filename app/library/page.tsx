'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { generateLessonPDF } from '../utils/generatePDF';
import {
    ArrowLeft,
    ChevronRight,
    Search,
    FileText,
    Presentation,
    Download,
    MoreHorizontal,
    Trash2,
    ExternalLink,
    Loader2,
    Grid,
    List,
    Users,
    Clock,
    Calendar,
    ArrowRight,
    // New imports for survey functionality
    ClipboardList,
    BarChart3,
    Copy,
    MessageSquare,
    Mail,
    X,
    CheckCircle,
    AlertCircle,
    Sparkles,
    User
} from 'lucide-react';

interface SavedLesson {
    id: string;
    title: string;
    topic: string;
    created_at: string;
    session_type: string;
    setting_type: string;
    group_size?: string;
    session_length?: string;
    gamma_presentation_url?: string;
    lesson_json?: string;
    facilitator_guide?: string;
    participant_handout?: string;
    // Survey-related fields
    surveyCount?: number;
    activeSurvey?: Survey | null;
}

interface Survey {
    id: string;
    lesson_id: string;
    share_code: string;
    session_date: string;
    expires_at: string;
    is_active: boolean;
    response_count: number;
    analysis: any;
    created_at: string;
}

interface SurveyResponse {
    id: string;
    participant_name: string | null;
    rating_helpful: number;
    rating_will_use: number;
    rating_facilitator: number | null;
    most_valuable: string | null;
    improvements: string | null;
    would_recommend: string;
    additional_feedback: string | null;
    submitted_at: string;
}

function LibraryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: authStatus } = useSession();

    const [lessons, setLessons] = useState<SavedLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'recent' | 'starred' | 'shared'>('recent');
    const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
    const [generatingLessonId, setGeneratingLessonId] = useState<string | null>(null);

    // Survey-related state
    const [sendSurveyLesson, setSendSurveyLesson] = useState<SavedLesson | null>(null);
    const [viewResponsesLesson, setViewResponsesLesson] = useState<SavedLesson | null>(null);
    const [creatingSurvey, setCreatingSurvey] = useState(false);
    const [surveySessionDate, setSurveySessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [newSurvey, setNewSurvey] = useState<Survey | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [lessonSurveys, setLessonSurveys] = useState<Survey[]>([]);
    const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
    const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
    const [loadingResponses, setLoadingResponses] = useState(false);
    const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
    const [responsesTab, setResponsesTab] = useState<'overview' | 'responses' | 'analysis'>('overview');

    // Survey app domain - UPDATE THIS FOR PRODUCTION
    const surveyDomain = 'lesson-survey-app.vercel.app'; // Change to: survey.peersupportstudio.com

    const actionFromUrl = searchParams.get('action');
    const lessonIdFromUrl = searchParams.get('lessonId');

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') {
            fetchLessons();
        }
    }, [authStatus]);

    // Handle URL action params (from dashboard tool cards)
    useEffect(() => {
        if (actionFromUrl && lessonIdFromUrl && lessons.length > 0 && !isGeneratingPresentation) {
            const lesson = lessons.find(l => l.id === lessonIdFromUrl);
            if (lesson) {
                // Clear URL params first to prevent re-triggering
                router.replace('/library');

                if (actionFromUrl === 'presentation') {
                    // Small delay to ensure URL is cleared
                    setTimeout(() => handleGeneratePresentation(lesson), 100);
                } else if (actionFromUrl === 'pdf') {
                    handleDownloadPDF(lesson);
                }
            } else {
                router.replace('/library');
            }
        }
    }, [actionFromUrl, lessonIdFromUrl, lessons, isGeneratingPresentation]);

    const fetchLessons = async () => {
        try {
            const response = await fetch('/api/lessons');
            if (!response.ok) throw new Error('Failed to fetch lessons');
            const data = await response.json();
            
            // The API returns lessons, add placeholder survey data
            // Survey functionality will be handled by lesson-surveys API
            const lessonsWithSurveys = (data.lessons || []).map((lesson: any) => ({
                ...lesson,
                surveyCount: 0,
                activeSurvey: null
            }));

            setLessons(lessonsWithSurveys);
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePresentation = async (lesson: SavedLesson) => {
        // If already has presentation, just open it
        if (lesson.gamma_presentation_url) {
            window.open(lesson.gamma_presentation_url, '_blank');
            return;
        }

        setIsGeneratingPresentation(true);
        setGeneratingLessonId(lesson.id);

        try {
            // Get full lesson data from database via API
            const fetchResponse = await fetch(`/api/lessons/${lesson.id}`);
            if (!fetchResponse.ok) {
                throw new Error('Could not fetch lesson data');
            }
            const { lesson: fullLesson } = await fetchResponse.json();

            if (!fullLesson) {
                throw new Error('Could not fetch lesson data');
            }

            // Parse lesson_json if available, otherwise construct from stored data
            let lessonData;
            if (fullLesson.lesson_json) {
                try {
                    lessonData = JSON.parse(fullLesson.lesson_json);
                } catch {
                    // Fallback to basic data
                    lessonData = {
                        title: fullLesson.title,
                        overview: fullLesson.topic,
                        objectives: [],
                        activities: [],
                        discussionPrompts: [],
                        sessionType: fullLesson.session_type,
                        sessionLength: fullLesson.session_length
                    };
                }
            } else {
                lessonData = {
                    title: fullLesson.title,
                    overview: fullLesson.topic,
                    objectives: [],
                    activities: [],
                    discussionPrompts: [],
                    sessionType: fullLesson.session_type,
                    sessionLength: fullLesson.session_length
                };
            }

            // Call the presentation API
            const response = await fetch('/api/generate-gamma', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lessonData,
                    lessonId: lesson.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || 'Failed to generate presentation');
            }

            // Open the presentation
            if (result.gammaUrl) {
                window.open(result.gammaUrl, '_blank');
                // Refresh lessons to show updated gamma_presentation_url
                fetchLessons();
            }

        } catch (error) {
            console.error('Error generating presentation:', error);
            alert(`Failed to generate presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsGeneratingPresentation(false);
            setGeneratingLessonId(null);
        }
    };

    const handleDownloadPDF = async (lesson: SavedLesson) => {
        // Try to use the stored JSON if available
        if (lesson.lesson_json) {
            try {
                const lessonPlan = JSON.parse(lesson.lesson_json);
                generateLessonPDF(lessonPlan);
                return;
            } catch (e) {
                console.error('Failed to parse lesson JSON:', e);
            }
        }

        // Fallback: alert user that PDF generation requires newer lesson format
        alert('PDF generation is only available for lessons created after the latest update. Please regenerate this lesson to enable PDF download.');
    };

    const handleCreateSessionNote = (lesson: SavedLesson) => {
        // Try to get intervention/overview from lesson_json
        let intervention = '';
        if (lesson.lesson_json) {
            try {
                const lessonPlan = JSON.parse(lesson.lesson_json);
                intervention = lessonPlan.overview || '';
            } catch (e) {
                console.error('Failed to parse lesson JSON for intervention:', e);
            }
        }

        // Navigate to session note page with lesson data including intervention
        const params = new URLSearchParams({
            lessonId: lesson.id,
            topic: lesson.title,
            sessionType: lesson.session_type || 'group',
        });

        if (intervention) {
            params.append('intervention', intervention);
        }

        router.push(`/session-note?${params.toString()}`);
    };

    const handleDeleteLesson = async (lessonId: string) => {
        if (!confirm('Are you sure you want to delete this lesson?')) return;

        try {
            const response = await fetch(`/api/lessons/${lessonId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete lesson');
            setLessons(lessons.filter(l => l.id !== lessonId));
        } catch (error) {
            console.error('Error deleting lesson:', error);
        }
        setMenuOpen(null);
    };

    // ==================== SURVEY FUNCTIONS ====================

    const handleOpenSendSurvey = (lesson: SavedLesson) => {
        setSendSurveyLesson(lesson);
        setNewSurvey(null);
        setSurveySessionDate(new Date().toISOString().split('T')[0]);
        setMenuOpen(null);
    };

    const handleCreateSurvey = async () => {
        if (!sendSurveyLesson || !session?.user) return;

        setCreatingSurvey(true);
        try {
            const response = await fetch('/api/lesson-surveys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lessonId: sendSurveyLesson.id,
                    specialistId: session.user.id,
                    sessionDate: surveySessionDate
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setNewSurvey(data);

            // Update lesson in list with new active survey
            setLessons(lessons.map(l =>
                l.id === sendSurveyLesson.id
                    ? { ...l, activeSurvey: data }
                    : l
            ));
        } catch (error) {
            console.error('Error creating survey:', error);
            alert('Failed to create survey. Please try again.');
        } finally {
            setCreatingSurvey(false);
        }
    };

    const handleCopyLink = async () => {
        const shareCode = newSurvey?.share_code || sendSurveyLesson?.activeSurvey?.share_code;
        const link = `https://${surveyDomain}/${shareCode}`;
        await navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleTextLink = () => {
        const shareCode = newSurvey?.share_code || sendSurveyLesson?.activeSurvey?.share_code;
        const link = `https://${surveyDomain}/${shareCode}`;
        const message = `Please share your feedback about today's session: ${link}`;
        window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
    };

    const handleEmailLink = () => {
        const shareCode = newSurvey?.share_code || sendSurveyLesson?.activeSurvey?.share_code;
        const link = `https://${surveyDomain}/${shareCode}`;
        const subject = `Session Feedback Request`;
        const body = `Thank you for attending today's session!\n\nPlease take a moment to share your feedback (it only takes 2 minutes):\n\n${link}\n\nYour feedback helps improve future sessions.`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    };

    const handleViewResponses = async (lesson: SavedLesson) => {
        setViewResponsesLesson(lesson);
        setLoadingResponses(true);
        setResponsesTab('overview');
        setMenuOpen(null);

        try {
            // Fetch all surveys for this lesson
            const response = await fetch(`/api/lesson-surveys?lessonId=${lesson.id}`);
            const surveys = await response.json();
            setLessonSurveys(Array.isArray(surveys) ? surveys : []);

            if (surveys?.length > 0) {
                // Select the most recent survey by default
                setSelectedSurvey(surveys[0]);
                await fetchSurveyResponses(surveys[0].id);
            } else {
                setSelectedSurvey(null);
                setSurveyResponses([]);
            }
        } catch (error) {
            console.error('Error fetching surveys:', error);
            setLessonSurveys([]);
        } finally {
            setLoadingResponses(false);
        }
    };

    const fetchSurveyResponses = async (surveyId: string) => {
        try {
            const response = await fetch(`/api/lesson-surveys?surveyId=${surveyId}`);
            const data = await response.json();
            setSurveyResponses(data?.survey_responses || []);
            if (data?.analysis) {
                setSelectedSurvey(prev => prev ? { ...prev, analysis: data.analysis } : null);
            }
        } catch (error) {
            console.error('Error fetching responses:', error);
            setSurveyResponses([]);
        }
    };

    const handleGenerateAnalysis = async () => {
        if (!selectedSurvey) return;

        setGeneratingAnalysis(true);
        try {
            const response = await fetch('/api/lesson-surveys/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ surveyId: selectedSurvey.id })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setSelectedSurvey(prev => prev ? { ...prev, analysis: data.analysis } : null);
            setResponsesTab('analysis');
        } catch (error) {
            console.error('Error generating analysis:', error);
            alert('Failed to generate analysis. Please try again.');
        } finally {
            setGeneratingAnalysis(false);
        }
    };

    const calculateStats = (responses: SurveyResponse[]) => {
        if (responses.length === 0) return null;

        const avgHelpful = responses.reduce((sum, r) => sum + r.rating_helpful, 0) / responses.length;
        const avgWillUse = responses.reduce((sum, r) => sum + r.rating_will_use, 0) / responses.length;
        const facilitatorRatings = responses.filter(r => r.rating_facilitator);
        const avgFacilitator = facilitatorRatings.length > 0
            ? facilitatorRatings.reduce((sum, r) => sum + (r.rating_facilitator || 0), 0) / facilitatorRatings.length
            : null;

        return {
            total: responses.length,
            avgHelpful: avgHelpful.toFixed(1),
            avgWillUse: avgWillUse.toFixed(1),
            avgFacilitator: avgFacilitator?.toFixed(1) || null,
            recommendYes: responses.filter(r => r.would_recommend === 'yes').length,
            recommendMaybe: responses.filter(r => r.would_recommend === 'maybe').length,
            recommendNo: responses.filter(r => r.would_recommend === 'no').length
        };
    };

    // ==================== END SURVEY FUNCTIONS ====================

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const filteredLessons = lessons.filter(lesson =>
        (lesson.title || lesson.topic).toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Reusable Survey Menu Items Component
    const SurveyMenuItems = ({ lesson }: { lesson: SavedLesson }) => (
        <>
            <div className="border-t border-gray-100 my-1"></div>
            <button
                onClick={() => handleOpenSendSurvey(lesson)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2"
            >
                <ClipboardList className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-[#8B5CF6] font-medium">Send Survey</span>
                {lesson.activeSurvey && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Active</span>
                )}
            </button>
            <button
                onClick={() => handleViewResponses(lesson)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 flex items-center gap-2"
            >
                <BarChart3 className="w-4 h-4 text-[#30B27A]" />
                <span className="text-[#30B27A] font-medium">View Responses</span>
                {lesson.surveyCount && lesson.surveyCount > 0 && (
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {lesson.surveyCount}
                    </span>
                )}
            </button>
        </>
    );

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
                                <span className="text-gray-600 font-medium">My Lessons</span>
                            </nav>
                        </div>

                        <button
                            onClick={signOut}
                            className="text-sm text-gray-600 hover:text-[#1A73A8] transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Presentation Generation Loading Overlay */}
            {isGeneratingPresentation && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-xl">
                        <Loader2 className="w-12 h-12 animate-spin text-[#1A73A8] mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-[#0E2235] mb-2">Generating Presentation</h3>
                        <p className="text-gray-600 mb-4">
                            This may take 1-2 minutes. We're using AI to create beautiful, participant-focused slides.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <div className="w-2 h-2 bg-[#1A73A8] rounded-full animate-pulse"></div>
                            <span>Please don't close this window</span>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">My Saved Lessons</h1>
                        <p className="text-gray-600 mt-1">
                            {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} in your library
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/lesson-builder')}
                        className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90"
                        style={{
                            background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                        }}
                    >
                        + New Lesson
                    </button>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-2">
                            {['recent', 'starred', 'shared'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as typeof activeTab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
                                            ? 'bg-[#1A73A8] text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search lessons..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-64 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent text-sm"
                                />
                            </div>

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

                {/* Lessons Display */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : filteredLessons.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {searchQuery ? 'No lessons found' : 'No lessons yet'}
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Create your first lesson to get started'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => router.push('/lesson-builder')}
                                className="px-6 py-2.5 text-white font-medium rounded-lg"
                                style={{
                                    background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                }}
                            >
                                Create Your First Lesson
                            </button>
                        )}
                    </div>
                ) : viewMode === 'list' ? (
                    /* ==================== LIST VIEW ==================== */
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                            <div className="col-span-5">Name</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Setting</div>
                            <div className="col-span-2">Created</div>
                            <div className="col-span-1"></div>
                        </div>

                        {filteredLessons.map((lesson) => (
                            <div
                                key={lesson.id}
                                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors items-center group"
                            >
                                <div className="col-span-5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <button
                                            onClick={() => router.push(`/lesson/${lesson.id}`)}
                                            className="text-sm font-medium text-[#0E2235] hover:text-[#1A73A8] truncate block"
                                        >
                                            {lesson.title || lesson.topic}
                                        </button>
                                        <div className="flex items-center gap-2">
                                            {lesson.gamma_presentation_url && (
                                                <span className="text-xs text-[#30B27A]">🎨 Presentation</span>
                                            )}
                                            {lesson.surveyCount && lesson.surveyCount > 0 && (
                                                <span className="text-xs text-[#8B5CF6]">📊 {lesson.surveyCount} responses</span>
                                            )}
                                            {lesson.activeSurvey && (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Survey Active</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-sm text-gray-600 capitalize">
                                    {lesson.session_type}
                                </div>
                                <div className="col-span-2 text-sm text-gray-600 capitalize">
                                    {lesson.setting_type?.replace(/-/g, ' ')}
                                </div>
                                <div className="col-span-2 text-sm text-gray-500">
                                    {formatDate(lesson.created_at)}
                                </div>
                                <div className="col-span-1 flex justify-end relative">
                                    <button
                                        onClick={() => setMenuOpen(menuOpen === lesson.id ? null : lesson.id)}
                                        className="p-2 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                    </button>

                                    {menuOpen === lesson.id && (
                                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[200px] z-10">
                                            <button
                                                onClick={() => {
                                                    router.push(`/lesson/${lesson.id}`);
                                                    setMenuOpen(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                View Lesson
                                            </button>
                                            {lesson.gamma_presentation_url ? (
                                                <a
                                                    href={lesson.gamma_presentation_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                    onClick={() => setMenuOpen(null)}
                                                >
                                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                                    View Presentation
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        handleGeneratePresentation(lesson);
                                                        setMenuOpen(null);
                                                    }}
                                                    disabled={isGeneratingPresentation && generatingLessonId === lesson.id}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {isGeneratingPresentation && generatingLessonId === lesson.id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Presentation className="w-4 h-4 text-gray-400" />
                                                            Generate Presentation
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handleDownloadPDF(lesson);
                                                    setMenuOpen(null);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4 text-gray-400" />
                                                Download PDF
                                            </button>

                                            <div className="border-t border-gray-100 my-1"></div>
                                            <button
                                                onClick={() => handleDeleteLesson(lesson.id)}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* ==================== GRID VIEW ==================== */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLessons.map((lesson) => (
                            <div
                                key={lesson.id}
                                className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 hover:shadow-md transition-shadow relative"
                            >
                                {/* Title */}
                                <h3 className="font-semibold text-[#0E2235] text-lg mb-4 pr-8">
                                    {lesson.title || lesson.topic}
                                </h3>

                                {/* Session Details */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        <span className="capitalize">{lesson.session_type} Session</span>
                                        {lesson.group_size && (
                                            <span>• {lesson.group_size} people</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>{lesson.session_length || '60'} minutes</span>
                                        <span>•</span>
                                        <span className="capitalize">{lesson.setting_type?.replace(/-/g, ' ')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{formatDate(lesson.created_at)}</span>
                                    </div>
                                </div>

                                {/* Status Badges */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {lesson.gamma_presentation_url && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full">
                                            <Presentation className="w-3 h-3" />
                                            Presentation Ready
                                        </span>
                                    )}
                                    {lesson.surveyCount && lesson.surveyCount > 0 && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#30B27A] bg-[#30B27A]/10 px-2 py-1 rounded-full">
                                            <BarChart3 className="w-3 h-3" />
                                            {lesson.surveyCount} Responses
                                        </span>
                                    )}
                                    {lesson.activeSurvey && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-1 rounded-full">
                                            <ClipboardList className="w-3 h-3" />
                                            Survey Active
                                        </span>
                                    )}
                                </div>

                                {/* View Details Link */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => router.push(`/lesson/${lesson.id}`)}
                                        className="text-sm font-medium text-[#1A73A8] hover:text-[#156090] flex items-center gap-1"
                                    >
                                        View Details
                                        <ArrowRight className="w-4 h-4" />
                                    </button>

                                    {/* More Options Menu */}
                                    <button
                                        onClick={() => setMenuOpen(menuOpen === lesson.id ? null : lesson.id)}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>

                                {/* Dropdown Menu */}
                                {menuOpen === lesson.id && (
                                    <div className="absolute right-4 bottom-16 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[200px] z-10">
                                        <button
                                            onClick={() => {
                                                router.push(`/lesson/${lesson.id}`);
                                                setMenuOpen(null);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            View Lesson
                                        </button>
                                        {lesson.gamma_presentation_url ? (
                                            <a
                                                href={lesson.gamma_presentation_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                onClick={() => setMenuOpen(null)}
                                            >
                                                <ExternalLink className="w-4 h-4 text-gray-400" />
                                                View Presentation
                                            </a>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    handleGeneratePresentation(lesson);
                                                    setMenuOpen(null);
                                                }}
                                                disabled={isGeneratingPresentation && generatingLessonId === lesson.id}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isGeneratingPresentation && generatingLessonId === lesson.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Presentation className="w-4 h-4 text-gray-400" />
                                                        Generate Presentation
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                handleDownloadPDF(lesson);
                                                setMenuOpen(null);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4 text-gray-400" />
                                            Download PDF
                                        </button>

                                        <div className="border-t border-gray-100 my-1"></div>
                                        <button
                                            onClick={() => handleDeleteLesson(lesson.id)}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Click outside to close menu */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setMenuOpen(null)}
                />
            )}

            {/* ==================== SEND SURVEY MODAL ==================== */}
            {sendSurveyLesson && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-[#0E2235]">Send Session Survey</h2>
                                <button
                                    onClick={() => {
                                        setSendSurveyLesson(null);
                                        setNewSurvey(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{sendSurveyLesson.title}</p>
                        </div>

                        <div className="p-6">
                            {/* Show existing active survey or create new */}
                            {!newSurvey && sendSurveyLesson.activeSurvey ? (
                                <div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="font-medium">Active Survey</span>
                                        </div>
                                        <p className="text-sm text-blue-600">
                                            This lesson has an active survey. Share the link below or create a new one.
                                        </p>
                                    </div>

                                    {/* Share Link */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Survey Link</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={`https://${surveyDomain}/${sendSurveyLesson.activeSurvey.share_code}`}
                                                readOnly
                                                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                            />
                                            <button
                                                onClick={handleCopyLink}
                                                className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#155d8a] flex items-center gap-2"
                                            >
                                                {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {copiedLink ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Share Buttons */}
                                    <div className="flex gap-3 mb-6">
                                        <button
                                            onClick={handleTextLink}
                                            className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare className="w-5 h-5 text-green-600" />
                                            Text Message
                                        </button>
                                        <button
                                            onClick={handleEmailLink}
                                            className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <Mail className="w-5 h-5 text-blue-600" />
                                            Email
                                        </button>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4">
                                        <button
                                            onClick={() => {
                                                setSendSurveyLesson({ ...sendSurveyLesson, activeSurvey: null });
                                            }}
                                            className="text-sm text-[#1A73A8] hover:underline"
                                        >
                                            Create a new survey instead
                                        </button>
                                    </div>
                                </div>
                            ) : newSurvey ? (
                                /* Survey Created - Show Link */
                                <div>
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 text-green-700 mb-2">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="font-medium">Survey Created!</span>
                                        </div>
                                        <p className="text-sm text-green-600">
                                            Share this link with participants. The survey expires in 7 days.
                                        </p>
                                    </div>

                                    {/* Share Link */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Survey Link</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={`https://${surveyDomain}/${newSurvey.share_code}`}
                                                readOnly
                                                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                            />
                                            <button
                                                onClick={handleCopyLink}
                                                className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#155d8a] flex items-center gap-2"
                                            >
                                                {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {copiedLink ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Share Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleTextLink}
                                            className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare className="w-5 h-5 text-green-600" />
                                            Text Message
                                        </button>
                                        <button
                                            onClick={handleEmailLink}
                                            className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <Mail className="w-5 h-5 text-blue-600" />
                                            Email
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Create New Survey Form */
                                <div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <Calendar className="w-4 h-4 inline mr-1" />
                                            Session Date
                                        </label>
                                        <input
                                            type="date"
                                            value={surveySessionDate}
                                            onChange={(e) => setSurveySessionDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                                        />
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                        <h4 className="font-medium text-gray-700 mb-2">Survey includes:</h4>
                                        <ul className="text-sm text-gray-600 space-y-1">
                                            <li>• Session helpfulness rating (1-5 stars)</li>
                                            <li>• Likelihood to apply learning (1-5 stars)</li>
                                            <li>• Facilitator rating (optional)</li>
                                            <li>• Open feedback questions</li>
                                            <li>• Recommendation question</li>
                                        </ul>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Clock className="w-4 h-4" />
                                            <span className="text-sm font-medium">Survey expires in 7 days</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCreateSurvey}
                                        disabled={creatingSurvey}
                                        className="w-full py-3 bg-[#8B5CF6] text-white rounded-xl font-semibold hover:bg-[#7c4ee4] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {creatingSurvey ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Creating Survey...
                                            </>
                                        ) : (
                                            <>
                                                <ClipboardList className="w-5 h-5" />
                                                Create Survey
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== VIEW RESPONSES MODAL ==================== */}
            {viewResponsesLesson && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-[#0E2235]">Survey Responses</h2>
                                    <p className="text-sm text-gray-500 mt-1">{viewResponsesLesson.title}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setViewResponsesLesson(null);
                                        setSelectedSurvey(null);
                                        setSurveyResponses([]);
                                        setLessonSurveys([]);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {loadingResponses ? (
                            <div className="flex-1 flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                            </div>
                        ) : lessonSurveys.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12">
                                <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-600 mb-2">No surveys yet</h3>
                                <p className="text-gray-500 mb-6">Create a survey to start collecting feedback</p>
                                <button
                                    onClick={() => {
                                        setViewResponsesLesson(null);
                                        setSendSurveyLesson(viewResponsesLesson);
                                    }}
                                    className="px-6 py-2 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7c4ee4]"
                                >
                                    Send Survey
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Survey Selector */}
                                {lessonSurveys.length > 1 && (
                                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                                        <label className="text-sm font-medium text-gray-600 mr-3">Survey:</label>
                                        <select
                                            value={selectedSurvey?.id || ''}
                                            onChange={(e) => {
                                                const survey = lessonSurveys.find(s => s.id === e.target.value);
                                                if (survey) {
                                                    setSelectedSurvey(survey);
                                                    fetchSurveyResponses(survey.id);
                                                }
                                            }}
                                            className="px-3 py-1 border border-gray-200 rounded-lg text-sm"
                                        >
                                            {lessonSurveys.map((survey) => (
                                                <option key={survey.id} value={survey.id}>
                                                    {formatDate(survey.session_date)} - {survey.response_count} responses
                                                    {new Date(survey.expires_at) > new Date() && survey.is_active ? ' (Active)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="px-6 py-2 border-b border-gray-100">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setResponsesTab('overview')}
                                            className={`py-2 text-sm font-medium border-b-2 transition-colors ${responsesTab === 'overview'
                                                    ? 'border-[#1A73A8] text-[#1A73A8]'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Overview
                                        </button>
                                        <button
                                            onClick={() => setResponsesTab('responses')}
                                            className={`py-2 text-sm font-medium border-b-2 transition-colors ${responsesTab === 'responses'
                                                    ? 'border-[#1A73A8] text-[#1A73A8]'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Responses ({surveyResponses.length})
                                        </button>
                                        <button
                                            onClick={() => setResponsesTab('analysis')}
                                            className={`py-2 text-sm font-medium border-b-2 transition-colors ${responsesTab === 'analysis'
                                                    ? 'border-[#1A73A8] text-[#1A73A8]'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            AI Analysis
                                        </button>
                                    </div>
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {responsesTab === 'overview' && (
                                        <div>
                                            {surveyResponses.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500">No responses yet</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {(() => {
                                                        const stats = calculateStats(surveyResponses);
                                                        if (!stats) return null;

                                                        return (
                                                            <>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                                                        <p className="text-3xl font-bold text-[#0E2235]">{stats.total}</p>
                                                                        <p className="text-sm text-gray-500">Total Responses</p>
                                                                    </div>
                                                                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                                                                        <p className="text-3xl font-bold text-amber-600">{stats.avgHelpful}</p>
                                                                        <p className="text-sm text-gray-500">Avg. Helpful</p>
                                                                    </div>
                                                                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                                                                        <p className="text-3xl font-bold text-blue-600">{stats.avgWillUse}</p>
                                                                        <p className="text-sm text-gray-500">Avg. Will Use</p>
                                                                    </div>
                                                                    {stats.avgFacilitator && (
                                                                        <div className="bg-purple-50 rounded-xl p-4 text-center">
                                                                            <p className="text-3xl font-bold text-purple-600">{stats.avgFacilitator}</p>
                                                                            <p className="text-sm text-gray-500">Avg. Facilitator</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="bg-gray-50 rounded-xl p-4">
                                                                    <h4 className="font-medium text-gray-700 mb-3">Would Recommend?</h4>
                                                                    <div className="flex gap-4">
                                                                        <div className="flex-1 text-center">
                                                                            <div className="text-2xl font-bold text-green-600">{stats.recommendYes}</div>
                                                                            <div className="text-sm text-gray-500">Yes</div>
                                                                        </div>
                                                                        <div className="flex-1 text-center">
                                                                            <div className="text-2xl font-bold text-amber-600">{stats.recommendMaybe}</div>
                                                                            <div className="text-sm text-gray-500">Maybe</div>
                                                                        </div>
                                                                        <div className="flex-1 text-center">
                                                                            <div className="text-2xl font-bold text-red-600">{stats.recommendNo}</div>
                                                                            <div className="text-sm text-gray-500">No</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {responsesTab === 'responses' && (
                                        <div className="space-y-4">
                                            {surveyResponses.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500">No responses yet</p>
                                                </div>
                                            ) : (
                                                surveyResponses.map((response, idx) => (
                                                    <div key={response.id} className="bg-gray-50 rounded-xl p-4">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <User className="w-4 h-4 text-gray-400" />
                                                                <span className="font-medium text-gray-700">
                                                                    {response.participant_name || `Anonymous #${idx + 1}`}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {formatDate(response.submitted_at)}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                                                            <div>
                                                                <span className="text-gray-500">Helpful:</span>
                                                                <span className="ml-1 font-medium">{response.rating_helpful}/5</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Will Use:</span>
                                                                <span className="ml-1 font-medium">{response.rating_will_use}/5</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500">Recommend:</span>
                                                                <span className={`ml-1 font-medium ${response.would_recommend === 'yes' ? 'text-green-600' :
                                                                        response.would_recommend === 'maybe' ? 'text-amber-600' : 'text-red-600'
                                                                    }`}>
                                                                    {response.would_recommend}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {(response.most_valuable || response.improvements || response.additional_feedback) && (
                                                            <div className="border-t border-gray-200 pt-3 space-y-2 text-sm">
                                                                {response.most_valuable && (
                                                                    <p><span className="text-gray-500">Valuable:</span> "{response.most_valuable}"</p>
                                                                )}
                                                                {response.improvements && (
                                                                    <p><span className="text-gray-500">Improve:</span> "{response.improvements}"</p>
                                                                )}
                                                                {response.additional_feedback && (
                                                                    <p><span className="text-gray-500">Other:</span> "{response.additional_feedback}"</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {responsesTab === 'analysis' && (
                                        <div>
                                            {selectedSurvey?.analysis ? (
                                                <div className="prose prose-sm max-w-none">
                                                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                                                        <div className="flex items-center gap-2 text-purple-700 mb-2">
                                                            <Sparkles className="w-5 h-5" />
                                                            <span className="font-medium">AI-Generated Insights</span>
                                                        </div>
                                                        <p className="text-xs text-purple-600">
                                                            Generated {formatDate(selectedSurvey.analysis.generatedAt)}
                                                        </p>
                                                    </div>

                                                    <div className="whitespace-pre-wrap text-gray-700">
                                                        {selectedSurvey.analysis.insights}
                                                    </div>
                                                </div>
                                            ) : surveyResponses.length >= 1 ? (
                                                <div className="text-center py-8">
                                                    <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Generate AI Analysis</h3>
                                                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                                        Get personalized insights, identify strengths, and receive actionable recommendations based on participant feedback.
                                                    </p>
                                                    <button
                                                        onClick={handleGenerateAnalysis}
                                                        disabled={generatingAnalysis}
                                                        className="px-6 py-3 bg-[#8B5CF6] text-white rounded-xl font-medium hover:bg-[#7c4ee4] disabled:opacity-50 flex items-center gap-2 mx-auto"
                                                    >
                                                        {generatingAnalysis ? (
                                                            <>
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                                Analyzing...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-5 h-5" />
                                                                Generate Analysis
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500">Need at least 1 response to generate analysis</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LibraryPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        }>
            <LibraryContent />
        </Suspense>
    );
}
