'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    ArrowRight,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Loader2,
    Target,
    Heart,
    Home,
    Briefcase,
    GraduationCap,
    Users,
    Scale,
    Activity,
    Wallet,
    Car,
    Sparkles,
    CheckCircle,
    Download,
    Save,
    RefreshCw,
    Lightbulb,
    Shield,
    TrendingUp,
    Calendar,
    FileText,
    AlertCircle,
    Zap,
    HeartHandshake,
    ListChecks,
    Eye,
    BookOpen,
    Search
} from 'lucide-react';

const goalAreas = [
    { id: 'substance-use', label: 'Substance Use Recovery', icon: Heart, color: '#E74C3C' },
    { id: 'mental-health', label: 'Mental Health', icon: Activity, color: '#9B59B6' },
    { id: 'housing', label: 'Housing', icon: Home, color: '#3498DB' },
    { id: 'employment', label: 'Employment', icon: Briefcase, color: '#27AE60' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: '#F39C12' },
    { id: 'family', label: 'Family Relationships', icon: Users, color: '#E91E63' },
    { id: 'legal', label: 'Legal', icon: Scale, color: '#607D8B' },
    { id: 'physical-health', label: 'Physical Health', icon: Activity, color: '#00BCD4' },
    { id: 'life-skills', label: 'Life Skills', icon: Lightbulb, color: '#FF9800' },
    { id: 'social-support', label: 'Social Support', icon: Users, color: '#8E44AD' },
    { id: 'transportation', label: 'Transportation', icon: Car, color: '#34495E' },
    { id: 'financial', label: 'Financial Stability', icon: Wallet, color: '#16A085' },
];

const commonStrengths = [
    'Motivated to change', 'Strong family support', 'Good self-awareness', 'Resilient',
    'Willing to ask for help', 'Has past recovery experience', 'Committed to treatment',
    'Good communication skills', 'Creative problem solver', 'Spiritual foundation',
    'Employment history', 'Educational background', 'Supportive peer network',
    'Healthy coping skills', 'Open to feedback',
];

const commonChallenges = [
    'Cravings/urges', 'Transportation issues', 'Housing instability', 'Financial stress',
    'Legal problems', 'Family conflict', 'Lack of support system', 'Mental health symptoms',
    'Trauma history', 'Low self-esteem', 'Unhealthy relationships', 'Limited job skills',
    'Childcare needs', 'Health issues', 'Isolation',
];

interface GeneratedGoal {
    smartGoal: string;
    motivationStatement: string;
    phasedPlan: {
        preparation: { title: string; description: string; actions: string[] };
        action: { title: string; description: string; actions: string[] };
        followThrough: { title: string; description: string; actions: string[] };
        maintenance: { title: string; description: string; actions: string[] };
    };
    strengthsUsed: { strength: string; howItHelps: string }[];
    barriersAndCoping: { barrier: string; copingStrategy: string }[];
    peerSupportActivities: { activity: string; purpose: string }[];
    progressIndicators: { indicator: string; target: string }[];
    emotionalSupportPlan: {
        anticipatedEmotions: string[];
        copingStrategies: string[];
        peerSupportRole: string;
        selfCareReminders: string[];
    };
    backupPlan: {
        potentialSetbacks: string[];
        alternativeStrategies: string[];
        ifThingsGetHard: string;
        emergencyResources: string[];
    };
    domainSpecific: {
        category: string;
        sections: { title: string; items: string[] }[];
    };
    successVision: string;
}

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
}

