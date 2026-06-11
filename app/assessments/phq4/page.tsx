'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Brain, AlertTriangle,
    Sparkles, CheckCircle2, ChevronRight,
    Loader2, RotateCcw, History, Search, X,
    Info, ShieldAlert, Activity
} from 'lucide-react';

// =============================================
// PHQ-4 QUESTIONS (4 Likert + 1 binary self-harm screen)
// Questions 1-2: GAD-2 (Anxiety)
// Questions 3-4: PHQ-2 (Depression)
// Question 5: Self-harm screening (not scored, flags the result)
// =============================================
const PHQ4_QUESTIONS = [
    {
        id: 1,
        text: "Feeling nervous, anxious, or on edge",
        subscale: "anxiety",
        shortLabel: "Anxiety / Nervousness"
    },
    {
        id: 2,
        text: "Not being able to stop or control worrying",
        subscale: "anxiety",
        shortLabel: "Uncontrollable Worry"
    },
    {
        id: 3,
        text: "Feeling down, depressed, or hopeless",
        subscale: "depression",
        shortLabel: "Depressed Mood"
    },
    {
        id: 4,
        text: "Little interest or pleasure in doing things",
        subscale: "depression",
        shortLabel: "Loss of Interest"
    }
];

const LIKERT_OPTIONS = [
    { value: 0, label: "Not at all", description: "0 days" },
    { value: 1, label: "Several days", description: "1–6 days" },
    { value: 2, label: "More than half the days", description: "7–11 days" },
    { value: 3, label: "Nearly every day", description: "12–14 days" }
];

const SELF_HARM_QUESTION = {
    id: 5,
    text: "The thought of harming myself has occurred to me.",
    subscale: "safety"
};

const SUBSCALE_INFO = {
    anxiety: { name: "Anxiety (GAD-2)", color: "#8B5CF6", bgColor: "#F5F3FF", icon: Activity },
    depression: { name: "Depression (PHQ-2)", color: "#3B82F6", bgColor: "#EFF6FF", icon: Brain }
};

interface Answers { [key: string]: number; }
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
}

type ViewState = 'dashboard' | 'assessment' | 'self_harm_screen' | 'results' | 'history';

