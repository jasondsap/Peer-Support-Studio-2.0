'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Plus, Calendar, Clock, Users, User,
    FileText, CheckCircle, Circle, AlertCircle,
    ChevronRight, Loader2, Filter, MoreVertical,
    ClipboardList, Building2, BookOpen, Target,
    Check, X, MessageSquare, Shield
} from 'lucide-react';

// Types
interface ServicePlan {
    id: string;
    user_id: string;
    organization_id: string;
    service_type: 'individual' | 'group';
    planned_date: string;
    planned_duration: number;
    setting: string;
    service_code?: string;
    participant_id?: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    lesson_id?: string;
    goal_id?: string;
    notes?: string;
    actual_duration?: number;
    attendance_count?: number;
    delivered_as_planned?: boolean;
    deviation_notes?: string;
    completed_at?: string;
    verified_at?: string;
    session_note_id?: string;
    status: 'draft' | 'planned' | 'approved' | 'completed' | 'verified';
    created_at: string;
    updated_at: string;
    lesson?: { id: string; title: string };
    goal?: { id: string; title: string };
    approvals?: Array<{
        id: string;
        action: string;
        comment?: string;
        approved_at: string;
    }>;
}

interface Stats {
    draft: number;
    planned: number;
    approved: number;
    completed: number;
    verified: number;
    thisWeek: number;
}

type ViewFilter = 'upcoming' | 'completed' | 'all';

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
        planned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Planned' },
        approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
        completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Completed' },
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

// Service card component
function ServiceCard({ 
    service, 
    onClick 
}: { 
    service: ServicePlan; 
    onClick: () => void;
}) {
    const isOverdue = new Date(service.planned_date) < new Date() && 
                      !['completed', 'verified'].includes(service.status);
    const participantName = getParticipantDisplayName(service);

    return (
        <button
            onClick={onClick}
            className={`w-full bg-white rounded-xl p-4 text-left shadow-sm border-l-4 hover:shadow-md transition-all ${
                isOverdue ? 'border-red-500' :
                service.status === 'verified' ? 'border-emerald-500' :
                service.status === 'completed' ? 'border-purple-500' :
                service.status === 'approved' ? 'border-green-500' :
                service.status === 'planned' ? 'border-blue-500' :
                'border-gray-300'
            }`}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {service.service_type === 'individual' ? (
                        <User className="w-4 h-4 text-gray-400" />
                    ) : (
                        <Users className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-[#0E2235] capitalize">
                        {service.service_type} Session
                    </span>
                </div>
                <StatusBadge status={service.status} />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(service.planned_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    })}
                </span>
                <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {service.planned_duration} min
                </span>
                <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {service.setting}
                </span>
            </div>

            {service.lesson && (
                <div className="flex items-center gap-2 text-sm text-[#1A73A8] mb-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="truncate">{service.lesson.title}</span>
                </div>
            )}

            {participantName && (
                <div className="flex items-center gap-2 text-xs text-purple-600 mb-2">
                    <User className="w-3 h-3" />
                    <span>{participantName}</span>
                </div>
            )}

            {isOverdue && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    Overdue - needs completion
                </div>
            )}

            <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                    Created {new Date(service.created_at).toLocaleDateString()}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
        </button>
    );
}

// Main component
export default function ServiceLogPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const [services, setServices] = useState<ServicePlan[]>([]);
    const [stats, setStats] = useState<Stats>({
        draft: 0,
        planned: 0,
        approved: 0,
        completed: 0,
        verified: 0,
        thisWeek: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [viewFilter, setViewFilter] = useState<ViewFilter>('upcoming');

    useEffect(() => {
        if (authStatus === 'loading') return;
        if (authStatus === 'unauthenticated') {
            router.push('/login');
        } else if (session) {
            fetchServices();
        }
    }, [session, authStatus, viewFilter]);

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            // API route will get user/organization from session
            const res = await fetch(`/api/service-log?view=${viewFilter}`);
            const data = await res.json();

            if (data.success) {
                setServices(data.services || []);
            }

            // Fetch stats
            const allRes = await fetch(`/api/service-log?view=all`);
            const allData = await allRes.json();

            if (allData.success) {
                const all = allData.services || [];
                const today = new Date();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());

                setStats({
                    draft: all.filter((s: ServicePlan) => s.status === 'draft').length,
                    planned: all.filter((s: ServicePlan) => s.status === 'planned').length,
                    approved: all.filter((s: ServicePlan) => s.status === 'approved').length,
                    completed: all.filter((s: ServicePlan) => s.status === 'completed').length,
                    verified: all.filter((s: ServicePlan) => s.status === 'verified').length,
                    thisWeek: all.filter((s: ServicePlan) => 
                        new Date(s.planned_date) >= weekStart && 
                        new Date(s.planned_date) <= today
                    ).length
                });
            }

        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const upcomingCount = stats.draft + stats.planned + stats.approved;
    const completedCount = stats.completed + stats.verified;

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Peer Service Log</h1>
                                <p className="text-sm text-gray-500">Plan, verify, and document services</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/service-log/plan')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                            Plan a Service
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <ClipboardList className="w-4 h-4" />
                            <span className="text-sm">Upcoming</span>
                        </div>
                        <div className="text-2xl font-bold text-[#0E2235]">{upcomingCount}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Completed</span>
                        </div>
                        <div className="text-2xl font-bold text-[#0E2235]">{completedCount}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Shield className="w-4 h-4" />
                            <span className="text-sm">Verified</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.verified}</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">This Week</span>
                        </div>
                        <div className="text-2xl font-bold text-[#1A73A8]">{stats.thisWeek}</div>
                    </div>
                </div>

                {/* View Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
                        { id: 'completed', label: 'Completed', count: completedCount },
                        { id: 'all', label: 'All Services', count: upcomingCount + completedCount }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setViewFilter(tab.id as ViewFilter)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewFilter === tab.id
                                    ? 'bg-[#1A73A8] text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                viewFilter === tab.id
                                    ? 'bg-white/20'
                                    : 'bg-gray-100'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Services List */}
                {services.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-2">
                            {viewFilter === 'upcoming' 
                                ? 'No upcoming services planned' 
                                : viewFilter === 'completed'
                                ? 'No completed services yet'
                                : 'No services yet'
                            }
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {viewFilter === 'upcoming'
                                ? 'Plan your first service to get started'
                                : 'Complete a planned service to see it here'
                            }
                        </p>
                        {viewFilter !== 'completed' && (
                            <button
                                onClick={() => router.push('/service-log/plan')}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <Plus className="w-4 h-4" />
                                Plan a Service
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {services.map(service => (
                            <ServiceCard
                                key={service.id}
                                service={service}
                                onClick={() => router.push(`/service-log/${service.id}`)}
                            />
                        ))}
                    </div>
                )}

                {/* Compliance Info */}
                <div className="mt-8 bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-blue-800">Audit-Ready Documentation</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            Every service you plan, deliver, and document creates a time-stamped record. 
                            This helps demonstrate that services were planned and delivered as claimed—
                            before billing is submitted.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
