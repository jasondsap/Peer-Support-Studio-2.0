'use client';

// ============================================================================
// Peer Support Studio - Message Center
// File: /app/messages/page.tsx
// MyChart-inspired messaging interface
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    MessageSquare, Search, Send, Archive, Trash2,
    ChevronRight, Plus, Loader2, User, Users,
    Bell, BellOff, MoreVertical, ArrowLeft,
    Clock, Check, CheckCheck, AlertCircle
} from 'lucide-react';
import ConversationList from './components/ConversationList';
import MessageThread from './components/MessageThread';
import ComposeMessageModal from './components/ComposeMessageModal';

// ============================================================================
// Types
// ============================================================================

interface Conversation {
    id: string;
    organization_id: string;
    type: 'direct' | 'participant' | 'team' | 'announcement';
    participant_id?: string;
    subject?: string;
    category?: string;
    status: string;
    last_message_at?: string;
    last_message_preview?: string;
    message_count: number;
    created_at: string;
    unread_count: number;
    muted: boolean;
    last_read_at?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    other_user?: {
        id: string;
        name: string;
        avatar_url?: string;
    };
}

// ============================================================================
// Main Component
// ============================================================================

function MessageCenterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
        searchParams.get('conversation')
    );
    const [totalUnread, setTotalUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'participant' | 'team' | 'direct'>('all');
    const [showCompose, setShowCompose] = useState(false);
    const [mobileShowThread, setMobileShowThread] = useState(false);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    const fetchConversations = useCallback(async () => {
        if (!currentOrg?.id) return;

        try {
            const typeParam = filter !== 'all' ? `&type=${filter}` : '';
            const res = await fetch(
                `/api/messages?organization_id=${currentOrg.id}${typeParam}`
            );
            const data = await res.json();

            if (data.conversations) {
                setConversations(data.conversations);
                setTotalUnread(data.totalUnread || 0);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }, [currentOrg?.id, filter]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Poll for new messages every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchConversations, 30000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleSelectConversation = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        setMobileShowThread(true);
        // Update URL without navigation
        router.push(`/messages?conversation=${conversationId}`, { scroll: false });
    };

    const handleBackToList = () => {
        setMobileShowThread(false);
        setSelectedConversationId(null);
        router.push('/messages', { scroll: false });
    };

    const handleConversationCreated = (conversation: Conversation) => {
        setConversations(prev => [conversation, ...prev]);
        setSelectedConversationId(conversation.id);
        setShowCompose(false);
        setMobileShowThread(true);
    };

    const handleMarkAsRead = useCallback(async (conversationId: string) => {
        try {
            await fetch(`/api/messages/${conversationId}/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_id: currentOrg?.id })
            });

            // Update local state
            setConversations(prev =>
                prev.map(c =>
                    c.id === conversationId ? { ...c, unread_count: 0 } : c
                )
            );
            setTotalUnread(prev => {
                const unreadCount = conversations.find(c => c.id === conversationId)?.unread_count || 0;
                return Math.max(0, prev - unreadCount);
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }, [currentOrg?.id]);

    // Filter conversations by search query
    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const name = conv.participant_preferred_name || conv.participant_first_name || conv.other_user?.name || '';
        const subject = conv.subject || '';
        const preview = conv.last_message_preview || '';
        return name.toLowerCase().includes(query) ||
               subject.toLowerCase().includes(query) ||
               preview.toLowerCase().includes(query);
    });

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header - Contained with grey-blue color */}
            <div className="max-w-7xl mx-auto px-4 pt-4">
                <header className="bg-slate-600 text-white rounded-lg">
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/" className="flex items-center gap-2 hover:opacity-90">
                                    <ArrowLeft className="w-5 h-5" />
                                    <span className="hidden sm:inline">Back to Dashboard</span>
                                </Link>
                            </div>
                            <h1 className="text-xl font-semibold">Message Center</h1>
                            <div className="w-24"></div> {/* Spacer for centering */}
                        </div>
                    </div>
                </header>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto">
                <div className="flex min-h-[calc(100vh-72px)]">
                    {/* Sidebar */}
                    <aside className={`w-80 bg-white border-r border-gray-200 flex-shrink-0 ${mobileShowThread ? 'hidden lg:flex' : 'flex'} flex-col`}>
                        <div className="p-4 border-b border-gray-200">
                            <button
                                onClick={() => currentOrg?.id && setShowCompose(true)}
                                disabled={!currentOrg?.id}
                                className="w-full py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-[#367588] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                                Send a message
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav className="p-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                                    filter === 'all' ? 'bg-[#b7c9e2] text-black' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <MessageSquare className="w-5 h-5" />
                                    <span>Conversations</span>
                                </div>
                                {totalUnread > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        filter === 'all' ? 'bg-white text-[#367588]' : 'bg-slate-600 text-white'
                                    }`}>
                                        {totalUnread}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setFilter('participant')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    filter === 'participant' ? 'bg-[#b7c9e2] text-black' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                <User className="w-5 h-5" />
                                <span>Participants</span>
                            </button>

                            <button
                                onClick={() => setFilter('team')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    filter === 'team' ? 'bg-[#b7c9e2] text-black' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                <Users className="w-5 h-5" />
                                <span>Team</span>
                            </button>

                            <button
                                onClick={() => setFilter('direct')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    filter === 'direct' ? 'bg-[#b7c9e2] text-black' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                <MessageSquare className="w-5 h-5" />
                                <span>Direct Messages</span>
                            </button>
                        </nav>

                        <div className="border-t border-gray-200 mt-2"></div>

                        {/* Archive link */}
                        <nav className="p-2">
                            <Link
                                href="/messages?status=archived"
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                            >
                                <Archive className="w-5 h-5" />
                                <span>Archived</span>
                            </Link>
                        </nav>
                    </aside>

                    {/* Conversation List */}
                    <div className={`w-96 bg-white border-r border-gray-200 flex-shrink-0 flex-col ${mobileShowThread ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Search */}
                        <div className="p-4 border-b border-gray-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search conversations"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#367588]/20 focus:border-[#367588]"
                                />
                            </div>
                        </div>

                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-[#367588]">Conversations</h2>
                            <p className="text-sm text-gray-500">
                                Showing {filteredConversations.length} of {conversations.length}
                            </p>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredConversations.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>No conversations yet</p>
                                    <button
                                        onClick={() => currentOrg?.id && setShowCompose(true)}
                                        className="mt-4 text-[#367588] hover:underline"
                                    >
                                        Start a conversation
                                    </button>
                                </div>
                            ) : (
                                <ConversationList
                                    conversations={filteredConversations}
                                    selectedId={selectedConversationId}
                                    onSelect={handleSelectConversation}
                                />
                            )}
                        </div>
                    </div>

                    {/* Message Thread */}
                    <main className={`flex-1 flex flex-col bg-gray-50 ${!mobileShowThread && !selectedConversationId ? 'hidden lg:flex' : 'flex'}`}>
                        {selectedConversation ? (
                            <MessageThread
                                conversation={selectedConversation}
                                organizationId={currentOrg?.id}
                                onBack={handleBackToList}
                                onMarkAsRead={() => handleMarkAsRead(selectedConversation.id)}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">Select a conversation to view messages</p>
                                    <p className="text-sm mt-2">or</p>
                                    <button
                                        onClick={() => currentOrg?.id && setShowCompose(true)}
                                        disabled={!currentOrg?.id}
                                        className="mt-4 px-4 py-2 bg-[#367588] text-white rounded-lg hover:bg-[#367588] transition-colors disabled:opacity-50"
                                    >
                                        Start a new conversation
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Compose Message Modal */}
            {showCompose && currentOrg?.id && (
                <ComposeMessageModal
                    organizationId={currentOrg.id}
                    onClose={() => setShowCompose(false)}
                    onCreated={handleConversationCreated}
                />
            )}
        </div>
    );
}

// Wrapper with Suspense for useSearchParams
export default function MessageCenterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-[#367588]" />
            </div>
        }>
            <MessageCenterContent />
        </Suspense>
    );
}
