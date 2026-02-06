'use client';

// ============================================================================
// Peer Support Studio - Conversation List Component
// File: /app/messages/components/ConversationList.tsx
// ============================================================================

import { User, Users, Bell, BellOff, ChevronRight } from 'lucide-react';

interface Conversation {
    id: string;
    type: 'direct' | 'participant' | 'team' | 'announcement';
    participant_id?: string;
    subject?: string;
    category?: string;
    status: string;
    last_message_at?: string;
    last_message_preview?: string;
    message_count: number;
    unread_count: number;
    muted: boolean;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    other_user?: {
        id: string;
        name: string;
        avatar_url?: string;
    };
}

interface ConversationListProps {
    conversations: Conversation[];
    selectedId: string | null;
    onSelect: (id: string) => void;
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
    if (conversation.type === 'team' || conversation.type === 'announcement') {
        return conversation.subject || 'Team Conversation';
    }
    return conversation.subject || 'Conversation';
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function formatDate(dateString?: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

export default function ConversationList({
    conversations,
    selectedId,
    onSelect
}: ConversationListProps) {
    return (
        <div className="divide-y divide-gray-100">
            {conversations.map(conversation => {
                const name = getConversationName(conversation);
                const initials = getInitials(name);
                const isSelected = conversation.id === selectedId;
                const hasUnread = conversation.unread_count > 0;

                return (
                    <button
                        key={conversation.id}
                        onClick={() => onSelect(conversation.id)}
                        className={`w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-[#367588]/5 border-l-4 border-[#367588]' : ''
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                                conversation.type === 'participant' 
                                    ? 'bg-[#1A73A8] text-white'
                                    : conversation.type === 'team'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-gray-400 text-white'
                            }`}>
                                {conversation.other_user?.avatar_url ? (
                                    <img 
                                        src={conversation.other_user.avatar_url} 
                                        alt={name}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : conversation.type === 'team' ? (
                                    <Users className="w-5 h-5" />
                                ) : (
                                    <span className="text-sm font-medium">{initials}</span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className={`font-semibold truncate ${
                                        hasUnread ? 'text-[#0E2235]' : 'text-gray-700'
                                    }`}>
                                        {name}
                                    </h4>
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                        {formatDate(conversation.last_message_at)}
                                    </span>
                                </div>

                                {/* Subject if present */}
                                {conversation.subject && conversation.type !== 'team' && (
                                    <p className={`text-sm truncate ${
                                        hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'
                                    }`}>
                                        {conversation.subject}
                                    </p>
                                )}

                                {/* Preview */}
                                <div className="flex items-center gap-2 mt-1">
                                    {hasUnread && (
                                        <span className="w-2 h-2 rounded-full bg-[#1A73A8] flex-shrink-0"></span>
                                    )}
                                    <p className={`text-sm truncate ${
                                        hasUnread ? 'text-gray-700' : 'text-gray-500'
                                    }`}>
                                        {conversation.last_message_preview || 'No messages yet'}
                                    </p>
                                </div>
                            </div>

                            {/* Indicators */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {conversation.muted && (
                                    <BellOff className="w-4 h-4 text-gray-400" />
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
