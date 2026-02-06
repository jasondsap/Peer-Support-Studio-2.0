'use client';

// ============================================================================
// Peer Support Studio - Compose Message Modal
// File: /app/messages/components/ComposeMessageModal.tsx
// MyChart-inspired step-by-step message composition wizard
// ============================================================================

import { useState, useEffect } from 'react';
import {
    X, ArrowLeft, ChevronRight, User, Users,
    MessageSquare, Calendar, Target, FileText,
    Loader2, Search, AlertTriangle, Send,
    Paperclip, Trash2
} from 'lucide-react';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    status: string;
    primary_pss_name?: string;
}

interface TeamMember {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    avatar_url?: string;
}

interface ComposeMessageModalProps {
    organizationId: string;
    onClose: () => void;
    onCreated: (conversation: any) => void;
    preselectedParticipantId?: string;
}

type Step = 'recipient_type' | 'message_type' | 'select_recipient' | 'compose';
type RecipientType = 'participant' | 'team' | 'supervisor';
type MessageType = 'general' | 'goal_update' | 'check_in' | 'appointment' | 'resource' | 'urgent';

const MESSAGE_TYPES: Array<{ type: MessageType; label: string; description: string; icon: React.ElementType }> = [
    { 
        type: 'general', 
        label: 'General Message', 
        description: 'Send a general message or check-in',
        icon: MessageSquare 
    },
    { 
        type: 'goal_update', 
        label: 'Goal Progress Update', 
        description: 'Share or discuss progress on recovery goals',
        icon: Target 
    },
    { 
        type: 'check_in', 
        label: 'Wellness Check-in', 
        description: 'Regular check-in on how they\'re doing',
        icon: User 
    },
    { 
        type: 'appointment', 
        label: 'Appointment Related', 
        description: 'Schedule, confirm, or discuss appointments',
        icon: Calendar 
    },
    { 
        type: 'resource', 
        label: 'Share a Resource', 
        description: 'Share helpful resources or information',
        icon: FileText 
    },
];

