'use client';

// ============================================================================
// Session Note Edit Page
// File: /app/session-notes/[id]/edit/page.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Save, Loader2, Calendar, Clock, Users, User,
    Building2, Plus, X, GripVertical, AlertCircle, Check,
    FileText, ClipboardList, MessageSquare, ChevronRight
} from 'lucide-react';

interface PssNote {
    sessionOverview: string;
    topicsDiscussed: string[];
    strengthsObserved: string[];
    recoverySupportProvided: string[];
    actionItems: string[];
    followUpNeeded: string[];
}

interface Metadata {
    date: string;
    duration: string;
    sessionType: string;
    setting: string;
    participantName?: string;
}

interface SessionNote {
    id: string;
    user_id: string;
    organization_id?: string;
    participant_id?: string;
    metadata: Metadata;
    pss_note: PssNote;
    pss_summary: string;
    participant_summary: string;
    transcript: string;
    source: string;
    status: string;
    created_at: string;
    updated_at: string;
}

const SESSION_TYPES = [
    { value: 'individual', label: 'Individual' },
    { value: 'group', label: 'Group' },
    { value: 'family', label: 'Family' },
    { value: 'crisis', label: 'Crisis' },
    { value: 'intake', label: 'Intake' },
    { value: 'follow-up', label: 'Follow-Up' },
    { value: 'phone', label: 'Phone/Virtual' },
    { value: 'general', label: 'General' },
];

const SETTINGS = [
    { value: 'outpatient', label: 'Outpatient' },
    { value: 'residential', label: 'Residential' },
    { value: 'correctional', label: 'Jail/Correctional' },
    { value: 'hospital', label: 'Hospital/Inpatient' },
    { value: 'community', label: 'Community Outreach' },
    { value: 'dual-diagnosis', label: 'Dual Diagnosis' },
    { value: 'mental-health', label: 'Mental Health' },
    { value: 'youth', label: 'Youth/Adolescent' },
    { value: 'therapeutic-rehab', label: 'Therapeutic Rehab' },
];

type EditTab = 'note' | 'summaries' | 'transcript';

