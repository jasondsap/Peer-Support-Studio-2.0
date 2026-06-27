// app/components/PeerAdvisorChat.tsx
// RAG-powered Peer Advisor chat — replaces Hume voice integration
// Evidence-based responses with citations from SAMHSA & NAADAC sources

'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import {
    MessageSquare,
    Send,
    Plus,
    Clock,
    ShieldCheck,
    ChevronDown,
    ChevronRight,
    Loader2,
    BookOpen,
    Trash2,
    History,
    X,
    Sparkles,
    FileText,
    Check,
    Search,
    UserPlus,
    AlertCircle,
    ExternalLink,
} from 'lucide-react';

// ─── TYPES ───

interface Citation {
    doc: string;
    section: string;
    pages?: string;
    usage?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: Citation[];
    timestamp?: string;
}

interface Conversation {
    id: string;
    title: string;
    message_count: number;
    last_message_at: string;
    created_at: string;
}

interface PeerAdvisorChatProps {
    userName?: string;
}

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string | null;
}

const EXAMPLE_QUERIES = [
    'What are SAMHSA\'s 10 guiding principles of recovery?',
    'How should I support someone who just started buprenorphine?',
    'What\'s the best way to screen for co-occurring disorders?',
    'Can you explain the role trauma plays in substance use?',
    'How do I help a client build their recovery capital?',
    'What counseling approaches work best for preventing relapse?',
];

