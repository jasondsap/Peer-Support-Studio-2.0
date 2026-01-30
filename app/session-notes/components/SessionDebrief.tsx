'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Mic, MicOff, Square, ArrowLeft, Loader2,
    Calendar, Clock, Users, User, Building2,
    Sparkles, AlertCircle, Volume2, UserCircle, Upload, FileAudio, X
} from 'lucide-react';

interface SessionMetadata {
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
    sessionType: 'individual' | 'group' | 'check-in' | 'crisis';
    setting: string;
    participantName?: string;
}

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
}

interface SessionDebriefProps {
    mode: 'record' | 'dictate' | 'upload';
    metadata: SessionMetadata;
    onMetadataChange: (metadata: SessionMetadata) => void;
    onComplete: (transcript: string) => void;
    onBack: () => void;
    isProcessing: boolean;
    // New participant props
    participants?: Participant[];
    selectedParticipantId?: string;
    onParticipantChange?: (participantId: string) => void;
}

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

// Prompts to help PSS know what to talk about
const DICTATION_PROMPTS = [
    "What type of session was this and how long did it last?",
    "What were the main topics you discussed?",
    "What strengths did you observe in the participant?",
    "What support or resources did you provide?",
    "Were there any action items or next steps agreed upon?",
    "Is there anything that needs follow-up?"
];

