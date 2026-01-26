'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Calendar, Clock, Users, User,
    Building2, BookOpen, Target, FileText,
    Save, Send, Loader2, AlertCircle, Check,
    ChevronDown, X, Search
} from 'lucide-react';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
}

interface Lesson {
    id: string;
    title: string;
    session_type?: string;
    duration?: number;
    setting?: string;
    created_at: string;
}

interface Goal {
    id: string;
    participant_name: string;
    goal_area: string;
    smart_goal?: string;
    created_at: string;
}

const SETTINGS = [
    { value: 'outpatient', label: 'Outpatient' },
    { value: 'residential', label: 'Residential' },
    { value: 'correctional', label: 'Jail/Correctional' },
    { value: 'hospital', label: 'Hospital/Inpatient' },
    { value: 'community', label: 'Community Outreach' },
    { value: 'telehealth', label: 'Telehealth/Virtual' },
    { value: 'home', label: 'Home Visit' },
    { value: 'shelter', label: 'Shelter' },
    { value: 'recovery-housing', label: 'Recovery Housing' },
    { value: 'school', label: 'School-Based' },
    { value: 'workplace', label: 'Workplace' },
    { value: 'other', label: 'Other' },
];

const DURATIONS = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 45, label: '45 minutes' },
    { value: 60, label: '60 minutes (1 hour)' },
    { value: 90, label: '90 minutes (1.5 hours)' },
    { value: 120, label: '120 minutes (2 hours)' },
];