function CollapsibleCard({ title, icon: Icon, color, defaultOpen = false, children }: { 
    title: string; icon: React.ElementType; color: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl shadow-sm border border-[#E7E9EC] overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <span className="font-semibold text-[#0E2235]">{title}</span>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {isOpen && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
        </div>
    );
}

export default function GoalGenerator() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    // Participant selection
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // Goal wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [participantName, setParticipantName] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [motivation, setMotivation] = useState(5);
    const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
    const [customStrength, setCustomStrength] = useState('');
    const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
    const [customChallenge, setCustomChallenge] = useState('');
    const [timeframe, setTimeframe] = useState('30');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedGoal, setGeneratedGoal] = useState<GeneratedGoal | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Check for participant_id in URL params
    useEffect(() => {
        const participantId = searchParams.get('participant_id');
        if (participantId && currentOrg?.id) {
            fetchParticipantById(participantId);
        }
    }, [searchParams, currentOrg?.id]);

    // Check for pre-filled prompt from query params
    useEffect(() => {
        const promptParam = searchParams.get('prompt');
        if (promptParam) {
            setDesiredOutcome(promptParam);
        }
    }, [searchParams]);

    // Auth check
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch participants for dropdown
    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            searchParticipants(participantSearch);
        }
    }, [participantSearch, currentOrg?.id]);

    const fetchParticipantById = async (id: string) => {
        try {
            const res = await fetch(`/api/participants/${id}?organization_id=${currentOrg.id}`);
            const data = await res.json();
            if (data.participant) {
                setSelectedParticipant(data.participant);
                const displayName = data.participant.preferred_name || data.participant.first_name;
                setParticipantName(`${displayName} ${data.participant.last_name}`);
            }
        } catch (error) {
            console.error('Error fetching participant:', error);
        }
    };

    const searchParticipants = async (query: string) => {
        setLoadingParticipants(true);
        try {
            const res = await fetch(`/api/participants?organization_id=${currentOrg.id}&search=${query}&status=active`);
            const data = await res.json();
            setParticipants(data.participants || []);
        } catch (error) {
            console.error('Error searching participants:', error);
        } finally {
            setLoadingParticipants(false);
        }
    };

    const selectParticipant = (participant: Participant) => {
        setSelectedParticipant(participant);
        const displayName = participant.preferred_name || participant.first_name;
        setParticipantName(`${displayName} ${participant.last_name}`);
        setParticipantSearch('');
        setShowParticipantDropdown(false);
    };

    const clearParticipant = () => {
        setSelectedParticipant(null);
        setParticipantName('');
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: return selectedArea !== null;
            case 2: return desiredOutcome.trim().length > 10;
            case 3: return selectedStrengths.length > 0;
            case 4: return selectedChallenges.length > 0;
            case 5: return true;
            default: return false;
        }
    };

    const toggleStrength = (s: string) => setSelectedStrengths(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    const toggleChallenge = (c: string) => setSelectedChallenges(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    const addCustomStrength = () => { if (customStrength.trim()) { setSelectedStrengths([...selectedStrengths, customStrength.trim()]); setCustomStrength(''); } };
    const addCustomChallenge = () => { if (customChallenge.trim()) { setSelectedChallenges([...selectedChallenges, customChallenge.trim()]); setCustomChallenge(''); } };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch('/api/generate-goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goalArea: goalAreas.find(a => a.id === selectedArea)?.label,
                    participantName: participantName || 'the participant',
                    desiredOutcome, motivation, strengths: selectedStrengths, challenges: selectedChallenges, timeframe,
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setGeneratedGoal(data.goal);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate goal. Please try again.');
        } finally { setIsGenerating(false); }
    };

    const generateGoalName = () => {
        if (participantName.trim()) return participantName.trim();
        const areaLabel = goalAreas.find(a => a.id === selectedArea)?.label || 'Recovery';
        const outcomeWords = desiredOutcome.trim().split(' ').slice(0, 5).join(' ');
        const shortOutcome = outcomeWords.length < desiredOutcome.length ? outcomeWords + '...' : outcomeWords;
        return `${areaLabel}: ${shortOutcome}`;
    };

    const handleSaveGoal = async () => {
        if (!generatedGoal || !currentOrg?.id) return;
        setIsSaving(true);
        try {
            const goalName = generateGoalName();
            const response = await fetch('/api/saved-goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: selectedParticipant?.id || null,
                    participant_name: goalName,
                    goal_area: selectedArea,
                    desired_outcome: desiredOutcome,
                    motivation_level: motivation,
                    strengths: selectedStrengths,
                    challenges: selectedChallenges,
                    timeframe,
                    smart_goal: generatedGoal.smartGoal,
                    goal_data: JSON.stringify(generatedGoal),
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) { 
            console.error('Error:', error); 
            alert('Failed to save goal.'); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleStartOver = () => {
        setCurrentStep(1); 
        setSelectedArea(null); 
        setParticipantName(''); 
        setDesiredOutcome('');
        setMotivation(5); 
        setSelectedStrengths([]); 
        setSelectedChallenges([]); 
        setTimeframe('30'); 
        setGeneratedGoal(null);
        // Keep participant selection
    };

    const getAreaColor = () => goalAreas.find(a => a.id === selectedArea)?.color || '#1A73A8';

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header */}
            <div className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <Link href="/dashboard" className="text-[#1A73A8] hover:underline">Dashboard</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Recovery Goal Generator</span>
                        </nav>
                        <div className="ml-auto">
                            <Link href="/goals" className="flex items-center gap-2 px-4 py-2 text-[#1A73A8] hover:bg-[#1A73A8]/5 rounded-lg">
                                <BookOpen className="w-4 h-4" />Goal Library
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-[#0E2235] mb-2">Recovery Goal Generator</h1>
                    <p className="text-gray-600">Create comprehensive, strength-based SMART goals for recovery</p>
                </div>

                {/* Participant Selection Card */}
                <div className="bg-white rounded-xl shadow-sm border border-[#E7E9EC] p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            {selectedParticipant ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Creating goal for</p>
                                        <p className="font-semibold text-[#0E2235]">
                                            {selectedParticipant.preferred_name || selectedParticipant.first_name} {selectedParticipant.last_name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={clearParticipant}
                                        className="text-sm text-gray-500 hover:text-red-500"
                                    >
                                        Change
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={participantSearch}
                                            onChange={(e) => {
                                                setParticipantSearch(e.target.value);
                                                setShowParticipantDropdown(true);
                                            }}
                                            onFocus={() => setShowParticipantDropdown(true)}
                                            placeholder="Search participants to link this goal (optional)..."
                                            className="flex-1 bg-transparent border-none outline-none text-sm"
                                        />
                                    </div>
                                    {showParticipantDropdown && participantSearch.length >= 2 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-10">
                                            {loadingParticipants ? (
                                                <div className="p-4 text-center">
                                                    <Loader2 className="w-5 h-5 animate-spin text-[#1A73A8] mx-auto" />
                                                </div>
                                            ) : participants.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500 text-sm">
                                                    No participants found
                                                </div>
                                            ) : (
                                                participants.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectParticipant(p)}
                                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-sm font-medium">
                                                            {p.first_name[0]}{p.last_name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-[#0E2235]">
                                                                {p.preferred_name || p.first_name} {p.last_name}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!generatedGoal ? (
                    <>
                        {/* Progress Bar */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">Step {currentStep} of 5</span>
                                <span className="text-sm text-gray-500">{Math.round((currentStep / 5) * 100)}% complete</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${(currentStep / 5) * 100}%`, background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }} 
                                />
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8 mb-6">
                            {currentStep === 1 && (
                                <div>
                                    <h2 className="text-xl font-semibold text-[#0E2235] mb-2">What area is this goal in?</h2>
                                    <p className="text-gray-600 mb-6">Select the primary focus area for this recovery goal.</p>
                                    
                                    {!selectedParticipant && (
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Goal Name (optional)</label>
                                            <input 
                                                type="text" 
                                                value={participantName} 
                                                onChange={(e) => setParticipantName(e.target.value)} 
                                                placeholder="e.g., Housing Plan, Recovery Goal" 
                                                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent" 
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate from goal details</p>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {goalAreas.map((area) => (
                                            <button 
                                                key={area.id} 
                                                onClick={() => setSelectedArea(area.id)} 
                                                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${selectedArea === area.id ? 'border-[#1A73A8] bg-[#1A73A8]/5' : 'border-gray-200 hover:border-gray-300'}`}
                                            >
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${area.color}20` }}>
                                                    <area.icon className="w-6 h-6" style={{ color: area.color }} />
                                                </div>
                                                <span className="text-sm font-medium text-center text-[#0E2235]">{area.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div>
                                    <h2 className="text-xl font-semibold text-[#0E2235] mb-2">
                                        What does {selectedParticipant ? (selectedParticipant.preferred_name || selectedParticipant.first_name) : participantName || 'the participant'} want to achieve?
                                    </h2>
                                    <p className="text-gray-600 mb-6">Describe the goal in their own words.</p>
                                    <textarea 
                                        value={desiredOutcome} 
                                        onChange={(e) => setDesiredOutcome(e.target.value)} 
                                        placeholder="Example: I want to reconnect with my kids..." 
                                        rows={4} 
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent resize-none text-lg" 
                                    />
                                    <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                                        <p className="text-sm text-blue-800">
                                            <strong>Tip:</strong> Use the participant's own words. We'll transform vague desires into specific, actionable goals.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div>
                                    <h2 className="text-xl font-semibold text-[#0E2235] mb-2">
                                        What strengths does {selectedParticipant ? (selectedParticipant.preferred_name || selectedParticipant.first_name) : participantName || 'the participant'} have?
                                    </h2>
                                    <p className="text-gray-600 mb-4">Select or add strengths to build upon.</p>
                                    <div className="border border-gray-200 rounded-xl p-4 mb-4 max-h-64 overflow-y-auto bg-gray-50">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {commonStrengths.map((s) => (
                                                <button 
                                                    key={s} 
                                                    onClick={() => toggleStrength(s)} 
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${selectedStrengths.includes(s) ? 'bg-[#30B27A] text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                                >
                                                    {selectedStrengths.includes(s) && <CheckCircle className="w-4 h-4 inline mr-1" />}{s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={customStrength} 
                                            onChange={(e) => setCustomStrength(e.target.value)} 
                                            onKeyPress={(e) => e.key === 'Enter' && addCustomStrength()} 
                                            placeholder="Add custom strength..." 
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent" 
                                        />
                                        <button onClick={addCustomStrength} className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]">Add</button>
                                    </div>
                                    {selectedStrengths.length > 0 && (
                                        <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                                            <p className="text-sm font-medium text-green-800 mb-2">Selected ({selectedStrengths.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedStrengths.map((s) => (
                                                    <span key={s} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div>
                                    <h2 className="text-xl font-semibold text-[#0E2235] mb-2">What challenges might get in the way?</h2>
                                    <p className="text-gray-600 mb-4">Identify potential barriers.</p>
                                    <div className="border border-gray-200 rounded-xl p-4 mb-4 max-h-64 overflow-y-auto bg-gray-50">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {commonChallenges.map((c) => (
                                                <button 
                                                    key={c} 
                                                    onClick={() => toggleChallenge(c)} 
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${selectedChallenges.includes(c) ? 'bg-[#E74C3C] text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                                >
                                                    {selectedChallenges.includes(c) && <CheckCircle className="w-4 h-4 inline mr-1" />}{c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={customChallenge} 
                                            onChange={(e) => setCustomChallenge(e.target.value)} 
                                            onKeyPress={(e) => e.key === 'Enter' && addCustomChallenge()} 
                                            placeholder="Add custom challenge..." 
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent" 
                                        />
                                        <button onClick={addCustomChallenge} className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]">Add</button>
                                    </div>
                                    {selectedChallenges.length > 0 && (
                                        <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                                            <p className="text-sm font-medium text-red-800 mb-2">Selected ({selectedChallenges.length}):</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedChallenges.map((c) => (
                                                    <span key={c} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div>
                                    <h2 className="text-xl font-semibold text-[#0E2235] mb-2">Final Details</h2>
                                    <p className="text-gray-600 mb-6">Set motivation level and timeframe.</p>
                                    <div className="space-y-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-4">How motivated? (1-10)</label>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-500">Not Ready</span>
                                                <input 
                                                    type="range" 
                                                    min="1" 
                                                    max="10" 
                                                    value={motivation} 
                                                    onChange={(e) => setMotivation(parseInt(e.target.value))} 
                                                    className="flex-1 accent-[#1A73A8]" 
                                                />
                                                <span className="text-sm text-gray-500">Very Ready</span>
                                            </div>
                                            <div className="text-center mt-2">
                                                <span className="text-3xl font-bold text-[#1A73A8]">{motivation}</span>
                                                <span className="text-gray-500">/ 10</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Goal Timeframe</label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {[{ v: '30', l: '30 Days' }, { v: '60', l: '60 Days' }, { v: '90', l: '90 Days' }, { v: '180', l: '6 Months' }].map((o) => (
                                                    <button 
                                                        key={o.v} 
                                                        onClick={() => setTimeframe(o.v)} 
                                                        className={`px-4 py-3 rounded-xl border-2 font-medium transition-colors ${timeframe === o.v ? 'border-[#1A73A8] bg-[#1A73A8]/5 text-[#1A73A8]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                                    >
                                                        {o.l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <button 
                                onClick={() => setCurrentStep(currentStep - 1)} 
                                disabled={currentStep === 1} 
                                className="px-6 py-3 flex items-center gap-2 text-gray-600 disabled:opacity-50"
                            >
                                <ArrowLeft className="w-5 h-5" />Back
                            </button>
                            {currentStep < 5 ? (
                                <button 
                                    onClick={() => setCurrentStep(currentStep + 1)} 
                                    disabled={!canProceed()} 
                                    className="px-8 py-3 flex items-center gap-2 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors" 
                                    style={{ background: canProceed() ? 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' : '#ccc' }}
                                >
                                    Continue<ArrowRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleGenerate} 
                                    disabled={isGenerating} 
                                    className="px-8 py-3 flex items-center gap-2 text-white font-semibold rounded-xl disabled:opacity-50" 
                                    style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" />Generating...</>
                                    ) : (
                                        <><Sparkles className="w-5 h-5" />Generate Recovery Plan</>
                                    )}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    /* Generated Goal Display */
                    <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            <button onClick={handleStartOver} className="px-5 py-2.5 flex items-center gap-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                                <RefreshCw className="w-4 h-4" />Start Over
                            </button>
                            <button 
                                onClick={handleSaveGoal} 
                                disabled={isSaving || saveSuccess} 
                                className="px-5 py-2.5 flex items-center gap-2 bg-[#30B27A] text-white rounded-lg disabled:opacity-50 hover:bg-[#28a06d]"
                            >
                                {saveSuccess ? (
                                    <><CheckCircle className="w-4 h-4" />Saved!</>
                                ) : isSaving ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                                ) : (
                                    <><Save className="w-4 h-4" />Save to Library</>
                                )}
                            </button>
                            <button onClick={() => window.print()} className="px-5 py-2.5 flex items-center gap-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]">
                                <Download className="w-4 h-4" />Print / PDF
                            </button>
                        </div>

                        {/* SMART Goal Card */}
                        <div className="bg-white rounded-2xl shadow-lg border-2 border-[#1A73A8]/20 p-6 mb-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${getAreaColor()} 0%, #30B27A 100%)` }}>
                                    <Target className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase">SMART Goal</span>
                                    <p className="text-xl font-semibold text-[#0E2235] mt-1">{generatedGoal.smartGoal}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                                <p className="text-purple-900 italic">"{generatedGoal.motivationStatement}"</p>
                            </div>
                            {generatedGoal.successVision && (
                                <div className="mt-4 p-4 bg-gradient-to-r from-[#1A73A8]/5 to-[#30B27A]/5 rounded-xl border border-[#1A73A8]/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Eye className="w-4 h-4 text-[#1A73A8]" />
                                        <span className="text-sm font-semibold text-[#0E2235]">Vision of Success</span>
                                    </div>
                                    <p className="text-gray-700">{generatedGoal.successVision}</p>
                                </div>
                            )}
                        </div>

                        {/* Collapsible Sections */}
                        <CollapsibleCard title="Phased Action Plan" icon={Calendar} color="#1A73A8" defaultOpen={true}>
                            <div className="pt-4 space-y-4">
                                {generatedGoal.phasedPlan && Object.entries(generatedGoal.phasedPlan).map(([phase, data]) => (
                                    <div key={phase} className="p-4 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-2 h-2 rounded-full ${phase === 'preparation' ? 'bg-blue-500' : phase === 'action' ? 'bg-green-500' : phase === 'followThrough' ? 'bg-yellow-500' : 'bg-purple-500'}`} />
                                            <h4 className="font-semibold text-[#0E2235]">{data.title}</h4>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-3">{data.description}</p>
                                        <ul className="space-y-2">
                                            {data.actions.map((a, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-[#30B27A] mt-0.5 flex-shrink-0" />
                                                    <span className="text-sm text-gray-700">{a}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleCard>

                        {generatedGoal.domainSpecific?.sections && (
                            <CollapsibleCard title={`${goalAreas.find(a => a.id === selectedArea)?.label || 'Goal'} Planning Details`} icon={ListChecks} color={getAreaColor()} defaultOpen={true}>
                                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {generatedGoal.domainSpecific.sections.map((section, i) => (
                                        <div key={i} className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                                <FileText className="w-4 h-4" style={{ color: getAreaColor() }} />
                                                {section.title}
                                            </h4>
                                            <ul className="space-y-2">
                                                {section.items.map((item, j) => (
                                                    <li key={j} className="flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: getAreaColor() }} />
                                                        <span className="text-sm text-gray-700">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        <CollapsibleCard title="Strengths to Build On" icon={Sparkles} color="#F59E0B">
                            <div className="pt-4 space-y-3">
                                {generatedGoal.strengthsUsed.map((item, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                                        <Sparkles className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="font-medium text-yellow-800">{item.strength}</span>
                                            <p className="text-sm text-yellow-700 mt-1">{item.howItHelps}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleCard>

                        <CollapsibleCard title="Barriers & Coping Strategies" icon={Shield} color="#EF4444">
                            <div className="pt-4 space-y-3">
                                {generatedGoal.barriersAndCoping.map((item, i) => (
                                    <div key={i} className="p-3 bg-red-50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-4 h-4 text-red-600" />
                                            <span className="font-medium text-red-800">{item.barrier}</span>
                                        </div>
                                        <div className="flex items-start gap-2 ml-6">
                                            <ArrowRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">{item.copingStrategy}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleCard>

                        <CollapsibleCard title="Peer Support Activities" icon={HeartHandshake} color="#8B5CF6">
                            <div className="pt-4 space-y-3">
                                {generatedGoal.peerSupportActivities.map((item, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                                        <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="font-medium text-purple-800">{item.activity}</span>
                                            <p className="text-sm text-purple-700 mt-1">{item.purpose}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleCard>

                        <CollapsibleCard title="Progress Indicators" icon={TrendingUp} color="#10B981">
                            <div className="pt-4 space-y-3">
                                {generatedGoal.progressIndicators.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                            <span className="font-medium text-green-800">{item.indicator}</span>
                                        </div>
                                        <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full">{item.target}</span>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleCard>

                        <CollapsibleCard title="Emotional Support Plan" icon={Heart} color="#EC4899">
                            <div className="pt-4 space-y-4">
                                {generatedGoal.emotionalSupportPlan && (
                                    <>
                                        <div className="p-4 bg-pink-50 rounded-lg">
                                            <h4 className="font-semibold text-pink-800 mb-2">Anticipated Emotions</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {generatedGoal.emotionalSupportPlan.anticipatedEmotions?.map((e, i) => (
                                                    <span key={i} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">{e}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-pink-50 rounded-lg">
                                            <h4 className="font-semibold text-pink-800 mb-2">Coping Strategies</h4>
                                            <ul className="space-y-2">
                                                {generatedGoal.emotionalSupportPlan.copingStrategies?.map((s, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <CheckCircle className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700">{s}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-pink-50 rounded-lg">
                                            <h4 className="font-semibold text-pink-800 mb-2">Peer Support Role</h4>
                                            <p className="text-sm text-gray-700">{generatedGoal.emotionalSupportPlan.peerSupportRole}</p>
                                        </div>
                                        <div className="p-4 bg-pink-50 rounded-lg">
                                            <h4 className="font-semibold text-pink-800 mb-2">Self-Care Reminders</h4>
                                            <ul className="space-y-2">
                                                {generatedGoal.emotionalSupportPlan.selfCareReminders?.map((r, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Heart className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700">{r}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CollapsibleCard>

                        <CollapsibleCard title="Backup Plan & Contingencies" icon={Shield} color="#6B7280">
                            <div className="pt-4 space-y-4">
                                {generatedGoal.backupPlan && (
                                    <>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <h4 className="font-semibold text-gray-800 mb-2">Potential Setbacks</h4>
                                            <ul className="space-y-2">
                                                {generatedGoal.backupPlan.potentialSetbacks?.map((s, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700">{s}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <h4 className="font-semibold text-gray-800 mb-2">Alternative Strategies</h4>
                                            <ul className="space-y-2">
                                                {generatedGoal.backupPlan.alternativeStrategies?.map((s, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700">{s}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                            <h4 className="font-semibold text-blue-800 mb-2">If Things Get Hard...</h4>
                                            <p className="text-sm text-blue-700 italic">{generatedGoal.backupPlan.ifThingsGetHard}</p>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <h4 className="font-semibold text-gray-800 mb-2">Emergency Resources</h4>
                                            <ul className="space-y-2">
                                                {generatedGoal.backupPlan.emergencyResources?.map((r, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Zap className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                                        <span className="text-sm text-gray-700">{r}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CollapsibleCard>
                    </div>
                )}
            </main>

            <style jsx global>{`
                @media print { 
                    header, button, .no-print { display: none !important; } 
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } 
                }
            `}</style>
        </div>
    );
}
