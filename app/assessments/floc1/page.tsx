'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Compass,
    Loader2, RotateCcw, History, Search, X, Info, Sparkles, ChevronRight,
    Volume2, Square, CheckCircle2
} from 'lucide-react';

interface SavedAssessment {
    id: string;
    participant_name?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    assessment_type: string;
    total_score: number;
    domain_scores: any;
    responses?: any;
    created_at: string;
}

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
}

type ViewState = 'dashboard' | 'assessment' | 'results' | 'history';

export default function Floc1AssessmentPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('dashboard');
    const [answer, setAnswer] = useState<number | null>(null);
    // Participant
    const [participantName, setParticipantName] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [resultData, setResultData] = useState<any>(null);
    const [savedAssessmentId, setSavedAssessmentId] = useState<string | null>(null);

    const [assessmentHistory, setAssessmentHistory] = useState<SavedAssessment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // TTS Audio Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
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
        setIsPlaying(false);
    }, []);

    const playQuestion = useCallback(async () => {
        if (isPlaying) { stopAudio(); return; }
        stopAudio();

        const text = 'On a scale of 0 to 10, how much do you feel you are in control of your own recovery? 0 means no control at all, and 10 means complete control.';
        const cacheKey = `floc1_q1_en_${ttsVoiceRef.current}`;

        if (audioCacheRef.current.has(cacheKey)) {
            const audio = new Audio(audioCacheRef.current.get(cacheKey)!);
            audioRef.current = audio;
            setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => setIsPlaying(false);
            audio.play();
            return;
        }

        setTtsLoading(true);
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
            setIsPlaying(true);
            setTtsLoading(false);
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => { setIsPlaying(false); setTtsLoading(false); };
            audio.play();
        } catch (err) {
            console.error('TTS playback error:', err);
            setTtsLoading(false);
            setIsPlaying(false);
        }
    }, [isPlaying, stopAudio]);

    useEffect(() => { return () => stopAudio(); }, [view, stopAudio]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/auth/signin');
    }, [status, router]);

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

    const getInterpretation = (score: number) => {
    if (score >= 8) return { level: 'Strong Internal Locus', color: '#10B981', desc: 'Feels strongly in control of their recovery. This is a positive protective factor.' };
    if (score >= 5) return { level: 'Moderate Locus of Control', color: '#F59E0B', desc: 'Some sense of personal control. Building self-efficacy through small wins could strengthen this.' };
    return { level: 'External Locus of Control', color: '#EF4444', desc: 'Feels limited control over recovery. Focus on building self-efficacy and identifying areas of personal agency.' };
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&type=floc1`);
            const data = await res.json();
            setAssessmentHistory(data.assessments || []);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const totalScore = answer || 0;
        const domainScores = { value: totalScore };
        const responses = { q1: totalScore };
        const interp = getInterpretation(totalScore);

        setResultData({ totalScore, domainScores, interp });

        try {
            const res = await fetch('/api/recovery-assessments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg?.id,
                    participant_id: selectedParticipant?.id || null,
                    participant_name: selectedParticipant ? participantName : null,
                    assessment_type: 'floc1',
                    total_score: totalScore,
                    domain_scores: domainScores,
                    responses: responses,
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
        setParticipantName('');
        setSelectedParticipant(null);
        setAnswer(null);
        setResultData(null);
        setSavedAssessmentId(null);
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366F1' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => view === 'dashboard' ? router.push('/') : resetAssessment()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Locus of Control</h1>
                                <p className="text-sm text-gray-500">Recovery Control Assessment</p>
                            </div>
                        </div>
                        <button onClick={() => { setView('history'); fetchHistory(); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50"
                            style={{ color: '#6366F1' }}>
                            <History className="w-4 h-4" /> History
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
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{ backgroundColor: '#EEF2FF' }}>
                                    <Compass className="w-8 h-8" style={{ color: '#6366F1' }} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Locus of Control</h2>
                                    <p className="text-gray-600">FLOC-1. Quick single-item measure.</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-blue-800">
                                        Administered at intake, during stay, and exit. Takes under 30 seconds.
                                    </p>
                                </div>
                            </div>

                            {/* Select Resident */}
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
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium">
                                                        {p.first_name[0]}{p.last_name[0]}
                                                    </div>
                                                    <span className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
<button onClick={() => setView('assessment')}
                                disabled={!selectedParticipant}
                                className="w-full py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ backgroundColor: '#6366F1' }}>
                                <Compass className="w-5 h-5" />
                                Begin Locus of Control Assessment
                            </button>
                        </div>
                    </div>
                )}

                {/* ===================== ASSESSMENT VIEW ===================== */}
                {view === 'assessment' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: '#EEF2FF' }}>
                                    <Compass className="w-5 h-5" style={{ color: '#6366F1' }} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[#0E2235]">Locus of Control</h3>
                                    <p className="text-xs text-gray-500">FLOC-1</p>
                                </div>
                            </div>

                                <div className="flex items-start gap-3 mb-6">
                                    <p className="text-gray-700 flex-1">On a scale of 0 to 10, how much do you feel you are in control of your own recovery?</p>
                                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={playQuestion}
                                            disabled={ttsLoading}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                isPlaying
                                                    ? 'text-white shadow-md'
                                                    : ttsLoading
                                                        ? 'text-indigo-400'
                                                        : 'text-indigo-600 hover:bg-indigo-100'
                                            }`}
                                            style={{ backgroundColor: isPlaying ? '#6366F1' : '#EEF2FF' }}
                                            title={isPlaying ? 'Stop reading' : 'Read aloud'}
                                        >
                                            {ttsLoading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : isPlaying ? (
                                                <Square className="w-4 h-4 fill-current" />
                                            ) : (
                                                <Volume2 className="w-5 h-5" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => { stopAudio(); setTtsVoice(v => v === 'male' ? 'female' : 'male'); }}
                                            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                                            title={`Voice: ${ttsVoice}. Click to switch.`}
                                        >
                                            {ttsVoice === 'male' ? '♂' : '♀'}
                                        </button>
                                    </div>
                                </div>
                                <div className="px-2">
                                    <div className="text-center mb-4">
                                        <span className="text-4xl font-bold"
                                            style={{ color: answer !== null ? '#6366F1' : '#D1D5DB' }}>
                                            {answer !== null ? answer : '—'}
                                        </span>
                                        <span className="text-sm text-gray-400 ml-1">/ 10</span>
                                    </div>
                                    <input type="range" min={0} max={10} step={1}
                                        value={answer ?? 5}
                                        onChange={(e) => setAnswer(parseInt(e.target.value))}
                                        className="w-full h-3 rounded-full appearance-none cursor-pointer"
                                        style={{
                                            background: answer !== null
                                                ? `linear-gradient(to right, #6366F1 0%, #6366F1 ${((answer - 0) / 10) * 100}%, #E5E7EB ${((answer - 0) / 10) * 100}%, #E5E7EB 100%)`
                                                : '#E5E7EB',
                                            accentColor: '#6366F1'
                                        }}
                                    />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-gray-400">No control</span>
                                        <span className="text-xs text-gray-400">Complete control</span>
                                    </div>
                                    <div className="flex justify-between mt-3">
                                        {Array.from({ length: 11 }, (_, i) => i + 0).map(v => (
                                            <button key={v} onClick={() => setAnswer(v)}
                                                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                                                    answer === v ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                }`}
                                                style={answer === v ? { backgroundColor: '#6366F1' } : {}}>
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                        </div>

                        <button onClick={handleSubmit} disabled={!(answer !== null) || isLoading}
                            className="w-full py-4 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 sticky bottom-4 shadow-lg"
                            style={{ backgroundColor: '#6366F1' }}>
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {isLoading ? 'Saving...' : 'Save & View Results'}
                        </button>
                    </div>
                )}

                {/* ===================== RESULTS VIEW ===================== */}
                {view === 'results' && resultData && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: '#EEF2FF' }}>
                                    <Compass className="w-6 h-6" style={{ color: '#6366F1' }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[#0E2235]">Locus of Control</h3>
                                    <p className="text-xs text-gray-500">FLOC-1</p>
                                </div>
                                                                <p className="text-2xl font-bold" style={{ color: resultData.interp.color }}>
                                    {resultData.totalScore}/10
                                </p>
                            </div>
                            <div className="rounded-lg p-4" style={{ backgroundColor: `${resultData.interp.color}10` }}>
                                <p className="text-sm font-medium" style={{ color: resultData.interp.color }}>{resultData.interp.level}</p>
                                <p className="text-sm text-gray-600 mt-1">{resultData.interp.desc}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={resetAssessment} className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                                <RotateCcw className="w-4 h-4" /> New Assessment
                            </button>
                            <button onClick={() => { setView('history'); fetchHistory(); }}
                                className="flex-1 py-3 text-white rounded-xl font-semibold"
                                style={{ backgroundColor: '#6366F1' }}>
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
                            <h2 className="text-xl font-bold text-[#0E2235]">Locus of Control History</h2>
                            <button onClick={() => setView('dashboard')} className="hover:underline" style={{ color: '#6366F1' }}>← Back</button>
                        </div>
                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366F1' }} /></div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No locus of control assessments recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((a) => (
                                    <div key={a.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: '#EEF2FF' }}>
                                                <Compass className="w-5 h-5" style={{ color: '#6366F1' }} />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {a.participant_name || (a.participant_first_name ? `${a.participant_first_name} ${a.participant_last_name || ''}`.trim() : 'Self')}
                                                </p>
                                                <p className="text-sm text-gray-500">{new Date(a.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold" style={{ color: '#6366F1' }}>
                                                    {a.total_score}/10
                                                </span>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
