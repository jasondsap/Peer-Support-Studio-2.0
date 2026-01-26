'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Calendar, Clock, Users, User, Building2,
    FileText, ClipboardList, MessageSquare, Copy, Check,
    Edit3, Save, Download, Trash2, Loader2, ChevronRight,
    Target, AlertCircle
} from 'lucide-react';

interface SessionNote {
    id: string;
    user_id: string;
    organization_id?: string;
    participant_id?: string;
    metadata: {
        date: string;
        duration: string;
        sessionType: string;
        setting: string;
        participantName?: string;
    };
    pss_note: {
        sessionOverview: string;
        topicsDiscussed: string[];
        strengthsObserved: string[];
        recoverySupportProvided: string[];
        actionItems: string[];
        followUpNeeded: string[];
    };
    pss_summary: string;
    participant_summary: string;
    transcript: string;
    source: string;
    status: string;
    created_at: string;
    updated_at: string;
}

type OutputTab = 'note' | 'pss-summary' | 'participant-summary' | 'transcript';

const SETTINGS_MAP: Record<string, string> = {
    'outpatient': 'Outpatient',
    'residential': 'Residential',
    'correctional': 'Jail/Correctional',
    'hospital': 'Hospital/Inpatient',
    'community': 'Community Outreach',
    'dual-diagnosis': 'Dual Diagnosis',
    'mental-health': 'Mental Health',
    'youth': 'Youth/Adolescent',
    'therapeutic-rehab': 'Therapeutic Rehab',
};

