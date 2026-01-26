'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Calendar, Clock, Users, User,
    Building2, BookOpen, Check, X, MessageSquare,
    Shield, Loader2, AlertCircle, ChevronDown,
    ChevronRight, Eye, Filter, CheckCircle,
    FileText
} from 'lucide-react';

interface ServicePlan {
    id: string;
    user_id: string;
    organization_id: string;
    service_type: 'individual' | 'group';
    planned_date: string;
    planned_duration: number;
    actual_duration?: number;
    setting: string;
    service_code?: string;
    participant_id?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    user_first_name?: string;
    user_last_name?: string;
    notes?: string;
    attendance_count?: number;
    delivered_as_planned?: boolean;
    deviation_notes?: string;
    session_note_id?: string;
    status: 'draft' | 'planned' | 'approved' | 'completed' | 'verified';
    created_at: string;
    lesson?: { id: string; title: string };
    goal?: { id: string; title: string };
}

type ReviewTab = 'pending' | 'completed' | 'verified';

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
        planned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Awaiting Review' },
        approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
        completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Awaiting Verification' },
        verified: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified' }
    };

    const { bg, text, label } = config[status] || config.draft;

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
}

// Helper to get participant display name
function getParticipantDisplayName(service: ServicePlan): string | null {
    if (!service.participant_id) return null;
    return service.participant_preferred_name || 
           `${service.participant_first_name || ''} ${service.participant_last_name || ''}`.trim() ||
           null;
}

// Helper to get PSS display name
function getPSSDisplayName(service: ServicePlan): string {
    return `${service.user_first_name || ''} ${service.user_last_name || ''}`.trim() || 'Unknown';
}

