'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Heart, Users, Home, Brain,
    Sparkles, TrendingUp, CheckCircle2, ChevronRight,
    Loader2, RotateCcw, History, Search, X,
    Info, Volume2, Square
} from 'lucide-react';

// =============================================
// BARC-10 QUESTIONS (10 items, 6-point Likert)
// Vilsaint et al. (2017) Brief Assessment of Recovery Capital
// =============================================

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

const DOMAIN_INFO: Record<string, { name: string; icon: any; color: string; bgColor: string; description: string }> = {
    human:    { name: "Human Capital",    icon: Brain,  color: "#3B82F6", bgColor: "#EFF6FF", description: "Skills, health, purpose, and personal strengths" },
    social:   { name: "Social Capital",   icon: Users,  color: "#8B5CF6", bgColor: "#F5F3FF", description: "Support from friends, family, and community" },
    physical: { name: "Physical Capital",  icon: Home,   color: "#F59E0B", bgColor: "#FFFBEB", description: "Housing, environment, and tangible resources" },
    cultural: { name: "Cultural Capital",  icon: Heart,  color: "#EC4899", bgColor: "#FDF2F8", description: "Values, professional engagement, and recovery community" },
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

type ViewState = 'dashboard' | 'assessment' | 'results' | 'history';

export default function Barc10AssessmentPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('dashboard');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [totalScore, setTotalScore] = useState<number | null>(null);
    const [domainScores, setDomainScores] = useState<Record<string, number> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [savedAssessmentId, setSavedAssessmentId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

    // Participant selection
    const [participantName, setParticipantName] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    // History
    const [assessmentHistory, setAssessmentHistory] = useState<SavedAssessment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // TTS Audio Playback
    const [playingQuestionId, setPlayingQuestionId] = useState<number | null>(null);
    const [ttsLoading, setTtsLoading] = useState<number | null>(null);
    const [ttsVoice, setTtsVoice] = useState<'male' | 'female'>('female');
    const ttsVoiceRef = useRef<'male' | 'female'>('female');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCacheRef = useRef<Map<string, string>>(new Map());

    useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        setPlayingQuestionId(null);
    }, []);

    const playQuestion = useCallback(async (questionId: number, text: string) => {
        if (playingQuestionId === questionId) { stopAudio(); return; }
        stopAudio();
        const cacheKey = `barc10_q${questionId}_en_${ttsVoiceRef.current}`;
        if (audioCacheRef.current.has(cacheKey)) {
            const blobUrl = audioCacheRef.current.get(cacheKey)!;
            const audio = new Audio(blobUrl);
            audioRef.current = audio;
            setPlayingQuestionId(questionId);
            audio.onended = () => setPlayingQuestionId(null);
            audio.onerror = () => setPlayingQuestionId(null);
            audio.play();
            return;
        }
        setTtsLoading(questionId);
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: 'en', voice: ttsVoiceRef.current, cacheKey }),
            });
            if (!res.ok) throw new Error('TTS request failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            audioCacheRef.current.set(cacheKey, blobUrl);
            const audio = new Audio(blobUrl);
            audioRef.current = audio;
            setPlayingQuestionId(questionId);
            setTtsLoading(null);
            audio.onended = () => setPlayingQuestionId(null);
            audio.onerror = () => { setPlayingQuestionId(null); setTtsLoading(null); };
            audio.play();
        } catch (err) {
            console.error('TTS playback error:', err);
            setTtsLoading(null);
            setPlayingQuestionId(null);
        }
    }, [playingQuestionId, stopAudio]);

    useEffect(() => { return () => stopAudio(); }, [view, stopAudio]);

    useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

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

    const calculateScores = (ans: Answers) => {
        const domains: Record<string, number> = { human: 0, social: 0, physical: 0, cultural: 0 };
        let total = 0;
        BARC10_QUESTIONS.forEach(q => {
            const val = ans[`q${q.id}`] || 0;
            total += val;
            domains[q.domain] += val;
        });
        return { total, domains };
    };

    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [`q${questionId}`]: value }));
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&type=barc10`);
            const data = await res.json();
            setAssessmentHistory(data.assessments || []);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const { total, domains } = calculateScores(answers);
        setTotalScore(total);
        setDomainScores(domains);

        try {
            const res = await fetch('/api/recovery-assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg?.id,
                    participant_id: selectedParticipant?.id || null,
                    participant_name: selectedParticipant ? participantName : null,
                    assessment_type: 'barc10',
                    total_score: total,
                    domain_scores: domains,
                    responses: answers,
                    notes: notes || null,
                }),
            });
            const data = await res.json();
            if (data.success) setSavedAssessmentId(data.assessment?.id);
        } catch (e) { console.error(e); }
        setView('results');
        setIsLoading(false);
    };

    const resetAssessment = () => {
        stopAudio();
        setView('dashboard');
        setCurrentQuestion(0);
        setAnswers({});
        setTotalScore(null);
        setDomainScores(null);
        setParticipantName('');
        setSelectedParticipant(null);
        setSavedAssessmentId(null);
        setNotes('');
    };

    const getScoreColor = (score: number, max: number) => {
        const pct = score / max;
        if (pct >= 0.75) return '#10B981';
        if (pct >= 0.5) return '#F59E0B';
        if (pct >= 0.25) return '#F97316';
        return '#EF4444';
    };

    const getScoreInterpretation = (score: number) => {
        const pct = Math.round((score / 60) * 100);
        if (pct >= 75) return { level: 'Strong Recovery Capital', desc: `Score: ${score}/60 (${pct}%)`, detail: 'This score indicates strong personal and social resources supporting recovery. Continue to nurture these strengths and build on areas of growth.' };
        if (pct >= 50) return { level: 'Moderate Recovery Capital', desc: `Score: ${score}/60 (${pct}%)`, detail: 'Recovery capital is developing. Focus on strengthening weaker domains while maintaining existing supports.' };
        if (pct >= 25) return { level: 'Low Recovery Capital', desc: `Score: ${score}/60 (${pct}%)`, detail: 'Recovery capital needs significant development. Prioritize building support networks, housing stability, and personal coping skills.' };
        return { level: 'Very Low Recovery Capital', desc: `Score: ${score}/60 (${pct}%)`, detail: 'Critical need for recovery capital development across all domains. Intensive support services and environmental changes are recommended.' };
    };

    const progress = (Object.keys(answers).length / BARC10_QUESTIONS.length) * 100;
    const canProceed = answers[`q${BARC10_QUESTIONS[currentQuestion]?.id}`] !== undefined;
    const allAnswered = Object.keys(answers).length === BARC10_QUESTIONS.length;

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => view === 'dashboard' ? router.push('/') : resetAssessment()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">BARC-10</h1>
                                <p className="text-sm text-gray-500">Brief Assessment of Recovery Capital</p>
                            </div>
                        </div>
                        <button onClick={() => { setView('history'); fetchHistory(); }} className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
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
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                    <TrendingUp className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Brief Assessment of Recovery Capital</h2>
                                    <p className="text-gray-600">
                                        A 10-item measure of recovery capital across four domains. Higher scores indicate greater recovery resources and strengths.
                                    </p>
                                </div>
                            </div>

                            {/* Domain Preview */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {Object.entries(DOMAIN_INFO).map(([key, info]) => {
                                    const Icon = info.icon;
                                    const count = BARC10_QUESTIONS.filter(q => q.domain === key).length;
                                    return (
                                        <div key={key} className="rounded-xl p-3 text-center" style={{ backgroundColor: info.bgColor }}>
                                            <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: info.color }} />
                                            <p className="text-xs font-medium" style={{ color: info.color }}>{info.name}</p>
                                            <p className="text-xs text-gray-500">{count} items</p>
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
                                            The BARC-10 (Vilsaint et al., 2017) is a brief screening of recovery capital.
                                            Responses range from Strongly Disagree (1) to Strongly Agree (6) with a maximum
                                            score of 60. It can be administered at intake and repeated to track progress.
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
                                            onChange={(e) => { setParticipantSearch(e.target.value); setShowParticipantDropdown(true); setSelectedParticipant(null); }}
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
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-medium">
                                                        {p.first_name[0]}{p.last_name[0]}
                                                    </div>
                                                    <span className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Start Button */}
                            <button
                                onClick={() => setView('assessment')}
                                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <TrendingUp className="w-5 h-5" />
                                Begin BARC-10
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
                                <span className="text-sm font-medium text-gray-600">Question {currentQuestion + 1} of {BARC10_QUESTIONS.length}</span>
                                <span className="text-sm text-emerald-600 font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            {/* Domain Badge */}
                            <div className="mb-4">
                                <span
                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                                    style={{
                                        backgroundColor: DOMAIN_INFO[BARC10_QUESTIONS[currentQuestion].domain].bgColor,
                                        color: DOMAIN_INFO[BARC10_QUESTIONS[currentQuestion].domain].color
                                    }}
                                >
                                    {DOMAIN_INFO[BARC10_QUESTIONS[currentQuestion].domain].name} — {BARC10_QUESTIONS[currentQuestion].shortLabel}
                                </span>
                            </div>

                            <div className="flex items-start gap-3 mb-8">
                                <h2 className="text-lg font-semibold text-[#0E2235] leading-relaxed flex-1">
                                    {BARC10_QUESTIONS[currentQuestion].text}
                                </h2>
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <button
                                        onClick={() => playQuestion(BARC10_QUESTIONS[currentQuestion].id, BARC10_QUESTIONS[currentQuestion].text)}
                                        disabled={ttsLoading === BARC10_QUESTIONS[currentQuestion].id}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                            playingQuestionId === BARC10_QUESTIONS[currentQuestion].id
                                                ? 'bg-emerald-500 text-white shadow-md'
                                                : ttsLoading === BARC10_QUESTIONS[currentQuestion].id
                                                    ? 'bg-emerald-100 text-emerald-400'
                                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        }`}
                                        title={playingQuestionId === BARC10_QUESTIONS[currentQuestion].id ? 'Stop reading' : 'Read aloud'}
                                    >
                                        {ttsLoading === BARC10_QUESTIONS[currentQuestion].id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : playingQuestionId === BARC10_QUESTIONS[currentQuestion].id ? (
                                            <Square className="w-4 h-4 fill-current" />
                                        ) : (
                                            <Volume2 className="w-5 h-5" />
                                        )}
                                    </button>
                                    {currentQuestion === 0 && (
                                        <button
                                            onClick={() => { stopAudio(); setTtsVoice(v => v === 'male' ? 'female' : 'male'); }}
                                            className="text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                                            title={`Voice: ${ttsVoice}. Click to switch.`}
                                        >
                                            {ttsVoice === 'male' ? '♂' : '♀'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Response Options */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                                {RESPONSE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleAnswer(BARC10_QUESTIONS[currentQuestion].id, opt.value)}
                                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                                            answers[`q${BARC10_QUESTIONS[currentQuestion].id}`] === opt.value
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md'
                                                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                                        }`}
                                    >
                                        <div className="text-2xl font-bold mb-1">{opt.value}</div>
                                        <div className="text-xs">{opt.label}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentQuestion(p => p - 1)}
                                    disabled={currentQuestion === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Previous
                                </button>
                                {currentQuestion < BARC10_QUESTIONS.length - 1 ? (
                                    <button
                                        onClick={() => setCurrentQuestion(p => p + 1)}
                                        disabled={!canProceed}
                                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Next <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAnswered || isLoading}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {isLoading ? 'Saving...' : 'Get Results'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Question Navigator */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <p className="text-xs text-gray-400 mb-3">Question Navigator</p>
                            <div className="flex gap-2 flex-wrap">
                                {BARC10_QUESTIONS.map((q, idx) => (
                                    <button
                                        key={q.id}
                                        onClick={() => setCurrentQuestion(idx)}
                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                            idx === currentQuestion
                                                ? 'bg-emerald-500 text-white shadow-md'
                                                : answers[`q${q.id}`] !== undefined
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {q.id}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== RESULTS VIEW ===================== */}
                {view === 'results' && totalScore !== null && domainScores && (
                    <div className="space-y-6">
                        {/* Score Header */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                            {savedAssessmentId && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm mb-4">
                                    <CheckCircle2 className="w-4 h-4" /> Saved Successfully
                                </div>
                            )}
                            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${getScoreColor(totalScore, 60)}15` }}>
                                <span className="text-3xl font-bold" style={{ color: getScoreColor(totalScore, 60) }}>{totalScore}</span>
                            </div>
                            <p className="text-gray-500 mb-1">out of 60</p>
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">{getScoreInterpretation(totalScore).level}</h2>
                            <p className="text-gray-600 max-w-md mx-auto">{getScoreInterpretation(totalScore).detail}</p>
                        </div>

                        {/* Domain Scores */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Domain Scores</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(DOMAIN_INFO).map(([key, info]) => {
                                    const score = domainScores[key] || 0;
                                    const max = BARC10_QUESTIONS.filter(q => q.domain === key).length * 6;
                                    const pct = Math.round((score / max) * 100);
                                    const Icon = info.icon;
                                    return (
                                        <div key={key} className="border rounded-xl p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: info.bgColor }}>
                                                    <Icon className="w-5 h-5" style={{ color: info.color }} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-sm">{info.name}</h4>
                                                    <p className="text-xs text-gray-500">{score}/{max}</p>
                                                </div>
                                                <span className="text-xl font-bold" style={{ color: info.color }}>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Response Summary */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Response Summary</h3>
                            <div className="space-y-2">
                                {BARC10_QUESTIONS.map(q => {
                                    const val = answers[`q${q.id}`];
                                    const info = DOMAIN_INFO[q.domain];
                                    return (
                                        <div key={q.id} className="flex items-center gap-3 py-2">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: info.bgColor, color: info.color }}>
                                                {val}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800">{q.shortLabel}</p>
                                                <p className="text-xs text-gray-500">{info.name}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Scoring Guide */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Scoring Guide</h3>
                            <div className="space-y-3">
                                {[
                                    { range: '45–60', color: '#10B981', label: 'Strong', desc: 'Robust recovery capital across domains' },
                                    { range: '30–44', color: '#F59E0B', label: 'Moderate', desc: 'Developing recovery capital with room for growth' },
                                    { range: '15–29', color: '#F97316', label: 'Low', desc: 'Significant gaps in recovery resources' },
                                    { range: '10–14', color: '#EF4444', label: 'Very Low', desc: 'Critical need for recovery capital development' },
                                ].map((tier) => (
                                    <div
                                        key={tier.range}
                                        className={`flex items-center gap-3 p-3 rounded-lg ${
                                            (tier.range === '45–60' && totalScore >= 45) ||
                                            (tier.range === '30–44' && totalScore >= 30 && totalScore < 45) ||
                                            (tier.range === '15–29' && totalScore >= 15 && totalScore < 30) ||
                                            (tier.range === '10–14' && totalScore < 15)
                                                ? 'bg-gray-100 ring-2 ring-gray-300'
                                                : 'bg-gray-50'
                                        }`}
                                    >
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
                            <button onClick={() => { setView('history'); fetchHistory(); }} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600">
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
                            <h2 className="text-xl font-bold text-[#0E2235]">BARC-10 Assessment History</h2>
                            <button onClick={() => setView('dashboard')} className="text-emerald-600 hover:underline">← Back</button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No BARC-10 assessments recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((assessment) => {
                                    const score = assessment.total_score;
                                    const pct = Math.round((score / 60) * 100);
                                    return (
                                        <div key={assessment.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-medium">
                                                    {assessment.participant_name?.[0] || assessment.participant_first_name?.[0] || 'B'}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {assessment.participant_name ||
                                                            (assessment.participant_first_name ? `${assessment.participant_first_name} ${assessment.participant_last_name || ''}`.trim() : 'Anonymous')}
                                                    </p>
                                                    <p className="text-sm text-gray-500">BARC-10 • {new Date(assessment.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="font-bold" style={{ color: getScoreColor(score, 60) }}>{score}/60</p>
                                                    <p className="text-xs text-gray-500">{pct}%</p>
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