export default function SessionNoteViewPage() {
    const router = useRouter();
    const params = useParams();
    const { data: session, status: authStatus } = useSession();

    const [note, setNote] = useState<SessionNote | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<OutputTab>('note');
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const noteId = params?.id as string;

    // Auth check
    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    // Fetch note from API
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
                setNote(data.note);
            } catch (err) {
                console.error('Error fetching note:', err);
                router.push('/session-notes/library');
            } finally {
                setIsLoading(false);
            }
        }

        if (authStatus === 'authenticated' && noteId) {
            fetchNote();
        }
    }, [authStatus, noteId, router]);

    // Copy to clipboard
    const copyToClipboard = async (text: string, section: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSection(section);
            setTimeout(() => setCopiedSection(null), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    // Format note for copying
    const formatNoteForCopy = (): string => {
        if (!note) return '';
        
        return `SESSION OVERVIEW
${'-'.repeat(50)}
${note.pss_note.sessionOverview}

TOPICS DISCUSSED
${'-'.repeat(50)}
${note.pss_note.topicsDiscussed.map(t => `• ${t}`).join('\n')}

PARTICIPANT STRENGTHS OBSERVED
${'-'.repeat(50)}
${note.pss_note.strengthsObserved.map(s => `• ${s}`).join('\n')}

RECOVERY SUPPORT PROVIDED
${'-'.repeat(50)}
${note.pss_note.recoverySupportProvided.map(r => `• ${r}`).join('\n')}

ACTION ITEMS
${'-'.repeat(50)}
${note.pss_note.actionItems.map(a => `□ ${a}`).join('\n')}

FOLLOW-UP NEEDED
${'-'.repeat(50)}
${note.pss_note.followUpNeeded.map(f => `• ${f}`).join('\n')}`;
    };

    // Delete note (soft delete)
    const handleDelete = async () => {
        if (!note) return;

        try {
            const response = await fetch(`/api/session-notes/${note.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete note');
            
            router.push('/session-notes/library');
        } catch (err) {
            console.error('Error deleting note:', err);
        }
    };

    // Loading state
    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[#0E2235]">Note Not Found</h2>
                    <button
                        onClick={() => router.push('/session-notes/library')}
                        className="mt-4 text-[#1A73A8] hover:underline"
                    >
                        Back to Library
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.push('/session-notes/library')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back to Library
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push(`/session-notes/${note.id}/edit`)}
                                className="px-4 py-2 text-[#1A73A8] border border-[#1A73A8] rounded-lg hover:bg-blue-50 flex items-center gap-2"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit
                            </button>
                            {!deleteConfirm ? (
                                <button
                                    onClick={() => setDeleteConfirm(true)}
                                    className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDelete}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        Confirm Delete
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(false)}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Session Info Card */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(note.metadata.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {note.metadata.duration} minutes
                        </div>
                        <div className="flex items-center gap-2">
                            {note.metadata.sessionType === 'group' ? (
                                <Users className="w-4 h-4" />
                            ) : (
                                <User className="w-4 h-4" />
                            )}
                            {note.metadata.sessionType.charAt(0).toUpperCase() + note.metadata.sessionType.slice(1)}
                        </div>
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {SETTINGS_MAP[note.metadata.setting] || note.metadata.setting}
                        </div>
                        {note.metadata.participantName && (
                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
                                <User className="w-4 h-4 text-blue-600" />
                                <span className="text-blue-700">{note.metadata.participantName}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                        <span>Created: {new Date(note.created_at).toLocaleString()}</span>
                        <span>Source: {note.source === 'dictation' ? 'Voice Dictation' : note.source === 'recording' ? 'Session Recording' : 'Manual Entry'}</span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="flex border-b border-gray-200">
                        {[
                            { key: 'note', label: 'PSS Note', icon: FileText },
                            { key: 'pss-summary', label: 'PSS Summary', icon: ClipboardList },
                            { key: 'participant-summary', label: 'Participant Summary', icon: MessageSquare },
                            { key: 'transcript', label: 'Transcript', icon: FileText },
                        ].map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key as OutputTab)}
                                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                                    activeTab === key
                                        ? 'bg-[#1A73A8] text-white'
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {/* PSS Note Tab */}
                        {activeTab === 'note' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-[#0E2235]">PSS Session Note</h3>
                                    <button
                                        onClick={() => copyToClipboard(formatNoteForCopy(), 'note')}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors"
                                    >
                                        {copiedSection === 'note' ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        Copy Note
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Session Overview */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Session Overview
                                        </h4>
                                        <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                                            {note.pss_note.sessionOverview}
                                        </p>
                                    </div>

                                    {/* Topics Discussed */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Topics Discussed
                                        </h4>
                                        <ul className="space-y-2">
                                            {note.pss_note.topicsDiscussed?.map((topic, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-700">
                                                    <span className="w-2 h-2 rounded-full bg-[#1A73A8] mt-2 flex-shrink-0" />
                                                    {topic}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Participant Strengths Observed */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Participant Strengths Observed
                                        </h4>
                                        <ul className="space-y-2">
                                            {note.pss_note.strengthsObserved?.map((strength, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-700">
                                                    <span className="w-2 h-2 rounded-full bg-[#30B27A] mt-2 flex-shrink-0" />
                                                    {strength}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Recovery Support Provided */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Recovery Support Provided
                                        </h4>
                                        <ul className="space-y-2">
                                            {note.pss_note.recoverySupportProvided?.map((support, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-700">
                                                    <span className="w-2 h-2 rounded-full bg-[#1A73A8] mt-2 flex-shrink-0" />
                                                    {support}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Action Items */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Action Items
                                        </h4>
                                        <ul className="space-y-2">
                                            {note.pss_note.actionItems?.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-700">
                                                    <span className="w-4 h-4 border-2 border-gray-400 rounded mt-0.5 flex-shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Follow-Up Needed */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Follow-Up Needed
                                        </h4>
                                        <ul className="space-y-2">
                                            {note.pss_note.followUpNeeded?.map((followUp, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-700">
                                                    <ChevronRight className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                                    {followUp}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PSS Summary Tab */}
                        {activeTab === 'pss-summary' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-[#0E2235]">PSS Summary</h3>
                                    <button
                                        onClick={() => copyToClipboard(note.pss_summary || '', 'pss-summary')}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors"
                                    >
                                        {copiedSection === 'pss-summary' ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        Copy Summary
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <p className="text-gray-700 whitespace-pre-line">{note.pss_summary}</p>
                                </div>
                            </div>
                        )}

                        {/* Participant Summary Tab */}
                        {activeTab === 'participant-summary' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-[#0E2235]">Participant Summary</h3>
                                    <button
                                        onClick={() => copyToClipboard(note.participant_summary || '', 'participant-summary')}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors"
                                    >
                                        {copiedSection === 'participant-summary' ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        Copy Summary
                                    </button>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                    <p className="text-gray-700 whitespace-pre-line">{note.participant_summary}</p>
                                </div>
                                <p className="text-sm text-gray-500 mt-4">
                                    💡 This summary is written in plain language and can be shared with the participant 
                                    to help them remember what was discussed.
                                </p>
                            </div>
                        )}

                        {/* Transcript Tab */}
                        {activeTab === 'transcript' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-[#0E2235]">Session Transcript</h3>
                                    <button
                                        onClick={() => copyToClipboard(note.transcript || '', 'transcript')}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition-colors"
                                    >
                                        {copiedSection === 'transcript' ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                        Copy Transcript
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-6 max-h-[600px] overflow-y-auto font-mono text-sm">
                                    <pre className="whitespace-pre-wrap text-gray-700">{note.transcript}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-[#0E2235] mb-4">Related Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => router.push('/note-reviewer')}
                            className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left"
                        >
                            <ClipboardList className="w-8 h-8 text-amber-600" />
                            <div>
                                <p className="font-semibold text-[#0E2235]">Audit Note</p>
                                <p className="text-sm text-gray-500">Check compliance standards</p>
                            </div>
                        </button>
                        <button
                            onClick={() => router.push('/goal-generator')}
                            className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-left"
                        >
                            <Target className="w-8 h-8 text-green-600" />
                            <div>
                                <p className="font-semibold text-[#0E2235]">Create Goals</p>
                                <p className="text-sm text-gray-500">Draft recovery goals</p>
                            </div>
                        </button>
                        <button
                            onClick={() => router.push('/lesson-builder')}
                            className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-left"
                        >
                            <FileText className="w-8 h-8 text-blue-600" />
                            <div>
                                <p className="font-semibold text-[#0E2235]">Create Lesson</p>
                                <p className="text-sm text-gray-500">Build related lesson</p>
                            </div>
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