export default function SupervisorReviewPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const [services, setServices] = useState<ServicePlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ReviewTab>('pending');
    const [expandedService, setExpandedService] = useState<string | null>(null);

    // Action modal state
    const [actionService, setActionService] = useState<ServicePlan | null>(null);
    const [actionType, setActionType] = useState<'approve' | 'comment' | 'request-change' | 'verify' | null>(null);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        pendingApproval: 0,
        pendingVerification: 0,
        verified: 0
    });

    useEffect(() => {
        if (authStatus === 'loading') return;
        if (authStatus === 'unauthenticated') {
            router.push('/login');
        } else if (session) {
            fetchServices();
        }
    }, [session, authStatus, activeTab]);

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            // For review page, we want org-wide services (API gets org from session)
            let endpoint = `/api/service-log?view=review`;
            
            if (activeTab === 'completed') {
                endpoint = `/api/service-log?status=completed`;
            } else if (activeTab === 'verified') {
                endpoint = `/api/service-log?status=verified`;
            }

            const res = await fetch(endpoint);
            const data = await res.json();

            if (data.success) {
                setServices(data.services || []);
            }

            // Fetch stats - get counts for each status
            const allRes = await fetch(`/api/service-log?view=all`);
            const allData = await allRes.json();

            if (allData.success) {
                const all = allData.services || [];
                setStats({
                    pendingApproval: all.filter((s: ServicePlan) => s.status === 'planned').length,
                    pendingVerification: all.filter((s: ServicePlan) => s.status === 'completed').length,
                    verified: all.filter((s: ServicePlan) => s.status === 'verified').length
                });
            }

        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async () => {
        if (!actionService || !actionType) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/service-log/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionType,
                    serviceId: actionService.id,
                    comment: comment || null
                })
            });

            const data = await res.json();

            if (data.success) {
                setActionService(null);
                setActionType(null);
                setComment('');
                fetchServices();
            }
        } catch (error) {
            console.error('Action error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openActionModal = (service: ServicePlan, action: 'approve' | 'comment' | 'request-change' | 'verify') => {
        setActionService(service);
        setActionType(action);
        setComment('');
    };

    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/service-log')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-[#0E2235]">Supervisor Review</h1>
                            <p className="text-sm text-gray-500">Review and verify peer services</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">Pending Approval</span>
                        </div>
                        <div className="text-2xl font-bold text-[#0E2235]">{stats.pendingApproval}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Awaiting Verification</span>
                        </div>
                        <div className="text-2xl font-bold text-[#0E2235]">{stats.pendingVerification}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                            <Shield className="w-4 h-4" />
                            <span className="text-sm font-medium">Verified</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.verified}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { id: 'pending', label: 'Pending Approval', count: stats.pendingApproval },
                        { id: 'completed', label: 'Awaiting Verification', count: stats.pendingVerification },
                        { id: 'verified', label: 'Verified', count: stats.verified }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as ReviewTab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? tab.id === 'pending' ? 'bg-blue-500 text-white' :
                                      tab.id === 'completed' ? 'bg-purple-500 text-white' :
                                      'bg-emerald-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Services List */}
                {services.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">
                            {activeTab === 'pending' 
                                ? 'No services pending approval' 
                                : activeTab === 'completed'
                                ? 'No services awaiting verification'
                                : 'No verified services yet'
                            }
                        </h3>
                        <p className="text-gray-500">
                            {activeTab === 'pending'
                                ? 'Services will appear here when peers schedule them'
                                : activeTab === 'completed'
                                ? 'Completed services will appear here for verification'
                                : 'Verified services will be archived here'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {services.map(service => {
                            const isExpanded = expandedService === service.id;
                            const participantName = getParticipantDisplayName(service);
                            const pssName = getPSSDisplayName(service);
                            
                            return (
                                <div key={service.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    {/* Service Header */}
                                    <button
                                        onClick={() => setExpandedService(isExpanded ? null : service.id)}
                                        className="w-full p-4 text-left flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            {service.service_type === 'individual' ? (
                                                <User className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <Users className="w-5 h-5 text-gray-400" />
                                            )}
                                            <div>
                                                <div className="font-medium text-[#0E2235] capitalize">
                                                    {service.service_type} Session
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(service.planned_date).toLocaleDateString()} • {service.planned_duration} min
                                                    {pssName && <span className="ml-2">• by {pssName}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <StatusBadge status={service.status} />
                                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-gray-100">
                                            <div className="pt-4 grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-gray-500">Setting</div>
                                                    <div className="font-medium text-[#0E2235] capitalize">{service.setting}</div>
                                                </div>
                                                {participantName && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Participant</div>
                                                        <div className="font-medium text-purple-600">{participantName}</div>
                                                    </div>
                                                )}
                                                {service.service_code && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Service Code</div>
                                                        <div className="font-medium text-[#0E2235]">{service.service_code}</div>
                                                    </div>
                                                )}
                                                {service.lesson && (
                                                    <div>
                                                        <div className="text-xs text-gray-500">Lesson</div>
                                                        <div className="font-medium text-[#1A73A8]">{service.lesson.title}</div>
                                                    </div>
                                                )}
                                            </div>

                                            {service.notes && (
                                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                    <div className="text-xs text-gray-500 mb-1">Planning Notes</div>
                                                    <div className="text-sm text-gray-700">{service.notes}</div>
                                                </div>
                                            )}

                                            {/* Completion details for completed/verified services */}
                                            {['completed', 'verified'].includes(service.status) && (
                                                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                                                    <div className="text-xs text-purple-600 mb-2">Delivery Details</div>
                                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-gray-500">Duration:</span>
                                                            <span className="ml-1 font-medium">{service.actual_duration} min</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Attendance:</span>
                                                            <span className="ml-1 font-medium">{service.attendance_count}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Session Note:</span>
                                                            <span className={`ml-1 font-medium ${service.session_note_id ? 'text-green-600' : 'text-amber-600'}`}>
                                                                {service.session_note_id ? 'Created' : 'Not created'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 pt-4">
                                                {service.status === 'planned' && (
                                                    <>
                                                        <button
                                                            onClick={() => openActionModal(service, 'approve')}
                                                            className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => openActionModal(service, 'comment')}
                                                            className="py-2 px-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openActionModal(service, 'request-change')}
                                                            className="py-2 px-3 border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}

                                                {service.status === 'completed' && (
                                                    <>
                                                        <button
                                                            onClick={() => openActionModal(service, 'verify')}
                                                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center justify-center gap-2"
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                            Verify
                                                        </button>
                                                        <button
                                                            onClick={() => openActionModal(service, 'comment')}
                                                            className="py-2 px-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}

                                                <button
                                                    onClick={() => router.push(`/service-log/${service.id}`)}
                                                    className="py-2 px-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info Box */}
                <div className="mt-8 bg-emerald-50 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-emerald-800">Audit-Ready Workflow</h3>
                        <p className="text-sm text-emerald-700 mt-1">
                            Every approval and verification you make creates a time-stamped record. 
                            This demonstrates supervisory oversight and helps protect against compliance issues.
                        </p>
                    </div>
                </div>
            </main>

            {/* Action Modal */}
            {actionService && actionType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-4">
                            {actionType === 'approve' && 'Approve Service'}
                            {actionType === 'comment' && 'Add Comment'}
                            {actionType === 'request-change' && 'Request Changes'}
                            {actionType === 'verify' && 'Verify Completed Service'}
                        </h2>

                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-gray-600">
                                <span className="capitalize">{actionService.service_type}</span> session on{' '}
                                {new Date(actionService.planned_date).toLocaleDateString()}
                            </div>
                            {actionService.lesson && (
                                <div className="text-sm text-[#1A73A8] mt-1">
                                    Lesson: {actionService.lesson.title}
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {actionType === 'request-change' ? 'What needs to change? *' : 'Comment (optional)'}
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={
                                    actionType === 'approve' ? 'Add a note (optional)...' :
                                    actionType === 'verify' ? 'Add verification notes (optional)...' :
                                    actionType === 'request-change' ? 'Explain what needs to be revised...' :
                                    'Add your comment...'
                                }
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] resize-none"
                            />
                        </div>

                        {actionType === 'request-change' && (
                            <div className="mb-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                                <AlertCircle className="w-4 h-4 inline mr-1" />
                                This will return the service to draft status for the peer to revise.
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setActionService(null);
                                    setActionType(null);
                                    setComment('');
                                }}
                                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={isSubmitting || (actionType === 'request-change' && !comment.trim())}
                                className={`flex-1 py-2 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                                    actionType === 'approve' ? 'bg-green-500 hover:bg-green-600' :
                                    actionType === 'verify' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                    actionType === 'request-change' ? 'bg-amber-500 hover:bg-amber-600' :
                                    'bg-blue-500 hover:bg-blue-600'
                                }`}
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {actionType === 'approve' && 'Approve'}
                                {actionType === 'comment' && 'Add Comment'}
                                {actionType === 'request-change' && 'Request Changes'}
                                {actionType === 'verify' && 'Verify'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
