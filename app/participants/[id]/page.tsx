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
    assessment_date: string;
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
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-2xl font-bold">
                            {participant.first_name[0]}{participant.last_name[0]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#0E2235]">{fullName}</h1>
                            {participant.preferred_name && (
                                <p className="text-gray-600">Goes by "{participant.preferred_name}"</p>
                            )}
                            <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(participant.status)}`}>
                                {participant.status}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <Link
                            href={`/participants/${params.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </Link>
                        <Link
                            href={`/goals/new?participant_id=${params.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Goal
                        </Link>
                    </div>
                </div>
            </div>
            
            {/* Quick Stats */}
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
                            <p className="text-2xl font-bold text-[#0E2235]">
                                {Math.floor((Date.now() - new Date(participant.intake_date).getTime()) / (1000 * 60 * 60 * 24))}
                            </p>
                            <p className="text-sm text-gray-500">Days in Program</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex gap-8">
                    {[
                        { id: 'overview', label: 'Overview', icon: User },
                        { id: 'goals', label: 'Goals', icon: Target },
                        { id: 'notes', label: 'Session Notes', icon: FileText },
                        { id: 'assessments', label: 'Assessments', icon: Activity },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-[#1A73A8] text-[#1A73A8]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Contact Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-semibold text-[#0E2235] mb-4">Contact Information</h3>
                        <div className="space-y-3">
                            {participant.email && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Mail className="w-5 h-5 text-gray-400" />
                                    <a href={`mailto:${participant.email}`} className="hover:text-[#1A73A8]">
                                        {participant.email}
                                    </a>
                                </div>
                            )}
                            {participant.phone && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Phone className="w-5 h-5 text-gray-400" />
                                    <a href={`tel:${participant.phone}`} className="hover:text-[#1A73A8]">
                                        {participant.phone}
                                    </a>
                                </div>
                            )}
                            {participant.date_of_birth && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    DOB: {new Date(participant.date_of_birth).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Program Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-semibold text-[#0E2235] mb-4">Program Information</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-gray-600">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                Intake: {new Date(participant.intake_date).toLocaleDateString()}
                            </div>
                            {participant.referral_source && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <Users className="w-5 h-5 text-gray-400" />
                                    Referral: {participant.referral_source.replace('_', ' ')}
                                </div>
                            )}
                            {participant.primary_pss_name && (
                                <div className="flex items-center gap-3 text-gray-600">
                                    <User className="w-5 h-5 text-gray-400" />
                                    Primary PSS: {participant.primary_pss_name}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Recent Goals */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-[#0E2235]">Active Goals</h3>
                            <Link href={`/goals?participant_id=${params.id}`} className="text-sm text-[#1A73A8] hover:underline">
                                View All
                            </Link>
                        </div>
                        {activeGoals.length === 0 ? (
                            <p className="text-gray-500 text-sm">No active goals</p>
                        ) : (
                            <div className="space-y-3">
                                {activeGoals.slice(0, 3).map(goal => (
                                    <Link
                                        key={goal.id}
                                        href={`/goals/${goal.id}`}
                                        className="block p-3 rounded-lg border border-gray-100 hover:border-[#1A73A8]/30 hover:bg-blue-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div 
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: goalAreaColors[goal.goal_area] || '#1A73A8' }}
                                            />
                                            <span className="text-sm font-medium text-[#0E2235] truncate">{goal.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                                                <div 
                                                    className="h-full bg-[#1A73A8] rounded-full"
                                                    style={{ width: `${goal.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">{goal.progress}%</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Recent Notes */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-[#0E2235]">Recent Session Notes</h3>
                            <Link href={`/session-notes?participant_id=${params.id}`} className="text-sm text-[#1A73A8] hover:underline">
                                View All
                            </Link>
                        </div>
                        {notes.length === 0 ? (
                            <p className="text-gray-500 text-sm">No session notes yet</p>
                        ) : (
                            <div className="space-y-3">
                                {notes.slice(0, 3).map(note => (
                                    <Link
                                        key={note.id}
                                        href={`/session-notes/${note.id}`}
                                        className="block p-3 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-[#0E2235] capitalize">
                                                {note.session_type} Session
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(note.session_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {note.pss_note?.sessionOverview && (
                                            <p className="text-sm text-gray-600 line-clamp-2">
                                                {note.pss_note.sessionOverview}
                                            </p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
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
                            href={`/assessments/recovery-capital?participant_id=${params.id}`}
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
                            {assessments.map(assessment => (
                                <Link
                                    key={assessment.id}
                                    href={`/assessments/${assessment.id}`}
                                    className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-medium text-[#0E2235] uppercase">
                                                {assessment.assessment_type}
                                            </span>
                                            <p className="text-sm text-gray-500">
                                                {new Date(assessment.assessment_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-[#1A73A8]">{assessment.total_score}</p>
                                                <p className="text-xs text-gray-500">/ 60</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
