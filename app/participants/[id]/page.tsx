'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, Mail, Calendar, MapPin,
    Target, FileText, Activity, Plus, Edit, Loader2,
    AlertCircle, ChevronRight, Clock, Users
} from 'lucide-react';
import AssessmentDetailModal from '@/app/components/AssessmentDetailModal';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    status: string;
    intake_date: string;
    referral_source?: string;
    primary_pss_name?: string;
    internal_notes?: string;
}

interface Goal {
    id: string;
    smart_goal: string;
    goal_area: string;
    desired_outcome: string;
    status: string;
    progress: number;
    timeframe: string;
    created_at: string;
}

interface SessionNote {
    id: string;
    session_date: string;
    session_type: string;
    duration_minutes: number;
    pss_note?: { sessionOverview?: string };
}

interface Assessment {
    id: string;
    assessment_type: string;
    total_score: number;
    domain_scores?: any;
    responses?: any;
    ai_analysis?: any;
    notes?: string;
    assessment_date?: string;
    created_at: string;
}

export default function ParticipantDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { data: session } = useSession();
    const currentOrg = (session as any)?.currentOrganization;
    
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'goals' | 'notes' | 'assessments'>('overview');
    
    // Assessment detail modal
    const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
    
    useEffect(() => {
        async function fetchData() {
            if (!currentOrg?.id || !params.id) return;
            
            try {
                // Fetch participant
                const pRes = await fetch(`/api/participants/${params.id}?organization_id=${currentOrg.id}`);
                const pData = await pRes.json();
                if (pData.error) throw new Error(pData.error);
                setParticipant(pData.participant);
                
                // Fetch goals
                const gRes = await fetch(`/api/saved-goals?organization_id=${currentOrg.id}&participant_id=${params.id}&status=all`);
                const gData = await gRes.json();
                setGoals(gData.goals || []);
                
                // Fetch session notes
                const nRes = await fetch(`/api/session-notes?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const nData = await nRes.json();
                setNotes(nData.notes || []);
                
                // Fetch assessments
                const aRes = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const aData = await aRes.json();
                setAssessments(aData.assessments || []);
                
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load participant');
            } finally {
                setLoading(false);
            }
        }
        
        fetchData();
    }, [currentOrg?.id, params.id]);
    
    // Analyze assessment with AI
    const handleAnalyzeAssessment = async (assessmentId: string) => {
        try {
            const res = await fetch(`/api/recovery-assessments/${assessmentId}/analyze`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                // Update the assessment in list with new analysis
                setAssessments(prev => 
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
                setAssessments(prev => prev.filter(a => a.id !== assessmentId));
                setSelectedAssessment(null);
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };
    
    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }
    
    if (error || !participant) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-12 text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[#0E2235] mb-2">Participant Not Found</h2>
                <p className="text-gray-600 mb-6">{error || 'The participant you\'re looking for doesn\'t exist.'}</p>
                <Link
                    href="/participants"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Participants
                </Link>
            </div>
        );
    }
    
    const displayName = participant.preferred_name || participant.first_name;
    const fullName = `${participant.first_name} ${participant.last_name}`;
    const activeGoals = goals.filter(g => g.status === 'active');
    
    // Calculate days in program
    const intakeDate = new Date(participant.intake_date);
    const today = new Date();
    const daysInProgram = Math.floor((today.getTime() - intakeDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-600',
            discharged: 'bg-orange-100 text-orange-700',
        };
        return styles[status] || styles.active;
    };
    
    const goalAreaColors: Record<string, string> = {
        'substance-use': '#E74C3C',
        'mental-health': '#9B59B6',
        'housing': '#3498DB',
        'employment': '#27AE60',
        'education': '#F39C12',
        'family': '#E91E63',
        'legal': '#607D8B',
        'physical-health': '#00BCD4',
    };
    
    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-start gap-4 mb-8">
                <Link
                    href="/participants"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                
                <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-xl font-bold">
                            {participant.first_name[0]}{participant.last_name[0]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#0E2235]">{fullName}</h1>
                            {participant.preferred_name && (
                                <p className="text-gray-500">Goes by "{participant.preferred_name}"</p>
                            )}
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize mt-1 ${getStatusBadge(participant.status)}`}>
                                {participant.status}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/participants/${params.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </Link>
                        <Link
                            href={`/goals/new?participant_id=${params.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            New Goal
                        </Link>
                    </div>
                </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{activeGoals.length}</p>
                            <p className="text-sm text-gray-500">Active Goals</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{notes.length}</p>
                            <p className="text-sm text-gray-500">Session Notes</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{assessments.length}</p>
                            <p className="text-sm text-gray-500">Assessments</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{daysInProgram}</p>
                            <p className="text-sm text-gray-500">Days in Program</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex gap-6">
                    {[
                        { key: 'overview', label: 'Overview', icon: User },
                        { key: 'goals', label: 'Goals', icon: Target },
                        { key: 'notes', label: 'Session Notes', icon: FileText },
                        { key: 'assessments', label: 'Assessments', icon: Activity },
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-2 px-1 py-3 border-b-2 font-medium transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-[#1A73A8] text-[#1A73A8]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Contact Info */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-semibold text-[#0E2235] mb-4">Contact Information</h3>
                        <div className="space-y-3">
                            {participant.phone && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    {participant.phone}
                                </div>
                            )}
                            {participant.email && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {participant.email}
                                </div>
                            )}
                            {participant.date_of_birth && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {new Date(participant.date_of_birth).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Program Info */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-semibold text-[#0E2235] mb-4">Program Information</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Intake Date</span>
                                <span className="text-[#0E2235]">{new Date(participant.intake_date).toLocaleDateString()}</span>
                            </div>
                            {participant.referral_source && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Referral Source</span>
                                    <span className="text-[#0E2235]">{participant.referral_source}</span>
                                </div>
                            )}
                            {participant.primary_pss_name && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Primary PSS</span>
                                    <span className="text-[#0E2235]">{participant.primary_pss_name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Internal Notes */}
                    {participant.internal_notes && (
                        <div className="md:col-span-2 bg-white rounded-xl p-6 border border-gray-200">
                            <h3 className="font-semibold text-[#0E2235] mb-4">Internal Notes</h3>
                            <p className="text-gray-600 whitespace-pre-wrap">{participant.internal_notes}</p>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'goals' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/goals/new?participant_id=${params.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            Create Goal
                        </Link>
                    </div>
                    {goals.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No goals yet. Create the first goal for {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {goals.map(goal => (
                                <Link
                                    key={goal.id}
                                    href={`/goals/${goal.id}`}
                                    className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div 
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: goalAreaColors[goal.goal_area] || '#1A73A8' }}
                                                />
                                                <h4 className="font-medium text-[#0E2235]">{goal.smart_goal || goal.desired_outcome}</h4>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                    goal.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    goal.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {goal.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded-full">
                                                    <div 
                                                        className="h-full bg-[#1A73A8] rounded-full transition-all"
                                                        style={{ width: `${goal.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-gray-600">{goal.progress}%</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'notes' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/session-notes/new?participant_id=${params.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                        >
                            <Plus className="w-4 h-4" />
                            New Session Note
                        </Link>
                    </div>
                    {notes.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No session notes yet. Document your first session with {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {notes.map(note => (
                                <Link
                                    key={note.id}
                                    href={`/session-notes/${note.id}`}
                                    className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-medium text-[#0E2235] capitalize">
                                                    {note.session_type} Session
                                                </span>
                                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {note.duration_minutes} min
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {new Date(note.session_date).toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'assessments' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/recovery-capital?participant_id=${params.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            <Plus className="w-4 h-4" />
                            New Assessment
                        </Link>
                    </div>
                    {assessments.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No assessments yet. Conduct a Recovery Capital assessment for {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {assessments.map(assessment => {
                                const maxScore = assessment.assessment_type === 'mirc28' ? 140 : 60;
                                return (
                                    <div
                                        key={assessment.id}
                                        onClick={() => setSelectedAssessment({
                                            ...assessment,
                                            participant_name: fullName,
                                            created_at: assessment.created_at || assessment.assessment_date || new Date().toISOString()
                                        })}
                                        className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-[#0E2235] uppercase">
                                                    {assessment.assessment_type}
                                                </span>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(assessment.assessment_date || assessment.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-[#1A73A8]">{assessment.total_score}</p>
                                                    <p className="text-xs text-gray-500">/ {maxScore}</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
