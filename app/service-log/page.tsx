'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Plus, Calendar, Clock, Users, User,
    FileText, CheckCircle, Circle, AlertCircle,
    ChevronRight, ChevronLeft, Loader2, Filter, MoreVertical,
    ClipboardList, Building2, BookOpen, Target,
    Check, X, MessageSquare, Shield, List, LayoutGrid,
    ExternalLink
} from 'lucide-react';

// Types
interface ServicePlan {
    id: string;
    user_id: string;
    organization_id: string;
    service_type: 'individual' | 'group';
    title?: string;
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
type ViewMode = 'list' | 'calendar';

// Status color map used by list cards, calendar chips, and modal
const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; border: string; label: string }> = {
    draft:     { dot: 'bg-gray-400',    bg: 'bg-gray-50',     text: 'text-gray-600',    border: 'border-gray-300',   label: 'Draft' },
    planned:   { dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-500',   label: 'Planned' },
    approved:  { dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700',   border: 'border-green-500',  label: 'Approved' },
    completed: { dot: 'bg-purple-500',  bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-500', label: 'Completed' },
    verified:  { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-500', label: 'Verified' },
};

// Helper to format time from HH:MM or HH:MM:SS to 2:00 PM
function formatTime(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {colors.label}
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

// ─── Service Detail Modal ───────────────────────────────────────────────────

function ServiceDetailModal({
    service,
    onClose,
    onComplete,
    onNavigate,
}: {
    service: ServicePlan;
    onClose: () => void;
    onComplete: (serviceId: string, data: {
        actualDuration: number;
        attendanceCount: number;
        deliveredAsPlanned: boolean;
        deviationNotes?: string;
    }) => Promise<boolean>;
    onNavigate: (id: string) => void;
}) {
    const [showCompleteForm, setShowCompleteForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completionSuccess, setCompletionSuccess] = useState(false);

    // Completion form state
    const [actualDuration, setActualDuration] = useState(service.planned_duration);
    const [attendanceCount, setAttendanceCount] = useState(1);
    const [deliveredAsPlanned, setDeliveredAsPlanned] = useState(true);
    const [deviationNotes, setDeviationNotes] = useState('');

    const participantName = getParticipantDisplayName(service);
    const isOverdue = new Date(service.planned_date) < new Date() &&
        !['completed', 'verified'].includes(service.status);
    const canComplete = ['planned', 'approved'].includes(service.status);
    const colors = STATUS_COLORS[service.status] || STATUS_COLORS.draft;

    const handleComplete = async () => {
        setIsSubmitting(true);
        const success = await onComplete(service.id, {
            actualDuration,
            attendanceCount,
            deliveredAsPlanned,
            deviationNotes: deliveredAsPlanned ? undefined : deviationNotes,
        });
        setIsSubmitting(false);
        if (success) {
            setCompletionSuccess(true);
            setTimeout(() => onClose(), 1500);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">
                {/* Status accent bar */}
                <div className={`h-1.5 w-full ${isOverdue ? 'bg-red-500' : ''}`}
                    style={!isOverdue ? {
                        background: service.status === 'verified' ? '#10B981' :
                            service.status === 'completed' ? '#8B5CF6' :
                            service.status === 'approved' ? '#22C55E' :
                            service.status === 'planned' ? '#3B82F6' : '#9CA3AF'
                    } : {}}
                />

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                {service.service_type === 'individual' ? (
                                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )}
                                <h2 className="text-lg font-bold text-[#0E2235] truncate">
                                    {service.title || `${service.service_type === 'individual' ? 'Individual' : 'Group'} Session`}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={service.status} />
                                {isOverdue && (
                                    <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                        <AlertCircle className="w-3 h-3" />
                                        Overdue
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {completionSuccess ? (
                        <div className="py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#0E2235] mb-1">Service Completed</h3>
                            <p className="text-sm text-gray-500">This service has been marked as complete.</p>
                        </div>
                    ) : (
                        <>
                            {/* Detail rows */}
                            <div className="space-y-4">
                                {/* Date & Time */}
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium text-[#0E2235]">
                                            {new Date(service.planned_date).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        {service.planned_time && (
                                            <p className="text-sm text-gray-500">{formatTime(service.planned_time)}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Duration & Setting */}
                                <div className="flex items-start gap-3">
                                    <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-[#0E2235]">
                                        {service.planned_duration} minutes
                                    </p>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-[#0E2235] capitalize">{service.setting}</p>
                                </div>

                                {/* Participant */}
                                {participantName && (
                                    <div className="flex items-start gap-3">
                                        <User className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-[#0E2235]">{participantName}</p>
                                    </div>
                                )}

                                {/* Lesson */}
                                {service.lesson && (
                                    <div className="flex items-start gap-3">
                                        <BookOpen className="w-5 h-5 text-[#1A73A8] mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-[#1A73A8]">{service.lesson.title}</p>
                                    </div>
                                )}

                                {/* Goal */}
                                {service.goal && (
                                    <div className="flex items-start gap-3">
                                        <Target className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-[#0E2235]">{service.goal.title}</p>
                                    </div>
                                )}

                                {/* Notes */}
                                {service.notes && (
                                    <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-gray-600">{service.notes}</p>
                                    </div>
                                )}

                                {/* Service code */}
                                {service.service_code && (
                                    <div className="flex items-start gap-3">
                                        <ClipboardList className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-gray-500">
                                            Service Code: <span className="font-medium text-[#0E2235]">{service.service_code}</span>
                                        </p>
                                    </div>
                                )}

                                {/* Completion info (if already completed) */}
                                {service.completed_at && (
                                    <div className="mt-2 p-3 bg-purple-50 rounded-xl">
                                        <p className="text-xs font-medium text-purple-700 mb-1">Completed</p>
                                        <p className="text-sm text-purple-600">
                                            {new Date(service.completed_at).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric'
                                            })}
                                            {service.actual_duration && ` · ${service.actual_duration} min actual`}
                                            {service.delivered_as_planned === false && ' · Deviated from plan'}
                                        </p>
                                        {service.deviation_notes && (
                                            <p className="text-sm text-purple-500 mt-1">{service.deviation_notes}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ─── Mark Complete Form ─── */}
                            {canComplete && showCompleteForm && (
                                <div className="mt-6 pt-5 border-t border-gray-100">
                                    <h3 className="text-sm font-semibold text-[#0E2235] mb-4">Complete Service</h3>
                                    <div className="space-y-4">
                                        {/* Actual Duration */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Actual Duration (minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={actualDuration}
                                                onChange={e => setActualDuration(parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                                            />
                                        </div>

                                        {/* Attendance Count (group only) */}
                                        {service.service_type === 'group' && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Attendance Count
                                                </label>
                                                <input
                                                    type="number"
                                                    value={attendanceCount}
                                                    onChange={e => setAttendanceCount(parseInt(e.target.value) || 0)}
                                                    min={0}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                                                />
                                            </div>
                                        )}

                                        {/* Delivered as Planned */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-2">
                                                Delivered as planned?
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => { setDeliveredAsPlanned(true); setDeviationNotes(''); }}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                                        deliveredAsPlanned
                                                            ? 'bg-green-50 border-green-300 text-green-700'
                                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <Check className="w-4 h-4 inline mr-1" />
                                                    Yes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeliveredAsPlanned(false)}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                                        !deliveredAsPlanned
                                                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <X className="w-4 h-4 inline mr-1" />
                                                    No
                                                </button>
                                            </div>
                                        </div>

                                        {/* Deviation Notes */}
                                        {!deliveredAsPlanned && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    What changed?
                                                </label>
                                                <textarea
                                                    value={deviationNotes}
                                                    onChange={e => setDeviationNotes(e.target.value)}
                                                    rows={3}
                                                    placeholder="Describe how the service deviated from the plan..."
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8] resize-none"
                                                />
                                            </div>
                                        )}

                                        {/* Submit / Cancel */}
                                        <div className="flex gap-3 pt-1">
                                            <button
                                                onClick={() => setShowCompleteForm(false)}
                                                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleComplete}
                                                disabled={isSubmitting || (!deliveredAsPlanned && !deviationNotes.trim())}
                                                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#1A73A8] to-[#30B27A] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isSubmitting ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                                {isSubmitting ? 'Saving...' : 'Confirm Complete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer actions */}
                {!completionSuccess && !showCompleteForm && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                        {canComplete && (
                            <button
                                onClick={() => setShowCompleteForm(true)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#1A73A8] to-[#30B27A] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Mark Complete
                            </button>
                        )}
                        <button
                            onClick={() => onNavigate(service.id)}
                            className={`${canComplete ? '' : 'flex-1'} py-2.5 px-4 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2`}
                        >
                            <ExternalLink className="w-4 h-4" />
                            Full Details
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Service Card (list view) ───────────────────────────────────────────────

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
                    <span className="font-medium text-[#0E2235]">
                        {service.title || <span className="capitalize">{service.service_type} Session</span>}
                    </span>
                    {service.title && (
                        <span className="text-xs text-gray-400 capitalize ml-2">{service.service_type}</span>
                    )}
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
                    {service.planned_time && (
                        <span className="ml-1">at {formatTime(service.planned_time)}</span>
                    )}
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

// ─── Calendar View Component ────────────────────────────────────────────────

function CalendarView({
    allServices,
    onServiceClick,
    onPlanService,
}: {
    allServices: ServicePlan[];
    onServiceClick: (service: ServicePlan) => void;
    onPlanService: () => void;
}) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Group services by date key (YYYY-MM-DD)
    const servicesByDate = useMemo(() => {
        const map: Record<string, ServicePlan[]> = {};
        allServices.forEach(s => {
            const key = s.planned_date.substring(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push(s);
        });
        Object.values(map).forEach(arr =>
            arr.sort((a, b) => (a.planned_time || '').localeCompare(b.planned_time || ''))
        );
        return map;
    }, [allServices]);

    // Build calendar grid
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
        else { setCurrentMonth(m => m - 1); }
        setSelectedDate(null);
    };

    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
        else { setCurrentMonth(m => m + 1); }
        setSelectedDate(null);
    };

    const goToToday = () => {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
        setSelectedDate(null);
    };

    const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const isToday = (day: number) =>
        day === today.getDate() &&
        currentMonth === today.getMonth() &&
        currentYear === today.getFullYear();

    const dateKey = (day: number) => {
        const m = String(currentMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${currentYear}-${m}-${d}`;
    };

    const selectedServices = selectedDate ? (servicesByDate[selectedDate] || []) : [];
    const totalRows = Math.ceil((startOffset + daysInMonth) / 7);

    return (
        <div>
            {/* Calendar header */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <h3 className="text-base font-semibold text-[#0E2235] min-w-[160px] text-center">
                            {monthLabel}
                        </h3>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <button
                        onClick={goToToday}
                        className="text-xs font-medium text-[#1A73A8] hover:text-[#156a9a] px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        Today
                    </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-medium text-gray-400 py-2.5">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7">
                    {/* Empty cells for offset */}
                    {Array.from({ length: startOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50 bg-gray-50/30" />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const key = dateKey(day);
                        const dayServices = servicesByDate[key] || [];
                        const isSelected = selectedDate === key;
                        const hasOverdue = dayServices.some(
                            s => new Date(s.planned_date) < today && !['completed', 'verified'].includes(s.status)
                        );
                        const isLastRow = (startOffset + i) >= (totalRows - 1) * 7;

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDate(isSelected ? null : key)}
                                className={`min-h-[80px] p-1.5 text-left border-b border-r border-gray-50 transition-colors relative
                                    ${isSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-[#1A73A8]/30' : 'hover:bg-gray-50'}
                                    ${isLastRow ? 'border-b-0' : ''}
                                `}
                            >
                                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                                    ${isToday(day) ? 'bg-[#1A73A8] text-white' : 'text-gray-600'}
                                `}>
                                    {day}
                                </div>

                                <div className="space-y-0.5">
                                    {dayServices.slice(0, 3).map(s => {
                                        const c = STATUS_COLORS[s.status] || STATUS_COLORS.draft;
                                        return (
                                            <div
                                                key={s.id}
                                                onClick={(e) => { e.stopPropagation(); onServiceClick(s); }}
                                                className={`text-[10px] leading-tight font-medium truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80 ${c.bg} ${c.text}`}
                                            >
                                                {s.planned_time ? formatTime(s.planned_time).replace(':00', '') : ''}{' '}
                                                {s.title || (s.service_type === 'individual' ? 'Individual' : 'Group')}
                                            </div>
                                        );
                                    })}
                                    {dayServices.length > 3 && (
                                        <div className="text-[10px] text-gray-400 font-medium px-1">
                                            +{dayServices.length - 3} more
                                        </div>
                                    )}
                                </div>

                                {hasOverdue && (
                                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                                )}
                            </button>
                        );
                    })}

                    {/* Trailing empty cells */}
                    {Array.from({ length: (7 - ((startOffset + daysInMonth) % 7)) % 7 }).map((_, i) => (
                        <div key={`trail-${i}`} className="min-h-[80px] border-r border-gray-50 bg-gray-50/30" />
                    ))}
                </div>
            </div>

            {/* Selected day detail panel */}
            {selectedDate && (
                <div className="mt-4 animate-fadeIn">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[#0E2235]">
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                        </h3>
                        <span className="text-xs text-gray-400">
                            {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}
                        </span>
                    </div>

                    {selectedServices.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                            <p className="text-sm text-gray-500 mb-3">No services planned for this day</p>
                            <button
                                onClick={onPlanService}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <Plus className="w-4 h-4" />
                                Plan a Service
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedServices.map(service => {
                                const sc = STATUS_COLORS[service.status] || STATUS_COLORS.draft;
                                const participantName = getParticipantDisplayName(service);
                                const isOverdue = new Date(service.planned_date) < today &&
                                    !['completed', 'verified'].includes(service.status);

                                return (
                                    <button
                                        key={service.id}
                                        onClick={() => onServiceClick(service)}
                                        className={`w-full bg-white rounded-xl p-4 text-left shadow-sm border-l-4 hover:shadow-md transition-all ${
                                            isOverdue ? 'border-red-500' : sc.border
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                {service.service_type === 'individual' ? (
                                                    <User className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <Users className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className="font-medium text-[#0E2235]">
                                                    {service.title || <span className="capitalize">{service.service_type} Session</span>}
                                                </span>
                                            </div>
                                            <StatusBadge status={service.status} />
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            {service.planned_time && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatTime(service.planned_time)}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {service.planned_duration} min
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3.5 h-3.5" />
                                                {service.setting}
                                            </span>
                                        </div>
                                        {participantName && (
                                            <div className="flex items-center gap-2 text-xs text-purple-600 mt-1.5">
                                                <User className="w-3 h-3" />
                                                <span>{participantName}</span>
                                            </div>
                                        )}
                                        {isOverdue && (
                                            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                                                <AlertCircle className="w-3 h-3" />
                                                Overdue
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 px-1">
                {Object.entries(STATUS_COLORS).map(([status, c]) => (
                    <div key={status} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                        <span className="text-xs text-gray-500">{c.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-500">Overdue</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ServiceLogPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const [services, setServices] = useState<ServicePlan[]>([]);
    const [allServices, setAllServices] = useState<ServicePlan[]>([]);
    const [stats, setStats] = useState<Stats>({
        draft: 0, planned: 0, approved: 0,
        completed: 0, verified: 0, thisWeek: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [viewFilter, setViewFilter] = useState<ViewFilter>('upcoming');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [modalService, setModalService] = useState<ServicePlan | null>(null);

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
            const res = await fetch(`/api/service-log?view=${viewFilter}`);
            const data = await res.json();
            if (data.success) setServices(data.services || []);

            const allRes = await fetch(`/api/service-log?view=all`);
            const allData = await allRes.json();
            if (allData.success) {
                const all = allData.services || [];
                setAllServices(all);

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

    // Handle marking a service complete from the modal
    const handleCompleteService = async (
        serviceId: string,
        data: {
            actualDuration: number;
            attendanceCount: number;
            deliveredAsPlanned: boolean;
            deviationNotes?: string;
        }
    ): Promise<boolean> => {
        try {
            const res = await fetch('/api/service-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'complete',
                    serviceId,
                    actualDuration: data.actualDuration,
                    attendanceCount: data.attendanceCount,
                    deliveredAsPlanned: data.deliveredAsPlanned,
                    deviationNotes: data.deviationNotes,
                }),
            });
            const result = await res.json();
            if (result.success) {
                await fetchServices();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error completing service:', error);
            return false;
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
                                <h1 className="text-xl font-bold text-[#0E2235]">Service Planner</h1>
                                <p className="text-sm text-gray-500">Schedule, Plan, verify, and document services</p>
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

                {/* View Filter Tabs + View Mode Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex gap-2">
                        {viewMode === 'list' && [
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
                                    viewFilter === tab.id ? 'bg-white/20' : 'bg-gray-100'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                        {viewMode === 'calendar' && (
                            <div className="flex items-center px-1 text-sm text-gray-500">
                                Showing all services
                            </div>
                        )}
                    </div>

                    {/* List / Calendar toggle */}
                    <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'list'
                                    ? 'bg-[#1A73A8] text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                viewMode === 'calendar'
                                    ? 'bg-[#1A73A8] text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Calendar
                        </button>
                    </div>
                </div>

                {/* ─── List View ─── */}
                {viewMode === 'list' && (
                    <>
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
                    </>
                )}

                {/* ─── Calendar View ─── */}
                {viewMode === 'calendar' && (
                    <CalendarView
                        allServices={allServices}
                        onServiceClick={(service) => setModalService(service)}
                        onPlanService={() => router.push('/service-log/plan')}
                    />
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

            {/* ─── Service Detail Modal ─── */}
            {modalService && (
                <ServiceDetailModal
                    service={modalService}
                    onClose={() => setModalService(null)}
                    onComplete={handleCompleteService}
                    onNavigate={(id) => router.push(`/service-log/${id}`)}
                />
            )}
        </div>
    );
}
