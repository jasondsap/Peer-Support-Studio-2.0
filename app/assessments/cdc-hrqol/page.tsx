'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Heart,
    CheckCircle2,
    Loader2, RotateCcw, History, Search, X, Info, Sparkles, ChevronRight,
    Volume2, Square
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

export default function CdchrqolAssessmentPage() {
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

        const text = 'Would you say that in general your health is: Excellent, Very good, Good, Fair, or Poor?';
        const cacheKey = `cdchrqol_q1_en_${ttsVoiceRef.current}`;

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
    if (score >= 4) return { level: 'Good to Excellent', color: '#10B981', desc: 'Reports good or better general health.' };
    if (score === 3) return { level: 'Good', color: '#F59E0B', desc: 'Reports average general health.' };
    return { level: 'Fair to Poor', color: '#EF4444', desc: 'Reports below-average general health. May warrant further assessment.' };
    };

    const fetchHistory = async () => {
        if (!currentOrg?.id) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&type=cdc_hrqol`);
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
                    assessment_type: 'cdc_hrqol',
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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#EC4899' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-slate-50">
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => view === 'dashboard' ? router.push('/') : resetAssessment()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">General Health</h1>
                                <p className="text-sm text-gray-500">Self-Rated Health Quality</p>
                            </div>
                        </div>
                        <button onClick={() => { setView('history'); fetchHistory(); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50"
                            style={{ color: '#EC4899' }}>
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
                                    style={{ backgroundColor: '#FDF2F8' }}>
                                    <Heart className="w-8 h-8" style={{ color: '#EC4899' }} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">General Health</h2>
                                    <p className="text-gray-600">CDC HRQOL Healthy Days. Quick single-item measure.</p>
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
                                                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-sm font-medium">
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
                                style={{ backgroundColor: '#EC4899' }}>
                                <Heart className="w-5 h-5" />
                                Begin General Health Assessment
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
                                    style={{ backgroundColor: '#FDF2F8' }}>
                                    <Heart className="w-5 h-5" style={{ color: '#EC4899' }} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[#0E2235]">General Health</h3>
                                    <p className="text-xs text-gray-500">CDC HRQOL Healthy Days</p>
                                </div>
                            </div>

                                <div className="flex items-start gap-3 mb-4">
                                    <p className="text-gray-700 flex-1">Would you say that in general your health is:</p>
                                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={playQuestion}
                                            disabled={ttsLoading}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                isPlaying
                                                    ? 'text-white shadow-md'
                                                    : ttsLoading
                                                        ? 'text-pink-400'
                                                        : 'text-pink-600 hover:bg-pink-100'
                                            }`}
                                            style={{ backgroundColor: isPlaying ? '#EC4899' : ttsLoading ? '#FDF2F8' : '#FDF2F8' }}
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
                                            className="text-xs text-gray-400 hover:text-pink-600 transition-colors"
                                            title={`Voice: ${ttsVoice}. Click to switch.`}
                                        >
                                            {ttsVoice === 'male' ? '♂' : '♀'}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                        <button key={5} onClick={() => setAnswer(5)}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                                answer === 5 ? 'bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={answer === 5 ? { borderColor: '#EC4899' } : {}}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={answer === 5 ? { borderColor: '#EC4899', backgroundColor: '#EC4899' } : { borderColor: '#D1D5DB' }}>
                                                    {answer === 5 && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="font-medium text-gray-700">Excellent</span>
                                            </div>
                                        </button>
                                        <button key={4} onClick={() => setAnswer(4)}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                                answer === 4 ? 'bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={answer === 4 ? { borderColor: '#EC4899' } : {}}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={answer === 4 ? { borderColor: '#EC4899', backgroundColor: '#EC4899' } : { borderColor: '#D1D5DB' }}>
                                                    {answer === 4 && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="font-medium text-gray-700">Very good</span>
                                            </div>
                                        </button>
                                        <button key={3} onClick={() => setAnswer(3)}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                                answer === 3 ? 'bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={answer === 3 ? { borderColor: '#EC4899' } : {}}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={answer === 3 ? { borderColor: '#EC4899', backgroundColor: '#EC4899' } : { borderColor: '#D1D5DB' }}>
                                                    {answer === 3 && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="font-medium text-gray-700">Good</span>
                                            </div>
                                        </button>
                                        <button key={2} onClick={() => setAnswer(2)}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                                answer === 2 ? 'bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={answer === 2 ? { borderColor: '#EC4899' } : {}}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={answer === 2 ? { borderColor: '#EC4899', backgroundColor: '#EC4899' } : { borderColor: '#D1D5DB' }}>
                                                    {answer === 2 && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="font-medium text-gray-700">Fair</span>
                                            </div>
                                        </button>
                                        <button key={1} onClick={() => setAnswer(1)}
                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                                answer === 1 ? 'bg-pink-50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={answer === 1 ? { borderColor: '#EC4899' } : {}}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={answer === 1 ? { borderColor: '#EC4899', backgroundColor: '#EC4899' } : { borderColor: '#D1D5DB' }}>
                                                    {answer === 1 && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="font-medium text-gray-700">Poor</span>
                                            </div>
                                        </button>
                                </div>
                        </div>

                        <button onClick={handleSubmit} disabled={!(answer !== null) || isLoading}
                            className="w-full py-4 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 sticky bottom-4 shadow-lg"
                            style={{ backgroundColor: '#EC4899' }}>
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
                                    style={{ backgroundColor: '#FDF2F8' }}>
                                    <Heart className="w-6 h-6" style={{ color: '#EC4899' }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[#0E2235]">General Health</h3>
                                    <p className="text-xs text-gray-500">CDC HRQOL Healthy Days</p>
                                </div>
                                                                <p className="text-2xl font-bold" style={{ color: resultData.interp.color }}>
                                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][resultData.totalScore] || resultData.totalScore}
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
                                style={{ backgroundColor: '#EC4899' }}>
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
                            <h2 className="text-xl font-bold text-[#0E2235]">General Health History</h2>
                            <button onClick={() => setView('dashboard')} className="hover:underline" style={{ color: '#EC4899' }}>← Back</button>
                        </div>
                        {loadingHistory ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#EC4899' }} /></div>
                        ) : assessmentHistory.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No general health assessments recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm divide-y">
                                {assessmentHistory.map((a) => (
                                    <div key={a.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: '#FDF2F8' }}>
                                                <Heart className="w-5 h-5" style={{ color: '#EC4899' }} />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {a.participant_name || (a.participant_first_name ? `${a.participant_first_name} ${a.participant_last_name || ''}`.trim() : 'Self')}
                                                </p>
                                                <p className="text-sm text-gray-500">{new Date(a.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold" style={{ color: '#EC4899' }}>
                                                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][a.total_score] || a.total_score}
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
