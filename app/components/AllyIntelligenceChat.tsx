'use client';

import { useState, useRef, useEffect } from 'react';
import { 
    MessageCircle, 
    Send, 
    X, 
    Sparkles, 
    ChevronDown,
    Loader2,
    User,
    Bot,
    Minimize2,
    Maximize2
} from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AllyIntelligenceChatProps {
    organizationId: string;
}

export default function AllyIntelligenceChat({ organizationId }: AllyIntelligenceChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && !isMinimized) {
            inputRef.current?.focus();
        }
    }, [isOpen, isMinimized]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/ally-intelligence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    organizationId
                })
            });

            if (!response.ok) throw new Error('Failed to get response');

            const data = await response.json();

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm sorry, I encountered an error. Please try again.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickQuestion = (question: string) => {
        setInput(question);
        setTimeout(() => {
            handleSubmit();
        }, 100);
    };

    const quickQuestions = [
        "How many active participants do I have?",
        "Who has upcoming sessions this week?",
        "Show me recent milestones"
    ];

    // Closed state - floating button
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 z-50 group"
                title="Ask Ally"
            >
                <div className="relative">
                    <Sparkles className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Ask Ally about participants
                </span>
            </button>
        );
    }

    // Minimized state
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-72">
                <div 
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg cursor-pointer"
                    onClick={() => setIsMinimized(false)}
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-medium">Ally</span>
                        {messages.length > 0 && (
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                {messages.length} messages
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                            className="p-1 hover:bg-white/20 rounded"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                            className="p-1 hover:bg-white/20 rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Full chat view
    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Ally</h3>
                        <p className="text-xs text-purple-100">Participant Intelligence</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsMinimized(true)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        title="Minimize"
                    >
                        <Minimize2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-purple-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">Ask me anything!</h4>
                        <p className="text-sm text-gray-500 mb-6">
                            I can help you find information about your participants, goals, sessions, and more.
                        </p>
                        <div className="space-y-2 w-full">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Quick questions</p>
                            {quickQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickQuestion(q)}
                                    className="w-full text-left text-sm p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] p-3 rounded-xl ${
                                        message.role === 'user'
                                            ? 'bg-purple-600 text-white rounded-br-sm'
                                            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                                    }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-gray-600" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-white p-3 rounded-xl rounded-bl-sm shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Searching...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about participants..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                    Try: "What's Marc working on?" or "Who needs follow-up?"
                </p>
            </form>
        </div>
    );
}