export default function PHQ4AssessmentPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('dashboard');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [selfHarmAnswer, setSelfHarmAnswer] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedAssessmentId, setSavedAssessmentId] = useState<string | null>(null);

    // Scores
    const [anxietyScore, setAnxietyScore] = useState<number | null>(null);
    const [depressionScore, setDepressionScore] = useState<number | null>(null);
    const [totalScore, setTotalScore] = useState<number | null>(null);

    // Participant selection
    const [participantName, setParticipantName] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    // History
    const [assessmentHistory, setAssessmentHistory] = useState<SavedAssessment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/auth/signin');
    }, [status, router]);

    // Search participants
    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${participantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setParticipants(data.participants || []))
                .catch(() => setParticipants([]));
        }
    }, [participantSearch, currentOrg?.id]);

    const selectParticipant = (p: Participant) => {
        setSelectedParticipant(p);
        setParticipantName(`${p.preferred_name || p.first_name} ${p.last_name}`);
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const calculateScores = (answers: Answers) => {
        const anxiety = (answers['q1'] || 0) + (answers['q2'] || 0);
        const depression = (answers['q3'] || 0) + (answers['q4'] || 0);
        const total = anxiety + depression;
        return { anxiety, depression, total };
    };

    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [`q${questionId}`]: value }));
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&type=phq4`);
            const data = await res.json();
            setAssessmentHistory(data.assessments || []);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmitAssessment = () => {
        // After 4 Likert questions, go to self-harm screen
        setView('self_harm_screen');
    };

    const handleSubmitFinal = async () => {
        setIsLoading(true);
        const scores = calculateScores(answers);
        setAnxietyScore(scores.anxiety);
        setDepressionScore(scores.depression);
        setTotalScore(scores.total);

        const allResponses = {
            ...answers,
            q5_self_harm: selfHarmAnswer ? 1 : 0
        };

        const domainScores = {
            anxiety: scores.anxiety,
            depression: scores.depression,
            self_harm_endorsed: selfHarmAnswer || false
        };

        try {
            const res = await fetch('/api/recovery-assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg?.id,
                    participant_id: selectedParticipant?.id || null,
                    participant_name: selectedParticipant ? participantName : null,
                    assessment_type: 'phq4',
                    total_score: scores.total,
                    domain_scores: domainScores,
                    responses: allResponses,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSavedAssessmentId(data.assessment?.id);
            }
        } catch (e) { console.error(e); }
        setView('results');
        setIsLoading(false);
    };

    const resetAssessment = () => {
        setView('dashboard');
        setCurrentQuestion(0);
        setAnswers({});
        setSelfHarmAnswer(null);
        setAnxietyScore(null);
        setDepressionScore(null);
        setTotalScore(null);
        setParticipantName('');
        setSelectedParticipant(null);
        setSavedAssessmentId(null);
    };

    const getSubscaleInterpretation = (score: number, subscale: string) => {
        const label = subscale === 'anxiety' ? 'anxiety' : 'depression';
        if (score <= 2) return { level: 'Normal', desc: `No significant ${label} symptoms`, color: '#10B981' };
        if (score <= 4) return { level: 'Mild', desc: `Mild ${label} symptoms present`, color: '#F59E0B' };
        return { level: 'Elevated', desc: `Elevated ${label} — further evaluation recommended`, color: '#EF4444' };
    };

    const getTotalInterpretation = (score: number) => {
        if (score <= 2) return { level: 'Normal', desc: 'No significant symptoms of anxiety or depression.', color: '#10B981' };
        if (score <= 5) return { level: 'Mild', desc: 'Some symptoms present. Monitor and reassess.', color: '#F59E0B' };
        if (score <= 8) return { level: 'Moderate', desc: 'Moderate symptoms. Consider additional screening or referral.', color: '#F97316' };
        return { level: 'Severe', desc: 'Significant symptoms of distress. Referral for further evaluation recommended.', color: '#EF4444' };
    };

    const progress = (Object.keys(answers).length / PHQ4_QUESTIONS.length) * 100;
    const canProceed = answers[`q${PHQ4_QUESTIONS[currentQuestion]?.id}`] !== undefined;
    const allAnswered = Object.keys(answers).length === PHQ4_QUESTIONS.length;

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => view === 'dashboard' ? router.push('/') : resetAssessment()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">PHQ-4 Assessment</h1>
                                <p className="text-sm text-gray-500">Anxiety &amp; Depression Screening</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setView('history'); fetchHistory(); }}
                            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">

                {/* ===================== DASHBOARD VIEW ===================== */}
                {view === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                    <Brain className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Patient Health Questionnaire-4</h2>
                                    <p className="text-gray-600">
                                        A brief 4-item screening tool for anxiety and depression with dual subscales.
                                    </p>
                                </div>
                            </div>

                            {/* Subscale Preview */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {Object.entries(SUBSCALE_INFO).map(([key, info]) => {
                                    const Icon = info.icon;
                                    return (
                                        <div key={key} className="rounded-xl p-4" style={{ backgroundColor: info.bgColor }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className="w-4 h-4" style={{ color: info.color }} />
                                                <p className="text-sm font-medium" style={{ color: info.color }}>{info.name}</p>
                                            </div>
                                            <p className="text-xs text-gray-500">2 items • Score 0–6</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Info Box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-medium mb-1">About This Assessment</p>
                                        <p>
                                            The PHQ-4 screens for anxiety (Q1–2) and depression (Q3–4) over the past 2 weeks.
                                            A subscale score of 3+ suggests elevated symptoms. Includes a self-harm
                                            screening question that flags the saved result if endorsed.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Safety Alert Info */}
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-red-800">
                                        <p className="font-medium mb-1">Safety Screening Included</p>
                                        <p>
                                            This assessment includes a self-harm screening question. If endorsed,
                                            the result is flagged and staff should follow the program&apos;s safety
                                            protocol with documented follow-up.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Select Participant */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Select Resident</label>
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
                                            placeholder="Search residents..."
                                            className="flex-1 bg-transparent border-none outline-none"
                                        />
                                        {selectedParticipant && (
                                            <button onClick={() => { setSelectedParticipant(null); setParticipantSearch(''); }} className="p-1 hover:bg-gray-100 rounded">
                                                <X className="w-4 h-4 text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                    {showParticipantDropdown && participantSearch.length >= 2 && participants.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-10">
                                            {participants.map((p) => (
                                                <button key={p.id} onClick={() => selectParticipant(p)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                                                        {p.first_name[0]}{p.last_name[0]}
                                                    </div>
                                                    <span className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Start */}
                            <button
                                onClick={() => setView('assessment')}
                                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Brain className="w-5 h-5" />
                                Begin PHQ-4 Screening
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== ASSESSMENT VIEW ===================== */}
                {view === 'assessment' && (
                    <div className="space-y-6">
                        {/* Progress */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Question {currentQuestion + 1} of {PHQ4_QUESTIONS.length}</span>
                                <span className="text-sm text-blue-600 font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            {/* Preamble */}
                            <p className="text-sm text-gray-500 mb-3 italic">
                                Over the last 2 weeks, how often have you been bothered by the following:
                            </p>

                            {/* Subscale Badge */}
                            <div className="mb-4">
                                {(() => {
                                    const sub = PHQ4_QUESTIONS[currentQuestion].subscale;
                                    const info = SUBSCALE_INFO[sub as keyof typeof SUBSCALE_INFO];
                                    return (
                                        <span
                                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                                            style={{ backgroundColor: info.bgColor, color: info.color }}
                                        >
                                            {info.name} — {PHQ4_QUESTIONS[currentQuestion].shortLabel}
                                        </span>
                                    );
                                })()}
                            </div>

                            <h2 className="text-xl font-semibold text-[#0E2235] mb-8">
                                {PHQ4_QUESTIONS[currentQuestion].text}
                            </h2>

                            {/* Likert Options */}
                            <div className="space-y-3 mb-8">
                                {LIKERT_OPTIONS.map((option) => {
                                    const isSelected = answers[`q${PHQ4_QUESTIONS[currentQuestion].id}`] === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleAnswer(PHQ4_QUESTIONS[currentQuestion].id, option.value)}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                isSelected
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                                }`}>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">{option.label}</span>
                                                    <span className="text-sm text-gray-400 ml-2">({option.description})</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
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
                                {currentQuestion < PHQ4_QUESTIONS.length - 1 ? (
                                    <button
                                        onClick={() => setCurrentQuestion(q => q + 1)}
                                        disabled={!canProceed}
                                        className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmitAssessment}
                                        disabled={!allAnswered}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        Continue
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== SELF-HARM SCREENING ===================== */}
                {view === 'self_harm_screen' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                                    <ShieldAlert className="w-8 h-8 text-red-500" />
                                </div>
                                <h2 className="text-xl font-bold text-[#0E2235] mb-2">Safety Screening</h2>
                                <p className="text-sm text-gray-500">One additional screening question</p>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-6 mb-8">
                                <h3 className="text-lg font-semibold text-[#0E2235] mb-6 text-center">
                                    {SELF_HARM_QUESTION.text}
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setSelfHarmAnswer(false)}
                                        className={`p-6 rounded-xl border-2 text-center transition-all ${
                                            selfHarmAnswer === false
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto mb-3 ${
                                            selfHarmAnswer === false ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                                        }`}>
                                            {selfHarmAnswer === false && <CheckCircle2 className="w-5 h-5 text-white" />}
                                        </div>
                                        <span className="text-lg font-semibold text-gray-700">No</span>
                                    </button>
                                    <button
                                        onClick={() => setSelfHarmAnswer(true)}
                                        className={`p-6 rounded-xl border-2 text-center transition-all ${
                                            selfHarmAnswer === true
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto mb-3 ${
                                            selfHarmAnswer === true ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                        }`}>
                                            {selfHarmAnswer === true && <CheckCircle2 className="w-5 h-5 text-white" />}
                                        </div>
                                        <span className="text-lg font-semibold text-gray-700">Yes</span>
                                    </button>
                                </div>
                            </div>

                            {selfHarmAnswer === true && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm text-red-800">
                                            <p className="font-medium mb-1">Safety Follow-Up Required</p>
                                            <p>
                                                The saved result will be flagged. Follow your program&apos;s safety
                                                protocol and document the follow-up conversation.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setView('assessment'); setCurrentQuestion(PHQ4_QUESTIONS.length - 1); }}
                                    className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmitFinal}
                                    disabled={selfHarmAnswer === null || isLoading}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    {isLoading ? 'Saving...' : 'View Results'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== RESULTS VIEW ===================== */}
                {view === 'results' && totalScore !== null && anxietyScore !== null && depressionScore !== null && (
                    <div className="space-y-6">

                        {/* Safety Alert - Top Priority */}
                        {selfHarmAnswer === true && (
                            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="w-7 h-7 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-red-800 text-lg mb-2">Self-Harm Screening Endorsed</h3>
                                        <p className="text-sm text-red-700 mb-3">
                                            The resident endorsed thoughts of self-harm. The saved result is flagged
                                            and requires staff follow-up per your program&apos;s safety protocol.
                                        </p>
                                        <div className="bg-red-100 rounded-lg p-3">
                                            <p className="text-sm font-medium text-red-800">Required Actions:</p>
                                            <p className="text-sm text-red-700 mt-1">
                                                Conduct a safety assessment. Document the conversation and any safety plan.
                                                Consider referral for crisis intervention or mental health services if appropriate.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Overall Score */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                            <div
                                className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center"
                                style={{ backgroundColor: `${getTotalInterpretation(totalScore).color}15` }}
                            >
                                <span className="text-4xl font-bold" style={{ color: getTotalInterpretation(totalScore).color }}>
                                    {totalScore}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">{getTotalInterpretation(totalScore).level}</h2>
                            <p className="text-gray-600">{getTotalInterpretation(totalScore).desc}</p>
                            <p className="text-sm text-gray-500 mt-2">Total Score: {totalScore}/12</p>

                            {savedAssessmentId && (
                                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Saved to record
                                </div>
                            )}
                        </div>

                        {/* Dual Subscale Scores */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { key: 'anxiety', score: anxietyScore, label: 'Anxiety (GAD-2)', info: SUBSCALE_INFO.anxiety },
                                { key: 'depression', score: depressionScore, label: 'Depression (PHQ-2)', info: SUBSCALE_INFO.depression }
                            ].map(sub => {
                                const interp = getSubscaleInterpretation(sub.score, sub.key);
                                const Icon = sub.info.icon;
                                const isElevated = sub.score >= 3;
                                return (
                                    <div key={sub.key} className={`bg-white rounded-2xl p-6 shadow-sm ${isElevated ? 'ring-2 ring-amber-300' : ''}`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: sub.info.bgColor }}>
                                                <Icon className="w-5 h-5" style={{ color: sub.info.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-[#0E2235]">{sub.label}</h3>
                                            </div>
                                            <span className="text-2xl font-bold" style={{ color: interp.color }}>{sub.score}/6</span>
                                        </div>

                                        {/* Score bar */}
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${(sub.score / 6) * 100}%`, backgroundColor: interp.color }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium" style={{ color: interp.color }}>{interp.level}</span>
                                            {isElevated && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Score ≥ 3
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{interp.desc}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Question-Level Detail */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Response Detail</h3>
                            <div className="space-y-3">
                                {PHQ4_QUESTIONS.map((q) => {
                                    const val = answers[`q${q.id}`];
                                    const option = LIKERT_OPTIONS.find(o => o.value === val);
                                    const info = SUBSCALE_INFO[q.subscale as keyof typeof SUBSCALE_INFO];
                                    return (
                                        <div key={q.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                                                style={{ backgroundColor: val >= 2 ? '#F97316' : val >= 1 ? '#F59E0B' : '#10B981' }}
                                            >
                                                {val}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800">{q.text}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: info.bgColor, color: info.color }}>
                                                        {q.subscale === 'anxiety' ? 'Anxiety' : 'Depression'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{option?.label}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Self-harm item */}
                                <div className="flex items-center gap-3 py-2 mt-2 pt-4 border-t-2 border-gray-200">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        selfHarmAnswer ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                                    }`}>
                                        {selfHarmAnswer ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800">{SELF_HARM_QUESTION.text}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Safety Screen</span>
                                            <span className="text-xs text-gray-500">{selfHarmAnswer ? 'Yes — flagged' : 'No'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scoring Guide */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Subscale Scoring Guide</h3>
                            <p className="text-sm text-gray-500 mb-3">
                                Each subscale (Anxiety, Depression) scores 0–6. A subscale score of <span className="font-semibold">3 or higher</span> suggests
                                elevated symptoms warranting further evaluation.
                            </p>
                            <div className="space-y-2">
                                {[
                                    { range: '0–2', color: '#10B981', label: 'Normal', desc: 'No significant symptoms' },
                                    { range: '3–4', color: '#F59E0B', label: 'Mild', desc: 'Some symptoms — monitor' },
                                    { range: '5–6', color: '#EF4444', label: 'Elevated', desc: 'Further evaluation recommended' },
                                ].map((tier) => (
                                    <div key={tier.range} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-gray-800">{tier.range}: {tier.label}</span>
                                            <p className="text-xs text-gray-500">{tier.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button onClick={resetAssessment} className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                                <RotateCcw className="w-4 h-4" /> New Assessment
                            </button>
                            <button
                                onClick={() => { setView('history'); fetchHistory(); }}
                                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600"
                            >
                                View History
                            </button>
                            <button onClick={() => router.push('/')} className="flex-1 py-3 bg-[#1A73A8] text-white rounded-xl font-semibold hover:bg-[#156090] flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Done
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== HISTORY VIEW ===================== */}
                {view === 'history' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#0E2235]">PHQ-4 Assessment History</h2>
                            <button onClick={() => setView('dashboard')} className="text-blue-600 hover:underline">
                                ← Back
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No PHQ-4 assessments recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((assessment) => {
                                    const ds = assessment.domain_scores || {};
                                    const anxElevated = (ds.anxiety || 0) >= 3;
                                    const depElevated = (ds.depression || 0) >= 3;
                                    const selfHarm = ds.self_harm_endorsed === true;
                                    return (
                                        <div
                                            key={assessment.id}
                                            className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                                    {assessment.participant_name?.[0] || assessment.participant_first_name?.[0] || 'A'}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {assessment.participant_name ||
                                                            (assessment.participant_first_name ? `${assessment.participant_first_name} ${assessment.participant_last_name || ''}`.trim() : 'Anonymous')}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        PHQ-4 • {new Date(assessment.created_at).toLocaleDateString()}
                                                    </p>
                                                    {/* Subscale badges */}
                                                    <div className="flex gap-1 mt-1">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${anxElevated ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-600'}`}>
                                                            Anx: {ds.anxiety || 0}
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${depElevated ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-600'}`}>
                                                            Dep: {ds.depression || 0}
                                                        </span>
                                                        {selfHarm && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                                ⚠ SH
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="font-bold" style={{ color: getTotalInterpretation(assessment.total_score).color }}>
                                                        {assessment.total_score}/12
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
