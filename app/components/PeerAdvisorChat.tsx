'use client';

import { useVoice, VoiceProvider } from '@humeai/voice-react';
import { 
    Phone, PhoneOff, Volume2, VolumeX, Mic, MicOff,
    MessageCircle, Sparkles, Heart, Brain, Users, 
    ClipboardList, Lightbulb, Shield, RefreshCw
} from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';

interface Message {
    type: 'user_message' | 'assistant_message';
    message?: {
        content: string;
    };
    timestamp: Date;
}

interface PeerAdvisorChatProps {
    onSessionEnd: (transcript: string, messages: Message[]) => void;
    onBack: () => void;
}

// Hume EVI Configuration ID for Peer Support Advisor
// TODO: Verify which config ID is correct - you have two in your codebase
const PEER_ADVISOR_CONFIG_ID = 'b2fb313e-8ee1-4a6c-a640-d8fc8c034ad0';

function VoiceInterface({ onSessionEnd, onBack }: {
    onSessionEnd: (transcript: string, messages: Message[]) => void;
    onBack: () => void;
}) {
    const { connect, disconnect, messages, status, isMuted, mute, unmute, micFft } = useVoice();
    const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isConnected = status.value === 'connected';
    const isConnecting = status.value === 'connecting';
    const isError = status.value === 'error';

    // Monitor connection status for errors
    useEffect(() => {
        if (isError) {
            console.error('Voice connection error:', status);
            setConnectionError('Connection failed. Please try again.');
        }
    }, [status, isError]);

    // Update session messages when new messages come in
    useEffect(() => {
        if (messages.length > 0) {
            const formattedMessages: Message[] = messages
                .filter((msg): msg is typeof msg & { message: { content: string } } => 
                    (msg.type === 'user_message' || msg.type === 'assistant_message') &&
                    'message' in msg &&
                    typeof msg.message === 'object' &&
                    msg.message !== null &&
                    'content' in msg.message &&
                    typeof msg.message.content === 'string'
                )
                .map(msg => ({
                    type: msg.type as 'user_message' | 'assistant_message',
                    message: { content: msg.message.content },
                    timestamp: new Date()
                }));
            setSessionMessages(formattedMessages);
        }
    }, [messages]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sessionMessages]);

    const handleConnect = async () => {
        try {
            setConnectionError(null);
            await connect();
        } catch (error: any) {
            console.error('Failed to connect:', error);
            setConnectionError(error.message || 'Failed to connect. Please try again.');
        }
    };

    const handleDisconnect = () => {
        disconnect();
    };

    const handleEndSession = () => {
        const transcript = sessionMessages
            .filter(m => m.message?.content)
            .map(m => {
                const role = m.type === 'user_message' ? 'Peer Support Specialist' : 'Peer Advisor';
                return `${role}: ${m.message?.content}`;
            })
            .join('\n\n');

        disconnect();
        onSessionEnd(transcript, sessionMessages);
    };

    const audioLevel = micFft ? Math.max(...Array.from(micFft).slice(0, 10)) / 255 : 0;

    return (
        <div className="flex flex-col h-full">
            {/* Error Banner */}
            {connectionError && (
                <div className="bg-red-50 border-b border-red-200 p-3 flex items-center justify-between">
                    <span className="text-red-700 text-sm">{connectionError}</span>
                    <button 
                        onClick={() => setConnectionError(null)}
                        className="text-red-500 hover:text-red-700"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {sessionMessages.length === 0 && !isConnected && (
                    <div className="text-center py-8">
                        <div className="bg-white rounded-2xl shadow-md p-8 max-w-2xl mx-auto">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00BCD4] to-[#0097A7] flex items-center justify-center mx-auto mb-4">
                                <Mic className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-4">
                                Ready to Talk with Your Peer Advisor
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Click the button below to start a natural voice conversation. 
                                You can interrupt at any time, just like talking with a supportive colleague.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
                                    <Brain className="w-5 h-5 text-cyan-600 mb-1" />
                                    <p className="text-sm text-cyan-800 font-medium">Brainstorm Ideas</p>
                                    <p className="text-xs text-cyan-600">Group topics, activities, strategies</p>
                                </div>
                                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
                                    <Heart className="w-5 h-5 text-cyan-600 mb-1" />
                                    <p className="text-sm text-cyan-800 font-medium">Get Support</p>
                                    <p className="text-xs text-cyan-600">Process difficult moments</p>
                                </div>
                                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
                                    <Users className="w-5 h-5 text-cyan-600 mb-1" />
                                    <p className="text-sm text-cyan-800 font-medium">Navigate Situations</p>
                                    <p className="text-xs text-cyan-600">Work through participant challenges</p>
                                </div>
                                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
                                    <Shield className="w-5 h-5 text-cyan-600 mb-1" />
                                    <p className="text-sm text-cyan-800 font-medium">Practice Boundaries</p>
                                    <p className="text-xs text-cyan-600">Role-play conversations</p>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <p className="text-sm text-amber-800">
                                    💡 <strong>Tip:</strong> This uses Hume AI's Empathic Voice Interface, which 
                                    can detect emotions in your voice and respond with warmth and understanding.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {sessionMessages.length === 0 && isConnected && (
                    <div className="text-center py-8">
                        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <Mic className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-[#0E2235] mb-2">Listening...</h3>
                            <p className="text-gray-600">Go ahead and share what's on your mind. I'm here to help.</p>
                        </div>
                    </div>
                )}

                {sessionMessages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${message.type === 'user_message' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl p-4 ${
                                message.type === 'user_message'
                                    ? 'bg-[#00BCD4] text-white rounded-br-md'
                                    : 'bg-white shadow-md rounded-bl-md'
                            }`}
                        >
                            <p className="whitespace-pre-wrap">
                                {message.message?.content || 'Listening...'}
                            </p>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Controls */}
            <div className="bg-white border-t border-gray-200 p-4">
                {!isConnected ? (
                    <div className="text-center">
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="px-8 py-4 bg-[#00BCD4] text-white rounded-full hover:bg-[#0097A7] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center mx-auto text-lg font-medium shadow-lg"
                        >
                            {isConnecting ? (
                                <>
                                    <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <Phone className="w-6 h-6 mr-2" />
                                    Start Conversation
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 mt-3">
                            Click to start a real-time empathic conversation
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Audio Level Indicator */}
                        <div className="flex justify-center">
                            <div className="flex items-center gap-1">
                                {[...Array(10)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1 rounded-full transition-all duration-75 ${
                                            audioLevel > i / 10 ? 'bg-[#00BCD4]' : 'bg-gray-200'
                                        }`}
                                        style={{ height: `${12 + i * 3}px` }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={isMuted ? unmute : mute}
                                className={`p-4 rounded-full transition-all ${
                                    isMuted ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>

                            <button
                                onClick={handleEndSession}
                                className="px-8 py-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all flex items-center text-lg font-medium shadow-lg"
                            >
                                <PhoneOff className="w-6 h-6 mr-2" />
                                End & Summarize
                            </button>

                            <button
                                onClick={handleDisconnect}
                                className="p-4 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
                                title="End without summary"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            Speak naturally — you can interrupt at any time
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PeerAdvisorChat({ onSessionEnd, onBack }: PeerAdvisorChatProps) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to fetch a fresh token
    const fetchToken = useCallback(async () => {
        try {
            const tokenResponse = await fetch('/api/hume/access-token');
            const tokenData = await tokenResponse.json();

            if (tokenData.error) {
                throw new Error(tokenData.error);
            }

            if (!tokenData.accessToken) {
                throw new Error('Failed to get access token');
            }

            return tokenData.accessToken;
        } catch (err: any) {
            console.error('Token fetch error:', err);
            throw err;
        }
    }, []);

    useEffect(() => {
        async function initialize() {
            try {
                const token = await fetchToken();
                setAccessToken(token);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        initialize();
    }, [fetchToken]);

    // Retry handler
    const handleRetry = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = await fetchToken();
            setAccessToken(token);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00BCD4] mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing empathic voice interface...</p>
                </div>
            </div>
        );
    }

    if (error || !accessToken) {
        return (
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <PhoneOff className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
                    <p className="text-gray-600 mb-6">{error || 'Failed to initialize'}</p>
                    <p className="text-sm text-gray-500 mb-6">
                        Make sure HUME_API_KEY and HUME_SECRET_KEY are configured in your environment.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleRetry}
                            className="flex-1 px-4 py-2 bg-[#00BCD4] text-white rounded-lg hover:bg-[#0097A7] transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                        <button
                            onClick={onBack}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // KEY FIX: Pass auth and configId to VoiceProvider
    return (
        <VoiceProvider
            auth={{ type: 'accessToken', value: accessToken }}
            configId={PEER_ADVISOR_CONFIG_ID}
            // Optional: Add handlers for connection events
            onOpen={() => console.log('WebSocket opened')}
            onClose={(event) => console.log('WebSocket closed:', event)}
            onError={(error) => console.error('WebSocket error:', error)}
        >
            <VoiceInterface
                onSessionEnd={onSessionEnd}
                onBack={onBack}
            />
        </VoiceProvider>
    );
}
