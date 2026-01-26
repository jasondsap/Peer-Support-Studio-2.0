'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

type AllySidebarProps = {
    currentTopic: string;
    sessionType: string;
    settingType: string;
    onTopicSuggestion: (topic: string) => void;
    resetTrigger?: number;
    initialOpen?: boolean;
};

export default function AllySidebar({
    currentTopic,
    sessionType,
    settingType,
    onTopicSuggestion,
    resetTrigger = 0,
    initialOpen = false
}: AllySidebarProps) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (initialOpen) {
            setIsOpen(true);
        }
    }, [initialOpen]);

    const initializeAlly = () => {
        const contextGreeting = currentTopic
            ? `Hi! I see you're working on a lesson about "${currentTopic}" for a ${sessionType} session in a ${settingType} setting. I'd love to help you brainstorm and refine this idea. What aspects would you like to explore together?`
            : `Hi there! I'm Ally, and I'm here to help you brainstorm and develop great lesson topics for your peer support sessions. What kind of session are you thinking about facilitating?`;

        setMessages([{
            role: 'assistant',
            content: contextGreeting,
            timestamp: new Date()
        }]);
    };

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            initializeAlly();
        }
    }, [isOpen, currentTopic, sessionType, settingType]);

    useEffect(() => {
        if (resetTrigger > 0) {
            setMessages([]);
            setInput('');
            if (isOpen) {
                initializeAlly();
            }
        }
    }, [resetTrigger]);

    const handleReset = () => {
        if (confirm('Start a new brainstorming session? Your current conversation will be cleared.')) {
            setMessages([]);
            setInput('');
            initializeAlly();
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        try {
            const contextualMessages = updatedMessages.map((msg, idx) => {
                if (idx === 0 && msg.role === 'assistant') {
                    return {
                        role: 'system' as const,
                        content: `You are Ally, helping a peer support specialist brainstorm lesson topics. Current context: Session Type: ${sessionType}, Setting: ${settingType}${currentTopic ? `, Current Topic Idea: "${currentTopic}"` : ''}. Help them refine ideas, ask clarifying questions, and suggest specific, actionable lesson topics. When you suggest a refined topic, format it clearly so they can use it.`
                    };
                }
                return {
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content
                };
            });

            const response = await fetch('/api/ally-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: contextualMessages
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                timestamp: new Date()
            };

            setMessages([...updatedMessages, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: "I'm having trouble connecting right now. Please try again in a moment.",
                timestamp: new Date()
            };
            setMessages([...updatedMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const extractTopicFromMessage = (content: string): string | null => {
        const quotedMatch = content.match(/"([^"]+)"/);
        if (quotedMatch) return quotedMatch[1];

        const topicMatch = content.match(/Topic:\s*([^\n.]+)/i);
        if (topicMatch) return topicMatch[1].trim();

        return null;
    };

    const handleUseTopic = (content: string) => {
        const topic = extractTopicFromMessage(content);
        if (topic) {
            onTopicSuggestion(topic);
            const successMessage: Message = {
                role: 'assistant',
                content: `Great! I've added that topic to your lesson generator. Feel free to keep brainstorming or close this sidebar and start generating your lesson!`,
                timestamp: new Date()
            };
            setMessages([...messages, successMessage]);
        }
    };

    const quickStarters = [
        "I need ideas for a coping skills lesson",
        "Help me plan a session about triggers",
        "What topics work well for new groups?",
        "I want to focus on building peer connections"
    ];

    const handleQuickStart = (starter: string) => {
        setInput(starter);
    };

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <div className="fixed right-6 bottom-6 flex flex-col items-center gap-2 z-40">
                    <div className="bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-[#1A73A8] animate-pulse">
                        <p className="text-sm font-semibold text-[#1A73A8]">💡 Need Help?</p>
                        <p className="text-xs text-gray-600">Brainstorm with Ally</p>
                    </div>
                    <button
                        onClick={() => setIsOpen(true)}
                        className="text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all group relative"
                        style={{
                            background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                        }}
                        title="Brainstorm with Ally"
                    >
                        <MessageCircle className="w-6 h-6" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-bounce"></div>
                    </button>
                </div>
            )}

            {/* Sidebar */}
            {isOpen && (
                <div className="fixed right-0 top-0 h-screen w-96 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-50 animate-slide-in">
                    {/* Header */}
                    <div
                        className="text-white p-4 flex items-center justify-between"
                        style={{
                            background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold backdrop-blur">
                                A
                            </div>
                            <div>
                                <h2 className="font-semibold">Ally</h2>
                                <p className="text-xs text-white/80">Brainstorm Helper</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded"
                                title="Start new conversation"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white transition-colors p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFB]">
                        {messages.length === 1 && (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-2 text-center">Quick starters:</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {quickStarters.map((starter, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleQuickStart(starter)}
                                            className="text-left text-xs p-2 bg-white border border-gray-200 rounded-lg hover:border-[#1A73A8] hover:bg-[#1A73A8]/5 transition-colors"
                                        >
                                            <Sparkles className="w-3 h-3 inline mr-1 text-[#30B27A]" />
                                            {starter}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex gap-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${message.role === 'user'
                                            ? 'bg-gray-700 text-white'
                                            : 'text-white'
                                        }`}
                                        style={message.role === 'assistant' ? {
                                            background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                        } : undefined}
                                    >
                                        {message.role === 'user' ? 'Y' : 'A'}
                                    </div>
                                    <div>
                                        <div className={`rounded-2xl px-4 py-2 ${message.role === 'user'
                                                ? 'bg-[#1A73A8] text-white'
                                                : 'bg-white text-gray-900 border border-gray-200'
                                            }`}>
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                {message.content}
                                            </p>
                                        </div>

                                        {message.role === 'assistant' && extractTopicFromMessage(message.content) && (
                                            <button
                                                onClick={() => handleUseTopic(message.content)}
                                                className="mt-2 text-xs text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors hover:opacity-90"
                                                style={{
                                                    background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                                }}
                                            >
                                                <ArrowRight className="w-3 h-3" />
                                                Use This Topic
                                            </button>
                                        )}

                                        <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-gray-500' : 'text-gray-400'
                                            }`}>
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-2">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 text-sm font-semibold"
                                        style={{
                                            background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                        }}
                                    >
                                        A
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-gray-200 p-4 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Share your ideas..."
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-gray-900"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !input.trim()}
                                className="px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                style={{
                                    background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                }}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            💡 Ally helps you brainstorm better lesson topics
                        </p>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-in {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
            `}</style>
        </>
    );
}
