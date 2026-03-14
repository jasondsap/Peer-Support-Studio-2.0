// app/components/AssessmentDetailModal.tsx
// Modal component for viewing completed recovery assessment details

'use client';

import { useState, useEffect } from 'react';
import {
    X, Users, Home, Brain, Heart, Download, Trash2,
    Sparkles, Loader2, Target, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';

// ============================================================================
// Question Definitions — used to map stored responses back to display
// ============================================================================

const BARC10_QUESTIONS = [
    { id: 1, text: "There are more important things to me in life than using substances.", domain: "human", shortLabel: "Purpose & Meaning", reverse: false },
    { id: 2, text: "In general I am happy with my life.", domain: "human", shortLabel: "Life Satisfaction", reverse: false },
    { id: 3, text: "I have enough energy to complete the tasks I set myself.", domain: "human", shortLabel: "Energy & Vitality", reverse: false },
    { id: 4, text: "I am proud of the community I live in and feel part of it.", domain: "social", shortLabel: "Community Connection", reverse: false },
    { id: 5, text: "I get lots of support from friends.", domain: "social", shortLabel: "Friend Support", reverse: false },
    { id: 6, text: "I regard my life as challenging and fulfilling without the need for using drugs or alcohol.", domain: "human", shortLabel: "Fulfillment in Recovery", reverse: false },
    { id: 7, text: "My living space has helped to drive my recovery journey.", domain: "physical", shortLabel: "Supportive Environment", reverse: false },
    { id: 8, text: "I take full responsibility for my actions.", domain: "human", shortLabel: "Personal Responsibility", reverse: false },
    { id: 9, text: "I am happy dealing with a range of professional people.", domain: "cultural", shortLabel: "Professional Engagement", reverse: false },
    { id: 10, text: "I am making good progress on my recovery journey.", domain: "cultural", shortLabel: "Recovery Progress", reverse: false }
];

const MIRC28_QUESTIONS = [
    // Social Capital (items 1-7)
    { id: 1, text: "I actively support other people who are in recovery.", domain: "social", shortLabel: "Peer Support", reverse: false },
    { id: 2, text: "My family makes my recovery more difficult.", domain: "social", shortLabel: "Family Barriers", reverse: true },
    { id: 3, text: "I have at least one friend who supports my recovery.", domain: "social", shortLabel: "Friend Support", reverse: false },
    { id: 4, text: "My family supports my recovery.", domain: "social", shortLabel: "Family Support", reverse: false },
    { id: 5, text: "Some people in my life do not think I'll make it in my recovery.", domain: "social", shortLabel: "Negative Beliefs", reverse: true },
    { id: 6, text: "I feel alone.", domain: "social", shortLabel: "Loneliness", reverse: true },
    { id: 7, text: "I feel like I'm part of a recovery community.", domain: "social", shortLabel: "Community Belonging", reverse: false },
    // Physical Capital (items 8-14)
    { id: 8, text: "My housing situation is helpful for my recovery.", domain: "physical", shortLabel: "Housing Support", reverse: false },
    { id: 9, text: "I have difficulty getting transportation.", domain: "physical", shortLabel: "Transportation Barriers", reverse: true },
    { id: 10, text: "My housing situation is unstable.", domain: "physical", shortLabel: "Housing Instability", reverse: true },
    { id: 11, text: "I have enough money every week to buy the basic things I need.", domain: "physical", shortLabel: "Basic Needs", reverse: false },
    { id: 12, text: "Not having enough money makes my recovery more difficult.", domain: "physical", shortLabel: "Financial Barriers", reverse: true },
    { id: 13, text: "I can afford the care I need for my health, mental health, and recovery.", domain: "physical", shortLabel: "Affordable Care", reverse: false },
    { id: 14, text: "I have reliable access to a phone and the internet.", domain: "physical", shortLabel: "Connectivity", reverse: false },
    // Human Capital (items 15-21)
    { id: 15, text: "I find it hard to have fun.", domain: "human", shortLabel: "Enjoyment Barriers", reverse: true },
    { id: 16, text: "I feel physically healthy most days.", domain: "human", shortLabel: "Physical Health", reverse: false },
    { id: 17, text: "I am struggling with guilt or shame.", domain: "human", shortLabel: "Guilt & Shame", reverse: true },
    { id: 18, text: "I am experiencing a lot of stress.", domain: "human", shortLabel: "Stress Level", reverse: true },
    { id: 19, text: "My education and training have prepared me to handle life's challenges.", domain: "human", shortLabel: "Preparedness", reverse: false },
    { id: 20, text: "I have problems with my mental health.", domain: "human", shortLabel: "Mental Health", reverse: true },
    { id: 21, text: "I feel my life has purpose and meaning.", domain: "human", shortLabel: "Purpose & Meaning", reverse: false },
    // Cultural Capital (items 22-28)
    { id: 22, text: "It's hard for me to trust others.", domain: "cultural", shortLabel: "Trust Barriers", reverse: true },
    { id: 23, text: "I have opportunities to participate in fun activities that do not involve drugs and alcohol.", domain: "cultural", shortLabel: "Sober Activities", reverse: false },
    { id: 24, text: "I feel disconnected from my culture or not part of any culture.", domain: "cultural", shortLabel: "Cultural Disconnection", reverse: true },
    { id: 25, text: "I feel like an outcast.", domain: "cultural", shortLabel: "Social Exclusion", reverse: true },
    { id: 26, text: "There are helpful services and resources accessible to me.", domain: "cultural", shortLabel: "Resource Access", reverse: false },
    { id: 27, text: "It's hard to let go of the part of my identity that was linked to my drinking or drug use.", domain: "cultural", shortLabel: "Identity Attachment", reverse: true },
    { id: 28, text: "My neighborhood or town feels safe.", domain: "cultural", shortLabel: "Neighborhood Safety", reverse: false },
];

// ============================================================================
// Domain info and response labels
// ============================================================================

const DOMAIN_INFO = {
    social: { name: "Social Capital", icon: Users, color: "#8B5CF6" },
    physical: { name: "Physical Capital", icon: Home, color: "#F59E0B" },
    human: { name: "Human Capital", icon: Brain, color: "#3B82F6" },
    cultural: { name: "Cultural Capital", icon: Heart, color: "#EC4899" }
};

const BARC10_LABELS: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Somewhat Disagree",
    4: "Somewhat Agree",
    5: "Agree",
    6: "Strongly Agree"
};

