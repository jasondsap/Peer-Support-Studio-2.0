'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Heart, Users, Home, Brain, Compass,
    Sparkles, Target, TrendingUp, CheckCircle2, ChevronRight,
    Loader2, RotateCcw, Clock, AlertCircle, Calendar, BookOpen, Search
} from 'lucide-react';

const MIRC_QUESTIONS = {
    social: {
        name: "Social Capital", icon: Users, color: "#8B5CF6",
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
        name: "Physical Capital", icon: Home, color: "#F59E0B",
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
        name: "Human Capital", icon: Brain, color: "#3B82F6",
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
        name: "Cultural Capital", icon: Compass, color: "#EC4899",
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

const RESPONSE_OPTIONS = [
    { value: 1, label: "Strongly Disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Agree" },
    { value: 4, label: "Strongly Agree" }
];

const ALL_QUESTIONS = Object.entries(MIRC_QUESTIONS).flatMap(([domain, data]) =>
    data.questions.map(q => ({ ...q, domain, domainName: data.name, domainColor: data.color }))
);

interface Answers { [key: string]: number; }
interface DomainScore { raw: number; max: number; percentage: number; }
interface Scores {
    total: number; maxScore: number; percentage: number;
    domains: { social: DomainScore; physical: DomainScore; human: DomainScore; cultural: DomainScore; };
}
interface Analysis {
    overallSummary: string;
    scoreInterpretation: { level: string; description: string; };
    domainInsights: { domain: string; domainName: string; summary: string; strengths: string[]; growthAreas: string[]; }[];
    prioritizedGoals: { domain: string; title: string; description: string; actionSteps: string[]; whyItMatters: string; priority: string; }[];
    immediateActions: string[];
    weeklyPlan: { week1: string[]; week2: string[]; week3: string[]; week4: string[]; };
    encouragement: string;
}
interface Participant { id: string; first_name: string; last_name: string; preferred_name?: string; }

type ViewState = 'intro' | 'assessment' | 'results';

function ComprehensiveAssessmentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [view, setView] = useState<ViewState>('intro');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Answers>({});
    const [isLoading, setIsLoading] = useState(false);
    const [scores, setScores] = useState<Scores | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [savedAssessmentId, setSavedAssessmentId] = useState<string | null>(null);
    const [showDomainNav, setShowDomainNav] = useState(false);
    const [participantName, setParticipantName] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

    useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

    useEffect(() => {
        const participantId = searchParams.get('participant_id');
        if (participantId && currentOrg?.id) {
            fetch(`/api/participants/${participantId}?organization_id=${currentOrg.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.participant) {
                        setSelectedParticipant(data.participant);
                        setParticipantName(`${data.participant.preferred_name || data.participant.first_name} ${data.participant.last_name}`);
                    }
                });
        }
    }, [searchParams, currentOrg?.id]);

    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${participantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setParticipants(data.participants || []));
        }
    }, [participantSearch, currentOrg?.id]);

    const selectParticipant = (p: Participant) => {
        setSelectedParticipant(p);
        setParticipantName(`${p.preferred_name || p.first_name} ${p.last_name}`);
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const calculateScores = (answers: Answers): Scores => {
        const domainScores: any = {};
        let totalScore = 0;
        Object.entries(MIRC_QUESTIONS).forEach(([domain, data]) => {
            let domainTotal = 0;
            data.questions.forEach(q => {
                const raw = answers[`q${q.id}`] || 2;
                domainTotal += q.reverse ? (5 - raw) : raw;
            });
            domainScores[domain] = { raw: domainTotal, max: 28, percentage: Math.round((domainTotal / 28) * 100) };
            totalScore += domainTotal;
        });
        return { total: totalScore, maxScore: 112, percentage: Math.round((totalScore / 112) * 100), domains: domainScores };
    };

    const handleAnswer = (qId: number, value: number) => setAnswers(prev => ({ ...prev, [`q${qId}`]: value }));

    const jumpToDomain = (domain: string) => {
        const idx = ALL_QUESTIONS.findIndex(q => q.domain === domain);
        if (idx !== -1) { setCurrentQuestion(idx); setShowDomainNav(false); }
    };

    const getDomainProgress = (domain: string) => {
        const qs = ALL_QUESTIONS.filter(q => q.domain === domain);
        return { answered: qs.filter(q => answers[`q${q.id}`] !== undefined).length, total: qs.length };
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const calculatedScores = calculateScores(answers);
        setScores(calculatedScores);
        try {
            const res = await fetch('/api/recovery-capital/comprehensive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'analyze', answers, scores: calculatedScores,
                    participantName: selectedParticipant ? participantName : null,
                    organization_id: currentOrg?.id, participant_id: selectedParticipant?.id,
                })
            });
            const data = await res.json();
            if (data.success) { setAnalysis(data.analysis); if (data.assessmentId) setSavedAssessmentId(data.assessmentId); }
            setView('results');
        } catch (e) { console.error(e); setView('results'); }
        finally { setIsLoading(false); }
    };

    const resetAssessment = () => {
        setView('intro'); setCurrentQuestion(0); setAnswers({}); setScores(null); setAnalysis(null); setSavedAssessmentId(null);
    };

    const currentQ = ALL_QUESTIONS[currentQuestion];
    const progress = (Object.keys(answers).length / ALL_QUESTIONS.length) * 100;
    const canProceed = answers[`q${currentQ?.id}`] !== undefined;
    const allAnswered = Object.keys(answers).length === ALL_QUESTIONS.length;

    if (status === 'loading') return <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-amber-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-amber-50">
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/recovery-capital')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
                        <div><h1 className="text-xl font-bold text-[#0E2235]">Comprehensive Assessment</h1><p className="text-sm text-gray-500">MIRC-28</p></div>
                    </div>
                    {view === 'assessment' && <div className="flex items-center gap-2 text-sm text-gray-500"><Clock className="w-4 h-4" />~10-15 min</div>}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {view === 'intro' && (
                    <div className="bg-white rounded-2xl p-8 shadow-sm">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-blue-500 to-amber-500 flex items-center justify-center shadow-lg"><BookOpen className="w-8 h-8 text-white" /></div>
                            <div><h2 className="text-2xl font-bold text-[#0E2235] mb-2">Comprehensive Recovery Capital Assessment</h2><p className="text-gray-600">28 questions across 4 domains for detailed insights.</p></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {Object.entries(MIRC_QUESTIONS).map(([key, domain]) => {
                                const Icon = domain.icon;
                                return (<div key={key} className="bg-gray-50 rounded-lg p-4 text-center"><div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${domain.color}20` }}><Icon className="w-5 h-5" style={{ color: domain.color }} /></div><p className="text-sm font-medium">{domain.name.split(' ')[0]}</p></div>);
                            })}
                        </div>
                        <div className="mb-6 relative">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Select Participant</label>
                            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3">
                                <Search className="w-4 h-4 text-gray-400" />
                                <input value={selectedParticipant ? participantName : participantSearch} onChange={(e) => { setParticipantSearch(e.target.value); setShowParticipantDropdown(true); setSelectedParticipant(null); }} onFocus={() => setShowParticipantDropdown(true)} placeholder="Search participants..." className="flex-1 bg-transparent outline-none" />
                                {selectedParticipant && (
                                    <button onClick={() => { setSelectedParticipant(null); setParticipantName(''); setParticipantSearch(''); }} className="p-1 hover:bg-gray-100 rounded">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                            {showParticipantDropdown && participants.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border max-h-60 overflow-y-auto z-10">
                                    {participants.map(p => (<button key={p.id} onClick={() => selectParticipant(p)} className="w-full px-4 py-3 text-left hover:bg-gray-50">{p.preferred_name || p.first_name} {p.last_name}</button>))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setView('assessment')} className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold">Begin Assessment</button>
                    </div>
                )}

                {view === 'assessment' && currentQ && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: `${currentQ.domainColor}20`, color: currentQ.domainColor }}>{currentQ.domainName}</span>
                                <button onClick={() => setShowDomainNav(!showDomainNav)} className="text-sm text-purple-600">Jump to domain</button>
                            </div>
                            {showDomainNav && (
                                <div className="grid grid-cols-4 gap-2 mb-3 pt-3 border-t">
                                    {Object.entries(MIRC_QUESTIONS).map(([key, domain]) => {
                                        const prog = getDomainProgress(key);
                                        return (<button key={key} onClick={() => jumpToDomain(key)} className={`p-2 rounded-lg text-xs ${currentQ.domain === key ? 'bg-purple-100' : 'bg-gray-50'}`}>{domain.name.split(' ')[0]} ({prog.answered}/{prog.total})</button>);
                                    })}
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" style={{ width: `${progress}%` }} /></div>
                                <span className="text-sm font-medium text-purple-600">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            {currentQ.reverse && <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs mb-3"><AlertCircle className="w-3 h-3" />Reverse-scored</div>}
                            <h2 className="text-xl font-semibold text-[#0E2235] mb-6">{currentQ.text}</h2>
                            <div className="space-y-3 mb-8">
                                {RESPONSE_OPTIONS.map(opt => (
                                    <button key={opt.value} onClick={() => handleAnswer(currentQ.id, opt.value)} className={`w-full p-4 rounded-xl border-2 text-left ${answers[`q${currentQ.id}`] === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[`q${currentQ.id}`] === opt.value ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>{answers[`q${currentQ.id}`] === opt.value && <CheckCircle2 className="w-4 h-4 text-white" />}</div>
                                            <span className="font-medium">{opt.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between">
                                <button onClick={() => setCurrentQuestion(p => p - 1)} disabled={currentQuestion === 0} className="flex items-center gap-2 px-4 py-2 text-gray-600 disabled:opacity-50"><ArrowLeft className="w-4 h-4" />Previous</button>
                                {currentQuestion < ALL_QUESTIONS.length - 1 ? (
                                    <button onClick={() => setCurrentQuestion(p => p + 1)} disabled={!canProceed} className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50">Next<ArrowRight className="w-4 h-4" /></button>
                                ) : (
                                    <button onClick={handleSubmit} disabled={!allAnswered || isLoading} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg disabled:opacity-50">{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{isLoading ? 'Analyzing...' : 'Get Results'}</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'results' && scores && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">{analysis?.scoreInterpretation?.level || 'Your Recovery Capital'}</h2>
                            <p className="text-4xl font-bold text-purple-600 mb-2">{scores.percentage}%</p>
                            <p className="text-gray-600">{analysis?.scoreInterpretation?.description || `Score: ${scores.total}/${scores.maxScore}`}</p>
                            {savedAssessmentId && <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full"><CheckCircle2 className="w-4 h-4" />Saved</div>}
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Domain Scores</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(MIRC_QUESTIONS).map(([key, domain]) => {
                                    const ds = scores.domains[key as keyof typeof scores.domains];
                                    const Icon = domain.icon;
                                    return (
                                        <div key={key} className="border rounded-xl p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${domain.color}20` }}><Icon className="w-5 h-5" style={{ color: domain.color }} /></div>
                                                <div className="flex-1"><h4 className="font-semibold">{domain.name}</h4></div>
                                                <span className="text-2xl font-bold" style={{ color: domain.color }}>{ds.percentage}%</span>
                                            </div>
                                            <div className="h-3 bg-gray-200 rounded-full"><div className="h-full rounded-full" style={{ width: `${ds.percentage}%`, backgroundColor: domain.color }} /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {analysis && (
                            <div className="bg-white rounded-2xl p-8 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
                                    <h3 className="font-semibold text-[#0E2235]">AI Analysis</h3>
                                </div>
                                <p className="text-gray-700 text-lg mb-6">{analysis.overallSummary}</p>
                                
                                {analysis.domainInsights?.map((insight, idx) => {
                                    const domain = MIRC_QUESTIONS[insight.domain as keyof typeof MIRC_QUESTIONS];
                                    const Icon = domain?.icon || Target;
                                    return (
                                        <div key={idx} className="border rounded-xl p-5 mb-4">
                                            <div className="flex items-center gap-2 mb-3"><Icon className="w-5 h-5" style={{ color: domain?.color }} /><h4 className="font-semibold">{insight.domainName}</h4></div>
                                            <p className="text-gray-600 mb-4">{insight.summary}</p>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                {insight.strengths?.length > 0 && <div className="bg-green-50 rounded-lg p-3"><p className="text-sm font-medium text-green-800 mb-2">Strengths</p>{insight.strengths.map((s, i) => <p key={i} className="text-sm text-green-700">• {s}</p>)}</div>}
                                                {insight.growthAreas?.length > 0 && <div className="bg-amber-50 rounded-lg p-3"><p className="text-sm font-medium text-amber-800 mb-2">Growth Areas</p>{insight.growthAreas.map((g, i) => <p key={i} className="text-sm text-amber-700">• {g}</p>)}</div>}
                                            </div>
                                        </div>
                                    );
                                })}

                                {analysis.prioritizedGoals?.length > 0 && (
                                    <div className="mt-6">
                                        <h4 className="font-semibold text-[#0E2235] mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-purple-600" />Prioritized Goals</h4>
                                        {analysis.prioritizedGoals.map((goal, idx) => (
                                            <div key={idx} className="border rounded-xl p-5 mb-3">
                                                <h5 className="font-semibold mb-2">{goal.title}</h5>
                                                <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                                                <div className="bg-gray-50 rounded-lg p-3">
                                                    <p className="text-sm font-medium mb-2">Action Steps:</p>
                                                    {goal.actionSteps?.map((step, i) => <p key={i} className="text-sm text-gray-600">{i + 1}. {step}</p>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {analysis.encouragement && (
                                    <div className="mt-6 p-6 bg-purple-50 rounded-xl text-center">
                                        <Heart className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                                        <p className="text-gray-700">{analysis.encouragement}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button onClick={resetAssessment} className="flex-1 py-4 border border-gray-200 rounded-xl font-semibold flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5" />New Assessment</button>
                            <button onClick={() => router.push('/recovery-capital')} className="flex-1 py-4 bg-purple-600 text-white rounded-xl font-semibold">Back to Dashboard</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ComprehensiveAssessmentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
            </div>
        }>
            <ComprehensiveAssessmentContent />
        </Suspense>
    );
}
