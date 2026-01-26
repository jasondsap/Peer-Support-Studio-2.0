'use client';

import { useState, useEffect } from 'react';
import {
    User, Calendar, Clock, MapPin,
    Save, Loader2, Target, Heart,
    MessageSquare, Sparkles, ArrowRight,
    Users, AlertTriangle, Quote, FileText,
    CheckCircle, ClipboardCheck, Zap, Copy,
    Eye, Edit3
} from 'lucide-react';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
}

interface RecoveryGoal {
    id: string;
    title: string;
    status: string;
}

interface ManualNoteFormProps {
    participants: Participant[];
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    staffName?: string;
    prefillData?: {
        topic?: string;
        intervention?: string;
        lessonId?: string;
    };
}

export default function ManualNoteForm({ 
    participants, 
    onSave, 
    onCancel,
    staffName: initialStaffName = '',
    prefillData 
}: ManualNoteFormProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
    const [participantGoals, setParticipantGoals] = useState<RecoveryGoal[]>([]);
    const [isLoadingGoals, setIsLoadingGoals] = useState(false);
    const [generatedNote, setGeneratedNote] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const [formData, setFormData] = useState({
        // === SECTION 1: Session Details (Who, Where, When) ===
        staffName: initialStaffName,
        dateOfService: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        sessionType: 'individual' as 'individual' | 'group',
        location: 'office',
        locationOther: '',
        groupSize: '',
        othersPresent: '',

        // === SECTION 2: Goals & Recovery Focus ===
        selectedGoalIds: [] as string[],
        goalDiscussion: '',
        
        // === SECTION 3: Participant's Voice ===
        participantShared: '',
        directQuotes: '',
        
        // === SECTION 4: Strengths & Progress ===
        strengthsObserved: [] as string[],
        customStrength: '',
        progressNoted: '',
        
        // === SECTION 5: Support Provided ===
        supportProvided: [] as string[],
        customSupport: '',
        sharedExperience: '',
        participantResponse: '',
        
        // === SECTION 6: Connections & Resources ===
        resourcesDiscussed: '',
        communityConnections: '',
        
        // === SECTION 7: Safety ===
        safetyConcerns: false,
        safetyConcernsNote: '',
        
        // === SECTION 8: BILLING REQUIRED - Participation & Motivation ===
        participationLevel: '' as '' | 'active' | 'engaged' | 'moderate' | 'minimal' | 'resistant',
        motivationLevel: '' as '' | 'high' | 'moderate' | 'low',
        
        // === SECTION 9: Treatment Plan ===
        treatmentPlanAttested: false,
        treatmentPlanNote: '',
        
        // === SECTION 10: Next Steps ===
        nextSteps: '',
        nextMeetingDate: '',
        nextMeetingFocus: '',

        // Hidden
        sessionTopic: prefillData?.topic || '',
    });

    // Options
    const locationOptions = [
        { value: 'office', label: 'Office' },
        { value: 'home', label: "Participant's Home" },
        { value: 'community', label: 'Community Location' },
        { value: 'virtual', label: 'Virtual/Phone' },
        { value: 'hospital', label: 'Hospital' },
        { value: 'other', label: 'Other' },
    ];

    const participationOptions = [
        { value: 'active', label: 'Active - Fully engaged, asking questions, sharing openly' },
        { value: 'engaged', label: 'Engaged - Participating willingly, responsive' },
        { value: 'moderate', label: 'Moderate - Some engagement, needed prompting' },
        { value: 'minimal', label: 'Minimal - Limited participation, brief responses' },
        { value: 'resistant', label: 'Resistant - Reluctant to engage, guarded' },
    ];

    const motivationOptions = [
        { value: 'high', label: 'High (8-10) - Eager to work on recovery, setting goals' },
        { value: 'moderate', label: 'Moderate (5-7) - Willing but may need encouragement' },
        { value: 'low', label: 'Low (1-4) - Ambivalent, struggling to find motivation' },
    ];

    const strengthOptions = [
        'Showed resilience', 'Expressed hope', 'Demonstrated self-awareness',
        'Used healthy coping skills', 'Advocated for themselves',
        'Showed willingness to try new things', 'Connected with supports',
        'Recognized their progress', 'Set meaningful goals',
        'Showed commitment to recovery', 'Helped others', 'Practiced self-care',
    ];

    const supportOptions = [
        'Active listening', 'Shared lived experience', 'Encouraged use of coping skills',
        'Helped identify strengths', 'Provided hope and encouragement',
        'Helped navigate systems', 'Connected to resources', 'Supported decision-making',
        'Practiced skills together', 'Discussed recovery goals', 'Celebrated progress',
        'Problem-solved together', 'Provided emotional support',
        'Accompanied to appointment', 'Facilitated group discussion',
    ];

    // Fetch participant's goals when selected
    useEffect(() => {
        if (selectedParticipantId) {
            fetchParticipantGoals(selectedParticipantId);
        } else {
            setParticipantGoals([]);
        }
    }, [selectedParticipantId]);

    const fetchParticipantGoals = async (participantId: string) => {
        setIsLoadingGoals(true);
        try {
            const response = await fetch(`/api/participants/${participantId}/goals`);
            if (response.ok) {
                const data = await response.json();
                setParticipantGoals(data.goals || []);
            }
        } catch (error) {
            console.error('Error fetching goals:', error);
        } finally {
            setIsLoadingGoals(false);
        }
    };

    const calculateDuration = () => {
        const start = new Date(`2000-01-01T${formData.startTime}`);
        const end = new Date(`2000-01-01T${formData.endTime}`);
        const diff = (end.getTime() - start.getTime()) / (1000 * 60);
        return diff > 0 ? diff : 0;
    };

    const toggleArrayItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
        if (array.includes(item)) {
            setter(array.filter(i => i !== item));
        } else {
            setter([...array, item]);
        }
    };

    const getSelectedParticipant = () => participants.find(p => p.id === selectedParticipantId);

    const validateForm = () => {
        const errors: string[] = [];
        
        if (!selectedParticipantId) errors.push('Please select a participant');
        if (!formData.participantShared.trim()) errors.push('Please document what the participant shared');
        if (formData.supportProvided.length === 0) errors.push('Please select at least one type of support provided');
        if (!formData.participationLevel) errors.push('Please select participation level (required for billing)');
        if (!formData.motivationLevel) errors.push('Please select motivation level (required for billing)');
        if (!formData.treatmentPlanAttested) errors.push('Please confirm services align with treatment plan');
        
        return errors;
    };

    const handleGenerateNote = async () => {
        const errors = validateForm();
        if (errors.length > 0) {
            alert('Please complete required fields:\n\n' + errors.join('\n'));
            return;
        }

        setIsGenerating(true);
        try {
            const selectedParticipant = getSelectedParticipant();
            const selectedGoals = participantGoals.filter(g => formData.selectedGoalIds.includes(g.id));

            const response = await fetch('/api/generate-peer-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participantName: selectedParticipant 
                        ? `${selectedParticipant.first_name} ${selectedParticipant.last_name}`
                        : 'Participant',
                    staffName: formData.staffName || 'Peer Specialist',
                    dateOfService: formData.dateOfService,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    location: formData.location === 'other' ? formData.locationOther : formData.location,
                    sessionType: formData.sessionType,
                    groupSize: formData.groupSize,
                    othersPresent: formData.othersPresent,
                    selectedGoals,
                    goalDiscussion: formData.goalDiscussion,
                    participantShared: formData.participantShared,
                    directQuotes: formData.directQuotes,
                    strengthsObserved: [...formData.strengthsObserved, formData.customStrength].filter(Boolean),
                    progressNoted: formData.progressNoted,
                    supportProvided: [...formData.supportProvided, formData.customSupport].filter(Boolean),
                    sharedExperience: formData.sharedExperience,
                    participantResponse: formData.participantResponse,
                    resourcesDiscussed: formData.resourcesDiscussed,
                    communityConnections: formData.communityConnections,
                    safetyConcerns: formData.safetyConcerns,
                    safetyConcernsNote: formData.safetyConcernsNote,
                    participationLevel: formData.participationLevel,
                    motivationLevel: formData.motivationLevel,
                    treatmentPlanAttested: formData.treatmentPlanAttested,
                    treatmentPlanNote: formData.treatmentPlanNote,
                    nextSteps: formData.nextSteps,
                    nextMeetingDate: formData.nextMeetingDate,
                    nextMeetingFocus: formData.nextMeetingFocus,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate note');
            }

            const data = await response.json();
            setGeneratedNote(data.generatedNote);
            setShowPreview(true);
        } catch (error) {
            console.error('Error generating note:', error);
            alert('Failed to generate note. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!generatedNote) {
            alert('Please generate the note first');
            return;
        }

        setIsSaving(true);
        try {
            const selectedParticipant = getSelectedParticipant();
            const duration = calculateDuration();
            const selectedGoals = participantGoals.filter(g => formData.selectedGoalIds.includes(g.id));

            const noteData = {
                participant_id: selectedParticipantId || null,
                metadata: {
                    date: formData.dateOfService,
                    duration: duration.toString(),
                    sessionType: formData.sessionType,
                    setting: formData.location === 'other' ? formData.locationOther : formData.location,
                    participantName: selectedParticipant 
                        ? `${selectedParticipant.first_name} ${selectedParticipant.last_name}`
                        : null,
                    staffName: formData.staffName,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    groupSize: formData.groupSize,
                    othersPresent: formData.othersPresent,
                    participationLevel: formData.participationLevel,
                    motivationLevel: formData.motivationLevel,
                    treatmentPlanAttested: formData.treatmentPlanAttested,
                    peerNoteData: {
                        selectedGoals: selectedGoals.map(g => ({ id: g.id, title: g.title })),
                        goalDiscussion: formData.goalDiscussion,
                        participantShared: formData.participantShared,
                        directQuotes: formData.directQuotes,
                        strengthsObserved: [...formData.strengthsObserved, formData.customStrength].filter(Boolean),
                        progressNoted: formData.progressNoted,
                        supportProvided: [...formData.supportProvided, formData.customSupport].filter(Boolean),
                        sharedExperience: formData.sharedExperience,
                        participantResponse: formData.participantResponse,
                        resourcesDiscussed: formData.resourcesDiscussed,
                        communityConnections: formData.communityConnections,
                        safetyConcerns: formData.safetyConcerns,
                        safetyConcernsNote: formData.safetyConcernsNote,
                        nextSteps: formData.nextSteps,
                        nextMeetingDate: formData.nextMeetingDate,
                        nextMeetingFocus: formData.nextMeetingFocus,
                    }
                },
                pss_note: {
                    sessionOverview: formData.participantShared,
                    topicsDiscussed: selectedGoals.map(g => g.title),
                    strengthsObserved: [...formData.strengthsObserved, formData.customStrength].filter(Boolean),
                    recoverySupportProvided: [...formData.supportProvided, formData.customSupport].filter(Boolean),
                    actionItems: formData.nextSteps ? formData.nextSteps.split('\n').filter(Boolean) : [],
                    followUpNeeded: formData.nextMeetingFocus ? [formData.nextMeetingFocus] : [],
                },
                pss_summary: generatedNote, // The AI-generated professional note
                source: 'manual',
            };

            await onSave(noteData);
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Failed to save note. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = () => {
        if (generatedNote) {
            navigator.clipboard.writeText(generatedNote);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const ChipSelector = ({ 
        options, 
        selected, 
        onToggle,
        color = 'blue'
    }: { 
        options: string[]; 
        selected: string[]; 
        onToggle: (item: string) => void;
        color?: 'blue' | 'green' | 'purple';
    }) => {
        const colors = {
            blue: { active: 'bg-[#1A73A8] text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
            green: { active: 'bg-[#30B27A] text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
            purple: { active: 'bg-[#8B5CF6] text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
        };
        
        return (
            <div className="flex flex-wrap gap-2">
                {options.map(option => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onToggle(option)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selected.includes(option) ? colors[color].active : colors[color].inactive
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        );
    };

    // If showing preview, render the preview screen
    if (showPreview && generatedNote) {
        return (
            <div className="space-y-6">
                {/* Preview Header */}
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-green-800">Note Generated!</h2>
                            <p className="text-green-600">Review the note below, then save to complete.</p>
                        </div>
                    </div>
                </div>

                {/* Generated Note Preview */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-[#0E2235] flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#1A73A8]" />
                            Professional Peer Support Note
                        </h3>
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                            {generatedNote}
                        </pre>
                    </div>
                </div>

                {/* Billing Checklist */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5" />
                        Billing Requirements Met
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            'Description of session',
                            'Interventions used',
                            'Social/emotional support',
                            "Client's response",
                            'Participation level',
                            'Motivation level',
                            'Treatment plan',
                            'Next steps/plan'
                        ].map(item => (
                            <div key={item} className="flex items-center gap-2 text-sm text-blue-700">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between gap-3 pt-4">
                    <button
                        onClick={() => setShowPreview(false)}
                        className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <Edit3 className="w-5 h-5" />
                        Edit Form
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerateNote}
                            disabled={isGenerating}
                            className="px-6 py-3 border border-[#1A73A8] text-[#1A73A8] rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                            <Zap className="w-5 h-5" />
                            Regenerate
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-8 py-3 bg-[#30B27A] text-white rounded-lg font-semibold hover:bg-[#28a06c] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Note
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Section 1: Session Details */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#1A73A8]" />
                    Session Details
                    <span className="text-sm font-normal text-gray-500 ml-2">Who, Where, When</span>
                </h2>
                
                {/* Participant & Staff */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <User className="w-4 h-4 inline mr-1" />
                            Participant *
                        </label>
                        <select
                            value={selectedParticipantId}
                            onChange={(e) => setSelectedParticipantId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                        >
                            <option value="">Select a participant...</option>
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.first_name} {p.last_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Staff Name / Credentials
                        </label>
                        <input
                            type="text"
                            value={formData.staffName}
                            onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                            placeholder="e.g., Maria Johnson, PSS"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                </div>

                {/* Date/Time/Duration */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input
                            type="date"
                            value={formData.dateOfService}
                            onChange={(e) => setFormData({ ...formData, dateOfService: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                        <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700 h-[42px] flex items-center">
                            {calculateDuration()} minutes
                        </div>
                    </div>
                </div>

                {/* Location & Session Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Location *
                        </label>
                        <select
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        >
                            {locationOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        {formData.location === 'other' && (
                            <input
                                type="text"
                                value={formData.locationOther}
                                onChange={(e) => setFormData({ ...formData, locationOther: e.target.value })}
                                placeholder="Specify location..."
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Users className="w-4 h-4 inline mr-1" />
                            Session Type
                        </label>
                        <select
                            value={formData.sessionType}
                            onChange={(e) => setFormData({ ...formData, sessionType: e.target.value as 'individual' | 'group' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        >
                            <option value="individual">Individual (1:1)</option>
                            <option value="group">Group Session</option>
                        </select>
                        {formData.sessionType === 'group' && (
                            <input
                                type="number"
                                value={formData.groupSize}
                                onChange={(e) => setFormData({ ...formData, groupSize: e.target.value })}
                                placeholder="Number of participants"
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                            />
                        )}
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Others Present (family, providers, etc.)
                    </label>
                    <input
                        type="text"
                        value={formData.othersPresent}
                        onChange={(e) => setFormData({ ...formData, othersPresent: e.target.value })}
                        placeholder="e.g., Mother, case manager..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                    />
                </div>
            </section>

            {/* Section 2: Goals & Recovery Focus */}
            <section className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600" />
                    Goals & Recovery Focus
                    <span className="text-xs font-normal bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full ml-2">
                        The Golden Thread
                    </span>
                </h2>
                <p className="text-sm text-amber-700 mb-4">
                    Connect this session to the participant's recovery goals.
                </p>

                {selectedParticipantId ? (
                    <>
                        {isLoadingGoals ? (
                            <div className="flex items-center gap-2 text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading goals...
                            </div>
                        ) : participantGoals.length > 0 ? (
                            <div className="space-y-3 mb-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    Which recovery goals were addressed?
                                </label>
                                {participantGoals.map(goal => (
                                    <label key={goal.id} className="flex items-start gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-amber-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.selectedGoalIds.includes(goal.id)}
                                            onChange={() => {
                                                const newIds = formData.selectedGoalIds.includes(goal.id)
                                                    ? formData.selectedGoalIds.filter(id => id !== goal.id)
                                                    : [...formData.selectedGoalIds, goal.id];
                                                setFormData({ ...formData, selectedGoalIds: newIds });
                                            }}
                                            className="mt-1 rounded text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{goal.title}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4 italic">
                                No recovery goals found. Consider creating goals in the Goal Generator.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-gray-500 mb-4 italic">
                        Select a participant above to see their recovery goals.
                    </p>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        How were goals discussed? Progress or challenges?
                    </label>
                    <textarea
                        value={formData.goalDiscussion}
                        onChange={(e) => setFormData({ ...formData, goalDiscussion: e.target.value })}
                        placeholder="Describe how the session connected to recovery goals..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                </div>
            </section>

            {/* Section 3: Participant's Voice */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#1A73A8]" />
                    Participant's Voice *
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            What did the participant share about how they're doing? *
                        </label>
                        <textarea
                            value={formData.participantShared}
                            onChange={(e) => setFormData({ ...formData, participantShared: e.target.value })}
                            placeholder="What did they talk about? Concerns, feelings, current situation..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-blue-800 mb-1 flex items-center gap-2">
                            <Quote className="w-4 h-4" />
                            Direct Quotes (recommended)
                        </label>
                        <textarea
                            value={formData.directQuotes}
                            onChange={(e) => setFormData({ ...formData, directQuotes: e.target.value })}
                            placeholder='e.g., "I finally feel like I can handle things without using."'
                            rows={2}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                    </div>
                </div>
            </section>

            {/* Section 4: Strengths & Progress */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#30B27A]" />
                    Strengths & Progress
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Strengths observed
                        </label>
                        <ChipSelector
                            options={strengthOptions}
                            selected={formData.strengthsObserved}
                            onToggle={(item) => toggleArrayItem(formData.strengthsObserved, item, 
                                (arr) => setFormData({ ...formData, strengthsObserved: arr })
                            )}
                            color="green"
                        />
                        <input
                            type="text"
                            value={formData.customStrength}
                            onChange={(e) => setFormData({ ...formData, customStrength: e.target.value })}
                            placeholder="Add another strength..."
                            className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#30B27A]"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Progress or accomplishments noted
                        </label>
                        <textarea
                            value={formData.progressNoted}
                            onChange={(e) => setFormData({ ...formData, progressNoted: e.target.value })}
                            placeholder="What progress did you notice?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#30B27A]"
                        />
                    </div>
                </div>
            </section>

            {/* Section 5: Support Provided */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-[#8B5CF6]" />
                    Support Provided *
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            What support did you provide? *
                        </label>
                        <ChipSelector
                            options={supportOptions}
                            selected={formData.supportProvided}
                            onToggle={(item) => toggleArrayItem(formData.supportProvided, item,
                                (arr) => setFormData({ ...formData, supportProvided: arr })
                            )}
                            color="purple"
                        />
                        <input
                            type="text"
                            value={formData.customSupport}
                            onChange={(e) => setFormData({ ...formData, customSupport: e.target.value })}
                            placeholder="Add another type of support..."
                            className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-purple-800 mb-1">
                            Shared Lived Experience (Mutuality)
                        </label>
                        <textarea
                            value={formData.sharedExperience}
                            onChange={(e) => setFormData({ ...formData, sharedExperience: e.target.value })}
                            placeholder="How did you use your own recovery experience to connect?"
                            rows={2}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            How did the participant respond to the support?
                        </label>
                        <textarea
                            value={formData.participantResponse}
                            onChange={(e) => setFormData({ ...formData, participantResponse: e.target.value })}
                            placeholder="How did they engage? What was their reaction?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B5CF6]"
                        />
                    </div>
                </div>
            </section>

            {/* Section 6: Connections & Resources */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00BCD4]" />
                    Connections & Resources
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resources or supports discussed
                        </label>
                        <textarea
                            value={formData.resourcesDiscussed}
                            onChange={(e) => setFormData({ ...formData, resourcesDiscussed: e.target.value })}
                            placeholder="Meetings, programs, services..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00BCD4]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Community connections explored
                        </label>
                        <textarea
                            value={formData.communityConnections}
                            onChange={(e) => setFormData({ ...formData, communityConnections: e.target.value })}
                            placeholder="Family, friends, recovery community..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00BCD4]"
                        />
                    </div>
                </div>
            </section>

            {/* Section 7: Safety */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Safety
                </h2>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.safetyConcerns}
                        onChange={(e) => setFormData({ ...formData, safetyConcerns: e.target.checked })}
                        className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                        Safety concerns were discussed or observed
                    </span>
                </label>

                {formData.safetyConcerns && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <textarea
                            value={formData.safetyConcernsNote}
                            onChange={(e) => setFormData({ ...formData, safetyConcernsNote: e.target.value })}
                            placeholder="Describe the concern and actions taken..."
                            rows={2}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                    </div>
                )}
            </section>

            {/* Section 8: BILLING REQUIRED - Participation & Motivation */}
            <section className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-2 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-red-600" />
                    Billing Required Fields
                    <span className="text-xs font-normal bg-red-200 text-red-800 px-2 py-0.5 rounded-full ml-2">
                        Required
                    </span>
                </h2>
                <p className="text-sm text-red-700 mb-4">
                    These fields are required for the note to be billable.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Client's Participation Level *
                        </label>
                        <select
                            value={formData.participationLevel}
                            onChange={(e) => setFormData({ ...formData, participationLevel: e.target.value as any })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${
                                !formData.participationLevel ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                        >
                            <option value="">Select participation level...</option>
                            {participationOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Client's Motivation Level *
                        </label>
                        <select
                            value={formData.motivationLevel}
                            onChange={(e) => setFormData({ ...formData, motivationLevel: e.target.value as any })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${
                                !formData.motivationLevel ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                        >
                            <option value="">Select motivation level...</option>
                            {motivationOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* Section 9: Treatment Plan */}
            <section className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#1A73A8]" />
                    Treatment Plan *
                </h2>

                <label className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
                    formData.treatmentPlanAttested 
                        ? 'bg-green-50 border-2 border-green-300' 
                        : 'bg-red-50 border-2 border-red-300'
                }`}>
                    <input
                        type="checkbox"
                        checked={formData.treatmentPlanAttested}
                        onChange={(e) => setFormData({ ...formData, treatmentPlanAttested: e.target.checked })}
                        className="mt-1 rounded text-green-600 focus:ring-green-500"
                    />
                    <div>
                        <span className="font-medium text-gray-900">
                            Services provided align with participant's treatment plan
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                            Check this box to confirm the services documented are relevant to the participant's treatment plan objectives.
                        </p>
                    </div>
                </label>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Treatment Plan Note (optional)
                    </label>
                    <input
                        type="text"
                        value={formData.treatmentPlanNote}
                        onChange={(e) => setFormData({ ...formData, treatmentPlanNote: e.target.value })}
                        placeholder="Specific TP objectives addressed..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                    />
                </div>
            </section>

            {/* Section 10: Next Steps */}
            <section className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                <h2 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-green-600" />
                    Next Steps & Follow-Up
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Action items / What the participant will work on
                        </label>
                        <textarea
                            value={formData.nextSteps}
                            onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                            placeholder="What did they commit to? What will they try?"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Next meeting date
                            </label>
                            <input
                                type="date"
                                value={formData.nextMeetingDate}
                                onChange={(e) => setFormData({ ...formData, nextMeetingDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Focus for next meeting
                            </label>
                            <input
                                type="text"
                                value={formData.nextMeetingFocus}
                                onChange={(e) => setFormData({ ...formData, nextMeetingFocus: e.target.value })}
                                placeholder="What will you discuss next time?"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
                <button
                    onClick={onCancel}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleGenerateNote}
                    disabled={isGenerating}
                    className="px-8 py-3 bg-[#1A73A8] text-white rounded-lg font-semibold hover:bg-[#155a8a] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" />
                            Generate Note
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