export default function SessionDebrief({ 
    mode, 
    metadata, 
    onMetadataChange, 
    onComplete, 
    onBack,
    isProcessing,
    participants = [],
    selectedParticipantId = '',
    onParticipantChange
}: SessionDebriefProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // Upload mode state
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Check for browser support
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setIsSupported(false);
                setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
            }
        }
    }, []);

    // Auto-scroll transcript
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript, interimTranscript]);

    // Recording timer
    useEffect(() => {
        if (isListening) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isListening]);

    // Rotate prompts every 30 seconds while recording
    useEffect(() => {
        if (isListening) {
            const promptInterval = setInterval(() => {
                setCurrentPromptIndex(prev => (prev + 1) % DICTATION_PROMPTS.length);
            }, 30000);
            return () => clearInterval(promptInterval);
        }
    }, [isListening]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startListening = () => {
        if (!isSupported) return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                setTranscript(prev => prev + final);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access and try again.');
            } else if (event.error === 'no-speech') {
                // This is normal - just means silence detected
                // Don't show error, recognition will continue
            } else {
                setError(`Speech recognition error: ${event.error}`);
            }
        };

        recognition.onend = () => {
            // If we're still supposed to be listening, restart
            if (isListening && recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // Already started, ignore
                }
            }
        };

        recognitionRef.current = recognition;
        
        try {
            recognition.start();
        } catch (e) {
            setError('Failed to start speech recognition. Please try again.');
        }
    };

    const stopListening = () => {
        setIsListening(false);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };

    const handleComplete = () => {
        stopListening();
        if (transcript.trim()) {
            onComplete(transcript.trim());
        }
    };

    const handleReset = () => {
        stopListening();
        setTranscript('');
        setInterimTranscript('');
        setRecordingTime(0);
        setUploadedFile(null);
        setTranscriptionProgress(0);
    };

    // File upload handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg'];
            if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|mp4|webm|ogg)$/i)) {
                setError('Please upload an audio file (MP3, WAV, M4A, etc.)');
                return;
            }
            // Validate file size (max 50MB for AssemblyAI)
            if (file.size > 50 * 1024 * 1024) {
                setError('File is too large. Maximum size is 50MB.');
                return;
            }
            setUploadedFile(file);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg'];
            if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|mp4|webm|ogg)$/i)) {
                setError('Please upload an audio file (MP3, WAV, M4A, etc.)');
                return;
            }
            if (file.size > 50 * 1024 * 1024) {
                setError('File is too large. Maximum size is 50MB.');
                return;
            }
            setUploadedFile(file);
            setError(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeFile = () => {
        setUploadedFile(null);
        setTranscript('');
        setTranscriptionProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const transcribeAudio = async () => {
        if (!uploadedFile) return;

        setIsTranscribing(true);
        setError(null);
        setTranscriptionProgress(10);

        try {
            const formData = new FormData();
            formData.append('file', uploadedFile);  // Use 'file' to match existing API
            formData.append('speakerDetection', 'false');

            setTranscriptionProgress(30);

            const response = await fetch('/api/session-notes/transcribe', {
                method: 'POST',
                body: formData,
            });

            setTranscriptionProgress(70);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to transcribe audio');
            }

            const data = await response.json();
            setTranscriptionProgress(100);
            setTranscript(data.transcript);
        } catch (err) {
            console.error('Transcription error:', err);
            setError(err instanceof Error ? err.message : 'Failed to transcribe audio. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Show loading state
    if (isProcessing) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                    <Loader2 className="w-16 h-16 animate-spin text-[#F59E0B] mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-[#0E2235] mb-2">Generating Your Session Notes</h3>
                    <p className="text-gray-500">AI is analyzing your dictation and creating professional documentation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to options
            </button>

            {/* Session Metadata */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h3 className="text-lg font-bold text-[#0E2235] mb-4">Session Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            Date
                        </label>
                        <input
                            type="date"
                            value={metadata.date}
                            onChange={(e) => onMetadataChange({...metadata, date: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Duration
                        </label>
                        <select
                            value={metadata.duration}
                            onChange={(e) => onMetadataChange({...metadata, duration: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        >
                            <option value="15">15 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">60 min</option>
                            <option value="90">90 min</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Users className="w-4 h-4 inline mr-1" />
                            Type
                        </label>
                        <select
                            value={metadata.sessionType}
                            onChange={(e) => onMetadataChange({...metadata, sessionType: e.target.value as any})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        >
                            <option value="individual">Individual</option>
                            <option value="group">Group</option>
                            <option value="check-in">Check-in</option>
                            <option value="crisis">Crisis</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Building2 className="w-4 h-4 inline mr-1" />
                            Setting
                        </label>
                        <select
                            value={metadata.setting}
                            onChange={(e) => onMetadataChange({...metadata, setting: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        >
                            {SETTINGS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Participant Selection - Full Width Below */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        <UserCircle className="w-4 h-4 inline mr-1" />
                        Participant (optional)
                    </label>
                    {participants.length > 0 ? (
                        <select
                            value={selectedParticipantId}
                            onChange={(e) => onParticipantChange?.(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        >
                            <option value="">Select participant...</option>
                            {participants.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.first_name} {p.last_name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            placeholder="Name or initials"
                            value={metadata.participantName || ''}
                            onChange={(e) => onMetadataChange({...metadata, participantName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent text-sm"
                        />
                    )}
                </div>
            </div>

            {/* Main Interface - Upload Mode */}
            {mode === 'upload' && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Upload Audio</h2>
                                <p className="text-amber-100 text-sm">
                                    Upload a recording to transcribe and generate notes
                                </p>
                            </div>
                            {isTranscribing && (
                                <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span className="text-white text-sm">Transcribing...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File Upload Area */}
                    <div className="p-6">
                        {!uploadedFile ? (
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#F59E0B] transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 font-medium mb-2">
                                    Drop your audio file here or click to browse
                                </p>
                                <p className="text-sm text-gray-400">
                                    Supports MP3, WAV, M4A, and other audio formats (max 50MB)
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* File Info */}
                                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <FileAudio className="w-6 h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={removeFile}
                                        className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                {isTranscribing && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Transcribing audio...</span>
                                            <span className="text-amber-600 font-medium">{transcriptionProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] transition-all duration-300"
                                                style={{ width: `${transcriptionProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Transcript Display */}
                                {transcript && (
                                    <div className="p-4 bg-gray-50 rounded-xl max-h-[300px] overflow-y-auto">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Transcript:</p>
                                        <p className="text-gray-600 whitespace-pre-wrap">{transcript}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="px-6 py-3 bg-red-50 border-t border-red-100">
                            <p className="text-sm text-red-700 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="bg-white border-t border-gray-200 p-6">
                        <div className="flex items-center justify-center gap-4">
                            {uploadedFile && !transcript && !isTranscribing && (
                                <button
                                    onClick={transcribeAudio}
                                    className="px-8 py-4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white rounded-full hover:opacity-90 transition-all flex items-center text-lg font-medium shadow-lg"
                                >
                                    <Sparkles className="w-6 h-6 mr-2" />
                                    Transcribe Audio
                                </button>
                            )}
                            
                            {transcript && (
                                <button
                                    onClick={handleComplete}
                                    className="px-8 py-4 bg-[#30B27A] text-white rounded-full hover:bg-[#28995c] transition-all flex items-center text-lg font-medium shadow-lg"
                                >
                                    <Sparkles className="w-6 h-6 mr-2" />
                                    Generate Notes
                                </button>
                            )}
                        </div>

                        {(uploadedFile || transcript) && (
                            <div className="mt-4 text-center">
                                <button
                                    onClick={handleReset}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Clear and start over
                                </button>
                            </div>
                        )}

                        <p className="text-xs text-gray-500 text-center mt-4">
                            Your audio will be transcribed using AI and then used to generate professional session notes
                        </p>
                    </div>
                </div>
            )}

            {/* Main Dictation Interface - Record/Dictate Modes */}
            {(mode === 'record' || mode === 'dictate') && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {mode === 'record' ? 'Session Recording' : 'Session Dictation'}
                            </h2>
                            <p className="text-amber-100 text-sm">
                                {mode === 'record' 
                                    ? 'Record your peer support session (with consent)'
                                    : 'Describe your session and AI will create the notes'
                                }
                            </p>
                        </div>
                        {isListening && (
                            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-white font-mono text-sm">{formatTime(recordingTime)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Prompt Helper */}
                {!transcript && !isListening && (
                    <div className="bg-amber-50 border-b border-amber-100 px-6 py-4">
                        <p className="text-sm text-amber-800 font-medium mb-2">💡 What to talk about:</p>
                        <ul className="text-sm text-amber-700 space-y-1">
                            {DICTATION_PROMPTS.map((prompt, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-amber-500">•</span>
                                    {prompt}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Active Prompt (while recording) */}
                {isListening && (
                    <div className="bg-green-50 border-b border-green-100 px-6 py-3">
                        <p className="text-sm text-green-700">
                            <span className="font-medium">Consider mentioning:</span> {DICTATION_PROMPTS[currentPromptIndex]}
                        </p>
                    </div>
                )}

                {/* Transcript Display */}
                <div className="p-6 min-h-[300px] max-h-[400px] overflow-y-auto bg-gray-50">
                    {!transcript && !interimTranscript && !isListening && (
                        <div className="text-center py-12">
                            <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Click the microphone to start dictating your session</p>
                        </div>
                    )}

                    {!transcript && !interimTranscript && isListening && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <Mic className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-gray-600">Listening... Start speaking about your session</p>
                        </div>
                    )}

                    {(transcript || interimTranscript) && (
                        <div className="prose prose-sm max-w-none">
                            <p className="text-gray-700 whitespace-pre-wrap">
                                {transcript}
                                <span className="text-gray-400 italic">{interimTranscript}</span>
                            </p>
                        </div>
                    )}
                    <div ref={transcriptEndRef} />
                </div>

                {/* Error Display */}
                {error && (
                    <div className="px-6 py-3 bg-red-50 border-t border-red-100">
                        <p className="text-sm text-red-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </p>
                    </div>
                )}

                {/* Controls */}
                <div className="bg-white border-t border-gray-200 p-6">
                    <div className="flex items-center justify-center gap-4">
                        {!isListening ? (
                            <>
                                <button
                                    onClick={startListening}
                                    className="px-8 py-4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white rounded-full hover:opacity-90 transition-all flex items-center text-lg font-medium shadow-lg"
                                >
                                    <Mic className="w-6 h-6 mr-2" />
                                    {transcript ? 'Continue Dictating' : 'Start Dictating'}
                                </button>
                                
                                {transcript && (
                                    <button
                                        onClick={handleComplete}
                                        className="px-8 py-4 bg-[#30B27A] text-white rounded-full hover:bg-[#28995c] transition-all flex items-center text-lg font-medium shadow-lg"
                                    >
                                        <Sparkles className="w-6 h-6 mr-2" />
                                        Generate Notes
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={stopListening}
                                    className="px-8 py-4 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-all flex items-center text-lg font-medium shadow-lg"
                                >
                                    <Square className="w-5 h-5 mr-2" />
                                    Pause
                                </button>
                                
                                <button
                                    onClick={handleComplete}
                                    className="px-8 py-4 bg-[#30B27A] text-white rounded-full hover:bg-[#28995c] transition-all flex items-center text-lg font-medium shadow-lg"
                                >
                                    <Sparkles className="w-6 h-6 mr-2" />
                                    Done - Generate Notes
                                </button>
                            </>
                        )}
                    </div>

                    {transcript && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={handleReset}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Clear and start over
                            </button>
                        </div>
                    )}

                    <p className="text-xs text-gray-500 text-center mt-4">
                        {mode === 'record' 
                            ? "⚠️ Ensure you have participant consent before recording"
                            : "Speak naturally — describe the session in your own words"
                        }
                    </p>
                </div>
            </div>
            )}

            {/* Word count indicator */}
            {transcript && (
                <div className="mt-4 text-center text-sm text-gray-500">
                    {transcript.split(/\s+/).filter(w => w.length > 0).length} words captured
                </div>
            )}
        </div>
    );
}
