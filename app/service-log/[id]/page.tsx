'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Calendar, Clock, Users, User,
    Building2, BookOpen, Target, FileText,
    CheckCircle, Circle, AlertCircle, Shield,
    Loader2, Edit3, Trash2, MessageSquare,
    Check, X, ChevronRight, ExternalLink,
    ClipboardList, History, CalendarPlus, ChevronDown
} from 'lucide-react';

interface ServicePlan {
    id: string;
    user_id: string;
    organization_id: string;
    service_type: 'individual' | 'group';
    planned_date: string;
    planned_time?: string;
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
    completed_by?: string;
    verified_at?: string;
    verified_by?: string;
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
        approved_by: string;
        approver_first_name?: string;
        approver_last_name?: string;
    }>;
}

// Helper to format time from HH:MM or HH:MM:SS to 2:00 PM
function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
}

// Status badge component
function StatusBadge({ status, large = false }: { status: string; large?: boolean }) {
    const config: Record<string, { bg: string; text: string; label: string; icon: any }> = {
        draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft', icon: Circle },
        planned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Planned', icon: Clock },
        approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: Check },
        completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Completed', icon: CheckCircle },
        verified: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified', icon: Shield }
    };

    const { bg, text, label, icon: Icon } = config[status] || config.draft;

    return (
        <span className={`inline-flex items-center gap-1.5 ${large ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'} rounded-full font-medium ${bg} ${text}`}>
            <Icon className={large ? 'w-4 h-4' : 'w-3 h-3'} />
            {label}
        </span>
    );
}

