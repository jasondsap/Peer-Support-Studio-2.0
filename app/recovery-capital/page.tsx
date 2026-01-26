'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Heart, Users, Home, Brain,
    Sparkles, Target, TrendingUp, CheckCircle2, ChevronRight,
    Loader2, RotateCcw, Save, History, BookOpen, Trash2,
    Clock, ChevronDown, ChevronUp, Search, Share2, Send,
    MessageSquare, Mail, QrCode, X, Copy, Check, ExternalLink, Download
} from 'lucide-react';
import AssessmentDetailModal from '@/app/components/AssessmentDetailModal';

// BARC-10 Questions
const BARC10_QUESTIONS = [
    { id: 1, text: "There are more important things to me in life than using substances.", domain: "human", shortLabel: "Purpose & Meaning" },
    { id: 2, text: "In general I am happy with my life.", domain: "human", shortLabel: "Life Satisfaction" },
    { id: 3, text: "I have enough energy to complete the tasks I set myself.", domain: "human", shortLabel: "Energy & Vitality" },
    { id: 4, text: "I am proud of the community I live in and feel part of it.", domain: "social", shortLabel: "Community Connection" },
    { id: 5, text: "I get lots of support from friends.", domain: "social", shortLabel: "Friend Support" },
    { id: 6, text: "I regard my life as challenging and fulfilling without the need for using drugs or alcohol.", domain: "human", shortLabel: "Fulfillment in Recovery" },
    { id: 7, text: "My living space has helped to drive my recovery journey.", domain: "physical", shortLabel: "Supportive Environment" },
    { id: 8, text: "I take full responsibility for my actions.", domain: "human", shortLabel: "Personal Responsibility" },
    { id: 9, text: "I am happy dealing with a range of professional people.", domain: "cultural", shortLabel: "Professional Engagement" },
    { id: 10, text: "I am making good progress on my recovery journey.", domain: "cultural", shortLabel: "Recovery Progress" }
];

const RESPONSE_OPTIONS = [
    { value: 1, label: "Strongly Disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Somewhat Disagree" },
    { value: 4, label: "Somewhat Agree" },
    { value: 5, label: "Agree" },
    { value: 6, label: "Strongly Agree" }
];

const DOMAIN_INFO = {
    social: { name: "Social Capital", icon: Users, color: "#8B5CF6", description: "Support from friends, family, and community" },
    physical: { name: "Physical Capital", icon: Home, color: "#F59E0B", description: "Housing, environment, and tangible resources" },
    human: { name: "Human Capital", icon: Brain, color: "#3B82F6", description: "Skills, health, purpose, and personal strengths" },
    cultural: { name: "Cultural Capital", icon: Heart, color: "#EC4899", description: "Values, professional engagement, and recovery community" }
};

interface Answers { [key: string]: number; }
interface Scores {
    total: number;
    maxScore: number;
    percentage: number;
    domains: { social: number; physical: number; human: number; cultural: number; };
}
interface SavedAssessment {
    id: string;
    participant_id?: string;
    participant_name?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    assessment_type: string;
    total_score: number;
    domain_scores: any;
    responses?: any;
    ai_analysis?: any;
    notes?: string;
    created_at: string;
}
interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    phone?: string;
    email?: string;
}
interface Invitation {
    id: string;
    token: string;
    status: string;
    assessment_type: string;
    participant_first_name: string;
    participant_last_name: string;
    participant_preferred_name?: string;
    created_at: string;
    expires_at?: string;
}

type ViewState = 'dashboard' | 'assessment' | 'results' | 'history';

