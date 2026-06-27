'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { todayLocal } from '@/lib/dateUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    FileText, Mic, Upload, MessageSquare, FileEdit, StickyNote,  // ADDED: StickyNote
    ArrowLeft, ChevronRight, Loader2, BookOpen,
    Clock, Users, Calendar, Building2, User,
    LayoutTemplate, Copy, Save, ChevronDown, Trash2  // ADDED: notes-efficiency
} from 'lucide-react';
import SessionDebrief from './components/SessionDebrief';
import ManualNoteForm from './components/ManualNoteForm';
import QuickNoteEditor from '../components/QuickNoteEditor';  // ADDED

// CHANGED: Added 'quick-note' to Mode type
type Mode = 'select' | 'record' | 'dictate' | 'upload' | 'manual' | 'quick-note';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
}

interface SessionMetadata {
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
    sessionType: 'individual' | 'group' | 'check-in' | 'crisis';
    setting: string;
    participantName?: string;
}

// ── Notes-efficiency: template body shape ───────────────────────────────────
// A template/seed body discriminated by `kind`:
//   { kind: 'manual', manual: {...partial ManualNoteForm formData} }
//   { kind: 'quick',  quick: { title, content, sessionType, tags } }
type TemplateBody = {
    kind: 'manual' | 'quick';
    manual?: Record<string, any>;
    quick?: { title?: string; content?: string; sessionType?: string; tags?: string[] };
};

interface NoteTemplate {
    id: string;
    name: string;
    description?: string | null;
    body: TemplateBody;
    is_shared: boolean;
    use_count: number;
}

// Build a manual-form seed from a previously saved note (copy-my-last-note).
// Dates/identifiers/attestations are intentionally NOT carried forward.
function seedManualFromNote(note: any): TemplateBody {
    const md = note?.metadata || {};
    const pn = md.peerNoteData || {};
    return {
        kind: 'manual',
        manual: {
            staffName: md.staffName || '',
            sessionType: md.sessionType === 'group' ? 'group' : 'individual',
            groupSize: md.groupSize || '',
            othersPresent: md.othersPresent || '',
            goalDiscussion: pn.goalDiscussion || '',
            participantShared: pn.participantShared || note?.pss_note?.sessionOverview || '',
            directQuotes: pn.directQuotes || '',
            strengthsObserved: Array.isArray(pn.strengthsObserved) ? pn.strengthsObserved : [],
            progressNoted: pn.progressNoted || '',
            supportProvided: Array.isArray(pn.supportProvided) ? pn.supportProvided : [],
            sharedExperience: pn.sharedExperience || '',
            participantResponse: pn.participantResponse || '',
            resourcesDiscussed: pn.resourcesDiscussed || '',
            communityConnections: pn.communityConnections || '',
            safetyConcerns: !!pn.safetyConcerns,
            safetyConcernsNote: pn.safetyConcernsNote || '',
            participationLevel: md.participationLevel || '',
            motivationLevel: md.motivationLevel || '',
            treatmentPlanNote: pn.treatmentPlanNote || '',
            nextSteps: pn.nextSteps || '',
            nextMeetingFocus: pn.nextMeetingFocus || '',
        },
    };
}

// Build a quick-note seed from a previously saved note.
function seedQuickFromNote(note: any): TemplateBody {
    const md = note?.metadata || {};
    return {
        kind: 'quick',
        quick: {
            title: '', // don't carry the old (often date-stamped) title
            content: note?.pss_note?.content || note?.pss_summary || '',
            sessionType: md.sessionType || 'general',
            tags: Array.isArray(md.tags) ? md.tags : [],
        },
    };
}

interface NoteTemplateBarProps {
    kind: 'manual' | 'quick';
    organizationId?: string;
    participants: Participant[];
    onApply: (seed: TemplateBody, participantId?: string) => void;
    getDraft: () => TemplateBody | null;
}