const MIRC28_LABELS: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Agree",
    4: "Strongly Agree"
};

// ============================================================================
// Types
// ============================================================================

interface Assessment {
    id: string;
    participant_name?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    assessment_type: string;
    total_score: number;
    domain_scores?: any;
    responses?: any;
    ai_analysis?: any;
    notes?: string;
    created_at: string;
}

interface Props {
    assessment: Assessment;
    onClose: () => void;
    onDelete?: (id: string) => void;
    onAnalyze?: (id: string) => Promise<any>;
}

// ============================================================================
// Component
// ============================================================================

export default function AssessmentDetailModal({ assessment, onClose, onDelete, onAnalyze }: Props) {
    const [activeTab, setActiveTab] = useState<'overview' | 'answers' | 'analysis' | 'goals'>('overview');
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]);
    const [notes, setNotes] = useState(assessment.notes || '');
    const [savingNotes, setSavingNotes] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(assessment.ai_analysis);
    const [sourcesOpen, setSourcesOpen] = useState(false);

    const isMirc = assessment.assessment_type === 'mirc28';
    const maxScore = isMirc ? 112 : 60;
    const percentage = Math.round((assessment.total_score / maxScore) * 100);
    const questions = isMirc ? MIRC28_QUESTIONS : BARC10_QUESTIONS;
    const responseLabels = isMirc ? MIRC28_LABELS : BARC10_LABELS;
    const maxLikert = isMirc ? 4 : 6;

    const participantName = assessment.participant_name
        || (assessment.participant_first_name
            ? `${assessment.participant_first_name} ${assessment.participant_last_name || ''}`.trim()
            : 'Self-Assessment');

    const toggleDomain = (domain: string) => {
        setExpandedDomains(prev =>
            prev.includes(domain)
                ? prev.filter(d => d !== domain)
                : [...prev, domain]
        );
    };

    // ========================================================================
    // Map stored responses { "q1": 5, "q2": 3 } back to question definitions
    // ========================================================================
    const getAnswersByDomain = () => {
        const responses = assessment.responses || {};
        const byDomain: Record<string, any[]> = {
            social: [], physical: [], human: [], cultural: []
        };

        questions.forEach((q) => {
            const key = `q${q.id}`;
            const rawValue = responses[key];
            if (rawValue !== undefined && rawValue !== null) {
                byDomain[q.domain]?.push({
                    id: q.id,
                    text: q.text,
                    shortLabel: q.shortLabel,
                    answer: rawValue,
                    domain: q.domain,
                    reverse: q.reverse || false,
                });
            }
        });

        return byDomain;
    };

    const answersByDomain = getAnswersByDomain();

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleSaveNotes = async () => {
        setSavingNotes(true);
        try {
            await fetch(`/api/recovery-assessments/${assessment.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes })
            });
        } catch (e) {
            console.error('Failed to save notes:', e);
        } finally {
            setSavingNotes(false);
        }
    };

    const handleAnalyze = async () => {
        if (!onAnalyze) return;
        setAnalyzing(true);
        try {
            const result = await onAnalyze(assessment.id);
            if (result) {
                setAnalysis(result);
            }
        } catch (e) {
            console.error('Analysis failed:', e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDownloadPDF = async () => {
        const { generateRecoveryCapitalPDF } = await import('../lib/generateRecoveryCapitalPDF');

        const domainScores = assessment.domain_scores || {};

        generateRecoveryCapitalPDF({
            participantName,
            assessmentType: assessment.assessment_type as 'barc10' | 'mirc28',
            assessmentDate: new Date(assessment.created_at).toLocaleDateString(),
            totalScore: assessment.total_score,
            maxScore,
            percentage,
            interpretation: getInterpretation(percentage),
            domains: [
                { name: 'Social', percentage: domainScores.social?.percentage || domainScores.social || 0, color: '#8B5CF6' },
                { name: 'Physical', percentage: domainScores.physical?.percentage || domainScores.physical || 0, color: '#F59E0B' },
                { name: 'Human', percentage: domainScores.human?.percentage || domainScores.human || 0, color: '#3B82F6' },
                { name: 'Cultural', percentage: domainScores.cultural?.percentage || domainScores.cultural || 0, color: '#EC4899' },
            ],
            analysis: analysis || getDefaultAnalysis()
        });
    };

    const getInterpretation = (pct: number) => {
        if (pct >= 78) return { level: 'Strong Foundation', description: 'Excellent recovery capital supporting sustained recovery.' };
        if (pct >= 58) return { level: 'Building Momentum', description: 'Good progress with opportunities for continued growth.' };
        if (pct >= 42) return { level: 'Growing Roots', description: 'Developing recovery resources in key areas.' };
        return { level: 'Early Foundation', description: 'Beginning to build essential recovery supports.' };
    };

    const getDefaultAnalysis = () => ({
        overallSummary: 'Analysis not yet generated. Click "Analyze" to generate AI insights.',
        strengthsHighlight: { title: 'Strengths', items: ['Run AI analysis to identify strengths'] },
        growthOpportunities: { title: 'Growth Areas', items: ['Run AI analysis to identify opportunities'] },
        recommendedGoals: [],
        weeklyChallenge: { title: 'Weekly Challenge', description: 'Run AI analysis for personalized challenge', domain: 'human' },
        encouragement: 'Every step forward matters on your recovery journey.'
    });

    const getScoreBadgeColor = (pct: number) => {
        if (pct >= 78) return 'bg-green-100 text-green-700';
        if (pct >= 58) return 'bg-amber-100 text-amber-700';
        if (pct >= 42) return 'bg-orange-100 text-orange-700';
        return 'bg-red-100 text-red-700';
    };

    // For answer display: color based on whether the response is positive
    const getAnswerColor = (value: number, reverse: boolean) => {
        const effectiveValue = reverse ? (maxLikert + 1 - value) : value;
        const midpoint = (maxLikert + 1) / 2;
        if (effectiveValue >= midpoint + 1) return { bar: 'bg-green-500', text: 'text-green-600' };
        if (effectiveValue >= midpoint) return { bar: 'bg-yellow-500', text: 'text-yellow-600' };
        return { bar: 'bg-red-500', text: 'text-red-600' };
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-[#0E2235]">{participantName}</h2>
                        <p className="text-sm text-gray-500">
                            {new Date(assessment.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            })}
                            <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs font-medium uppercase">
                                {isMirc ? 'MIRC-28' : 'BARC-10'}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4 border-b border-gray-100 flex-shrink-0">
                    {(['overview', 'answers', 'analysis', 'goals'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                activeTab === tab
                                    ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* ============================================================ */}
                    {/* Overview Tab */}
                    {/* ============================================================ */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Score Circle */}
                            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-white rounded-xl">
                                <p className="text-sm text-gray-500 mb-1">Overall Score</p>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-5xl font-bold text-gray-900">
                                        {assessment.total_score}
                                    </span>
                                    <span className="text-2xl text-gray-400">/{maxScore}</span>
                                </div>
                                <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getScoreBadgeColor(percentage)}`}>
                                    {percentage}%
                                </div>
                            </div>

                            {/* Domain Breakdown */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-900">Domain Breakdown</h3>
                                {Object.entries(DOMAIN_INFO).map(([key, domain]) => {
                                    const domainScore = assessment.domain_scores?.[key];
                                    const domainPct = typeof domainScore === 'object'
                                        ? domainScore?.percentage
                                        : domainScore || 0;
                                    const Icon = domain.icon;

                                    return (
                                        <div key={key} className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: `${domain.color}20` }}
                                            >
                                                <Icon className="w-4 h-4" style={{ color: domain.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium">{domain.name}</span>
                                                    <span className="text-sm font-semibold">{domainPct}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{ width: `${domainPct}%`, backgroundColor: domain.color }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-gray-900">Your Notes</h3>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes about this assessment..."
                                    className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    rows={3}
                                />
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={savingNotes}
                                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                                >
                                    {savingNotes ? 'Saving...' : 'Save Notes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* Answers Tab — maps stored { q1: 5 } to question definitions */}
                    {/* ============================================================ */}
                    {activeTab === 'answers' && (
                        <div className="space-y-4">
                            {Object.entries(DOMAIN_INFO).map(([domainKey, domain]) => {
                                const domainAnswers = answersByDomain[domainKey] || [];
                                const isExpanded = expandedDomains.includes(domainKey);
                                const Icon = domain.icon;

                                return (
                                    <div key={domainKey} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => toggleDomain(domainKey)}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                                <span className="font-medium">{domain.name}</span>
                                                <span className="text-sm text-gray-500">({domainAnswers.length} questions)</span>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                        </button>
                                        {isExpanded && domainAnswers.length > 0 && (
                                            <div className="divide-y divide-gray-100">
                                                {domainAnswers.map((answer: any) => {
                                                    const colors = getAnswerColor(answer.answer, answer.reverse);
                                                    return (
                                                        <div key={answer.id} className="p-4">
                                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                                <p className="text-sm text-gray-700 flex-1">
                                                                    <span className="font-medium text-gray-500">Q{answer.id}:</span>{' '}
                                                                    {answer.text}
                                                                </p>
                                                                {answer.reverse && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">
                                                                        Reverse
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${colors.bar}`}
                                                                        style={{ width: `${(answer.answer / maxLikert) * 100}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-sm font-medium min-w-[130px] text-right ${colors.text}`}>
                                                                    {responseLabels[answer.answer] || `${answer.answer}/${maxLikert}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {isExpanded && domainAnswers.length === 0 && (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                No responses recorded for this domain
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* Analysis Tab */}
                    {/* ============================================================ */}
                    {activeTab === 'analysis' && (
                        <div className="space-y-6">
                            {analysis ? (
                                <>
                                    <div className="bg-purple-50 rounded-xl p-4">
                                        <h3 className="font-semibold text-purple-900 mb-2">Overall Summary</h3>
                                        <p className="text-gray-700">{analysis.overallSummary}</p>
                                    </div>

                                    {analysis.strengthsHighlight && (
                                        <div className="bg-green-50 rounded-xl p-4">
                                            <h3 className="font-semibold text-green-900 mb-2">{analysis.strengthsHighlight.title}</h3>
                                            <ul className="space-y-1">
                                                {analysis.strengthsHighlight.items?.map((item: string, i: number) => (
                                                    <li key={i} className="text-gray-700 flex items-start gap-2">
                                                        <span className="text-green-500 mt-1">✓</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {analysis.growthOpportunities && (
                                        <div className="bg-amber-50 rounded-xl p-4">
                                            <h3 className="font-semibold text-amber-900 mb-2">{analysis.growthOpportunities.title}</h3>
                                            <ul className="space-y-1">
                                                {analysis.growthOpportunities.items?.map((item: string, i: number) => (
                                                    <li key={i} className="text-gray-700 flex items-start gap-2">
                                                        <span className="text-amber-500 mt-1">→</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {analysis.weeklyChallenge && (
                                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-white">
                                            <h3 className="font-semibold mb-2">{analysis.weeklyChallenge.title}</h3>
                                            <p>{analysis.weeklyChallenge.description}</p>
                                        </div>
                                    )}

                                    {/* Evidence Sources */}
                                    {analysis.sourcesCited && analysis.sourcesCited.length > 0 && (
                                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setSourcesOpen(!sourcesOpen)}
                                                className="flex items-center gap-2 w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                                <ShieldCheck className="w-4 h-4 text-green-500" />
                                                <span className="text-sm font-semibold text-gray-800">
                                                    Evidence Sources ({analysis.sourcesCited.length})
                                                </span>
                                                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {sourcesOpen && (
                                                <div className="px-4 py-3 bg-white">
                                                    <p className="text-xs text-gray-500 mb-2">
                                                        This analysis was built using the following authoritative sources.
                                                    </p>
                                                    <ul className="space-y-1.5">
                                                        {analysis.sourcesCited.map((source: any, idx: number) => (
                                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                                <span className="text-green-500 font-bold mt-0.5">✓</span>
                                                                <span className="text-gray-700">
                                                                    <span className="font-medium">{source.doc}, {source.section}</span>
                                                                    {source.pages && <span className="text-gray-500"> — pp. {source.pages}</span>}
                                                                    {source.usage && <span className="text-gray-500"> — {source.usage}</span>}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Yet</h3>
                                    <p className="text-gray-500 mb-4">Generate AI-powered insights for this assessment</p>
                                    {onAnalyze && (
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={analyzing}
                                            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                                        >
                                            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            {analyzing ? 'Analyzing...' : 'Generate Analysis'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* Goals Tab */}
                    {/* ============================================================ */}
                    {activeTab === 'goals' && (
                        <div className="space-y-4">
                            {analysis?.recommendedGoals && analysis.recommendedGoals.length > 0 ? (
                                analysis.recommendedGoals.map((goal: any, index: number) => (
                                    <div key={index} className="border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                                <span className="text-purple-600 font-bold">{index + 1}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{goal.title || goal.goal}</h4>
                                                <span className="text-xs text-purple-600 uppercase">{goal.domain}</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-3">{goal.description || goal.rationale}</p>
                                        {goal.actionSteps && (
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-xs font-medium text-gray-500 mb-2">Action Steps:</p>
                                                <ul className="space-y-1">
                                                    {goal.actionSteps.map((step: string, i: number) => (
                                                        <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                                            {step}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Goals Generated</h3>
                                    <p className="text-gray-500 mb-4">Run AI analysis first to generate suggested goals</p>
                                    <button
                                        onClick={() => {
                                            setActiveTab('analysis');
                                            if (!analysis && onAnalyze) handleAnalyze();
                                        }}
                                        className="text-purple-600 font-medium hover:underline"
                                    >
                                        {!analysis ? 'Generate Analysis & Goals →' : 'Go to Analysis →'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-between items-center flex-shrink-0 bg-gray-50">
                    {onDelete && (
                        <button
                            onClick={() => onDelete(assessment.id)}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        {!analysis && onAnalyze && (
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors disabled:opacity-50"
                            >
                                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Analyze
                            </button>
                        )}
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