export default function RecoveryCapitalPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('dashboard');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [scores, setScores] = useState<Scores | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedAssessmentId, setSavedAssessmentId] = useState<string | null>(null);

    // Participant selection for PSS-administered assessment
    const [participantName, setParticipantName] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    // History
    const [assessmentHistory, setAssessmentHistory] = useState<SavedAssessment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Assessment Detail Modal
    const [selectedAssessment, setSelectedAssessment] = useState<SavedAssessment | null>(null);

    // Send Assessment Modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendParticipant, setSendParticipant] = useState<Participant | null>(null);
    const [sendParticipantSearch, setSendParticipantSearch] = useState('');
    const [sendParticipants, setSendParticipants] = useState<Participant[]>([]);
    const [showSendDropdown, setShowSendDropdown] = useState(false);
    const [generatedInvitation, setGeneratedInvitation] = useState<{token: string; url: string} | null>(null);
    const [sendingInvitation, setSendingInvitation] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // Pending invitations
    const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Search participants for PSS-administered assessment
    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${participantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setParticipants(data.participants || []))
                .catch(() => setParticipants([]));
        }
    }, [participantSearch, currentOrg?.id]);

    // Search participants for Send modal
    useEffect(() => {
        if (currentOrg?.id && sendParticipantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${sendParticipantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setSendParticipants(data.participants || []))
                .catch(() => setSendParticipants([]));
        }
    }, [sendParticipantSearch, currentOrg?.id]);

    // Fetch pending invitations on load
    useEffect(() => {
        if (currentOrg?.id) {
            fetchPendingInvitations();
        }
    }, [currentOrg?.id]);

    const fetchPendingInvitations = async () => {
        if (!currentOrg?.id) return;
        try {
            const res = await fetch(`/api/assessment-invitations?organization_id=${currentOrg.id}&status=pending`);
            const data = await res.json();
            if (data.success) {
                setPendingInvitations(data.invitations || []);
            }
        } catch (e) {
            console.error('Failed to fetch invitations:', e);
        }
    };

    const selectParticipant = (p: Participant) => {
        setSelectedParticipant(p);
        setParticipantName(`${p.preferred_name || p.first_name} ${p.last_name}`);
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const selectSendParticipant = (p: Participant) => {
        setSendParticipant(p);
        setSendParticipantSearch('');
        setShowSendDropdown(false);
        setGeneratedInvitation(null);
    };

    const calculateScores = (answers: Answers): Scores => {
        const domainScores = { social: 0, physical: 0, human: 0, cultural: 0 };
        let totalScore = 0;
        BARC10_QUESTIONS.forEach(q => {
            const answerValue = answers[`q${q.id}`] || 3;
            totalScore += answerValue;
            domainScores[q.domain as keyof typeof domainScores] += answerValue;
        });
        return {
            total: totalScore,
            maxScore: 60,
            percentage: Math.round((totalScore / 60) * 100),
            domains: domainScores,
        };
    };

    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [`q${questionId}`]: value }));
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}`);
            const data = await res.json();
            setAssessmentHistory(data.assessments || []);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const calculatedScores = calculateScores(answers);
        setScores(calculatedScores);
        try {
            const res = await fetch('/api/recovery-assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg?.id,
                    participant_id: selectedParticipant?.id || null,
                    participant_name: selectedParticipant ? participantName : null,
                    assessment_type: 'barc10',
                    total_score: calculatedScores.total,
                    domain_scores: calculatedScores.domains,
                    responses: answers,
                }),
            });
            const data = await res.json();
            if (data.success) setSavedAssessmentId(data.assessment?.id);
        } catch (e) { console.error(e); }
        setView('results');
        setIsLoading(false);
    };

    const resetAssessment = () => {
        setView('dashboard');
        setCurrentQuestion(0);
        setAnswers({});
        setScores(null);
        setParticipantName('');
        setSelectedParticipant(null);
        setSavedAssessmentId(null);
    };

    const getScoreColor = (percentage: number) => {
        if (percentage >= 75) return '#10B981';
        if (percentage >= 50) return '#F59E0B';
        if (percentage >= 25) return '#F97316';
        return '#EF4444';
    };

    const getScoreLevel = (percentage: number) => {
        if (percentage >= 75) return { level: 'Strong', desc: 'Robust recovery capital foundation' };
        if (percentage >= 50) return { level: 'Building', desc: 'Actively developing recovery resources' };
        if (percentage >= 25) return { level: 'Developing', desc: 'Early stages of building capital' };
        return { level: 'Beginning', desc: 'Starting the recovery capital journey' };
    };

    // Generate invitation for participant
    const generateInvitation = async () => {
        if (!sendParticipant || !currentOrg?.id) return;
        setSendingInvitation(true);
        try {
            const res = await fetch('/api/assessment-invitations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: sendParticipant.id,
                    assessment_type: 'mirc28',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setGeneratedInvitation({
                    token: data.invitation.token,
                    url: data.share_url,
                });
                fetchPendingInvitations();
            }
        } catch (e) {
            console.error('Failed to generate invitation:', e);
        } finally {
            setSendingInvitation(false);
        }
    };

    const copyLink = () => {
        if (generatedInvitation?.url) {
            navigator.clipboard.writeText(generatedInvitation.url);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    const openSmsApp = () => {
        if (!generatedInvitation?.url || !sendParticipant) return;
        const message = `Hi ${sendParticipant.preferred_name || sendParticipant.first_name}, please complete your Recovery Capital Assessment: ${generatedInvitation.url}`;
        window.open(`sms:${sendParticipant.phone || ''}?body=${encodeURIComponent(message)}`, '_blank');
    };

    const openEmailApp = () => {
        if (!generatedInvitation?.url || !sendParticipant) return;
        const subject = 'Your Recovery Capital Assessment';
        const body = `Hi ${sendParticipant.preferred_name || sendParticipant.first_name},\n\nPlease complete your Recovery Capital Assessment by clicking the link below:\n\n${generatedInvitation.url}\n\nThis assessment takes about 10-15 minutes and will help us better support your recovery journey.\n\nThank you!`;
        const mailtoUrl = sendParticipant.email
            ? `mailto:${sendParticipant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoUrl, '_blank');
    };

    // Analyze assessment with AI
    const handleAnalyzeAssessment = async (assessmentId: string) => {
        try {
            const res = await fetch(`/api/recovery-assessments/${assessmentId}/analyze`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                // Update the assessment in history with new analysis
                setAssessmentHistory(prev => 
                    prev.map(a => a.id === assessmentId ? { ...a, ai_analysis: data.analysis } : a)
                );
                // Update selected assessment if open
                if (selectedAssessment?.id === assessmentId) {
                    setSelectedAssessment(prev => prev ? { ...prev, ai_analysis: data.analysis } : null);
                }
                return data.analysis;
            }
        } catch (e) {
            console.error('Analysis failed:', e);
        }
        return null;
    };

    // Delete assessment
    const handleDeleteAssessment = async (assessmentId: string) => {
        if (!confirm('Are you sure you want to delete this assessment?')) return;
        
        try {
            const res = await fetch(`/api/recovery-assessments?id=${assessmentId}&organization_id=${currentOrg?.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setAssessmentHistory(prev => prev.filter(a => a.id !== assessmentId));
                setSelectedAssessment(null);
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    const progress = (Object.keys(answers).length / BARC10_QUESTIONS.length) * 100;
    const canProceed = answers[`q${BARC10_QUESTIONS[currentQuestion]?.id}`] !== undefined;
    const allAnswered = Object.keys(answers).length === BARC10_QUESTIONS.length;

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-amber-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-amber-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Recovery Capital</h1>
                                <p className="text-sm text-gray-500">BARC-10 Assessment</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setView('history'); fetchHistory(); }}
                            className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* DASHBOARD VIEW */}
                {view === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Hero */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg">
                                    <Target className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Recovery Capital Assessment</h2>
                                    <p className="text-gray-600">Measure recovery resources across four key domains.</p>
                                </div>
                            </div>

                            {/* Domain Preview */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                {Object.entries(DOMAIN_INFO).map(([key, domain]) => {
                                    const Icon = domain.icon;
                                    return (
                                        <div key={key} className="bg-gray-50 rounded-xl p-4 text-center">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${domain.color}20` }}>
                                                <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                            </div>
                                            <p className="text-sm font-medium text-gray-800">{domain.name.split(' ')[0]}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Select Participant */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Participant</label>
                                <div className="relative">
                                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3">
                                        <Search className="w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={selectedParticipant ? `${selectedParticipant.preferred_name || selectedParticipant.first_name} ${selectedParticipant.last_name}` : participantSearch}
                                            onChange={(e) => {
                                                setParticipantSearch(e.target.value);
                                                setShowParticipantDropdown(true);
                                                setSelectedParticipant(null);
                                            }}
                                            onFocus={() => setShowParticipantDropdown(true)}
                                            placeholder="Search participants..."
                                            className="flex-1 bg-transparent border-none outline-none"
                                        />
                                        {selectedParticipant && (
                                            <button
                                                onClick={() => { setSelectedParticipant(null); setParticipantSearch(''); }}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <X className="w-4 h-4 text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                    {showParticipantDropdown && participantSearch.length >= 2 && participants.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-10">
                                            {participants.map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => selectParticipant(p)}
                                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
                                                        {p.first_name[0]}{p.last_name[0]}
                                                    </div>
                                                    <span className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assessment Options */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="border-2 border-purple-500 rounded-xl p-5 bg-purple-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-purple-600" />
                                        <span className="font-semibold text-gray-800">Quick Check (BARC-10)</span>
                                    </div>
                                    <ul className="text-sm text-gray-600 space-y-1 mb-4">
                                        <li>• 10 questions, 2-3 minutes</li>
                                        <li>• Overall recovery capital score</li>
                                        <li>• Great for regular check-ins</li>
                                    </ul>
                                    <button
                                        onClick={() => setView('assessment')}
                                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                                    >
                                        Start Quick Assessment
                                    </button>
                                </div>

                                <div className="border border-gray-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="w-5 h-5 text-blue-600" />
                                        <span className="font-semibold text-gray-800">Deep Dive (MIRC-28)</span>
                                    </div>
                                    <ul className="text-sm text-gray-600 space-y-1 mb-4">
                                        <li>• 28 questions, 10-15 minutes</li>
                                        <li>• Detailed domain breakdown</li>
                                        <li>• AI-powered goal recommendations</li>
                                    </ul>
                                    <button
                                        onClick={() => router.push('/recovery-capital/comprehensive')}
                                        className="w-full py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium"
                                    >
                                        Start Comprehensive Assessment
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Send Assessment to Participant */}
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-6 shadow-sm border border-amber-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow">
                                    <Share2 className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[#0E2235] mb-1">Send Assessment to Participant</h3>
                                    <p className="text-sm text-gray-600">Generate a personalized link for a specific participant</p>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => setShowSendModal(true)}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <Send className="w-5 h-5" />
                                Send Assessment Link
                            </button>

                            {/* Pending Invitations Count */}
                            {pendingInvitations.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-amber-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">
                                            <span className="font-medium text-amber-700">{pendingInvitations.length}</span> pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
                                        </span>
                                        <button 
                                            onClick={() => { setView('history'); fetchHistory(); }}
                                            className="text-sm text-purple-600 hover:underline"
                                        >
                                            View all
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ASSESSMENT VIEW */}
                {view === 'assessment' && (
                    <div className="space-y-6">
                        {/* Progress */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Question {currentQuestion + 1} of {BARC10_QUESTIONS.length}</span>
                                <span className="text-sm text-purple-600 font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            <h2 className="text-xl font-semibold text-[#0E2235] mb-6">
                                {BARC10_QUESTIONS[currentQuestion].text}
                            </h2>
                            <div className="space-y-3 mb-8">
                                {RESPONSE_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleAnswer(BARC10_QUESTIONS[currentQuestion].id, option.value)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                            answers[`q${BARC10_QUESTIONS[currentQuestion].id}`] === option.value
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                answers[`q${BARC10_QUESTIONS[currentQuestion].id}`] === option.value
                                                    ? 'border-purple-500 bg-purple-500'
                                                    : 'border-gray-300'
                                            }`}>
                                                {answers[`q${BARC10_QUESTIONS[currentQuestion].id}`] === option.value && (
                                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                                )}
                                            </div>
                                            <span className="font-medium text-gray-700">{option.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentQuestion(q => q - 1)}
                                    disabled={currentQuestion === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                {currentQuestion < BARC10_QUESTIONS.length - 1 ? (
                                    <button
                                        onClick={() => setCurrentQuestion(q => q + 1)}
                                        disabled={!canProceed}
                                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAnswered || isLoading}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {isLoading ? 'Saving...' : 'Get Results'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* RESULTS VIEW */}
                {view === 'results' && scores && (
                    <div className="space-y-6">
                        {/* Score Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${getScoreColor(scores.percentage)}20` }}>
                                <span className="text-3xl font-bold" style={{ color: getScoreColor(scores.percentage) }}>
                                    {scores.percentage}%
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">{getScoreLevel(scores.percentage).level}</h2>
                            <p className="text-gray-600">{getScoreLevel(scores.percentage).desc}</p>
                            <p className="text-sm text-gray-500 mt-2">Score: {scores.total}/{scores.maxScore}</p>
                        </div>

                        {/* Domain Breakdown */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Domain Breakdown</h3>
                            <div className="space-y-4">
                                {Object.entries(DOMAIN_INFO).map(([key, domain]) => {
                                    const domainScore = scores.domains[key as keyof typeof scores.domains];
                                    const maxDomain = key === 'physical' ? 6 : key === 'social' ? 12 : key === 'human' ? 30 : 12;
                                    const domainPct = Math.round((domainScore / maxDomain) * 100);
                                    const Icon = domain.icon;
                                    return (
                                        <div key={key} className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${domain.color}20` }}>
                                                <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium">{domain.name}</span>
                                                    <span className="text-sm font-semibold">{domainPct}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${domainPct}%`, backgroundColor: domain.color }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={resetAssessment}
                                className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                New Assessment
                            </button>
                            <button
                                onClick={() => { setView('history'); fetchHistory(); }}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
                            >
                                View History
                            </button>
                        </div>
                    </div>
                )}

                {/* HISTORY VIEW */}
                {view === 'history' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#0E2235]">Assessment History</h2>
                            <button onClick={() => setView('dashboard')} className="text-purple-600 hover:underline">
                                ← Back
                            </button>
                        </div>

                        {/* Pending Invitations Section */}
                        {pendingInvitations.length > 0 && (
                            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                                <h3 className="font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                    Pending Invitations ({pendingInvitations.length})
                                </h3>
                                <div className="space-y-3">
                                    {pendingInvitations.map((inv) => (
                                        <div key={inv.id} className="bg-white rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                                                    {inv.participant_first_name[0]}{inv.participant_last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{inv.participant_preferred_name || inv.participant_first_name} {inv.participant_last_name}</p>
                                                    <p className="text-sm text-gray-500">{inv.assessment_type.toUpperCase()} • Sent {new Date(inv.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">Pending</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <p className="text-gray-500">No assessments yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((assessment) => (
                                    <div 
                                        key={assessment.id} 
                                        className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedAssessment(assessment)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                                                {assessment.participant_name?.[0] || assessment.participant_first_name?.[0] || 'A'}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {assessment.participant_name || 
                                                     (assessment.participant_first_name ? `${assessment.participant_first_name} ${assessment.participant_last_name || ''}`.trim() : 'Anonymous')}
                                                </p>
                                                <p className="text-sm text-gray-500">{assessment.assessment_type.toUpperCase()} • {new Date(assessment.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div>
                                                <p className="font-bold text-purple-600">{assessment.total_score}/{assessment.assessment_type === 'barc10' ? 60 : 140}</p>
                                                <p className="text-sm text-gray-500">{Math.round((assessment.total_score / (assessment.assessment_type === 'barc10' ? 60 : 140)) * 100)}%</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Send Assessment Modal */}
            {showSendModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#0E2235]">Send Assessment</h2>
                            <button onClick={() => { setShowSendModal(false); setSendParticipant(null); setGeneratedInvitation(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            {!generatedInvitation ? (
                                <>
                                    {/* Step 1: Select Participant */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Participant</label>
                                        <div className="relative">
                                            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3">
                                                <Search className="w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={sendParticipant ? `${sendParticipant.preferred_name || sendParticipant.first_name} ${sendParticipant.last_name}` : sendParticipantSearch}
                                                    onChange={(e) => {
                                                        setSendParticipantSearch(e.target.value);
                                                        setShowSendDropdown(true);
                                                        setSendParticipant(null);
                                                    }}
                                                    onFocus={() => setShowSendDropdown(true)}
                                                    placeholder="Search participants..."
                                                    className="flex-1 bg-transparent border-none outline-none"
                                                />
                                            </div>
                                            {showSendDropdown && sendParticipantSearch.length >= 2 && sendParticipants.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto z-10">
                                                    {sendParticipants.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => selectSendParticipant(p)}
                                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-medium">
                                                                {p.first_name[0]}{p.last_name[0]}
                                                            </div>
                                                            <div>
                                                                <span className="font-medium block">{p.preferred_name || p.first_name} {p.last_name}</span>
                                                                {p.phone && <span className="text-xs text-gray-500">{p.phone}</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selected Participant Card */}
                                    {sendParticipant && (
                                        <div className="bg-purple-50 rounded-xl p-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-semibold">
                                                    {sendParticipant.first_name[0]}{sendParticipant.last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-[#0E2235]">{sendParticipant.preferred_name || sendParticipant.first_name} {sendParticipant.last_name}</p>
                                                    {sendParticipant.phone && <p className="text-sm text-gray-600">{sendParticipant.phone}</p>}
                                                    {sendParticipant.email && <p className="text-sm text-gray-600">{sendParticipant.email}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={generateInvitation}
                                        disabled={!sendParticipant || sendingInvitation}
                                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {sendingInvitation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                        {sendingInvitation ? 'Generating...' : 'Generate Assessment Link'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Step 2: Share Link */}
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">Link Generated!</h3>
                                        <p className="text-sm text-gray-600">
                                            Share this personalized link with {sendParticipant?.preferred_name || sendParticipant?.first_name}
                                        </p>
                                    </div>

                                    {/* Link Display */}
                                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <input
                                                type="text"
                                                readOnly
                                                value={generatedInvitation.url}
                                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
                                            />
                                            <button
                                                onClick={copyLink}
                                                className={`p-2 rounded-lg transition-colors ${copiedLink ? 'bg-green-100 text-green-600' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 text-center">Token: {generatedInvitation.token}</p>
                                    </div>

                                    {/* Share Options */}
                                    <div className="space-y-3">
                                        <button
                                            onClick={openSmsApp}
                                            className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-600"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                            Send via Text Message
                                        </button>
                                        <button
                                            onClick={openEmailApp}
                                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-600"
                                        >
                                            <Mail className="w-5 h-5" />
                                            Send via Email
                                        </button>
                                        <button
                                            onClick={() => window.open(generatedInvitation.url, '_blank')}
                                            className="w-full py-3 border border-gray-300 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-50"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                            Preview Link
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => { setShowSendModal(false); setSendParticipant(null); setGeneratedInvitation(null); }}
                                        className="w-full mt-4 py-3 text-gray-600 hover:text-gray-800"
                                    >
                                        Done
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Assessment Detail Modal */}
            {selectedAssessment && (
                <AssessmentDetailModal
                    assessment={selectedAssessment}
                    onClose={() => setSelectedAssessment(null)}
                    onDelete={handleDeleteAssessment}
                    onAnalyze={handleAnalyzeAssessment}
                />
            )}
        </div>
    );
}
