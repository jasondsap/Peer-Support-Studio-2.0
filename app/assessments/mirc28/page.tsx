'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Heart, Users, Home, Brain, Compass,
    Sparkles, Target, TrendingUp, CheckCircle2, ChevronRight,
    Loader2, RotateCcw, History, Search, X,
    Info, Volume2, Square, AlertCircle
} from 'lucide-react';

// =============================================
// MIRC-28 QUESTIONS (28 items, 4-point Likert)
// Multidimensional Inventory of Recovery Capital
// 4 domains × 7 questions, includes reverse-scored items
// =============================================

const MIRC_DOMAINS: Record<string, { name: string; icon: any; color: string; bgColor: string; description: string; questions: { id: number; text: string; reverse: boolean }[] }> = {
    social: {
        name: "Social Capital", icon: Users, color: "#8B5CF6", bgColor: "#F5F3FF",
        description: "Support from relationships and recovery community",
        questions: [
            { id: 1, text: "I actively support other people who are in recovery.", reverse: false },
            { id: 2, text: "My family makes my recovery more difficult.", reverse: true },
            { id: 3, text: "I have at least one friend who supports my recovery.", reverse: false },
            { id: 4, text: "My family supports my recovery.", reverse: false },
            { id: 5, text: "Some people in my life do not think I'll make it in my recovery.", reverse: true },
            { id: 6, text: "I feel alone.", reverse: true },
            { id: 7, text: "I feel like I'm part of a recovery community.", reverse: false }
        ]
    },
    physical: {
        name: "Physical Capital", icon: Home, color: "#F59E0B", bgColor: "#FFFBEB",
        description: "Housing, finances, transportation, and material resources",
        questions: [
            { id: 8, text: "My housing situation is helpful for my recovery.", reverse: false },
            { id: 9, text: "I have difficulty getting transportation.", reverse: true },
            { id: 10, text: "My housing situation is unstable.", reverse: true },
            { id: 11, text: "I have enough money every week to buy the basic things I need.", reverse: false },
            { id: 12, text: "Not having enough money makes my recovery more difficult.", reverse: true },
            { id: 13, text: "I can afford the care I need for my health, mental health, and recovery.", reverse: false },
            { id: 14, text: "I have reliable access to a phone and the internet.", reverse: false }
        ]
    },
    human: {
        name: "Human Capital", icon: Brain, color: "#3B82F6", bgColor: "#EFF6FF",
        description: "Health, skills, hope, and personal strengths",
        questions: [
            { id: 15, text: "I am hopeful about my future.", reverse: false },
            { id: 16, text: "I have difficulty managing stress.", reverse: true },
            { id: 17, text: "My physical health makes my recovery more difficult.", reverse: true },
            { id: 18, text: "I struggle with my mental health.", reverse: true },
            { id: 19, text: "I have the skills to cope with challenges in my recovery.", reverse: false },
            { id: 20, text: "I am motivated to continue my recovery.", reverse: false },
            { id: 21, text: "I feel good about myself.", reverse: false }
        ]
    },
    cultural: {
        name: "Cultural Capital", icon: Compass, color: "#EC4899", bgColor: "#FDF2F8",
        description: "Community resources, values, and cultural connections",
        questions: [
            { id: 22, text: "I know where to go in my community if I need help with my recovery.", reverse: false },
            { id: 23, text: "My community has limited resources for people in recovery.", reverse: true },
            { id: 24, text: "I participate in activities that give my life meaning.", reverse: false },
            { id: 25, text: "I lack access to recovery support services in my community.", reverse: true },
            { id: 26, text: "My cultural or spiritual beliefs support my recovery.", reverse: false },
            { id: 27, text: "I have a sense of purpose in my life.", reverse: false },
            { id: 28, text: "I feel connected to my community.", reverse: false }
        ]
    }
};

// Flat list for question-by-question navigation
const ALL_QUESTIONS = Object.entries(MIRC_DOMAINS).flatMap(([domain, data]) =>
    data.questions.map(q => ({ ...q, domain, domainName: data.name, domainColor: data.color, domainBgColor: data.bgColor }))
);

const RESPONSE_OPTIONS = [
    { value: 1, label: "Strongly Disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Agree" },
    { value: 4, label: "Strongly Agree" }
];

interface Answers { [key: string]: number; }
interface DomainScore { raw: number; max: number; percentage: number; }
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