export default function ComposeMessageModal({
    organizationId,
    onClose,
    onCreated,
    preselectedParticipantId
}: ComposeMessageModalProps) {
    // Wizard state
    const [step, setStep] = useState<Step>(preselectedParticipantId ? 'message_type' : 'recipient_type');
    const [recipientType, setRecipientType] = useState<RecipientType | null>(
        preselectedParticipantId ? 'participant' : null
    );
    const [messageType, setMessageType] = useState<MessageType | null>(null);
    const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
        preselectedParticipantId || null
    );

    // Data state
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Compose state
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    // ========================================================================
    // Fetch Recipients
    // ========================================================================

    useEffect(() => {
        async function fetchRecipients() {
            if (!recipientType || step !== 'select_recipient') return;
            
            setLoading(true);
            try {
                if (recipientType === 'participant') {
                    const res = await fetch(`/api/participants?organization_id=${organizationId}&status=active`);
                    const data = await res.json();
                    setParticipants(data.participants || []);
                } else if (recipientType === 'team' || recipientType === 'supervisor') {
                    const res = await fetch(`/api/organizations/${organizationId}/members`);
                    const data = await res.json();
                    setTeamMembers(data.members || []);
                }
            } catch (error) {
                console.error('Error fetching recipients:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchRecipients();
    }, [recipientType, step, organizationId]);

    // ========================================================================
    // Navigation
    // ========================================================================

    const goBack = () => {
        if (step === 'compose') {
            setStep('select_recipient');
        } else if (step === 'select_recipient') {
            setStep('message_type');
        } else if (step === 'message_type') {
            if (preselectedParticipantId) {
                onClose();
            } else {
                setStep('recipient_type');
            }
        } else {
            onClose();
        }
    };

    const selectRecipientType = (type: RecipientType) => {
        setRecipientType(type);
        setStep('message_type');
    };

    const selectMessageType = (type: MessageType) => {
        setMessageType(type);
        // Auto-set subject based on type
        const subjectMap: Record<MessageType, string> = {
            general: '',
            goal_update: 'Goal Progress Update',
            check_in: 'Checking In',
            appointment: 'Regarding Your Appointment',
            resource: 'Resource for You',
            urgent: 'Important Message'
        };
        setSubject(subjectMap[type]);
        setStep('select_recipient');
    };

    const selectRecipient = (id: string) => {
        setSelectedRecipientId(id);
        setStep('compose');
    };

    // ========================================================================
    // Send Message
    // ========================================================================

    const handleSend = async () => {
        if (!message.trim() || !selectedRecipientId) return;
        
        if (!organizationId) {
            console.error('ComposeMessageModal: organizationId is missing', { organizationId });
            alert('Organization not loaded. Please try again.');
            return;
        }

        console.log('Sending message:', { organizationId, recipientType, selectedRecipientId, subject, messageType });

        setSending(true);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: organizationId,
                    type: recipientType === 'participant' ? 'participant' : 'direct',
                    participant_id: recipientType === 'participant' ? selectedRecipientId : undefined,
                    recipient_user_id: recipientType !== 'participant' ? selectedRecipientId : undefined,
                    subject: subject || undefined,
                    category: messageType,
                    initial_message: message
                })
            });

            const data = await res.json();

            if (data.success && data.conversation) {
                onCreated(data.conversation);
            } else {
                alert(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // ========================================================================
    // Get recipient info for display
    // ========================================================================

    const getSelectedRecipientName = (): string => {
        if (recipientType === 'participant') {
            const p = participants.find(p => p.id === selectedRecipientId);
            return p ? (p.preferred_name || `${p.first_name} ${p.last_name}`) : '';
        } else {
            const m = teamMembers.find(m => m.id === selectedRecipientId);
            return m ? `${m.first_name} ${m.last_name}` : '';
        }
    };

    // ========================================================================
    // Filter recipients by search
    // ========================================================================

    const filteredParticipants = participants.filter(p => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const name = `${p.first_name} ${p.last_name} ${p.preferred_name || ''}`.toLowerCase();
        return name.includes(query);
    });

    const filteredTeamMembers = teamMembers.filter(m => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const name = `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase();
        return name.includes(query);
    });

    // ========================================================================
    // Render
    // ========================================================================

    const renderHeader = () => {
        const titles: Record<Step, string> = {
            recipient_type: 'New message',
            message_type: 'What would you like to do?',
            select_recipient: recipientType === 'participant' ? 'Select a Participant' : 'Select a Team Member',
            compose: messageType === 'general' ? 'New Message' : MESSAGE_TYPES.find(t => t.type === messageType)?.label || 'New Message'
        };

        return (
            <div className="bg-[#367588] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {step !== 'recipient_type' && (
                        <button onClick={goBack} className="p-1 hover:bg-white/10 rounded">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="font-semibold">{titles[step]}</h2>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-5 h-5" />
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                {renderHeader()}

                <div className="flex-1 overflow-y-auto">
                    {/* Step 1: Recipient Type */}
                    {step === 'recipient_type' && (
                        <div className="p-4">
                            <p className="text-[#367588] font-medium mb-4">
                                Where do you want to send this message?
                            </p>
                            
                            <div className="space-y-2">
                                <button
                                    onClick={() => selectRecipientType('participant')}
                                    className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#1A73A8] text-white flex items-center justify-center">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-[#0E2235]">Message a Participant</p>
                                            <p className="text-sm text-gray-500">Send a message to someone you support</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>

                                <button
                                    onClick={() => selectRecipientType('team')}
                                    className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-[#0E2235]">Message a Team Member</p>
                                            <p className="text-sm text-gray-500">Communicate with colleagues in your organization</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>

                                <button
                                    onClick={() => selectRecipientType('supervisor')}
                                    className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-[#0E2235]">Message Your Supervisor</p>
                                            <p className="text-sm text-gray-500">Questions, updates, or supervision requests</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Message Type */}
                    {step === 'message_type' && (
                        <div className="p-4">
                            <div className="space-y-2">
                                {MESSAGE_TYPES.map(({ type, label, description, icon: Icon }) => (
                                    <button
                                        key={type}
                                        onClick={() => selectMessageType(type)}
                                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                                <Icon className="w-5 h-5 text-gray-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium text-[#0E2235]">{label}</p>
                                                <p className="text-sm text-gray-500">{description}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Select Recipient */}
                    {step === 'select_recipient' && (
                        <div>
                            {/* Search */}
                            <div className="p-4 border-b border-gray-200">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#367588]/20 focus:border-[#367588]"
                                    />
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Your message may be seen by the recipient and their care team.
                            </div>

                            {/* List */}
                            <div className="divide-y divide-gray-100">
                                {loading ? (
                                    <div className="p-8 flex justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#367588]" />
                                    </div>
                                ) : recipientType === 'participant' ? (
                                    filteredParticipants.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                            <p>No participants found</p>
                                        </div>
                                    ) : (
                                        filteredParticipants.map(participant => (
                                            <button
                                                key={participant.id}
                                                onClick={() => selectRecipient(participant.id)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-[#1A73A8] text-white flex items-center justify-center">
                                                        <span className="text-sm font-medium">
                                                            {participant.first_name[0]}{participant.last_name[0]}
                                                        </span>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-medium text-[#0E2235]">
                                                            {participant.preferred_name || `${participant.first_name} ${participant.last_name}`}
                                                        </p>
                                                        {participant.primary_pss_name && (
                                                            <p className="text-sm text-gray-500">
                                                                PSS: {participant.primary_pss_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </button>
                                        ))
                                    )
                                ) : (
                                    filteredTeamMembers.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                            <p>No team members found</p>
                                        </div>
                                    ) : (
                                        filteredTeamMembers.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={() => selectRecipient(member.id)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center">
                                                        {member.avatar_url ? (
                                                            <img src={member.avatar_url} alt="" className="w-full h-full rounded-full" />
                                                        ) : (
                                                            <span className="text-sm font-medium">
                                                                {member.first_name[0]}{member.last_name[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-medium text-[#0E2235]">
                                                            {member.first_name} {member.last_name}
                                                        </p>
                                                        <p className="text-sm text-gray-500 capitalize">
                                                            {member.role}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </button>
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Compose */}
                    {step === 'compose' && (
                        <div className="p-4">
                            {/* Recipient */}
                            <div className="mb-4 pb-4 border-b border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">To</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-[#1A73A8] text-white flex items-center justify-center text-sm">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <span className="font-medium">{getSelectedRecipientName()}</span>
                                </div>
                            </div>

                            {/* Crisis Warning */}
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <p className="font-medium">Call 911 if you have an emergency.</p>
                                <p className="mt-1 text-red-600">
                                    Message response times may vary and may take 1-3 business days.
                                </p>
                            </div>

                            {/* Subject */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject (required)"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#367588]/20 focus:border-[#367588]"
                                />
                            </div>

                            {/* Message */}
                            <div className="mb-4">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter your message (required)"
                                    rows={6}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-[#367588]/20 focus:border-[#367588]"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions (for compose step) */}
                {step === 'compose' && (
                    <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                                Discard
                            </button>
                            <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                <Paperclip className="w-4 h-4" />
                                Attach
                            </button>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || !subject.trim() || sending}
                            className="flex items-center gap-2 px-6 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#15608a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    Send
                                    <Send className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