export default function PlanServicePage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    // User context (organization)
    const [organizationId, setOrganizationId] = useState<string | null>(null);

    // Form state
    const [serviceType, setServiceType] = useState<'individual' | 'group'>('individual');
    const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
    const [plannedDuration, setPlannedDuration] = useState(60);
    const [setting, setSetting] = useState('outpatient');
    const [serviceCode, setServiceCode] = useState('');
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [lessonId, setLessonId] = useState<string | null>(null);
    const [goalId, setGoalId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');

    // Participant search
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // Data
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showLessonPicker, setShowLessonPicker] = useState(false);
    const [showGoalPicker, setShowGoalPicker] = useState(false);

    // Fetch user context (organization) first
    useEffect(() => {
        if (authStatus === 'loading') return;
        if (authStatus === 'unauthenticated') {
            router.push('/login');
        } else if (session) {
            fetchUserContext();
        }
    }, [session, authStatus]);

    // Fetch lessons/goals once we have the organization
    useEffect(() => {
        if (organizationId) {
            fetchData();
        }
    }, [organizationId]);

    // Search participants when input changes
    useEffect(() => {
        if (participantSearch.length >= 2 && organizationId) {
            searchParticipants();
        } else {
            setParticipants([]);
        }
    }, [participantSearch, organizationId]);

    const fetchUserContext = async () => {
        try {
            // Use the service-log API to get user context (it returns org-scoped data)
            // Or we can create a dedicated endpoint. For now, let's fetch from a user API
            const res = await fetch('/api/user/context');
            const data = await res.json();
            if (data.organization_id) {
                setOrganizationId(data.organization_id);
            } else {
                // Fallback: try to get from session-notes or another endpoint
                console.error('Could not get organization context');
                setIsLoadingData(false);
            }
        } catch (err) {
            console.error('Error fetching user context:', err);
            setIsLoadingData(false);
        }
    };

    const searchParticipants = async () => {
        if (!organizationId) return;
        setLoadingParticipants(true);
        try {
            const res = await fetch(
                `/api/participants?organizationId=${organizationId}&search=${encodeURIComponent(participantSearch)}&status=active`
            );
            const data = await res.json();
            if (data.participants) {
                setParticipants(data.participants || []);
            }
        } catch (err) {
            console.error('Error searching participants:', err);
        } finally {
            setLoadingParticipants(false);
        }
    };

    const fetchData = async () => {
        if (!organizationId) return;
        setIsLoadingData(true);
        
        try {
            // Fetch lessons via API
            const lessonsRes = await fetch(`/api/lessons?organization_id=${organizationId}`);
            const lessonsData = await lessonsRes.json();
            if (lessonsData.success || lessonsData.lessons) {
                setLessons(lessonsData.lessons || []);
            }
        } catch (err: any) {
            console.error('Lessons exception:', err);
        }

        try {
            // Fetch goals via API
            const goalsRes = await fetch(`/api/saved-goals?organization_id=${organizationId}`);
            const goalsData = await goalsRes.json();
            if (goalsData.goals) {
                setGoals(goalsData.goals || []);
            }
        } catch (err: any) {
            console.error('Goals exception:', err);
        }

        setIsLoadingData(false);
    };

    const handleSave = async (submitForReview: boolean = false) => {
        if (!plannedDate) {
            setError('Please select a planned date');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    serviceType,
                    plannedDate,
                    plannedDuration,
                    setting,
                    serviceCode: serviceCode || null,
                    participantId: selectedParticipant?.id || null,
                    lessonId,
                    goalId,
                    notes: notes || null,
                    status: submitForReview ? 'planned' : 'draft'
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to save service plan');
            }

            router.push('/service-log');

        } catch (err: any) {
            console.error('Save error:', err);
            setError(err.message || 'Failed to save service plan');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedLesson = lessons.find(l => l.id === lessonId);
    const selectedGoal = goals.find(g => g.id === goalId);

    const getLessonDisplayName = (lesson: Lesson) => {
        return lesson.title || 'Untitled Lesson';
    };

    const getGoalDisplayName = (goal: Goal) => {
        if (goal.participant_name && goal.goal_area) {
            return `${goal.participant_name} - ${goal.goal_area.replace('-', ' ')}`;
        }
        return goal.smart_goal?.substring(0, 50) || 'Untitled Goal';
    };

    const getParticipantDisplayName = (participant: Participant) => {
        return participant.preferred_name || 
               `${participant.first_name} ${participant.last_name}`;
    };

    if (authStatus === 'loading' || isLoadingData) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/service-log')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-[#0E2235]">Plan a Service</h1>
                            <p className="text-sm text-gray-500">Create a new service plan</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    {/* Service Type */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Type
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setServiceType('individual')}
                                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                                    serviceType === 'individual'
                                        ? 'border-[#1A73A8] bg-[#1A73A8]/5'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <User className={`w-6 h-6 mx-auto mb-1 ${
                                    serviceType === 'individual' ? 'text-[#1A73A8]' : 'text-gray-400'
                                }`} />
                                <div className={`text-sm font-medium ${
                                    serviceType === 'individual' ? 'text-[#1A73A8]' : 'text-gray-600'
                                }`}>
                                    Individual
                                </div>
                            </button>
                            <button
                                onClick={() => setServiceType('group')}
                                className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                                    serviceType === 'group'
                                        ? 'border-[#1A73A8] bg-[#1A73A8]/5'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <Users className={`w-6 h-6 mx-auto mb-1 ${
                                    serviceType === 'group' ? 'text-[#1A73A8]' : 'text-gray-400'
                                }`} />
                                <div className={`text-sm font-medium ${
                                    serviceType === 'group' ? 'text-[#1A73A8]' : 'text-gray-600'
                                }`}>
                                    Group
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Date and Duration */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Planned Date
                            </label>
                            <input
                                type="date"
                                value={plannedDate}
                                onChange={(e) => setPlannedDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Clock className="w-4 h-4 inline mr-1" />
                                Duration
                            </label>
                            <select
                                value={plannedDuration}
                                onChange={(e) => setPlannedDuration(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            >
                                {DURATIONS.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Setting */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Building2 className="w-4 h-4 inline mr-1" />
                            Setting
                        </label>
                        <select
                            value={setting}
                            onChange={(e) => setSetting(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                        >
                            {SETTINGS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Participant Selection */}
                    <div className="mb-6 relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <User className="w-4 h-4 inline mr-1" />
                            Participant (optional)
                        </label>
                        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 focus-within:ring-2 focus-within:ring-[#1A73A8]">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={selectedParticipant ? getParticipantDisplayName(selectedParticipant) : participantSearch}
                                onChange={(e) => {
                                    setParticipantSearch(e.target.value);
                                    setShowParticipantDropdown(true);
                                    setSelectedParticipant(null);
                                }}
                                onFocus={() => setShowParticipantDropdown(true)}
                                placeholder="Search participants..."
                                className="flex-1 bg-transparent border-none outline-none"
                            />
                            {selectedParticipant && (
                                <button
                                    onClick={() => {
                                        setSelectedParticipant(null);
                                        setParticipantSearch('');
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                        </div>
                        
                        {/* Participant Dropdown */}
                        {showParticipantDropdown && participantSearch.length >= 2 && !selectedParticipant && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {loadingParticipants ? (
                                    <div className="p-3 text-center text-gray-500">
                                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                        Searching...
                                    </div>
                                ) : participants.length === 0 ? (
                                    <div className="p-3 text-center text-gray-500">
                                        No participants found
                                    </div>
                                ) : (
                                    participants.map((participant) => (
                                        <button
                                            key={participant.id}
                                            onClick={() => {
                                                setSelectedParticipant(participant);
                                                setShowParticipantDropdown(false);
                                                setParticipantSearch('');
                                            }}
                                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium text-sm">
                                                {participant.first_name?.[0]}{participant.last_name?.[0]}
                                            </div>
                                            <span>{getParticipantDisplayName(participant)}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Service Code */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Code (optional)
                        </label>
                        <input
                            type="text"
                            value={serviceCode}
                            onChange={(e) => setServiceCode(e.target.value)}
                            placeholder="e.g., H0038"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                        />
                    </div>

                    {/* Lesson Attachment */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <BookOpen className="w-4 h-4 inline mr-1" />
                            Attach Lesson (optional)
                        </label>
                        {selectedLesson ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-[#1A73A8]" />
                                    <span className="font-medium text-[#1A73A8]">{getLessonDisplayName(selectedLesson)}</span>
                                </div>
                                <button
                                    onClick={() => setLessonId(null)}
                                    className="p-1 hover:bg-blue-100 rounded"
                                >
                                    <X className="w-4 h-4 text-[#1A73A8]" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowLessonPicker(true)}
                                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#1A73A8] hover:text-[#1A73A8] transition-colors"
                            >
                                + Select a lesson from your library
                            </button>
                        )}
                    </div>

                    {/* Goal Attachment */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Target className="w-4 h-4 inline mr-1" />
                            Link to Goal (optional)
                        </label>
                        {selectedGoal ? (
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-[#30B27A]" />
                                    <span className="font-medium text-[#30B27A]">{getGoalDisplayName(selectedGoal)}</span>
                                </div>
                                <button
                                    onClick={() => setGoalId(null)}
                                    className="p-1 hover:bg-green-100 rounded"
                                >
                                    <X className="w-4 h-4 text-[#30B27A]" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowGoalPicker(true)}
                                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#30B27A] hover:text-[#30B27A] transition-colors"
                            >
                                + Select a goal to work on
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <FileText className="w-4 h-4 inline mr-1" />
                            Planning Notes (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any notes about this planned session..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Save as Draft
                        </button>
                        <button
                            onClick={() => handleSave(true)}
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Schedule Service
                        </button>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-blue-800">What happens next?</h3>
                        <ul className="text-sm text-blue-700 mt-1 space-y-1">
                            <li>• <strong>Save as Draft:</strong> You can edit later before scheduling</li>
                            <li>• <strong>Schedule Service:</strong> Creates a time-stamped record of your planned service</li>
                            <li>• After delivery, mark as completed and create session notes</li>
                        </ul>
                    </div>
                </div>
            </main>

            {/* Lesson Picker Modal */}
            {showLessonPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-[#0E2235]">Select Lesson ({lessons.length})</h3>
                            <button onClick={() => setShowLessonPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {lessons.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>No lessons found</p>
                                    <button
                                        onClick={() => router.push('/lesson-builder')}
                                        className="mt-2 text-[#1A73A8] hover:underline text-sm"
                                    >
                                        Create a lesson
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {lessons.map(lesson => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => {
                                                setLessonId(lesson.id);
                                                setShowLessonPicker(false);
                                            }}
                                            className="w-full p-3 text-left rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                                        >
                                            <div className="flex items-start gap-2">
                                                <BookOpen className="w-4 h-4 text-[#1A73A8] mt-0.5 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <span className="font-medium text-[#0E2235] block">{getLessonDisplayName(lesson)}</span>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {lesson.session_type && <span>{lesson.session_type} • </span>}
                                                        {lesson.duration && <span>{lesson.duration} min • </span>}
                                                        {new Date(lesson.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Goal Picker Modal */}
            {showGoalPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-[#0E2235]">Select Goal ({goals.length})</h3>
                            <button onClick={() => setShowGoalPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {goals.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>No goals found</p>
                                    <button
                                        onClick={() => router.push('/goal-generator')}
                                        className="mt-2 text-[#30B27A] hover:underline text-sm"
                                    >
                                        Create a goal
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {goals.map(goal => (
                                        <button
                                            key={goal.id}
                                            onClick={() => {
                                                setGoalId(goal.id);
                                                setShowGoalPicker(false);
                                            }}
                                            className="w-full p-3 text-left rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                                        >
                                            <div className="flex items-start gap-2">
                                                <Target className="w-4 h-4 text-[#30B27A] mt-0.5 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <span className="font-medium text-[#0E2235] block">{getGoalDisplayName(goal)}</span>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {goal.goal_area && <span className="capitalize">{goal.goal_area.replace('-', ' ')} • </span>}
                                                        {new Date(goal.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