export default function SessionNoteEditPage() {
    const router = useRouter();
    const params = useParams();
    const { data: session, status: authStatus } = useSession();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<EditTab>('note');
    const [hasChanges, setHasChanges] = useState(false);

    // Editable state
    const [metadata, setMetadata] = useState<Metadata>({
        date: '', duration: '', sessionType: '', setting: ''
    });
    const [pssNote, setPssNote] = useState<PssNote>({
        sessionOverview: '',
        topicsDiscussed: [],
        strengthsObserved: [],
        recoverySupportProvided: [],
        actionItems: [],
        followUpNeeded: [],
    });
    const [pssSummary, setPssSummary] = useState('');
    const [participantSummary, setParticipantSummary] = useState('');
    const [transcript, setTranscript] = useState('');
    const [originalNote, setOriginalNote] = useState<SessionNote | null>(null);

    const noteId = params?.id as string;

    // Auth check
    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    // Fetch note
    useEffect(() => {
        async function fetchNote() {
            if (authStatus !== 'authenticated' || !noteId) return;
            try {
                const response = await fetch(`/api/session-notes/${noteId}`);
                if (!response.ok) {
                    if (response.status === 404) {
                        router.push('/session-notes/library');
                        return;
                    }
                    throw new Error('Failed to fetch note');
                }
                const data = await response.json();
                const note: SessionNote = data.note;
                setOriginalNote(note);

                // Populate editable fields
                setMetadata(note.metadata || { date: '', duration: '', sessionType: '', setting: '' });
                setPssNote(note.pss_note || {
                    sessionOverview: '',
                    topicsDiscussed: [],
                    strengthsObserved: [],
                    recoverySupportProvided: [],
                    actionItems: [],
                    followUpNeeded: [],
                });
                setPssSummary(note.pss_summary || '');
                setParticipantSummary(note.participant_summary || '');
                setTranscript(note.transcript || '');
            } catch (err) {
                console.error('Error fetching note:', err);
                setError('Failed to load session note');
            } finally {
                setIsLoading(false);
            }
        }
        if (authStatus === 'authenticated' && noteId) {
            fetchNote();
        }
    }, [authStatus, noteId, router]);

    // Track changes
    useEffect(() => {
        if (originalNote) setHasChanges(true);
    }, [metadata, pssNote, pssSummary, participantSummary, transcript]);

    // Save handler
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);

        try {
            const response = await fetch(`/api/session-notes/${noteId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metadata,
                    pss_note: pssNote,
                    pss_summary: pssSummary,
                    participant_summary: participantSummary,
                    transcript,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save');
            }

            setSaveSuccess(true);
            setHasChanges(false);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    // Array field helpers
    const addArrayItem = (field: keyof PssNote) => {
        setPssNote(prev => ({
            ...prev,
            [field]: [...(prev[field] as string[]), '']
        }));
    };

    const updateArrayItem = (field: keyof PssNote, index: number, value: string) => {
        setPssNote(prev => ({
            ...prev,
            [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
        }));
    };

    const removeArrayItem = (field: keyof PssNote, index: number) => {
        setPssNote(prev => ({
            ...prev,
            [field]: (prev[field] as string[]).filter((_, i) => i !== index)
        }));
    };

    // Loading
    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (error && !originalNote) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600">{error}</p>
                    <button onClick={() => router.back()} className="mt-4 text-[#1A73A8] hover:underline">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Reusable array section editor
    const ArrayEditor = ({
        field, label, color, icon: Icon, placeholder
    }: {
        field: keyof PssNote;
        label: string;
        color: string;
        icon: any;
        placeholder: string;
    }) => {
        const items = (pssNote[field] as string[]) || [];
        return (
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color }} />
                        {label}
                    </h4>
                    <button
                        type="button"
                        onClick={() => addArrayItem(field)}
                        className="flex items-center gap-1 text-xs font-medium text-[#1A73A8] hover:text-[#156a9a] transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Item
                    </button>
                </div>
                {items.length === 0 ? (
                    <button
                        type="button"
                        onClick={() => addArrayItem(field)}
                        className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-[#1A73A8] hover:text-[#1A73A8] transition-colors"
                    >
                        + Add {label.toLowerCase()}
                    </button>
                ) : (
                    <div className="space-y-2">
                        {items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span
                                    className="w-2 h-2 rounded-full mt-3 flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                />
                                <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => updateArrayItem(field, i, e.target.value)}
                                    placeholder={placeholder}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8]"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeArrayItem(field, i)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => {
                            if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to leave?')) return;
                            router.push(`/session-notes/${noteId}`);
                        }}
                        className="flex items-center gap-2 text-gray-600 hover:text-[#0E2235] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to Note</span>
                    </button>

                    <div className="flex items-center gap-3">
                        {saveSuccess && (
                            <span className="flex items-center gap-1 text-sm text-green-600 font-medium animate-pulse">
                                <Check className="w-4 h-4" />
                                Saved
                            </span>
                        )}
                        {error && !isLoading && (
                            <span className="text-sm text-red-500">{error}</span>
                        )}
                        <button
                            onClick={() => {
                                if (hasChanges && !confirm('Discard changes?')) return;
                                router.push(`/session-notes/${noteId}`);
                            }}
                            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156a9a] disabled:opacity-50 transition-colors text-sm font-medium shadow-sm"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Session Metadata Card */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <h2 className="text-lg font-bold text-[#0E2235] mb-4">Session Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                Date
                            </label>
                            <input
                                type="date"
                                value={metadata.date || ''}
                                onChange={(e) => setMetadata(prev => ({ ...prev, date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                Duration (min)
                            </label>
                            <input
                                type="text"
                                value={metadata.duration || ''}
                                onChange={(e) => setMetadata(prev => ({ ...prev, duration: e.target.value }))}
                                placeholder="e.g., 45"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Users className="w-3.5 h-3.5 inline mr-1" />
                                Session Type
                            </label>
                            <select
                                value={metadata.sessionType || ''}
                                onChange={(e) => setMetadata(prev => ({ ...prev, sessionType: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] bg-white"
                            >
                                <option value="">Select type</option>
                                {SESSION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Building2 className="w-3.5 h-3.5 inline mr-1" />
                                Setting
                            </label>
                            <select
                                value={metadata.setting || ''}
                                onChange={(e) => setMetadata(prev => ({ ...prev, setting: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] bg-white"
                            >
                                <option value="">Select setting</option>
                                {SETTINGS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="flex border-b border-gray-200">
                        {([
                            { id: 'note' as EditTab, label: 'PSS Note', icon: FileText },
                            { id: 'summaries' as EditTab, label: 'Summaries', icon: MessageSquare },
                            { id: 'transcript' as EditTab, label: 'Transcript', icon: ClipboardList },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-[#1A73A8] text-white'
                                        : 'text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {/* PSS Note Tab */}
                        {activeTab === 'note' && (
                            <div>
                                {/* Session Overview */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Session Overview
                                    </h4>
                                    <textarea
                                        value={pssNote.sessionOverview || ''}
                                        onChange={(e) => setPssNote(prev => ({ ...prev, sessionOverview: e.target.value }))}
                                        rows={3}
                                        placeholder="Describe the session overview..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] resize-y"
                                    />
                                </div>

                                <ArrayEditor
                                    field="topicsDiscussed"
                                    label="Topics Discussed"
                                    color="#1A73A8"
                                    icon={MessageSquare}
                                    placeholder="Enter topic..."
                                />

                                <ArrayEditor
                                    field="strengthsObserved"
                                    label="Participant Strengths Observed"
                                    color="#30B27A"
                                    icon={Users}
                                    placeholder="Enter strength..."
                                />

                                <ArrayEditor
                                    field="recoverySupportProvided"
                                    label="Recovery Support Provided"
                                    color="#1A73A8"
                                    icon={FileText}
                                    placeholder="Enter support provided..."
                                />

                                <ArrayEditor
                                    field="actionItems"
                                    label="Action Items"
                                    color="#F59E0B"
                                    icon={ClipboardList}
                                    placeholder="Enter action item..."
                                />

                                <ArrayEditor
                                    field="followUpNeeded"
                                    label="Follow-Up Needed"
                                    color="#F59E0B"
                                    icon={ChevronRight}
                                    placeholder="Enter follow-up item..."
                                />
                            </div>
                        )}

                        {/* Summaries Tab */}
                        {activeTab === 'summaries' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        PSS Summary
                                    </h4>
                                    <p className="text-xs text-gray-400 mb-2">
                                        Professional summary for the Peer Support Specialist's records.
                                    </p>
                                    <textarea
                                        value={pssSummary}
                                        onChange={(e) => setPssSummary(e.target.value)}
                                        rows={8}
                                        placeholder="PSS professional summary..."
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] resize-y"
                                    />
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Participant Summary
                                    </h4>
                                    <p className="text-xs text-gray-400 mb-2">
                                        Plain-language summary that can be shared with the participant.
                                    </p>
                                    <textarea
                                        value={participantSummary}
                                        onChange={(e) => setParticipantSummary(e.target.value)}
                                        rows={8}
                                        placeholder="Participant-friendly summary..."
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/30 focus:border-blue-400 resize-y bg-blue-50/30"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Transcript Tab */}
                        {activeTab === 'transcript' && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    Session Transcript
                                </h4>
                                <p className="text-xs text-gray-400 mb-2">
                                    Raw transcript from the session recording or dictation.
                                </p>
                                <textarea
                                    value={transcript}
                                    onChange={(e) => setTranscript(e.target.value)}
                                    rows={20}
                                    placeholder="Session transcript..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] resize-y bg-gray-50"
                                />
                            </div>
                        )}
                    </div>

                    {/* Bottom Save Bar */}
                    <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                            {originalNote && `Last updated: ${new Date(originalNote.updated_at).toLocaleString()}`}
                        </p>
                        <div className="flex items-center gap-3">
                            {saveSuccess && (
                                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                                    <Check className="w-4 h-4" />
                                    Changes saved
                                </span>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-5 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156a9a] disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
