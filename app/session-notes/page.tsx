'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    FileText, Mic, Upload, MessageSquare, FileEdit, StickyNote,  // ADDED: StickyNote
    ArrowLeft, ChevronRight, Loader2, BookOpen,
    Clock, Users, Calendar, Building2, User
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

function SessionNotesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: authStatus } = useSession();

    const [mode, setMode] = useState<Mode>('select');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);

    // Prefill data from URL params (when coming from lesson library)
    const prefillTopic = searchParams.get('topic');
    const prefillIntervention = searchParams.get('intervention');
    const prefillLessonId = searchParams.get('lessonId');
    const prefillMode = searchParams.get('mode');

    // Session metadata as an object (matching SessionDebrief expectations)
    const [metadata, setMetadata] = useState<SessionMetadata>({
        date: new Date().toISOString().split('T')[0],
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
            // Call AI to generate notes from transcript
            const response = await fetch('/api/session-notes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript,
                    metadata,
                    participantId: selectedParticipantId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate notes');
            }

            const result = await response.json();
            setGeneratedNote(result);
            
            // TODO: Navigate to review/edit page or show generated note
            // For now, save directly
            await saveNote(result);
            
        } catch (error) {
            console.error('Error generating notes:', error);
            // TODO: Show error to user
        } finally {
            setIsProcessing(false);
        }
    };

    const saveNote = async (noteData: any) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/session-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...noteData,
                    metadata,
                    participant_id: selectedParticipantId || null,
                    source: mode,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            const result = await response.json();
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
                body: JSON.stringify(noteData),
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            const result = await response.json();
            
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
    const handleQuickNoteSaved = (note: any) => {
        // Navigate to the saved note
        if (note?.id) {
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

                {/* Manual Mode */}
                {mode === 'manual' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Manual Note Entry</h2>
                            <p className="text-gray-600">
                                Use this clinical template to document your session with structured fields
                            </p>
                        </div>
                        <ManualNoteForm
                            participants={participants}
                            onSave={handleSaveManualNote}
                            onCancel={() => setMode('select')}
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
                    <QuickNoteEditor
                        onBack={() => setMode('select')}
                        onSaved={handleQuickNoteSaved}
                    />
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