const SOURCE_BADGES = [
    { label: 'TIP 64', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { label: 'TIP 57', bg: 'bg-blue-100', text: 'text-blue-700' },
    { label: 'TIP 35', bg: 'bg-amber-100', text: 'text-amber-700' },
    { label: 'TIP 42', bg: 'bg-purple-100', text: 'text-purple-700' },
    { label: 'TIP 63', bg: 'bg-red-100', text: 'text-red-700' },
    { label: 'TIP 65', bg: 'bg-cyan-100', text: 'text-cyan-700' },
    { label: '10 Principles', bg: 'bg-rose-100', text: 'text-rose-700' },
    { label: 'Peer Competencies', bg: 'bg-teal-100', text: 'text-teal-700' },
    { label: 'NAADAC Ethics', bg: 'bg-orange-100', text: 'text-orange-700' },
];

// ─── HELPERS ───

function getDocColor(docName: string): string {
    if (!docName) return 'bg-gray-100 text-gray-800';
    const d = docName.toLowerCase();
    if (d.includes('tip 64')) return 'bg-emerald-100 text-emerald-800';
    if (d.includes('tip 57')) return 'bg-blue-100 text-blue-800';
    if (d.includes('tip 35')) return 'bg-amber-100 text-amber-800';
    if (d.includes('tip 42')) return 'bg-purple-100 text-purple-800';
    if (d.includes('tip 63')) return 'bg-red-100 text-red-800';
    if (d.includes('tip 65')) return 'bg-cyan-100 text-cyan-800';
    if (d.includes('guiding') || d.includes('principle')) return 'bg-rose-100 text-rose-800';
    if (d.includes('competenc')) return 'bg-teal-100 text-teal-800';
    if (d.includes('naadac') || d.includes('ethic')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
}

function timeAgo(dateString: string): string {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── SUB-COMPONENTS ───

function TypingIndicator() {
    return (
        <div className="flex items-center gap-3 py-3 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-[#30B27A] flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-[#30B27A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#30B27A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#30B27A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
    );
}

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const docName = citation.doc || 'Source';
    const colorClass = getDocColor(docName);

    // Build display text: prefer section, fall back to pages
    const sectionText = citation.section || '';
    const pagesText = citation.pages ? `pp. ${citation.pages}` : '';
    const displayText = sectionText || pagesText || 'Evidence source';

    return (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-2.5 p-2.5 text-left hover:bg-gray-50 transition-colors"
            >
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${colorClass}`}>
                    <ShieldCheck className="w-3 h-3" />
                    {docName}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 leading-snug truncate">
                        {displayText}
                    </p>
                    {sectionText && pagesText && (
                        <p className="text-xs text-gray-500 mt-0.5">{pagesText}</p>
                    )}
                </div>
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
            </button>
            {expanded && citation.usage && (
                <div className="px-3 pb-2.5 border-t border-gray-100">
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed italic">
                        {citation.usage}
                    </p>
                </div>
            )}
            {docName && docName !== 'Source' && (
                <div className="px-2.5 pb-2 -mt-0.5">
                    <a
                        href={`/doc-library?q=${encodeURIComponent(docName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#1A73A8] hover:underline"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open in Reference Library
                    </a>
                </div>
            )}
        </div>
    );
}

function ChatMessage({
    message,
    onSaveToNote,
    savedTo,
}: {
    message: Message;
    onSaveToNote: (m: Message) => void;
    savedTo?: string;
}) {
    const isUser = message.role === 'user';
    // Filter out empty/invalid citations
    const validCitations = (!isUser && message.citations)
        ? message.citations.filter(c => c && (c.doc || c.section || c.usage))
        : [];
    const hasCitations = validCitations.length > 0;

    return (
        <div className={`animate-fadeIn ${isUser ? 'flex justify-end' : ''}`}>
            <div className={isUser ? 'max-w-[85%]' : 'max-w-full'}>
                <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-[#30B27A] flex items-center justify-center flex-shrink-0 mt-1">
                            <BookOpen className="w-4 h-4 text-white" />
                        </div>
                    )}
                    <div
                        className={
                            isUser
                                ? 'px-4 py-2.5 rounded-2xl rounded-br-md bg-[#1A73A8] text-white'
                                : 'flex-1'
                        }
                    >
                        {isUser ? (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                        ) : (
                            <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-[#0E2235] prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-gray-800 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>

                {hasCitations && (
                    <div className="ml-11 mt-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#30B27A]" />
                            <span className="text-xs font-semibold text-[#30B27A]">
                                Evidence Sources ({validCitations.length})
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {validCitations.map((citation, i) => (
                                <CitationCard key={i} citation={citation} index={i} />
                            ))}
                        </div>
                    </div>
                )}

                {!isUser && (
                    <div className="ml-11 mt-3">
                        {savedTo ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                                <Check className="w-3.5 h-3.5" />
                                Saved to {savedTo}&apos;s session notes
                            </span>
                        ) : (
                            <button
                                onClick={() => onSaveToNote(message)}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#1A73A8] hover:text-[#1A73A8] transition-colors"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Save to session note
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───

export default function PeerAdvisorChat({ userName }: PeerAdvisorChatProps) {
    const { data: session } = useSession();
    const currentOrg = (session as any)?.currentOrganization as { id: string; name: string } | null;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // History sidebar
    const [historyOpen, setHistoryOpen] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Save-to-session-note flow
    const [saveTarget, setSaveTarget] = useState<Message | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [participantsLoaded, setParticipantsLoaded] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedNotes, setSavedNotes] = useState<Record<string, string>>({}); // message.id -> participant name

    // Lazily load this user's caseload for the participant picker
    const loadParticipants = async () => {
        if (participantsLoaded || !currentOrg?.id) return;
        try {
            const res = await fetch(`/api/participants?organization_id=${currentOrg.id}&pss_filter=mine`);
            if (res.ok) {
                const data = await res.json();
                if (data.participants) setParticipants(data.participants);
            }
        } catch (err) {
            console.error('Failed to load participants:', err);
        } finally {
            setParticipantsLoaded(true);
        }
    };

    const openSaveNote = (message: Message) => {
        setSaveError(null);
        setParticipantSearch('');
        setSaveTarget(message);
        loadParticipants();
    };

    const handleSaveNote = async (participant: Participant) => {
        if (!saveTarget) return;
        if (!currentOrg?.id) { setSaveError('No organization selected.'); return; }
        setSaveLoading(true);
        setSaveError(null);
        try {
            const res = await fetch('/api/session-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: participant.id,
                    source: 'advisor',
                    metadata: {
                        source: 'advisor',
                        created_from: 'peer_advisor',
                        captured_at: new Date().toISOString(),
                    },
                    pss_note: { content: saveTarget.content },
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setSaveError(d.error || 'Could not save note.');
                return;
            }
            const name = `${participant.preferred_name || participant.first_name} ${participant.last_name}`;
            setSavedNotes(prev => ({ ...prev, [saveTarget.id]: name }));
            setSaveTarget(null);
        } catch (err) {
            console.error('Save note error:', err);
            setSaveError('Could not save note. Please try again.');
        } finally {
            setSaveLoading(false);
        }
    };

    const filteredParticipants = participants.filter(p => {
        const name = `${p.first_name} ${p.last_name} ${p.preferred_name || ''}`.toLowerCase();
        return name.includes(participantSearch.toLowerCase());
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    // Load conversation list
    const loadConversations = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch('/api/peer-advisor-chat/history');
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations || []);
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Load a specific conversation
    const loadConversation = async (convId: string) => {
        try {
            const res = await fetch(`/api/peer-advisor-chat/history?id=${convId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setConversationId(convId);
                setHistoryOpen(false);
            }
        } catch (err) {
            console.error('Failed to load conversation:', err);
        }
    };

    // Delete a conversation
    const deleteConversation = async (convId: string) => {
        try {
            const res = await fetch('/api/peer-advisor-chat/history', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: convId }),
            });
            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== convId));
                if (conversationId === convId) {
                    handleNewChat();
                }
            }
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setConversationId(null);
        setInput('');
        inputRef.current?.focus();
    };

    const handleSubmit = async (e?: FormEvent, overrideQuery?: string) => {
        e?.preventDefault();
        const query = overrideQuery || input.trim();
        if (!query || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: query,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/peer-advisor-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    conversationId,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Request failed');
            }

            // Update conversation ID if this was a new chat
            if (data.conversationId && !conversationId) {
                setConversationId(data.conversationId);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.answer,
                citations: data.citations,
                timestamp: new Date().toISOString(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'I\'m having trouble connecting right now. Please try again in a moment.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isEmptyState = messages.length === 0;
    const hasMessages = messages.length > 0;

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#30B27A] flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-[#0E2235]">Peer Advisor</h2>
                            <p className="text-xs text-gray-500">Evidence-based guidance from SAMHSA & NAADAC</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* History button */}
                        <button
                            onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) loadConversations(); }}
                            className={`p-2 rounded-lg transition-colors ${
                                historyOpen ? 'bg-gray-200 text-[#0E2235]' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title="Chat history"
                        >
                            <History className="w-5 h-5" />
                        </button>
                        {/* New Chat button */}
                        {hasMessages && (
                            <button
                                onClick={handleNewChat}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                New Chat
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* History sidebar overlay */}
            {historyOpen && (
                <div className="absolute top-[60px] right-0 w-80 max-h-[70vh] bg-white border-l border-b border-gray-200 shadow-lg rounded-bl-xl z-20 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-[#0E2235]">Recent Conversations</h3>
                        <button onClick={() => setHistoryOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">No conversations yet</p>
                        ) : (
                            <div className="py-1">
                                {conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        className={`group flex items-start gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                                            conversationId === conv.id ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <button
                                            onClick={() => loadConversation(conv.id)}
                                            className="flex-1 text-left min-w-0"
                                        >
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {conv.title}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {timeAgo(conv.last_message_at || conv.created_at)}
                                                <span className="text-gray-300 mx-1">·</span>
                                                {conv.message_count} messages
                                            </p>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                                            title="Delete conversation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
                    {isEmptyState ? (
                        <div className="flex flex-col items-center justify-center min-h-[50vh]">
                            <div className="w-14 h-14 rounded-2xl bg-[#30B27A]/10 flex items-center justify-center mb-5">
                                <Sparkles className="w-7 h-7 text-[#30B27A]" />
                            </div>
                            <h3 className="text-xl font-semibold text-[#0E2235] mb-2 text-center">
                                {userName ? `Hey ${userName}, what can I help with?` : 'What can I help you with?'}
                            </h3>
                            <p className="text-sm text-gray-500 text-center max-w-md mb-6 leading-relaxed">
                                Ask me anything about recovery support, counseling approaches,
                                co-occurring disorders, ethics, or best practices. Every answer
                                is grounded in the evidence and I&apos;ll show you exactly where it comes from.
                            </p>

                            {/* Source badges */}
                            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                                {SOURCE_BADGES.map(badge => (
                                    <span
                                        key={badge.label}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}
                                    >
                                        {badge.label}
                                    </span>
                                ))}
                            </div>

                            {/* Example queries */}
                            <div className="w-full max-w-xl">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-2">
                                    Try asking
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {EXAMPLE_QUERIES.map(query => (
                                        <button
                                            key={query}
                                            onClick={() => handleSubmit(undefined, query)}
                                            className="text-left px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-[#30B27A] hover:bg-green-50/30 text-sm text-gray-600 hover:text-gray-800 transition-all group"
                                        >
                                            <span className="text-[#30B27A] group-hover:text-[#27A06D] mr-1">→</span>
                                            {query}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {messages.map(message => (
                                <ChatMessage
                                    key={message.id}
                                    message={message}
                                    onSaveToNote={openSaveNote}
                                    savedTo={savedNotes[message.id]}
                                />
                            ))}
                            {loading && <TypingIndicator />}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 py-3">
                <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
                    <div className="flex-1">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything about peer support, recovery, counseling approaches..."
                            rows={1}
                            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#30B27A]/40 focus:border-[#30B27A] placeholder:text-gray-400"
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#30B27A] text-white flex items-center justify-center hover:bg-[#27A06D] disabled:opacity-40 disabled:hover:bg-[#30B27A] transition-colors"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </form>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center max-w-3xl mx-auto">
                    Responses are grounded in SAMHSA and NAADAC source documents.
                    Your knowledgeable colleague, not a clinician — always use professional judgment.
                </p>
            </div>

            {/* Save-to-session-note: participant picker */}
            {saveTarget && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#1A73A8]/10 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-[#1A73A8]" />
                                </div>
                                <h3 className="text-sm font-semibold text-[#0E2235] truncate">Save to a session note</h3>
                            </div>
                            <button
                                onClick={() => setSaveTarget(null)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="px-5 py-3 border-b border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">
                                Choose the participant this guidance is for. A draft note will be created from the advisor&apos;s answer.
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={participantSearch}
                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                    placeholder="Search participants..."
                                    autoFocus
                                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/40 focus:border-[#1A73A8] placeholder:text-gray-400"
                                />
                            </div>
                            {saveError && (
                                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                                </p>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 py-2">
                            {!participantsLoaded ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                            ) : filteredParticipants.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-8">
                                    {participants.length === 0 ? 'No participants found on your caseload.' : 'No matches.'}
                                </p>
                            ) : (
                                filteredParticipants.map(p => (
                                    <button
                                        key={p.id}
                                        disabled={saveLoading}
                                        onClick={() => handleSaveNote(p)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700 flex items-center justify-between disabled:opacity-50 transition-colors"
                                    >
                                        <span>{p.preferred_name || p.first_name} {p.last_name}</span>
                                        {saveLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        ) : (
                                            <UserPlus className="w-4 h-4 text-[#1A73A8]" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
