'use client';

// ============================================================================
// Peer Support Studio - Message Thread Component
// File: /app/messages/components/MessageThread.tsx
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Send, Paperclip, MoreVertical,
    Loader2, Check, CheckCheck, AlertCircle,
    User, Clock, Archive, BellOff, Bell,
    Trash2, Phone, AlertTriangle
} from 'lucide-react';

interface Message {
    id: string;
    conversation_id: string;
    sender_type: 'user' | 'participant' | 'system';
    sender_user_id?: string;
    sender_participant_id?: string;
    content: string;
    content_type: string;
    status: string;
    is_edited: boolean;
    created_at: string;
    sender: {
        id?: string;
        name: string;
        avatar_url?: string;
    };
    attachments?: Array<{
        id: string;
        file_name: string;
        file_type: string;
        file_size: number;
        file_url: string;
    }>;
}

interface Conversation {
    id: string;
    type: 'direct' | 'participant' | 'team' | 'announcement';
    participant_id?: string;
    subject?: string;
    status: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    other_user?: {
        id: string;
        name: string;
        avatar_url?: string;
    };
}

interface MessageThreadProps {
    conversation: Conversation;
    organizationId: string;
    onBack: () => void;
    onMarkAsRead: () => void;
}

function getConversationName(conversation: Conversation): string {
    if (conversation.type === 'participant') {
        return conversation.participant_preferred_name ||
               `${conversation.participant_first_name || ''} ${conversation.participant_last_name || ''}`.trim() ||
               'Participant';
    }
    if (conversation.type === 'direct' && conversation.other_user) {
        return conversation.other_user.name;
    }
    return conversation.subject || 'Conversation';
}

function formatMessageTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatDateDivider(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function shouldShowDateDivider(currentMsg: Message, prevMsg?: Message): boolean {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.created_at).toDateString();
    const prevDate = new Date(prevMsg.created_at).toDateString();
    return currentDate !== prevDate;
}

export default function MessageThread({
    conversation,
    organizationId,
    onBack,
    onMarkAsRead
}: MessageThreadProps) {
    const { data: session } = useSession();
    const currentUserId = (session as any)?.internalUserId;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Track which conversation we've marked as read to prevent repeated calls
    const markedAsReadRef = useRef<string | null>(null);

    // ========================================================================
    // Fetch Messages
    // ========================================================================

    useEffect(() => {
        async function fetchMessages() {
            try {
                setLoading(true);
                const res = await fetch(
                    `/api/messages/${conversation.id}?organization_id=${organizationId}`
                );
                const data = await res.json();
                
                if (data.messages) {
                    setMessages(data.messages);
                }
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchMessages();
        
        // Only mark as read once per conversation
        if (markedAsReadRef.current !== conversation.id) {
            markedAsReadRef.current = conversation.id;
            onMarkAsRead();
        }
    }, [conversation.id, organizationId]); // Removed onMarkAsRead from deps

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [newMessage]);

    // ========================================================================
    // Send Message
    // ========================================================================

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        const content = newMessage.trim();
        setNewMessage('');
        setSending(true);

        // Optimistic update
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversation_id: conversation.id,
            sender_type: 'user',
            sender_user_id: currentUserId,
            content,
            content_type: 'text',
            status: 'sending',
            is_edited: false,
            created_at: new Date().toISOString(),
            sender: {
                id: currentUserId,
                name: 'You'
            }
        };
        setMessages(prev => [...prev, tempMessage]);

        try {
            const res = await fetch(`/api/messages/${conversation.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: organizationId,
                    content
                })
            });

            const data = await res.json();
            
            if (data.success && data.message) {
                // Replace temp message with real one
                setMessages(prev => 
                    prev.map(m => m.id === tempMessage.id ? data.message : m)
                );
            } else {
                // Remove temp message on error
                setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
                console.error('Failed to send message:', data.error);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ========================================================================
    // Render
    // ========================================================================

    const conversationName = getConversationName(conversation);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-10 h-10 bg-[#1A73A8] rounded-full flex items-center justify-center text-white font-medium">
                        {conversationName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h2 className="font-semibold text-gray-900">{conversationName}</h2>
                        <p className="text-sm text-gray-500">
                            {conversation.type === 'participant' ? 'Participant' : 
                             conversation.type === 'team' ? 'Team Chat' : 
                             'Direct Message'}
                        </p>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                <Archive className="w-4 h-4" />
                                Archive conversation
                            </button>
                            <button className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                                <BellOff className="w-4 h-4" />
                                Mute notifications
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Crisis Warning Banner */}
            <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                    If you or someone you know is in crisis, call <strong>988</strong> (Suicide & Crisis Lifeline) or <strong>911</strong> for emergencies.
                </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <p>No messages yet</p>
                            <p className="text-sm mt-1">Send a message to start the conversation</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => {
                            const prevMessage = messages[index - 1];
                            const showDateDivider = shouldShowDateDivider(message, prevMessage);
                            const isOwnMessage = message.sender_type === 'user' && 
                                message.sender?.id === currentUserId;
                            const isSystem = message.sender_type === 'system';

                            return (
                                <div key={message.id}>
                                    {/* Date Divider */}
                                    {showDateDivider && (
                                        <div className="flex items-center justify-center my-4">
                                            <div className="bg-gray-200 px-3 py-1 rounded-full text-xs text-gray-600">
                                                {formatDateDivider(message.created_at)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Message */}
                                    {isSystem ? (
                                        <div className="text-center text-sm text-gray-500 italic">
                                            {message.content}
                                        </div>
                                    ) : (
                                        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : ''}`}>
                                                {/* Sender name (for received messages) */}
                                                {!isOwnMessage && (
                                                    <p className="text-xs text-gray-500 mb-1 ml-1">
                                                        {message.sender?.name}
                                                    </p>
                                                )}
                                                
                                                <div className={`rounded-2xl px-4 py-2 ${
                                                    isOwnMessage
                                                        ? 'bg-[#1A73A8] text-white rounded-br-md'
                                                        : 'bg-white border border-gray-200 rounded-bl-md'
                                                }`}>
                                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                                    
                                                    {/* Attachments */}
                                                    {message.attachments && message.attachments.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {message.attachments.map(att => (
                                                                <a
                                                                    key={att.id}
                                                                    href={att.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`flex items-center gap-2 text-sm ${
                                                                        isOwnMessage ? 'text-blue-100 hover:text-white' : 'text-[#1A73A8] hover:underline'
                                                                    }`}
                                                                >
                                                                    <Paperclip className="w-3 h-3" />
                                                                    {att.file_name}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Timestamp & Status */}
                                                <div className={`flex items-center gap-1 mt-1 text-xs text-gray-400 ${
                                                    isOwnMessage ? 'justify-end mr-1' : 'ml-1'
                                                }`}>
                                                    <span>{formatMessageTime(message.created_at)}</span>
                                                    {isOwnMessage && (
                                                        message.status === 'sending' ? (
                                                            <Clock className="w-3 h-3" />
                                                        ) : message.status === 'read' ? (
                                                            <CheckCheck className="w-3 h-3 text-[#1A73A8]" />
                                                        ) : (
                                                            <Check className="w-3 h-3" />
                                                        )
                                                    )}
                                                    {message.is_edited && (
                                                        <span className="italic">(edited)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Compose Area */}
            <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-end gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Paperclip className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter your message (required)"
                            rows={1}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-[#1A73A8] text-white rounded-lg hover:bg-[#15608a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                
                <p className="text-xs text-gray-400 mt-2 text-center">
                    Message response times may vary. This is not monitored 24/7.
                </p>
            </div>
        </div>
    );
}