// Toolbar shown above the Manual/Quick note forms: start-from-template,
// copy-my-last-note, and save-as-template.
function NoteTemplateBar({ kind, organizationId, participants, onApply, getDraft }: NoteTemplateBarProps) {
    const [templates, setTemplates] = useState<NoteTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [copyParticipantId, setCopyParticipantId] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const loadTemplates = useCallback(async () => {
        if (!organizationId) return;
        try {
            const res = await fetch(
                `/api/note-templates?organization_id=${organizationId}&kind=${kind}`
            );
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (e) {
            console.error('Failed to load note templates:', e);
        }
    }, [organizationId, kind]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const flash = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 2500);
    };

    const handleApplyTemplate = () => {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (!tpl?.body) {
            flash('Select a template first');
            return;
        }
        onApply(tpl.body);
        flash(`Applied "${tpl.name}"`);
        // Best-effort use_count bump — never blocks the apply.
        fetch('/api/note-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apply_id: tpl.id }),
        }).catch(() => {});
    };

    const handleCopyLast = async () => {
        if (!copyParticipantId) {
            flash('Choose a participant to copy from');
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(
                `/api/session-notes?participant_id=${copyParticipantId}&limit=1`
            );
            const data = await res.json();
            const note = data?.notes?.[0];
            if (!note) {
                flash('No previous note found for this participant');
                return;
            }
            const seed = kind === 'quick' ? seedQuickFromNote(note) : seedManualFromNote(note);
            onApply(seed, copyParticipantId);
            flash('Copied your last note');
        } catch (e) {
            console.error('Copy last note failed:', e);
            flash('Could not copy last note');
        } finally {
            setBusy(false);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!organizationId) {
            flash('No organization selected');
            return;
        }
        const draft = getDraft();
        if (!draft) {
            flash('Fill in the note first');
            return;
        }
        const name = window.prompt('Template name?');
        if (!name || !name.trim()) return;
        setBusy(true);
        try {
            const res = await fetch('/api/note-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: organizationId,
                    name: name.trim(),
                    body: draft,
                    is_shared: true,
                }),
            });
            if (res.ok) {
                flash('Saved as template');
                await loadTemplates();
            } else {
                const d = await res.json().catch(() => ({}));
                flash(d.error || 'Failed to save template');
            }
        } catch (e) {
            console.error('Save as template failed:', e);
            flash('Failed to save template');
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteTemplate = async () => {
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (!tpl || !organizationId) return;
        if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
        setBusy(true);
        try {
            const res = await fetch(
                `/api/note-templates?id=${tpl.id}&organization_id=${organizationId}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                setSelectedTemplateId('');
                flash('Template deleted');
                await loadTemplates();
            } else {
                const d = await res.json().catch(() => ({}));
                flash(d.error || 'Could not delete template');
            }
        } catch (e) {
            console.error('Delete template failed:', e);
            flash('Could not delete template');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                {/* Start from template */}
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Start from template
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg appearance-none bg-white text-sm focus:ring-2 focus:ring-[#1A73A8]"
                            >
                                <option value="">
                                    {templates.length ? 'Select a template…' : 'No templates yet'}
                                </option>
                                {templates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                        {t.use_count ? ` (${t.use_count})` : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyTemplate}
                            disabled={!selectedTemplateId || busy}
                            className="px-3 py-2 bg-[#1A73A8] text-white rounded-lg text-sm font-medium hover:bg-[#155a8a] disabled:opacity-40"
                        >
                            Apply
                        </button>
                        {selectedTemplateId && (
                            <button
                                type="button"
                                onClick={handleDeleteTemplate}
                                disabled={busy}
                                title="Delete template"
                                className="px-2 py-2 border border-gray-300 rounded-lg text-gray-400 hover:text-red-600 hover:border-red-300"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Copy my last note */}
                <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        Copy my last note
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select
                                value={copyParticipantId}
                                onChange={(e) => setCopyParticipantId(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg appearance-none bg-white text-sm focus:ring-2 focus:ring-[#1A73A8]"
                            >
                                <option value="">Select participant…</option>
                                {participants.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.first_name} {p.last_name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <button
                            type="button"
                            onClick={handleCopyLast}
                            disabled={!copyParticipantId || busy}
                            className="px-3 py-2 border border-[#1A73A8] text-[#1A73A8] rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-40"
                        >
                            Copy
                        </button>
                    </div>
                </div>

                {/* Save as template */}
                <div>
                    <button
                        type="button"
                        onClick={handleSaveAsTemplate}
                        disabled={busy}
                        className="px-4 py-2 bg-[#30B27A] text-white rounded-lg text-sm font-medium hover:bg-[#28a06c] disabled:opacity-40 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save as template
                    </button>
                </div>
            </div>

            {message && (
                <p className="mt-2 text-xs text-[#1A73A8]">{message}</p>
            )}
        </div>
    );
}

function SessionNotesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [mode, setMode] = useState<Mode>('select');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);

    // Prefill data from URL params (when coming from lesson library)
    const prefillTopic = searchParams.get('topic');
    const prefillIntervention = searchParams.get('intervention');
    const prefillLessonId = searchParams.get('lessonId');
    const prefillMode = searchParams.get('mode');

    // Service → note linkage params (when coming from the service log)
    const prefillServiceId = searchParams.get('serviceId');
    const prefillParticipantId = searchParams.get('participantId');
    const prefillDate = searchParams.get('date');
    const prefillDuration = searchParams.get('duration');
    const prefillType = searchParams.get('type');
    const prefillSetting = searchParams.get('setting');

    // Session metadata as an object (matching SessionDebrief expectations)
    const [metadata, setMetadata] = useState<SessionMetadata>({
        date: todayLocal(),
        startTime: '',
        endTime: '',
        duration: '30',
        sessionType: 'individual',
        setting: 'outpatient',
        participantName: '',
    });

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Generated content
    const [generatedNote, setGeneratedNote] = useState<any>(null);

    // ── Notes-efficiency: template / copy-last-note seeds ───────────────────
    // Applying a template or copying the last note seeds the relevant form.
    // `seedKey` is bumped on every apply so the form remounts and re-reads its
    // initial values cleanly.
    const [manualSeed, setManualSeed] = useState<Record<string, any> | null>(null);
    const [quickSeed, setQuickSeed] = useState<any | null>(null);
    const [seedParticipantId, setSeedParticipantId] = useState<string>('');
    const [seedKey, setSeedKey] = useState(0);
    const manualDraftRef = useRef<TemplateBody | null>(null);
    const quickDraftRef = useRef<TemplateBody | null>(null);

    const applySeed = (seed: TemplateBody, participantId?: string) => {
        if (!seed) return;
        if (seed.kind === 'quick') {
            setQuickSeed({ ...(seed.quick || {}), participantId: participantId || '' });
        } else {
            setManualSeed(seed.manual || {});
            setSeedParticipantId(participantId || '');
        }
        setSeedKey((k) => k + 1);
    };

    const handleManualDraft = useCallback((body: TemplateBody) => {
        manualDraftRef.current = body;
    }, []);
    const handleQuickDraft = useCallback((body: TemplateBody) => {
        quickDraftRef.current = body;
    }, []);

    // Auth check
    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    // Fetch participants on mount
    useEffect(() => {
        if (authStatus === 'authenticated') {
            fetchParticipants();
        }
    }, [authStatus]);

    // Handle prefill mode from URL
    useEffect(() => {
        if (prefillMode === 'manual') {
            setMode('manual');
        }
    }, [prefillMode]);

    // Prefill metadata + participant when arriving from the service log so the
    // resulting note is tied back to the delivered service.
    useEffect(() => {
        if (prefillParticipantId) {
            setSelectedParticipantId(prefillParticipantId);
        }
        if (prefillDate || prefillDuration || prefillType || prefillSetting) {
            setMetadata((prev) => ({
                ...prev,
                date: prefillDate ? prefillDate.split('T')[0] : prev.date,
                duration: prefillDuration || prev.duration,
                sessionType: (prefillType as SessionMetadata['sessionType']) || prev.sessionType,
                setting: prefillSetting || prev.setting,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Link a freshly-saved note back to the originating service plan (closes the
    // deliver → document loop). Failures are non-fatal to the save flow.
    const linkNoteToService = async (noteId: string) => {
        if (!prefillServiceId || !noteId) return;
        try {
            await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'link-note',
                    serviceId: prefillServiceId,
                    sessionNoteId: noteId,
                }),
            });
        } catch (err) {
            console.error('Failed to link note to service:', err);
        }
    };

    const fetchParticipants = async () => {
        try {
            const response = await fetch('/api/participants');
            if (response.ok) {
                const data = await response.json();
                setParticipants(data.participants || []);
            }
        } catch (error) {
            console.error('Error fetching participants:', error);
        } finally {
            setIsLoadingParticipants(false);
        }
    };

    const handleMetadataChange = (newMetadata: SessionMetadata) => {
        setMetadata(newMetadata);
    };

    const handleTranscriptComplete = async (transcript: string) => {
        setIsProcessing(true);
        try {
            // Call AI to generate notes from transcript. saveToDb:false ensures the
            // generate route does NOT create a row — we persist exactly once below.
            const response = await fetch('/api/session-notes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript,
                    metadata,
                    participantId: selectedParticipantId || null,
                    organizationId: currentOrg?.id || null,
                    saveToDb: false,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate notes');
            }

            const result = await response.json();
            setGeneratedNote(result);

            // Persist the generated note (single source of truth) and link it.
            await saveNote(result, transcript);
        } catch (error) {
            console.error('Error generating notes:', error);
            // TODO: Show error to user
        } finally {
            setIsProcessing(false);
        }
    };

    // Persist a generated note exactly once, mapping the generate route's
    // camelCase output onto the API's snake_case body shape.
    const saveNote = async (generated: any, transcript: string) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/session-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metadata,
                    pss_note: generated.pssNote,
                    pss_summary: generated.pssSummary,
                    participant_summary: generated.participantSummary,
                    transcript,
                    participant_id: selectedParticipantId || null,
                    organization_id: currentOrg?.id || null,
                    source: mode,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            const result = await response.json();
            await linkNoteToService(result.note.id);
            router.push(`/session-notes/${result.note.id}`);
        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManualNote = async (noteData: any) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/session-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...noteData,
                    participant_id: noteData.participant_id ?? (selectedParticipantId || null),
                    organization_id: noteData.organization_id ?? (currentOrg?.id || null),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            const result = await response.json();
            await linkNoteToService(result.note.id);

            // Navigate to the saved note or library
            router.push(`/session-notes/${result.note.id}`);
        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    // ADDED: Handler for Quick Note saved
    const handleQuickNoteSaved = async (note: any) => {
        // Navigate to the saved note
        if (note?.id) {
            await linkNoteToService(note.id);
            router.push(`/session-notes/${note.id}`);
        }
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => mode === 'select' ? router.push('/') : setMode('select')}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                {mode === 'select' ? 'Dashboard' : 'Back'}
                            </button>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>Session Notes</span>
                                {mode !== 'select' && (
                                    <>
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="text-[#1A73A8] font-medium capitalize">
                                            {mode === 'quick-note' ? 'Quick Note' : mode}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/session-notes/library')}
                            className="flex items-center gap-2 text-[#1A73A8] hover:text-[#155a8a]"
                        >
                            <BookOpen className="w-5 h-5" />
                            View Library
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Mode Selection */}
                {mode === 'select' && (
           
                        <div>
                            <div className="flex items-start gap-4 mb-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-[#0E2235] mb-1">Create Session Note</h1>
                                    <p className="text-gray-600">Choose how you want to create your session documentation</p>
                                </div>
                            </div>

                        {/* CHANGED: First row with 2 cards, second row with 3 cards */}
                        <div className="max-w-5xl mx-auto">
                            {/* First Row - 2 cards */}
                            <div className="grid md:grid-cols-2 gap-6 mb-6">
                                {/* Record Mode */}
                                <button
                                    onClick={() => setMode('record')}
                                    className="bg-white rounded-2xl p-8 text-left shadow-md hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#1A73A8]"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1A73A8] to-[#155a8a] flex items-center justify-center mb-6 shadow-lg shadow-[#1A73A8]/20">
                                        <Mic className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Record Session</h3>
                                    <p className="text-gray-600 mb-4">
                                        Record your session in real-time with automatic speaker detection and transcription
                                    </p>
                                    <div className="flex items-center gap-2 text-[#1A73A8] font-medium">
                                        <span>Start Recording</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>

                                {/* Dictate Mode */}
                                <button
                                    onClick={() => setMode('dictate')}
                                    className="bg-white rounded-2xl p-8 text-left shadow-md hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#30B27A]"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#30B27A] to-[#28a06c] flex items-center justify-center mb-6 shadow-lg shadow-[#30B27A]/20">
                                        <MessageSquare className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Dictate Note</h3>
                                    <p className="text-gray-600 mb-4">
                                        Speak your notes after the session and let AI generate professional documentation
                                    </p>
                                    <div className="flex items-center gap-2 text-[#30B27A] font-medium">
                                        <span>Start Dictating</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </div>

                            {/* Second Row - 3 cards */}
                            <div className="grid md:grid-cols-3 gap-6">
                                {/* Upload Mode */}
                                <button
                                    onClick={() => setMode('upload')}
                                    className="bg-white rounded-2xl p-8 text-left shadow-md hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#F59E0B]"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center mb-6 shadow-lg shadow-[#F59E0B]/20">
                                        <Upload className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Upload Audio</h3>
                                    <p className="text-gray-600 mb-4">
                                        Upload an existing audio recording to transcribe and generate notes
                                    </p>
                                    <div className="flex items-center gap-2 text-[#F59E0B] font-medium">
                                        <span>Upload File</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>

                                {/* Manual Mode */}
                                <button
                                    onClick={() => setMode('manual')}
                                    className="bg-white rounded-2xl p-8 text-left shadow-md hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#8B5CF6]"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center mb-6 shadow-lg shadow-[#8B5CF6]/20">
                                        <FileEdit className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Manual Entry</h3>
                                    <p className="text-gray-600 mb-4">
                                        Use a clinical template to document your session with structured fields
                                    </p>
                                    <div className="flex items-center gap-2 text-[#8B5CF6] font-medium">
                                        <span>Fill Template</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>

                                {/* ADDED: Quick Note Mode */}
                                <button
                                    onClick={() => setMode('quick-note')}
                                    className="bg-white rounded-2xl p-8 text-left shadow-md hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#EC4899]"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EC4899] to-[#DB2777] flex items-center justify-center mb-6 shadow-lg shadow-[#EC4899]/20">
                                        <StickyNote className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Quick Note</h3>
                                    <p className="text-gray-600 mb-4">
                                        Capture a quick note without recording - perfect for brief updates
                                    </p>
                                    <div className="flex items-center gap-2 text-[#EC4899] font-medium">
                                        <span>Write Note</span>
                                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-12 text-center">
                            <p className="text-sm text-gray-500">
                                All notes are automatically saved and linked to participants for easy reference
                            </p>
                        </div>
                    </div>
                )}

                {/* Record Mode */}
                {mode === 'record' && (
                    <SessionDebrief
                        mode="record"
                        metadata={metadata}
                        onMetadataChange={handleMetadataChange}
                        onComplete={handleTranscriptComplete}
                        onBack={() => setMode('select')}
                        isProcessing={isProcessing}
                        participants={participants}
                        selectedParticipantId={selectedParticipantId}
                        onParticipantChange={setSelectedParticipantId}
                    />
                )}

                {/* Dictate Mode */}
                {mode === 'dictate' && (
                    <SessionDebrief
                        mode="dictate"
                        metadata={metadata}
                        onMetadataChange={handleMetadataChange}
                        onComplete={handleTranscriptComplete}
                        onBack={() => setMode('select')}
                        isProcessing={isProcessing}
                        participants={participants}
                        selectedParticipantId={selectedParticipantId}
                        onParticipantChange={setSelectedParticipantId}
                    />
                )}

                {/* Upload Mode - Using SessionDebrief but could be separate component */}
                {mode === 'upload' && (
                    <SessionDebrief
                        mode="upload"
                        metadata={metadata}
                        onMetadataChange={handleMetadataChange}
                        onComplete={handleTranscriptComplete}
                        onBack={() => setMode('select')}
                        isProcessing={isProcessing}
                        participants={participants}
                        selectedParticipantId={selectedParticipantId}
                        onParticipantChange={setSelectedParticipantId}
                    />
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Manual Note Entry</h2>
                            <p className="text-gray-600">
                                Use this clinical template to document your session with structured fields
                            </p>
                        </div>
                        <NoteTemplateBar
                            kind="manual"
                            organizationId={currentOrg?.id || undefined}
                            participants={participants}
                            onApply={applySeed}
                            getDraft={() => manualDraftRef.current}
                        />
                        <ManualNoteForm
                            key={`manual-${seedKey}`}
                            participants={participants}
                            onSave={handleSaveManualNote}
                            onCancel={() => setMode('select')}
                            organizationId={currentOrg?.id || undefined}
                            initialFormData={manualSeed || undefined}
                            initialParticipantId={seedParticipantId || undefined}
                            onDraftChange={handleManualDraft}
                            prefillData={{
                                topic: prefillTopic || undefined,
                                intervention: prefillIntervention || undefined,
                                lessonId: prefillLessonId || undefined,
                            }}
                        />
                    </div>
                )}

                {/* ADDED: Quick Note Mode */}
                {mode === 'quick-note' && (
                    <div>
                        <NoteTemplateBar
                            kind="quick"
                            organizationId={currentOrg?.id || undefined}
                            participants={participants}
                            onApply={applySeed}
                            getDraft={() => quickDraftRef.current}
                        />
                        <QuickNoteEditor
                            key={`quick-${seedKey}`}
                            onBack={() => setMode('select')}
                            onSaved={handleQuickNoteSaved}
                            initialData={quickSeed || undefined}
                            onDraftChange={handleQuickDraft}
                        />
                    </div>
                )}
            </main>
        </div>
    );
}

export default function SessionNotesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        }>
            <SessionNotesContent />
        </Suspense>
    );
}