// Add to Calendar dropdown component
function AddToCalendarButton({ service }: { service: ServicePlan }) {
    const [open, setOpen] = useState(false);

    const participantName = service.participant_preferred_name ||
        `${service.participant_first_name || ''} ${service.participant_last_name || ''}`.trim() || '';

    const title = `${service.service_type.charAt(0).toUpperCase() + service.service_type.slice(1)} Session${participantName ? ` - ${participantName}` : ''}`;
    const description = [
        `${service.planned_duration} min ${service.setting} session`,
        participantName && `Participant: ${participantName}`,
        service.notes && `Notes: ${service.notes}`,
    ].filter(Boolean).join('\n');

    const settingLabels: Record<string, string> = {
        outpatient: 'Outpatient Office', inpatient: 'Inpatient Facility',
        telehealth: 'Telehealth (Virtual)', community: 'Community Setting',
        home: 'Home Visit', office: 'Office',
    };
    const location = settingLabels[service.setting] || service.setting;

    // Build start/end datetimes
    const datePart = service.planned_date.split('T')[0]; // YYYY-MM-DD
    let startHour = 9, startMin = 0;
    if (service.planned_time) {
        const [h, m] = service.planned_time.split(':').map(Number);
        startHour = h;
        startMin = m;
    }
    const startDate = new Date(`${datePart}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
    const endDate = new Date(startDate.getTime() + service.planned_duration * 60000);

    // Google Calendar format: 20260309T143000
    const toGoogleDate = (d: Date) =>
        d.getFullYear().toString() +
        (d.getMonth() + 1).toString().padStart(2, '0') +
        d.getDate().toString().padStart(2, '0') + 'T' +
        d.getHours().toString().padStart(2, '0') +
        d.getMinutes().toString().padStart(2, '0') + '00';

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(title)}` +
        `&dates=${toGoogleDate(startDate)}/${toGoogleDate(endDate)}` +
        `&details=${encodeURIComponent(description)}` +
        `&location=${encodeURIComponent(location)}`;

    // Outlook format: 2026-03-09T14:30:00
    const toOutlookDate = (d: Date) =>
        `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:00`;

    const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?` +
        `subject=${encodeURIComponent(title)}` +
        `&startdt=${toOutlookDate(startDate)}` +
        `&enddt=${toOutlookDate(endDate)}` +
        `&body=${encodeURIComponent(description)}` +
        `&location=${encodeURIComponent(location)}`;

    // .ics file download
    const downloadIcs = () => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const toIcsDate = (d: Date) =>
            `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Peer Support Studio//Service Planner//EN',
            'BEGIN:VEVENT',
            `DTSTART:${toIcsDate(startDate)}`,
            `DTEND:${toIcsDate(endDate)}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
            `LOCATION:${location}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${datePart}.ics`;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1A73A8] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
            >
                <CalendarPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Add to Calendar</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                        <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="4" width="20" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5" fill="none" />
                                <path d="M2 10h20" stroke="#4285F4" strokeWidth="1.5" />
                                <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="12" cy="16" r="2" fill="#34A853" />
                            </svg>
                            Google Calendar
                        </a>
                        <a
                            href={outlookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                                <rect x="2" y="4" width="20" height="18" rx="2" stroke="#0078D4" strokeWidth="1.5" fill="none" />
                                <path d="M2 10h20" stroke="#0078D4" strokeWidth="1.5" />
                                <path d="M8 2v4M16 2v4" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round" />
                                <rect x="6" y="13" width="4" height="3" rx="0.5" fill="#0078D4" />
                            </svg>
                            Outlook
                        </a>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                            onClick={downloadIcs}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Calendar className="w-5 h-5 text-gray-500" />
                            Download .ics File
                            <span className="ml-auto text-xs text-gray-400">Apple / Other</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function ServiceDetailPage() {
    const router = useRouter();
    const params = useParams();
    const serviceId = params.id as string;
    const { data: session, status: authStatus } = useSession();

    const [service, setService] = useState<ServicePlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Complete modal state
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [actualDuration, setActualDuration] = useState(0);
    const [attendanceCount, setAttendanceCount] = useState(1);
    const [deliveredAsPlanned, setDeliveredAsPlanned] = useState(true);
    const [deviationNotes, setDeviationNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (authStatus === 'loading') return;
        if (authStatus === 'unauthenticated') {
            router.push('/login');
        } else if (session && serviceId) {
            fetchService();
        }
    }, [session, authStatus, serviceId]);

    const fetchService = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/service-log?view=all`);
            const data = await res.json();

            if (data.success) {
                const found = data.services?.find((s: ServicePlan) => s.id === serviceId);
                if (found) {
                    setService(found);
                    setActualDuration(found.planned_duration);
                } else {
                    setError('Service not found');
                }
            }
        } catch (err) {
            console.error('Error fetching service:', err);
            setError('Failed to load service');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitForReview = async () => {
        if (!service) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'submit',
                    serviceId: service.id
                })
            });

            const data = await res.json();
            if (data.success) {
                fetchService();
            }
        } catch (err) {
            console.error('Submit error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComplete = async () => {
        if (!service) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'complete',
                    serviceId: service.id,
                    actualDuration,
                    attendanceCount,
                    deliveredAsPlanned,
                    deviationNotes: deliveredAsPlanned ? null : deviationNotes
                })
            });

            const data = await res.json();
            if (data.success) {
                setShowCompleteModal(false);
                fetchService();
            }
        } catch (err) {
            console.error('Complete error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!service) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    serviceId: service.id
                })
            });

            const data = await res.json();
            if (data.success) {
                router.push('/service-log');
            }
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateSessionNote = () => {
        // Navigate to session notes with pre-filled data
        const params = new URLSearchParams({
            serviceId: service?.id || '',
            date: service?.planned_date || '',
            duration: String(service?.actual_duration || service?.planned_duration),
            type: service?.service_type || 'individual',
            setting: service?.setting || ''
        });
        router.push(`/session-notes?${params.toString()}`);
    };

    // Helper to get participant display name
    const getParticipantName = () => {
        if (!service?.participant_id) return null;
        return service.participant_preferred_name ||
            `${service.participant_first_name || ''} ${service.participant_last_name || ''}`.trim() ||
            'Unknown Participant';
    };

    if (authStatus === 'loading' || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (error || !service) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] p-6">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={() => router.push('/service-log')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Service Log
                    </button>
                    <div className="bg-white rounded-2xl p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2">{error || 'Service not found'}</h2>
                        <button
                            onClick={() => router.push('/service-log')}
                            className="mt-4 text-[#1A73A8] hover:underline"
                        >
                            Return to Service Log
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const canEdit = service.status === 'draft';
    const canSubmit = service.status === 'draft';
    const canComplete = ['planned', 'approved'].includes(service.status);
    const canCreateNote = service.status === 'completed' && !service.session_note_id;
    const canEditPlanned = service.status === 'planned';
    const canDelete = ['draft', 'planned'].includes(service.status);
    const isOverdue = new Date(service.planned_date) < new Date() && canComplete;
    const participantName = getParticipantName();

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/service-log')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235] capitalize">
                                    {service.service_type} Service
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {new Date(service.planned_date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                    {service.planned_time && ` at ${formatTime(service.planned_time)}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {['draft', 'planned', 'approved'].includes(service.status) && (
                                <AddToCalendarButton service={service} />
                            )}
                            <StatusBadge status={service.status} large />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* Overdue Warning */}
                {isOverdue && (
                    <div className="mb-6 bg-red-50 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-red-800">Service Overdue</h3>
                            <p className="text-sm text-red-700">
                                This service was planned for {new Date(service.planned_date).toLocaleDateString()}
                                but hasn't been marked as completed.
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Details Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-semibold text-[#0E2235] mb-4">Service Details</h2>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            {service.service_type === 'individual' ? (
                                <User className="w-5 h-5 text-gray-400" />
                            ) : (
                                <Users className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                                <div className="text-xs text-gray-500">Type</div>
                                <div className="font-medium text-[#0E2235] capitalize">{service.service_type}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500">Planned Date</div>
                                <div className="font-medium text-[#0E2235]">
                                    {new Date(service.planned_date).toLocaleDateString()}
                                    {service.planned_time && ` at ${formatTime(service.planned_time)}`}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500">
                                    {service.actual_duration ? 'Actual Duration' : 'Planned Duration'}
                                </div>
                                <div className="font-medium text-[#0E2235]">
                                    {service.actual_duration || service.planned_duration} minutes
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500">Setting</div>
                                <div className="font-medium text-[#0E2235] capitalize">{service.setting}</div>
                            </div>
                        </div>
                    </div>

                    {participantName && (
                        <div className="mb-4 p-3 bg-purple-50 rounded-lg flex items-center gap-3">
                            <User className="w-5 h-5 text-purple-500" />
                            <div>
                                <div className="text-xs text-purple-600">Participant</div>
                                <div className="font-medium text-purple-700">{participantName}</div>
                            </div>
                        </div>
                    )}

                    {service.service_code && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Service Code</div>
                            <div className="font-medium text-[#0E2235]">{service.service_code}</div>
                        </div>
                    )}

                    {service.lesson && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-[#1A73A8]" />
                                <div>
                                    <div className="text-xs text-blue-600">Attached Lesson</div>
                                    <div className="font-medium text-[#1A73A8]">{service.lesson.title}</div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                    )}

                    {service.goal && (
                        <div className="mb-4 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                            <Target className="w-4 h-4 text-[#30B27A]" />
                            <div>
                                <div className="text-xs text-green-600">Goal Focus</div>
                                <div className="font-medium text-[#30B27A]">{service.goal.title}</div>
                            </div>
                        </div>
                    )}

                    {service.notes && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Planning Notes</div>
                            <div className="text-gray-700">{service.notes}</div>
                        </div>
                    )}
                </div>

                {/* Completion Details (if completed) */}
                {['completed', 'verified'].includes(service.status) && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                        <h2 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            Delivery Details
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <div className="text-xs text-gray-500">Actual Duration</div>
                                <div className="font-medium text-[#0E2235]">{service.actual_duration} minutes</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Attendance</div>
                                <div className="font-medium text-[#0E2235]">{service.attendance_count} participant(s)</div>
                            </div>
                        </div>

                        <div className={`p-3 rounded-lg ${service.delivered_as_planned ? 'bg-green-50' : 'bg-amber-50'}`}>
                            <div className="flex items-center gap-2">
                                {service.delivered_as_planned ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                )}
                                <span className={service.delivered_as_planned ? 'text-green-700' : 'text-amber-700'}>
                                    {service.delivered_as_planned ? 'Delivered as planned' : 'Deviated from plan'}
                                </span>
                            </div>
                            {!service.delivered_as_planned && service.deviation_notes && (
                                <p className="mt-2 text-sm text-amber-700">{service.deviation_notes}</p>
                            )}
                        </div>

                        {service.completed_at && (
                            <div className="mt-4 text-xs text-gray-500">
                                Completed on {new Date(service.completed_at).toLocaleString()}
                            </div>
                        )}
                    </div>
                )}

                {/* Audit Trail */}
                <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" />
                        Audit Trail
                    </h2>

                    <div className="space-y-3">
                        <div className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5"></div>
                            <div>
                                <div className="text-gray-700">Created</div>
                                <div className="text-xs text-gray-500">
                                    {new Date(service.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {service.approvals?.map(approval => (
                            <div key={approval.id} className="flex items-start gap-3 text-sm">
                                <div className={`w-2 h-2 rounded-full mt-1.5 ${approval.action === 'approved' ? 'bg-green-500' :
                                        approval.action === 'verified' ? 'bg-emerald-500' :
                                            approval.action === 'change_requested' ? 'bg-amber-500' :
                                                'bg-blue-500'
                                    }`}></div>
                                <div>
                                    <div className="text-gray-700 capitalize">
                                        {approval.action.replace('_', ' ')}
                                        {approval.approver_first_name && (
                                            <span className="text-gray-500 font-normal">
                                                {' '}by {approval.approver_first_name} {approval.approver_last_name}
                                            </span>
                                        )}
                                    </div>
                                    {approval.comment && (
                                        <div className="text-gray-600 italic">"{approval.comment}"</div>
                                    )}
                                    <div className="text-xs text-gray-500">
                                        {new Date(approval.approved_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {service.completed_at && (
                            <div className="flex items-start gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5"></div>
                                <div>
                                    <div className="text-gray-700">Completed</div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(service.completed_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {service.verified_at && (
                            <div className="flex items-start gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5"></div>
                                <div>
                                    <div className="text-gray-700">Verified</div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(service.verified_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    {canSubmit && (
                        <button
                            onClick={handleSubmitForReview}
                            disabled={isSubmitting}
                            className="w-full py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Schedule Service
                        </button>
                    )}

                    {canComplete && (
                        <button
                            onClick={() => setShowCompleteModal(true)}
                            className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Mark as Completed
                        </button>
                    )}

                    {/* Edit and Delete for Planned services */}
                    {canEditPlanned && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push(`/service-log/plan?edit=${service.id}`)}
                                className="flex-1 py-3 border border-[#1A73A8] text-[#1A73A8] rounded-xl hover:bg-[#1A73A8]/5 flex items-center justify-center gap-2"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit Service
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="py-3 px-4 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    )}

                    {canCreateNote && (
                        <button
                            onClick={handleCreateSessionNote}
                            className="w-full py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Create Session Note
                        </button>
                    )}

                    {canEdit && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push(`/service-log/plan?edit=${service.id}`)}
                                className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="py-3 px-4 border border-red-300 text-red-600 rounded-xl hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Complete Modal */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-4">Mark Service as Completed</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Actual Duration (minutes)
                                </label>
                                <select
                                    value={actualDuration}
                                    onChange={(e) => setActualDuration(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>60 minutes</option>
                                    <option value={90}>90 minutes</option>
                                    <option value={120}>120 minutes</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Attendance Count
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={attendanceCount}
                                    onChange={(e) => setAttendanceCount(parseInt(e.target.value) || 1)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Delivered as planned?
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeliveredAsPlanned(true)}
                                        className={`flex-1 py-2 rounded-lg border-2 transition-colors ${deliveredAsPlanned
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setDeliveredAsPlanned(false)}
                                        className={`flex-1 py-2 rounded-lg border-2 transition-colors ${!deliveredAsPlanned
                                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                : 'border-gray-200 text-gray-600'
                                            }`}
                                    >
                                        No
                                    </button>
                                </div>
                            </div>

                            {!deliveredAsPlanned && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        What changed?
                                    </label>
                                    <textarea
                                        value={deviationNotes}
                                        onChange={(e) => setDeviationNotes(e.target.value)}
                                        placeholder="Brief explanation of deviation from plan..."
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCompleteModal(false)}
                                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={isSubmitting}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Complete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2">
                            {service?.status === 'planned' ? 'Cancel Planned Service?' : 'Delete Draft?'}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {service?.status === 'planned'
                                ? 'This will cancel the planned service and remove it from your log. This cannot be undone.'
                                : 'This will permanently delete this draft service plan. This cannot be undone.'
                            }
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Keep It
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {service?.status === 'planned' ? 'Cancel Service' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}