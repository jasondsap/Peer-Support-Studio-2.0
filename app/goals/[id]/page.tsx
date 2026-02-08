// app/goals/[id]/page.tsx
// Goal Detail Page - View, Edit, and Manage a Saved Goal
// Supports both AI-generated goals (full plan view) and quick goals (simple view)

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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
    Clock,
    Edit3,
    X,
    Trash2,
    BarChart3,
    PenLine,
} from 'lucide-react';

// ─── Shared Constants ─────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedGoal {
    id: string;
    organization_id: string;
    participant_id?: string;
    participant_name: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    goal_area: string;
    desired_outcome: string;
    smart_goal: string;
    timeframe: string;
    status: string;
    progress: number;
    goal_data: string | null;
    created_at: string;
    updated_at?: string;
}

interface GeneratedGoalData {
    type?: string; // 'quick-goal' for quick goals
    description?: string;
    smartGoal?: string;
    motivationStatement?: string;
    phasedPlan?: {
        preparation: { title: string; description: string; actions: string[] };
        action: { title: string; description: string; actions: string[] };
        followThrough: { title: string; description: string; actions: string[] };
        maintenance: { title: string; description: string; actions: string[] };
    };
    strengthsUsed?: { strength: string; howItHelps: string }[];
    barriersAndCoping?: { barrier: string; copingStrategy: string }[];
    peerSupportActivities?: { activity: string; purpose: string }[];
    progressIndicators?: { indicator: string; target: string }[];
    emotionalSupportPlan?: {
        anticipatedEmotions: string[];
        copingStrategies: string[];
        peerSupportRole: string;
        selfCareReminders: string[];
    };
    backupPlan?: {
        potentialSetbacks: string[];
        alternativeStrategies: string[];
        ifThingsGetHard: string;
        emergencyResources: string[];
    };
    domainSpecific?: {
        category: string;
        sections: { title: string; items: string[] }[];
    };
    successVision?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getAreaInfo(areaId: string) {
    return goalAreas.find(a => a.id === areaId) || { id: areaId, label: areaId, icon: Target, color: '#1A73A8' };
}

function getStatusConfig(status: string) {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
        active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
        completed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' },
        paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' },
        abandoned: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Abandoned' },
    };
    return configs[status] || configs.active;
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
    });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
    const router = useRouter();
    const params = useParams();
    const goalId = params.id as string;
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [goal, setGoal] = useState<SavedGoal | null>(null);
    const [goalData, setGoalData] = useState<GeneratedGoalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editSmartGoal, setEditSmartGoal] = useState('');
    const [editStatus, setEditStatus] = useState('active');
    const [editProgress, setEditProgress] = useState(0);
    const [editTimeframe, setEditTimeframe] = useState('30');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Auth check
    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/auth/signin');
    }, [authStatus, router]);

    // Fetch goal
    useEffect(() => {
        if (currentOrg?.id && goalId) fetchGoal();
    }, [currentOrg?.id, goalId]);

    const fetchGoal = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/saved-goals?id=${goalId}&organization_id=${currentOrg.id}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // The API might return goals array or single goal
            const goalRecord = data.goal || (data.goals && data.goals.find((g: any) => g.id === goalId));
            if (!goalRecord) throw new Error('Goal not found');

            setGoal(goalRecord);

            // Parse goal_data
            if (goalRecord.goal_data) {
                try {
                    const parsed = typeof goalRecord.goal_data === 'string'
                        ? JSON.parse(goalRecord.goal_data)
                        : goalRecord.goal_data;
                    setGoalData(parsed);
                } catch {
                    setGoalData(null);
                }
            }

            // Initialize edit fields
            setEditSmartGoal(goalRecord.smart_goal || '');
            setEditStatus(goalRecord.status || 'active');
            setEditProgress(goalRecord.progress || 0);
            setEditTimeframe(goalRecord.timeframe || '30');
        } catch (err) {
            console.error('Error fetching goal:', err);
            setError(err instanceof Error ? err.message : 'Failed to load goal');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!goal || !currentOrg?.id) return;
        setIsSaving(true);
        try {
            // Update smart_goal in goal_data too if it's an AI goal
            let updatedGoalData = goalData;
            if (goalData && goalData.smartGoal) {
                updatedGoalData = { ...goalData, smartGoal: editSmartGoal };
            } else if (goalData?.type === 'quick-goal') {
                updatedGoalData = { ...goalData, description: editSmartGoal };
            }

            const response = await fetch('/api/saved-goals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: goal.id,
                    organization_id: currentOrg.id,
                    status: editStatus,
                    progress: editProgress,
                    smart_goal: editSmartGoal,
                    timeframe: editTimeframe,
                    goal_data: updatedGoalData ? JSON.stringify(updatedGoalData) : null,
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Refresh goal
            await fetchGoal();
            setIsEditing(false);
            setSaveMessage('Goal updated successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            console.error('Error saving goal:', err);
            alert('Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!goal || !currentOrg?.id) return;
        try {
            const res = await fetch(`/api/saved-goals?id=${goal.id}&organization_id=${currentOrg.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            router.push('/goals');
        } catch (err) {
            console.error('Error deleting goal:', err);
            alert('Failed to delete goal.');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!goal || !currentOrg?.id) return;
        try {
            const response = await fetch('/api/saved-goals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: goal.id,
                    organization_id: currentOrg.id,
                    status: newStatus,
                    progress: newStatus === 'completed' ? 100 : goal.progress,
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            await fetchGoal();
            setSaveMessage(`Status updated to ${newStatus}`);
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const isQuickGoal = goalData?.type === 'quick-goal';
    const isAIGoal = goalData && !isQuickGoal && goalData.smartGoal;
    const areaInfo = goal ? getAreaInfo(goal.goal_area) : getAreaInfo('');
    const AreaIcon = areaInfo.icon;

    const participantDisplay = goal ? (
        goal.participant_first_name
            ? `${goal.participant_preferred_name || goal.participant_first_name} ${goal.participant_last_name}`
            : goal.participant_name
    ) : '';

    // ─── Loading / Error States ───────────────────────────────────────────────

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (error || !goal) {
        return (
            <div className="min-h-screen bg-[#F8FAFB]">
                <div className="bg-white border-b border-[#E7E9EC]">
                    <div className="max-w-5xl mx-auto px-6 py-4">
                        <button onClick={() => router.push('/goals')} className="flex items-center gap-2 text-[#1A73A8] hover:underline">
                            <ArrowLeft className="w-4 h-4" />Back to Goal Library
                        </button>
                    </div>
                </div>
                <div className="max-w-4xl mx-auto px-6 py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-[#0E2235] mb-2">Goal Not Found</h2>
                    <p className="text-gray-500 mb-6">{error || 'This goal may have been deleted or you may not have access.'}</p>
                    <Link href="/goals" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]">
                        <ArrowLeft className="w-4 h-4" />Go to Goal Library
                    </Link>
                </div>
            </div>
        );
    }

    const statusConfig = getStatusConfig(goal.status);

    // ─── Main Render ──────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header */}
            <div className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/goals')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <Link href="/" className="text-[#1A73A8] hover:underline">Dashboard</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <Link href="/goals" className="text-[#1A73A8] hover:underline">Goals</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium truncate max-w-xs">{participantDisplay}</span>
                        </nav>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Success Message */}
                {saveMessage && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-800">{saveMessage}</span>
                    </div>
                )}

                {/* Goal Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${areaInfo.color} 0%, #30B27A 100%)` }}>
                                <AreaIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-2xl font-bold text-[#0E2235]">{participantDisplay}</h1>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                        {statusConfig.label}
                                    </span>
                                    {isQuickGoal && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-200">
                                            Quick Goal
                                        </span>
                                    )}
                                    {isAIGoal && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                                            <Sparkles className="w-3 h-3 inline mr-1" />AI Generated
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">{areaInfo.label}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-4 py-2 text-[#1A73A8] hover:bg-[#1A73A8]/5 rounded-lg text-sm font-medium transition-colors">
                                        <Edit3 className="w-4 h-4" />Edit
                                    </button>
                                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                                        <Download className="w-4 h-4" />Print
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { setIsEditing(false); setEditSmartGoal(goal.smart_goal || ''); setEditStatus(goal.status); setEditProgress(goal.progress || 0); setEditTimeframe(goal.timeframe || '30'); }} className="flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                                        <X className="w-4 h-4" />Cancel
                                    </button>
                                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-2 bg-[#30B27A] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#28a06d]">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Created {formatDate(goal.created_at)}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{goal.timeframe} day timeframe</span>
                        {goal.participant_id && (
                            <Link href={`/participants/${goal.participant_id}`} className="flex items-center gap-1.5 text-[#1A73A8] hover:underline">
                                <Users className="w-4 h-4" />View Participant
                            </Link>
                        )}
                    </div>

                    {/* Progress bar */}
                    {goal.status === 'active' && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-600 font-medium">Progress</span>
                                {isEditing ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={editProgress}
                                            onChange={(e) => setEditProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                        />
                                        <span className="text-gray-500">%</span>
                                    </div>
                                ) : (
                                    <span className="font-semibold text-[#1A73A8]">{goal.progress || 0}%</span>
                                )}
                            </div>
                            {isEditing ? (
                                <input type="range" min="0" max="100" value={editProgress} onChange={(e) => setEditProgress(parseInt(e.target.value))} className="w-full accent-[#1A73A8]" />
                            ) : (
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#1A73A8] to-[#30B27A] rounded-full transition-all" style={{ width: `${goal.progress || 0}%` }} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status / Timeframe editing */}
                    {isEditing && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent">
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="paused">Paused</option>
                                    <option value="abandoned">Abandoned</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Timeframe (days)</label>
                                <div className="flex gap-2">
                                    {['30', '60', '90', '180'].map(t => (
                                        <button key={t} onClick={() => setEditTimeframe(t)} className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium border transition-colors ${editTimeframe === t ? 'border-[#1A73A8] bg-[#1A73A8]/5 text-[#1A73A8]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick status actions (not in edit mode) */}
                    {!isEditing && goal.status === 'active' && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                            <button onClick={() => handleStatusChange('completed')} className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                                <CheckCircle className="w-4 h-4 inline mr-1.5" />Mark Completed
                            </button>
                            <button onClick={() => handleStatusChange('paused')} className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
                                Pause Goal
                            </button>
                            <div className="flex-1" />
                            <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4 inline mr-1.5" />Delete
                            </button>
                        </div>
                    )}

                    {/* Delete confirmation */}
                    {showDeleteConfirm && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-800 mb-3">Are you sure you want to delete this goal? This action cannot be undone.</p>
                            <div className="flex gap-2">
                                <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">Yes, Delete</button>
                                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Goal Content ─────────────────────────────────────────────────── */}

                {/* SMART Goal / Description */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-[#1A73A8]" />
                        <h2 className="font-semibold text-[#0E2235]">{isAIGoal ? 'SMART Goal' : 'Goal Description'}</h2>
                    </div>
                    {isEditing ? (
                        <textarea
                            value={editSmartGoal}
                            onChange={(e) => setEditSmartGoal(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent resize-none text-base"
                        />
                    ) : (
                        <p className="text-gray-800 text-lg leading-relaxed">{goal.smart_goal}</p>
                    )}

                    {/* Motivation statement (AI goals only) */}
                    {isAIGoal && goalData?.motivationStatement && !isEditing && (
                        <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
                            <p className="text-purple-900 italic">&ldquo;{goalData.motivationStatement}&rdquo;</p>
                        </div>
                    )}

                    {/* Success vision (AI goals only) */}
                    {isAIGoal && goalData?.successVision && !isEditing && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-[#1A73A8]/5 to-[#30B27A]/5 rounded-xl border border-[#1A73A8]/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-4 h-4 text-[#1A73A8]" />
                                <span className="text-sm font-semibold text-[#0E2235]">Vision of Success</span>
                            </div>
                            <p className="text-gray-700">{goalData.successVision}</p>
                        </div>
                    )}

                    {/* Desired outcome if different from smart_goal */}
                    {goal.desired_outcome && goal.desired_outcome !== goal.smart_goal && !isEditing && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <span className="text-xs font-medium text-gray-500 uppercase">Original Words</span>
                            <p className="text-sm text-gray-700 mt-1">{goal.desired_outcome}</p>
                        </div>
                    )}
                </div>

                {/* ─── AI Goal Sections (only for AI-generated goals) ──────────────── */}

                {isAIGoal && goalData && !isEditing && (
                    <div className="space-y-4">
                        {/* Phased Plan */}
                        {goalData.phasedPlan && (
                            <CollapsibleCard title="Phased Action Plan" icon={Calendar} color="#1A73A8" defaultOpen={true}>
                                <div className="pt-4 space-y-4">
                                    {Object.entries(goalData.phasedPlan).map(([phase, data]) => (
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
                        )}

                        {/* Domain Specific */}
                        {goalData.domainSpecific?.sections && (
                            <CollapsibleCard title={`${areaInfo.label} Planning Details`} icon={ListChecks} color={areaInfo.color} defaultOpen={true}>
                                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {goalData.domainSpecific.sections.map((section, i) => (
                                        <div key={i} className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                                <FileText className="w-4 h-4" style={{ color: areaInfo.color }} />{section.title}
                                            </h4>
                                            <ul className="space-y-2">
                                                {section.items.map((item, j) => (
                                                    <li key={j} className="flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: areaInfo.color }} />
                                                        <span className="text-sm text-gray-700">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Strengths */}
                        {goalData.strengthsUsed && goalData.strengthsUsed.length > 0 && (
                            <CollapsibleCard title="Strengths to Build On" icon={Sparkles} color="#F59E0B">
                                <div className="pt-4 space-y-3">
                                    {goalData.strengthsUsed.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                                            <Sparkles className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <div><span className="font-medium text-yellow-800">{item.strength}</span><p className="text-sm text-yellow-700 mt-1">{item.howItHelps}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Barriers */}
                        {goalData.barriersAndCoping && goalData.barriersAndCoping.length > 0 && (
                            <CollapsibleCard title="Barriers & Coping Strategies" icon={Shield} color="#EF4444">
                                <div className="pt-4 space-y-3">
                                    {goalData.barriersAndCoping.map((item, i) => (
                                        <div key={i} className="p-3 bg-red-50 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-600" /><span className="font-medium text-red-800">{item.barrier}</span></div>
                                            <div className="flex items-start gap-2 ml-6"><ArrowRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{item.copingStrategy}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Peer Support Activities */}
                        {goalData.peerSupportActivities && goalData.peerSupportActivities.length > 0 && (
                            <CollapsibleCard title="Peer Support Activities" icon={HeartHandshake} color="#8B5CF6">
                                <div className="pt-4 space-y-3">
                                    {goalData.peerSupportActivities.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                                            <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                                            <div><span className="font-medium text-purple-800">{item.activity}</span><p className="text-sm text-purple-700 mt-1">{item.purpose}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Progress Indicators */}
                        {goalData.progressIndicators && goalData.progressIndicators.length > 0 && (
                            <CollapsibleCard title="Progress Indicators" icon={TrendingUp} color="#10B981">
                                <div className="pt-4 space-y-3">
                                    {goalData.progressIndicators.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                            <div className="flex items-center gap-3"><TrendingUp className="w-5 h-5 text-green-600" /><span className="font-medium text-green-800">{item.indicator}</span></div>
                                            <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full">{item.target}</span>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Emotional Support Plan */}
                        {goalData.emotionalSupportPlan && (
                            <CollapsibleCard title="Emotional Support Plan" icon={Heart} color="#EC4899">
                                <div className="pt-4 space-y-4">
                                    <div className="p-4 bg-pink-50 rounded-lg">
                                        <h4 className="font-semibold text-pink-800 mb-2">Anticipated Emotions</h4>
                                        <div className="flex flex-wrap gap-2">{goalData.emotionalSupportPlan.anticipatedEmotions?.map((e, i) => <span key={i} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">{e}</span>)}</div>
                                    </div>
                                    <div className="p-4 bg-pink-50 rounded-lg">
                                        <h4 className="font-semibold text-pink-800 mb-2">Coping Strategies</h4>
                                        <ul className="space-y-2">{goalData.emotionalSupportPlan.copingStrategies?.map((s, i) => <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{s}</span></li>)}</ul>
                                    </div>
                                    <div className="p-4 bg-pink-50 rounded-lg">
                                        <h4 className="font-semibold text-pink-800 mb-2">Peer Support Role</h4>
                                        <p className="text-sm text-gray-700">{goalData.emotionalSupportPlan.peerSupportRole}</p>
                                    </div>
                                    <div className="p-4 bg-pink-50 rounded-lg">
                                        <h4 className="font-semibold text-pink-800 mb-2">Self-Care Reminders</h4>
                                        <ul className="space-y-2">{goalData.emotionalSupportPlan.selfCareReminders?.map((r, i) => <li key={i} className="flex items-start gap-2"><Heart className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{r}</span></li>)}</ul>
                                    </div>
                                </div>
                            </CollapsibleCard>
                        )}

                        {/* Backup Plan */}
                        {goalData.backupPlan && (
                            <CollapsibleCard title="Backup Plan & Contingencies" icon={Shield} color="#6B7280">
                                <div className="pt-4 space-y-4">
                                    <div className="p-4 bg-gray-100 rounded-lg">
                                        <h4 className="font-semibold text-gray-800 mb-2">Potential Setbacks</h4>
                                        <ul className="space-y-2">{goalData.backupPlan.potentialSetbacks?.map((s, i) => <li key={i} className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{s}</span></li>)}</ul>
                                    </div>
                                    <div className="p-4 bg-gray-100 rounded-lg">
                                        <h4 className="font-semibold text-gray-800 mb-2">Alternative Strategies</h4>
                                        <ul className="space-y-2">{goalData.backupPlan.alternativeStrategies?.map((s, i) => <li key={i} className="flex items-start gap-2"><ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{s}</span></li>)}</ul>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <h4 className="font-semibold text-blue-800 mb-2">If Things Get Hard...</h4>
                                        <p className="text-sm text-blue-700 italic">{goalData.backupPlan.ifThingsGetHard}</p>
                                    </div>
                                    <div className="p-4 bg-gray-100 rounded-lg">
                                        <h4 className="font-semibold text-gray-800 mb-2">Emergency Resources</h4>
                                        <ul className="space-y-2">{goalData.backupPlan.emergencyResources?.map((r, i) => <li key={i} className="flex items-start gap-2"><Zap className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-700">{r}</span></li>)}</ul>
                                    </div>
                                </div>
                            </CollapsibleCard>
                        )}
                    </div>
                )}
            </main>

            <style jsx global>{`@media print { header, button, .no-print { display: none !important; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }`}</style>
        </div>
    );
}