export default function Mirc28AssessmentPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('dashboard');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [totalScore, setTotalScore] = useState<number | null>(null);
    const [domainScores, setDomainScores] = useState<Record<string, DomainScore> | null>(null);
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
        const cacheKey = `mirc28_q${questionId}_en_${ttsVoiceRef.current}`;
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
        const domains: Record<string, DomainScore> = {};
        let grandTotal = 0;

        Object.entries(MIRC_DOMAINS).forEach(([key, domain]) => {
            let raw = 0;
            const max = domain.questions.length * 4; // max 4 per question
            domain.questions.forEach(q => {
                const val = ans[`q${q.id}`] || 0;
                // Reverse-scored items: 1→4, 2→3, 3→2, 4→1
                raw += q.reverse ? (5 - val) : val;
            });
            domains[key] = { raw, max, percentage: Math.round((raw / max) * 100) };
            grandTotal += raw;
        });

        return { total: grandTotal, maxScore: 112, domains };
    };

    const handleAnswer = (questionId: number, value: number) => {
        setAnswers(prev => ({ ...prev, [`q${questionId}`]: value }));
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&type=mirc28`);
            const data = await res.json();
            setAssessmentHistory(data.assessments || []);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const { total, maxScore, domains } = calculateScores(answers);
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
                    assessment_type: 'mirc28',
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

    const getScoreColor = (pct: number) => {
        if (pct >= 75) return '#10B981';
        if (pct >= 50) return '#F59E0B';
        if (pct >= 25) return '#F97316';
        return '#EF4444';
    };

    const getScoreInterpretation = (total: number, max: number) => {
        const pct = Math.round((total / max) * 100);
        if (pct >= 75) return { level: 'Strong Recovery Capital', desc: `Score: ${total}/${max} (${pct}%)`, detail: 'Strong personal, social, and community resources supporting recovery. Continue strengthening these assets and address any individual domain gaps.' };
        if (pct >= 50) return { level: 'Moderate Recovery Capital', desc: `Score: ${total}/${max} (${pct}%)`, detail: 'Recovery capital is developing across domains. Identify the weakest domains and prioritize building resources in those areas while maintaining strengths.' };
        if (pct >= 25) return { level: 'Low Recovery Capital', desc: `Score: ${total}/${max} (${pct}%)`, detail: 'Significant gaps exist in recovery resources. Focus on building stable housing, social supports, and coping skills. Intensive case management may be beneficial.' };
        return { level: 'Very Low Recovery Capital', desc: `Score: ${total}/${max} (${pct}%)`, detail: 'Critical need for recovery capital development across all domains. Comprehensive support services, housing assistance, and community connections are strongly recommended.' };
    };

    // Current question data
    const currentQ = ALL_QUESTIONS[currentQuestion];
    const progress = (Object.keys(answers).length / ALL_QUESTIONS.length) * 100;
    const canProceed = currentQ ? answers[`q${currentQ.id}`] !== undefined : false;
    const allAnswered = Object.keys(answers).length === ALL_QUESTIONS.length;

    // Figure out which domain section we're in
    const getCurrentDomainProgress = () => {
        if (!currentQ) return null;
        const domain = MIRC_DOMAINS[currentQ.domain];
        const domainQs = domain.questions;
        const answered = domainQs.filter(q => answers[`q${q.id}`] !== undefined).length;
        return { name: domain.name, answered, total: domainQs.length };
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => view === 'dashboard' ? router.push('/') : resetAssessment()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">MIRC-28</h1>
                                <p className="text-sm text-gray-500">Multidimensional Inventory of Recovery Capital</p>
                            </div>
                        </div>
                        <button onClick={() => { setView('history'); fetchHistory(); }} className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg">
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
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                    <Compass className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Multidimensional Inventory of Recovery Capital</h2>
                                    <p className="text-gray-600">
                                        A comprehensive 28-item assessment measuring recovery capital across four domains with reverse-scored items for accuracy.
                                    </p>
                                </div>
                            </div>

                            {/* Domain Preview */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {Object.entries(MIRC_DOMAINS).map(([key, info]) => {
                                    const Icon = info.icon;
                                    return (
                                        <div key={key} className="rounded-xl p-3 text-center" style={{ backgroundColor: info.bgColor }}>
                                            <Icon className="w-5 h-5 mx-auto mb-1" style={{ color: info.color }} />
                                            <p className="text-xs font-medium" style={{ color: info.color }}>{info.name}</p>
                                            <p className="text-xs text-gray-500">7 items</p>
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
                                            The MIRC-28 provides a comprehensive view of recovery capital with 7 items
                                            per domain. Some items are reverse-scored to ensure accurate measurement.
                                            Responses range from Strongly Disagree (1) to Strongly Agree (4), with a
                                            maximum adjusted score of 112. Takes approximately 10–15 minutes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Reverse-scored notice */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-amber-800">
                                        <p className="font-medium mb-1">Reverse-Scored Items</p>
                                        <p>
                                            Some questions are worded negatively (e.g., &quot;I feel alone&quot;).
                                            These are automatically reverse-scored so that higher totals always
                                            indicate stronger recovery capital.
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

                            {/* Start Button */}
                            <button
                                onClick={() => setView('assessment')}
                                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Compass className="w-5 h-5" />
                                Begin MIRC-28
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== ASSESSMENT VIEW ===================== */}
                {view === 'assessment' && currentQ && (
                    <div className="space-y-6">
                        {/* Progress */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Question {currentQuestion + 1} of {ALL_QUESTIONS.length}</span>
                                <span className="text-sm text-purple-600 font-medium">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                            {/* Domain indicator */}
                            {(() => {
                                const dp = getCurrentDomainProgress();
                                if (!dp) return null;
                                return (
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs font-medium" style={{ color: currentQ.domainColor }}>{currentQ.domainName}</span>
                                        <span className="text-xs text-gray-400">{dp.answered}/{dp.total} in domain</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Question Card */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            {/* Domain Badge */}
                            <div className="flex items-center gap-2 mb-4">
                                <span
                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: currentQ.domainBgColor, color: currentQ.domainColor }}
                                >
                                    {currentQ.domainName}
                                </span>
                                {currentQ.reverse && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                        ↕ Reverse-scored
                                    </span>
                                )}
                            </div>

                            <div className="flex items-start gap-3 mb-8">
                                <h2 className="text-lg font-semibold text-[#0E2235] leading-relaxed flex-1">
                                    {currentQ.text}
                                </h2>
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <button
                                        onClick={() => playQuestion(currentQ.id, currentQ.text)}
                                        disabled={ttsLoading === currentQ.id}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                            playingQuestionId === currentQ.id
                                                ? 'bg-purple-500 text-white shadow-md'
                                                : ttsLoading === currentQ.id
                                                    ? 'bg-purple-100 text-purple-400'
                                                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                                        }`}
                                        title={playingQuestionId === currentQ.id ? 'Stop reading' : 'Read aloud'}
                                    >
                                        {ttsLoading === currentQ.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : playingQuestionId === currentQ.id ? (
                                            <Square className="w-4 h-4 fill-current" />
                                        ) : (
                                            <Volume2 className="w-5 h-5" />
                                        )}
                                    </button>
                                    {currentQuestion === 0 && (
                                        <button
                                            onClick={() => { stopAudio(); setTtsVoice(v => v === 'male' ? 'female' : 'male'); }}
                                            className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
                                            title={`Voice: ${ttsVoice}. Click to switch.`}
                                        >
                                            {ttsVoice === 'male' ? '♂' : '♀'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Response Options */}
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                {RESPONSE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleAnswer(currentQ.id, opt.value)}
                                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                                            answers[`q${currentQ.id}`] === opt.value
                                                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
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
                                {currentQuestion < ALL_QUESTIONS.length - 1 ? (
                                    <button
                                        onClick={() => setCurrentQuestion(p => p + 1)}
                                        disabled={!canProceed}
                                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        Next <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAnswered || isLoading}
                                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {isLoading ? 'Saving...' : 'Get Results'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Domain Navigator */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <p className="text-xs text-gray-400 mb-3">Question Navigator</p>
                            <div className="space-y-3">
                                {Object.entries(MIRC_DOMAINS).map(([key, domain]) => (
                                    <div key={key}>
                                        <p className="text-xs font-medium mb-1.5" style={{ color: domain.color }}>{domain.name}</p>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {domain.questions.map(q => {
                                                const idx = ALL_QUESTIONS.findIndex(aq => aq.id === q.id);
                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => setCurrentQuestion(idx)}
                                                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                                                            idx === currentQuestion
                                                                ? 'bg-purple-500 text-white shadow-md'
                                                                : answers[`q${q.id}`] !== undefined
                                                                    ? 'text-white shadow-sm'
                                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                        style={
                                                            answers[`q${q.id}`] !== undefined && idx !== currentQuestion
                                                                ? { backgroundColor: domain.color }
                                                                : undefined
                                                        }
                                                    >
                                                        {q.id}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
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
                            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${getScoreColor(Math.round((totalScore / 112) * 100))}15` }}>
                                <span className="text-3xl font-bold" style={{ color: getScoreColor(Math.round((totalScore / 112) * 100)) }}>
                                    {Math.round((totalScore / 112) * 100)}%
                                </span>
                            </div>
                            <p className="text-gray-500 mb-1">{totalScore} out of 112</p>
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">{getScoreInterpretation(totalScore, 112).level}</h2>
                            <p className="text-gray-600 max-w-md mx-auto">{getScoreInterpretation(totalScore, 112).detail}</p>
                        </div>

                        {/* Domain Scores */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Domain Scores</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(MIRC_DOMAINS).map(([key, domain]) => {
                                    const ds = domainScores[key];
                                    if (!ds) return null;
                                    const Icon = domain.icon;
                                    return (
                                        <div key={key} className="border rounded-xl p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: domain.bgColor }}>
                                                    <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-sm">{domain.name}</h4>
                                                    <p className="text-xs text-gray-500">{ds.raw}/{ds.max}</p>
                                                </div>
                                                <span className="text-xl font-bold" style={{ color: domain.color }}>{ds.percentage}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${ds.percentage}%`, backgroundColor: domain.color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Strongest / Weakest Domain */}
                        {(() => {
                            const entries = Object.entries(domainScores);
                            const sorted = [...entries].sort((a, b) => b[1].percentage - a[1].percentage);
                            const strongest = sorted[0];
                            const weakest = sorted[sorted.length - 1];
                            if (!strongest || !weakest) return null;
                            return (
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                                        <p className="text-sm font-medium text-green-800 mb-1">Strongest Domain</p>
                                        <p className="text-lg font-bold text-green-700">{MIRC_DOMAINS[strongest[0]]?.name}</p>
                                        <p className="text-sm text-green-600">{strongest[1].percentage}% — {strongest[1].raw}/{strongest[1].max}</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                                        <p className="text-sm font-medium text-amber-800 mb-1">Area for Growth</p>
                                        <p className="text-lg font-bold text-amber-700">{MIRC_DOMAINS[weakest[0]]?.name}</p>
                                        <p className="text-sm text-amber-600">{weakest[1].percentage}% — {weakest[1].raw}/{weakest[1].max}</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Scoring Guide */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Scoring Guide</h3>
                            <div className="space-y-3">
                                {[
                                    { range: '75–100%', color: '#10B981', label: 'Strong', desc: 'Robust recovery capital across domains' },
                                    { range: '50–74%', color: '#F59E0B', label: 'Moderate', desc: 'Developing recovery capital with room for growth' },
                                    { range: '25–49%', color: '#F97316', label: 'Low', desc: 'Significant gaps in recovery resources' },
                                    { range: '0–24%', color: '#EF4444', label: 'Very Low', desc: 'Critical need for recovery capital development' },
                                ].map((tier) => {
                                    const pct = Math.round((totalScore / 112) * 100);
                                    const active = (tier.range === '75–100%' && pct >= 75) ||
                                                   (tier.range === '50–74%' && pct >= 50 && pct < 75) ||
                                                   (tier.range === '25–49%' && pct >= 25 && pct < 50) ||
                                                   (tier.range === '0–24%' && pct < 25);
                                    return (
                                        <div
                                            key={tier.range}
                                            className={`flex items-center gap-3 p-3 rounded-lg ${active ? 'bg-gray-100 ring-2 ring-gray-300' : 'bg-gray-50'}`}
                                        >
                                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-gray-800">{tier.range}: {tier.label}</span>
                                                <p className="text-xs text-gray-500">{tier.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button onClick={resetAssessment} className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                                <RotateCcw className="w-4 h-4" /> New Assessment
                            </button>
                            <button onClick={() => { setView('history'); fetchHistory(); }} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600">
                                View History
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== HISTORY VIEW ===================== */}
                {view === 'history' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-[#0E2235]">MIRC-28 Assessment History</h2>
                            <button onClick={() => setView('dashboard')} className="text-purple-600 hover:underline">← Back</button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <Compass className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No MIRC-28 assessments recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((assessment) => {
                                    const score = assessment.total_score;
                                    const pct = Math.round((score / 112) * 100);
                                    return (
                                        <div key={assessment.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                                                    {assessment.participant_name?.[0] || assessment.participant_first_name?.[0] || 'M'}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {assessment.participant_name ||
                                                            (assessment.participant_first_name ? `${assessment.participant_first_name} ${assessment.participant_last_name || ''}`.trim() : 'Anonymous')}
                                                    </p>
                                                    <p className="text-sm text-gray-500">MIRC-28 • {new Date(assessment.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="font-bold" style={{ color: getScoreColor(pct) }}>{score}/112</p>
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
