'use client';

// ============================================================================
// Peer Support Studio - Participant Detail Page (Updated)
// File: /app/participants/[id]/page.tsx
// ============================================================================

import PortalAccessCard from '@/app/components/PortalAccessCard';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, Mail, Calendar, MapPin,
    Target, FileText, Activity, Plus, Edit, Loader2,
    AlertCircle, ChevronRight, Clock, Users, Heart,
    Home, Scale, Shield, Sparkles, BookHeart, Eye, Lock, X,
    ClipboardList, GraduationCap, Share2, TrendingUp,
    CheckCircle2, Paperclip, Download, Trash2, Upload
} from 'lucide-react';
import AssessmentDetailModal from '@/app/components/AssessmentDetailModal';
import AssessmentTrendChart from '@/app/components/AssessmentTrendChart';
import ReadinessChecklist from '@/app/components/ReadinessChecklist';
import ParticipantSnapshotModal from '@/app/components/ParticipantSnapshotModal';
import BillingReadinessCard, { BillingStatusBadge } from '@/app/components/BillingReadinessCard';
import { formatDateOnly } from '@/lib/dateUtils';

// ============================================================================
// Types
// ============================================================================

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    status: string;
    intake_date: string;
    referral_source?: string;
    primary_pss_name?: string;
    internal_notes?: string;
    is_reentry_participant?: boolean;
    location_id?: string;
    location_name?: string;
    location_short_name?: string;
}

interface Goal {
    id: string;
    smart_goal: string;
    goal_area: string;
    desired_outcome: string;
    status: string;
    progress: number;
    timeframe: string;
    created_at: string;
}

interface SessionNote {
    id: string;
    session_date?: string;
    date_of_service?: string;
    created_at?: string;
    session_type?: string;
    type?: string;
    service_type?: string;
    duration_minutes?: number;
    duration?: number;
    pss_note?: { sessionOverview?: string };
    source?: string;
}

interface Assessment {
    id: string;
    assessment_type: string;
    total_score: number;
    domain_scores?: any;
    responses?: any;
    ai_analysis?: any;
    notes?: string;
    participant_name?: string;
    assessment_date?: string;
    created_at: string;
}

interface JournalEntry {
    id: string;
    entry_text: string;
    mood: string | null;
    shared_with_pss: boolean;
    pss_viewed: boolean;
    created_at: string;
    updated_at: string;
}

type TabType = 'overview' | 'intake' | 'goals' | 'plans' | 'notes' | 'assessments' | 'activity' | 'curricula' | 'readiness' | 'referrals' | 'documents';

interface AssessmentSchedule {
    id: string;
    assessment_type: string;
    interval_days: number;
    next_due_date: string | null;
    last_completed_at: string | null;
    is_active: boolean;
    is_overdue?: boolean;
}

interface Referral {
    id: string;
    participant_id: string;
    referred_to: string;
    referral_type?: string;
    contact_info?: string;
    reason?: string;
    status?: string;
    follow_up_date?: string | null;
    referred_at?: string | null;
    notes?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatSessionDate(note: SessionNote): string {
    const dateValue = note.session_date || note.date_of_service || note.created_at;
    if (!dateValue) return 'Date not recorded';

    try {
        return formatDateOnly(dateValue, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) || 'Date not recorded';
    } catch {
        return 'Date not recorded';
    }
}

function getSessionType(note: SessionNote): string {
    const type = note.session_type || note.type || note.service_type;
    if (!type) return 'Session';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function getDuration(note: SessionNote): string {
    const duration = note.duration_minutes || note.duration;
    if (!duration || duration === 0) return '';
    return `${duration} min`;
}

function formatAddress(participant: Participant): string | null {
    if (!participant.address_line1 && !participant.city) return null;
    
    let address = participant.address_line1 || '';
    if (participant.address_line2) address += `, ${participant.address_line2}`;
    if (participant.city) address += `${address ? ', ' : ''}${participant.city}`;
    if (participant.state) address += `, ${participant.state}`;
    if (participant.zip) address += ` ${participant.zip}`;
    
    return address || null;
}

function formatGender(gender?: string): string {
    if (!gender) return '';
    const genderMap: Record<string, string> = {
        'male': 'Male',
        'female': 'Female',
        'non-binary': 'Non-binary',
        'other': 'Other',
        'prefer-not-to-say': 'Prefer not to say'
    };
    return genderMap[gender] || gender;
}

// Journal mood display helpers
const moodMap: Record<string, { emoji: string; label: string }> = {
    great: { emoji: '😊', label: 'Great' },
    good: { emoji: '🙂', label: 'Good' },
    okay: { emoji: '😐', label: 'Okay' },
    down: { emoji: '😔', label: 'Down' },
    frustrated: { emoji: '😤', label: 'Frustrated' },
    anxious: { emoji: '😰', label: 'Anxious' },
    grateful: { emoji: '🙏', label: 'Grateful' },
    strong: { emoji: '💪', label: 'Strong' },
};

// ============================================================================
// Intake Display Helpers
// ============================================================================

const MARITAL_MAP: Record<string, string> = {
    single: 'Single / Never Married', married: 'Married', partner: 'Domestic Partner',
    separated: 'Separated', divorced: 'Divorced', widowed: 'Widowed',
};
const RACE_MAP: Record<string, string> = {
    white: 'White', black: 'Black / African American', hispanic: 'Hispanic / Latino',
    asian: 'Asian', native: 'American Indian / Alaska Native', pacific: 'Native Hawaiian / Pacific Islander', other: 'Other',
};
const ETHNICITY_MAP: Record<string, string> = {
    hispanic: 'Hispanic or Latino', not_hispanic: 'Not Hispanic or Latino',
};
const GENDER_MAP: Record<string, string> = {
    male: 'Male', female: 'Female', non_binary: 'Non-binary', prefer_not: 'Prefer not to say', other: 'Other',
};
const REFERRAL_MAP: Record<string, string> = {
    self: 'Self', family: 'Family / Friend', professional: 'Treatment Professional',
    court: 'Court / Legal System', community: 'Community Organization', other: 'Other',
};
const LEGAL_STATUS_MAP: Record<string, string> = {
    none: 'No current legal involvement', court_diversion: 'Court Diversion Program',
    probation: 'Probation', parole: 'Parole', drug_court: 'Drug Court', pending: 'Charges Pending',
};
const LEGAL_OFFICER_MAP: Record<string, string> = {
    none: 'None', probation_officer: 'Probation Officer', parole_officer: 'Parole Officer', case_manager: 'Court Case Manager',
};
const PHYSICAL_MAP: Record<string, string> = {
    none: 'None', chronic: 'Chronic Pain / Condition', cancer: 'Cancer',
    communicable: 'Communicable Disease', diabetes: 'Diabetes', heart: 'Heart Disease',
    respiratory: 'Respiratory Condition', seizures: 'Seizure Disorder', other: 'Other',
};
const MENTAL_MAP: Record<string, string> = {
    none: 'None', anxiety: 'Anxiety Disorder', mood: 'Mood Disorder',
    ptsd: 'PTSD / Trauma-Related', behavioral: 'Behavioral Disorder',
    psychotic: 'Psychotic Disorder', eating: 'Eating Disorder', other: 'Other',
};
const INSURANCE_MAP: Record<string, string> = {
    none: 'No Insurance', medicaid: 'Medicaid', medicare: 'Medicare',
    private_self: 'Private (Self)', private_family: 'Private (Family/Employer)', va: 'VA / Military', other: 'Other',
};
const EDUCATION_MAP: Record<string, string> = {
    less_hs: 'Less than High School', hs_diploma: 'High School Diploma', ged: 'GED',
    some_college: 'Some College', associates: "Associate's Degree", bachelors: "Bachelor's Degree",
    technical: 'Technical / Vocational', military: 'Military Training', advanced: 'Advanced Degree',
};
const EMPLOYMENT_MAP: Record<string, string> = {
    full_time: 'Full-Time', part_time: 'Part-Time', part_time_seasonal: 'Part-Time (Seasonal)',
    unemployed_student: 'Unemployed — Student', unemployed_homemaker: 'Unemployed — Homemaker',
    unemployed_looking: 'Unemployed', retired: 'Retired', unemployed_disabled: 'Disability',
    controlled_environment: 'Controlled Environment', other: 'Other',
};
const INCOME_SOURCE_MAP: Record<string, string> = {
    employment: 'Employment', ssdi: 'SSDI', ssi: 'SSI', tanf: 'TANF', snap: 'SNAP / Food Stamps',
    unemployment: 'Unemployment', family_support: 'Family Support', va_benefits: 'VA Benefits', other: 'Other',
};
const BENEFIT_MAP: Record<string, string> = {
    health_insurance: 'Health Insurance', retirement: 'Retirement / 401k', pto: 'Paid Time Off',
};
const SUBSTANCE_MAP: Record<string, string> = {
    alcohol: 'Alcohol', tobacco: 'Tobacco / Nicotine', marijuana: 'Marijuana / Cannabis',
    opiates: 'Prescription Opioids', heroin: 'Heroin', methadone: 'Methadone',
    suboxone: 'Suboxone / Buprenorphine', cocaine: 'Cocaine / Crack', stimulants: 'Stimulants (Meth, Adderall)',
    sedatives: 'Sedatives / Benzos', hallucinogens: 'Hallucinogens', inhalants: 'Inhalants',
    synthetic: 'Synthetic Drugs', none: 'None', other: 'Other',
};
const DV_TIMELINE_MAP: Record<string, string> = {
    within_3mo: 'Within 3 months', '3_6mo': '3–6 months ago', '7_12mo': '7–12 months ago', over_1yr: 'Over 1 year ago',
};

// ── Billing / eligibility lookups (mirror lib/intakeFormTypes option lists) ──
const PRIMARY_INSURANCE_TYPE_MAP: Record<string, string> = {
    none: 'Uninsured / Self-Pay', medicaid: 'Medicaid', medicare: 'Medicare',
    dual: 'Dual Eligible (Medicare + Medicaid)', private: 'Private / Commercial',
    va: 'VA / TRICARE', marketplace: 'ACA Marketplace', other: 'Other',
};
const SUBSCRIBER_REL_MAP: Record<string, string> = {
    self: 'Self', spouse: 'Spouse', child: 'Child', other: 'Other Dependent',
};
const ELIGIBILITY_STATUS_MAP: Record<string, string> = {
    active: 'Active — Verified', inactive: 'Inactive / Terminated',
    pending: 'Pending Verification', not_checked: 'Not Yet Checked',
};
const ELIGIBILITY_METHOD_MAP: Record<string, string> = {
    portal: 'Payer Portal', phone: 'Phone Call', clearinghouse: 'Clearinghouse (270/271)', payer_website: 'Payer Website',
};
const VERIFIED_FROM_MAP: Record<string, string> = {
    insurance_card: 'Insurance Card', portal: 'Payer Portal', phone: 'Phone Verification',
    clearinghouse: 'Clearinghouse', payer_website: 'Payer Website', referral_docs: 'Referral/Discharge Paperwork',
};
const CREDENTIAL_MAP: Record<string, string> = {
    md: 'MD', do: 'DO', lcsw: 'LCSW', lpcc: 'LPCC', lmft: 'LMFT', psyd: 'PsyD', aprn: 'APRN', cadc: 'CADC', other: 'Other',
};
const DIAGNOSIS_SOURCE_MAP: Record<string, string> = {
    referring_provider: 'Referring Provider', treatment_team: 'Treatment Team',
    hospital_discharge: 'Hospital Discharge', assessment: 'Clinical Assessment on File', self_report: 'Self-Report (unverified)',
};
const RELEASE_PARTY_MAP: Record<string, string> = {
    insurance: 'Insurance / Payer', referring_provider: 'Referring Provider', pcp: 'Primary Care Provider',
    treatment_team: 'Treatment Team', legal: 'Court / Probation / Parole', family: 'Family Member(s)', other: 'Other',
};

function formatLookup(val: string | null | undefined, map: Record<string, string>): string | null {
    if (!val) return null;
    return map[val] || val;
}

function formatJsonbArray(val: any, map: Record<string, string>): string | null {
    if (!val) return null;
    const arr = typeof val === 'string' ? JSON.parse(val) : val;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((v: string) => map[v] || v).join(', ');
}

function formatBool(val: boolean | null | undefined): string | null {
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    return null;
}

function IntakeSection({ title, icon: Icon, color, children }: {
    title: string; icon: any; color: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100" style={{ backgroundColor: `${color}08` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <h3 className="font-semibold text-[#0E2235]">{title}</h3>
            </div>
            <div className="divide-y divide-gray-50">{children}</div>
        </div>
    );
}

function IntakeRow({ label, value, showEmpty }: { label: string; value: string | null | undefined; showEmpty?: boolean }) {
    if (!value && !showEmpty) return null;
    return (
        <div className="flex items-start gap-4 px-5 py-3">
            <span className="text-sm text-gray-500 w-44 flex-shrink-0">{label}</span>
            <span className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>{value || '—'}</span>
        </div>
    );
}

// Format a YYYY-MM-DD / ISO date string for read-mode display; null-safe.
function fmtDate(val: string | null | undefined): string | null {
    if (!val) return null;
    try { return formatDateOnly(val) || null; } catch { return null; }
}

// ============================================================================
// Main Component
// ============================================================================

export default function ParticipantDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { data: session } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [participant, setParticipant] = useState<Participant | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [notes, setNotes] = useState<SessionNote[]>([]);
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [recoveryPlans, setRecoveryPlans] = useState<any[]>([]);
    const [intake, setIntake] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
    const [showSnapshotModal, setShowSnapshotModal] = useState(false);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [showJournalModal, setShowJournalModal] = useState(false);
    const [groupAttendance, setGroupAttendance] = useState<any[]>([]);
    const [resourceLogs, setResourceLogs] = useState<any[]>([]);
    const [participantCurricula, setParticipantCurricula] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<AssessmentSchedule[]>([]);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [docsUnavailable, setDocsUnavailable] = useState(false);
    const [docBusyId, setDocBusyId] = useState<string | null>(null);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        async function fetchData() {
            if (!currentOrg?.id || !params.id) return;

            try {
                // Fetch participant
                const pRes = await fetch(`/api/participants/${params.id}?organization_id=${currentOrg.id}`);
                const pData = await pRes.json();
                if (pData.error) throw new Error(pData.error);
                setParticipant(pData.participant);

                // Fetch goals
                const gRes = await fetch(`/api/saved-goals?organization_id=${currentOrg.id}&participant_id=${params.id}&status=all`);
                const gData = await gRes.json();
                setGoals(gData.goals || []);

                // Fetch session notes
                const nRes = await fetch(`/api/session-notes?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const nData = await nRes.json();
                setNotes(nData.notes || []);

                // Fetch assessments
                const aRes = await fetch(`/api/recovery-assessments?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const aData = await aRes.json();
                setAssessments(aData.assessments || []);

                // Fetch recovery plans
                const rpRes = await fetch(`/api/rc-plans?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const rpData = await rpRes.json();
                setRecoveryPlans(rpData.plans || []);

                // Fetch intake
                const iRes = await fetch(`/api/intake?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                const iData = await iRes.json();
                if (iData.intakes?.length > 0) setIntake(iData.intakes[0]);

                // Fetch shared journal entries
                const jRes = await fetch(`/api/journal?participant_id=${params.id}&organization_id=${currentOrg.id}`);
                const jData = await jRes.json();
                setJournalEntries(jData.entries || []);

                // Fetch group attendance + service/resource logs for the Activity tab
                const gaRes = await fetch(`/api/group-attendance?participant_id=${params.id}`);
                const gaData = await gaRes.json();
                setGroupAttendance(gaData.attendance || []);

                const srRes = await fetch(`/api/service-resource-log?participant_id=${params.id}`);
                const srData = await srRes.json();
                setResourceLogs(srData.logs || []);

                // Fetch curriculum enrollments
                const curRes = await fetch(`/api/participants/${params.id}/curricula`);
                const curData = await curRes.json();
                setParticipantCurricula(curData.enrollments || []);

                // Fetch attached documents (non-fatal; degrades to empty)
                try {
                    const docRes = await fetch(`/api/participant-documents?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                    if (docRes.ok) {
                        const docData = await docRes.json();
                        setDocuments(docData.documents || []);
                    }
                } catch {
                    /* non-fatal */
                }

            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load participant');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [currentOrg?.id, params.id]);

    // Reassessment schedules + referrals load separately so a failure (e.g. the
    // referrals endpoint not yet deployed) never blocks the main participant view.
    useEffect(() => {
        async function fetchAux() {
            if (!currentOrg?.id || !params.id) return;

            // Reassessment cadence schedules
            try {
                const res = await fetch(`/api/assessment-schedules?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setSchedules(data.schedules || []);
                }
            } catch {
                /* non-fatal */
            }

            // Referrals (read-only consumer; degrade to empty if 404 / not deployed)
            try {
                const res = await fetch(`/api/referrals?organization_id=${currentOrg.id}&participant_id=${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setReferrals(data.referrals || []);
                } else {
                    setReferrals([]);
                }
            } catch {
                setReferrals([]);
            }
        }
        fetchAux();
    }, [currentOrg?.id, params.id]);

    // ========================================================================
    // Handlers
    // ========================================================================

    // Upsert a reassessment cadence for an instrument. Accepts an interval
    // (preset or custom) and/or an explicit next-due date ('now'/'today' or
    // a YYYY-MM-DD string).
    const upsertCadence = async (
        assessmentType: string,
        payload: { interval_days?: number; next_due_date?: string }
    ) => {
        if (!currentOrg?.id || !params.id) return;
        try {
            const res = await fetch('/api/assessment-schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: params.id,
                    assessment_type: assessmentType,
                    ...payload,
                }),
            });
            const data = await res.json();
            if (res.ok && data.schedule) {
                setSchedules(prev => [
                    ...prev.filter(s => s.assessment_type !== assessmentType),
                    data.schedule,
                ]);
            }
        } catch (e) {
            console.error('Failed to set cadence:', e);
        }
    };

    // Preset cadence (30/60/90 or a custom number of days).
    const setCadence = (assessmentType: string, intervalDays: number) =>
        upsertCadence(assessmentType, { interval_days: intervalDays });

    // Mark the instrument due now (surfaces immediately in "Assessments Due").
    const setDueNow = (assessmentType: string) =>
        upsertCadence(assessmentType, { next_due_date: 'today' });

    // Set an explicit next-due date.
    const setDueDate = (assessmentType: string, date: string) => {
        if (!date) return;
        upsertCadence(assessmentType, { next_due_date: date });
    };

    // Mark an instrument reassessed today (stamps completion, pushes next due out).
    const markReassessed = async (schedule: AssessmentSchedule) => {
        if (!currentOrg?.id) return;
        try {
            const res = await fetch('/api/assessment-schedules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: schedule.id,
                    organization_id: currentOrg.id,
                    action: 'complete',
                }),
            });
            const data = await res.json();
            if (res.ok && data.schedule) {
                setSchedules(prev => prev.map(s => (s.id === schedule.id ? data.schedule : s)));
            }
        } catch (e) {
            console.error('Failed to mark reassessed:', e);
        }
    };

    // Stop tracking a cadence (soft deactivate).
    const removeCadence = async (schedule: AssessmentSchedule) => {
        if (!currentOrg?.id) return;
        try {
            const res = await fetch(`/api/assessment-schedules?id=${schedule.id}&organization_id=${currentOrg.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setSchedules(prev => prev.filter(s => s.id !== schedule.id));
            }
        } catch (e) {
            console.error('Failed to remove cadence:', e);
        }
    };

    const handleAnalyzeAssessment = async (assessmentId: string) => {
        try {
            const res = await fetch(`/api/recovery-assessments/${assessmentId}/analyze`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                setAssessments(prev =>
                    prev.map(a => a.id === assessmentId ? { ...a, ai_analysis: data.analysis } : a)
                );
                if (selectedAssessment?.id === assessmentId) {
                    setSelectedAssessment(prev => prev ? { ...prev, ai_analysis: data.analysis } : null);
                }
                return data.analysis;
            }
        } catch (e) {
            console.error('Analysis failed:', e);
        }
        return null;
    };

    const handleDeleteAssessment = async (assessmentId: string) => {
        if (!confirm('Are you sure you want to delete this assessment?')) return;

        try {
            const res = await fetch(`/api/recovery-assessments?id=${assessmentId}&organization_id=${currentOrg?.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setAssessments(prev => prev.filter(a => a.id !== assessmentId));
                setSelectedAssessment(null);
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    // Documents — request a short-lived presigned URL then open it.
    const handleDownloadDocument = async (docId: string) => {
        if (!currentOrg?.id) return;
        setDocBusyId(docId);
        try {
            const res = await fetch(`/api/participant-documents?organization_id=${currentOrg.id}&id=${docId}&download=1`);
            const data = await res.json();
            if (res.ok && data.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
            } else if (res.status === 503) {
                setDocsUnavailable(true);
            }
        } catch (e) {
            console.error('Download failed:', e);
        } finally {
            setDocBusyId(null);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!currentOrg?.id) return;
        if (!confirm('Delete this document? This cannot be undone.')) return;
        setDocBusyId(docId);
        try {
            const res = await fetch(`/api/participant-documents?organization_id=${currentOrg.id}&id=${docId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.id !== docId));
            }
        } catch (e) {
            console.error('Delete failed:', e);
        } finally {
            setDocBusyId(null);
        }
    };

    // Mark this participant's shared journal entries as viewed by the PSS so the
    // "X new" badge clears. Optimistically updates the UI; fires when the PSS
    // opens the shared-journal section.
    const markJournalViewed = async () => {
        if (!currentOrg?.id || !params.id) return;
        if (!journalEntries.some(e => !e.pss_viewed)) return; // nothing new

        setJournalEntries(prev => prev.map(e => ({ ...e, pss_viewed: true })));
        try {
            await fetch('/api/journal', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark_viewed',
                    participant_id: params.id,
                    organization_id: currentOrg.id,
                }),
            });
        } catch {
            // UI already reflects viewed; a refresh will reconcile if needed.
        }
    };

    // ========================================================================
    // Render: Loading & Error States
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (error || !participant) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Participant</h1>
                <p className="text-gray-600 mb-6">{error || 'Participant not found'}</p>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg"
                >
                    Go Back
                </button>
            </div>
        );
    }

    // ========================================================================
    // Computed Values
    // ========================================================================

    const displayName = participant.preferred_name || participant.first_name;
    const fullName = `${participant.first_name} ${participant.last_name}`;
    const initials = `${participant.first_name[0]}${participant.last_name[0]}`.toUpperCase();
    const intakeDate = new Date(participant.intake_date);
    const daysInProgram = Math.floor((new Date().getTime() - intakeDate.getTime()) / (1000 * 60 * 60 * 24));
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const address = formatAddress(participant);

    const goalAreaColors: Record<string, string> = {
        'Physical Health': '#30B27A',
        'Mental Health': '#1A73A8',
        'Social Relationships': '#F59E0B',
        'Employment': '#8B5CF6',
        'Housing': '#EC4899',
        'Education': '#06B6D4',
        'Financial': '#10B981',
        'Legal': '#EF4444',
        'Spiritual': '#6366F1',
        'Recovery Support': '#14B8A6'
    };

    // Tab configuration - include Readiness tab for reentry participants
    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'intake', label: 'Intake', icon: ClipboardList },
        { id: 'goals', label: 'Goals', icon: Target },
        { id: 'plans', label: 'Recovery Plans', icon: Heart },
        { id: 'notes', label: 'Session Notes', icon: FileText },
        { id: 'assessments', label: 'Assessments', icon: Activity },
        { id: 'referrals', label: 'Referrals', icon: Share2 },
        { id: 'documents', label: 'Documents', icon: Paperclip },
        { id: 'activity', label: 'Activity', icon: Users },
        { id: 'curricula', label: 'Curricula', icon: GraduationCap },
        ...(participant.is_reentry_participant ? [{ id: 'readiness', label: 'Readiness', icon: Shield }] : [])
    ];

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-xl font-semibold">
                            {initials}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#0E2235]">{fullName}</h1>
                                {participant.is_reentry_participant && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                        Reentry
                                    </span>
                                )}
                            </div>
                            {participant.preferred_name && (
                                <p className="text-gray-500">Goes by "{participant.preferred_name}"</p>
                            )}
                            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                                participant.status === 'active' ? 'bg-green-100 text-green-700' :
                                participant.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                                {participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowSnapshotModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Snapshot
                        </button>
                        {intake ? (
                            <button
                                onClick={() => setActiveTab('intake')}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
                            >
                                <ClipboardList className="w-4 h-4" />
                                View Intake
                            </button>
                        ) : (
                            <Link
                                href={`/intake?participant_id=${params.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
                            >
                                <ClipboardList className="w-4 h-4" />
                                Start Intake
                            </Link>
                        )}
                        <Link
                            href={`/participants/${params.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </Link>
                        
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{activeGoals}</p>
                            <p className="text-sm text-gray-500">Active Goals</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{notes.length}</p>
                            <p className="text-sm text-gray-500">Session Notes</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{assessments.length}</p>
                            <p className="text-sm text-gray-500">Assessments</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{recoveryPlans.length}</p>
                            <p className="text-sm text-gray-500">Recovery Plans</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">{daysInProgram}</p>
                            <p className="text-sm text-gray-500">Days in Program</p>
                        </div>
                    </div>
                </div>
                <BillingStatusBadge intake={intake} />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex gap-8 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 pb-4 border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-[#1A73A8] text-[#1A73A8]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* ================================================================ */}
            {/* OVERVIEW TAB */}
            {/* ================================================================ */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <BillingReadinessCard intake={intake} participantId={params.id as string} />
                    <div className="grid md:grid-cols-2 gap-6">
                    {/* Contact Information */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-4">Contact Information</h3>
                        <div className="space-y-4">
                            {participant.phone && (
                                <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">{participant.phone}</span>
                                </div>
                            )}
                            {participant.email && (
                                <div className="flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">{participant.email}</span>
                                </div>
                            )}
                            {participant.date_of_birth && (
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">
                                        DOB: {formatDateOnly(participant.date_of_birth)}
                                    </span>
                                </div>
                            )}
                            {participant.gender && (
                                <div className="flex items-center gap-3">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">Gender: {formatGender(participant.gender)}</span>
                                </div>
                            )}
                            {address && (
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                    <span className="text-gray-700">{address}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Program Details */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-4">Program Details</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-700">
                                    Intake: {formatDateOnly(participant.intake_date)}
                                </span>
                            </div>
                            {participant.referral_source && (
                                <div className="flex items-center gap-3">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">Referral: {participant.referral_source}</span>
                                </div>
                            )}
                            {participant.primary_pss_name && (
                                <div className="flex items-center gap-3">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">Primary PSS: {participant.primary_pss_name}</span>
                                </div>
                            )}
                            {participant.location_name && (
                                <div className="flex items-center gap-3">
                                    <Home className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">Location: {participant.location_name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    {(participant.emergency_contact_name || participant.emergency_contact_phone) && (
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-[#0E2235] mb-4">Emergency Contact</h3>
                            <div className="space-y-2">
                                {participant.emergency_contact_name && (
                                    <p className="text-gray-700 font-medium">{participant.emergency_contact_name}</p>
                                )}
                                {participant.emergency_contact_relationship && (
                                    <p className="text-gray-500 text-sm">{participant.emergency_contact_relationship}</p>
                                )}
                                {participant.emergency_contact_phone && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        {participant.emergency_contact_phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Internal Notes */}
                    {participant.internal_notes && (
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-[#0E2235] mb-4">Internal Notes</h3>
                            <p className="text-gray-700 whitespace-pre-wrap">{participant.internal_notes}</p>
                        </div>
                    )}

                    {/* Shared Journal Entries */}
                    {journalEntries.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-[#0E2235] flex items-center gap-2">
                                    <BookHeart className="w-5 h-5 text-amber-500" />
                                    Shared Journal
                                </h3>
                                {journalEntries.filter(e => !e.pss_viewed).length > 0 && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                        {journalEntries.filter(e => !e.pss_viewed).length} new
                                    </span>
                                )}
                            </div>
                            <div className="space-y-3">
                                {journalEntries.slice(0, 3).map(entry => (
                                    <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        {entry.mood && moodMap[entry.mood] && (
                                            <span className="text-xl mt-0.5" title={moodMap[entry.mood].label}>
                                                {moodMap[entry.mood].emoji}
                                            </span>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-700 line-clamp-2">{entry.entry_text}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                {entry.mood && moodMap[entry.mood] && ` · Feeling ${moodMap[entry.mood].label.toLowerCase()}`}
                                            </p>
                                        </div>
                                        {!entry.pss_viewed && (
                                            <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" title="Not yet viewed" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { setShowJournalModal(true); void markJournalViewed(); }}
                                className="w-full mt-4 py-2.5 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Eye className="w-4 h-4" />
                                View All {journalEntries.length} {journalEntries.length === 1 ? 'Entry' : 'Entries'}
                            </button>
                        </div>
                    )}

                    {/* Portal Access Card */}
                    <PortalAccessCard
                        participantId={participant.id}
                        participantEmail={participant.email}
                        participantName={displayName}
                        organizationId={currentOrg?.id || ''}
                    />
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* INTAKE TAB */}
            {/* ================================================================ */}
            {activeTab === 'intake' && (
                <div className="space-y-6">
                    {!intake ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Intake on File</h3>
                            <p className="text-gray-500 mb-6">Complete an intake to document {displayName}&apos;s background, health, and recovery history.</p>
                            <Link
                                href={`/intake?participant_id=${participant.id}`}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Start Intake
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Action bar */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-500">
                                    {intake.status === 'draft'
                                        ? <span className="inline-flex items-center px-2 py-0.5 mr-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Draft</span>
                                        : null}
                                    {intake.status === 'draft' ? 'Started' : 'Completed'} {formatDateOnly(intake.intake_date)}
                                    {intake.completed_by_name && <> by {intake.completed_by_name}</>}
                                    {intake.updated_at && intake.updated_at !== intake.created_at && (
                                        <> · Updated {new Date(intake.updated_at).toLocaleDateString()}</>
                                    )}
                                </div>
                                <Link
                                    href={`/intake?participant_id=${participant.id}&edit=true&intake_id=${intake.id}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090] text-sm font-medium"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit Intake
                                </Link>
                            </div>

                            {/* Background */}
                            <IntakeSection title="Background" icon={User} color="#6366F1">
                                <IntakeRow label="Other Names / Aliases" value={intake.other_names} />
                                <IntakeRow label="SSN (Last 4)" value={intake.ssn_last_four ? `***-**-${intake.ssn_last_four}` : null} />
                                <IntakeRow label="Home ZIP" value={intake.home_zip} />
                                <IntakeRow label="City / State" value={intake.home_city_state} />
                                <IntakeRow label="Veteran" value={intake.is_veteran ? 'Yes' : intake.is_veteran === false ? 'No' : null} />
                                <IntakeRow label="English First Language" value={intake.is_english_first_language ? 'Yes' : intake.is_english_first_language === false ? 'No' : null} />
                                {!intake.is_english_first_language && <IntakeRow label="Other Language" value={intake.other_language} />}
                                <IntakeRow label="Marital Status" value={formatLookup(intake.marital_status, MARITAL_MAP)} />
                                <IntakeRow label="Race" value={formatJsonbArray(intake.race, RACE_MAP)} />
                                {intake.race_other && <IntakeRow label="Race (Other)" value={intake.race_other} />}
                                <IntakeRow label="Ethnicity" value={formatLookup(intake.ethnicity, ETHNICITY_MAP)} />
                                <IntakeRow label="Gender Identity" value={formatLookup(intake.gender_identity, GENDER_MAP)} />
                                {intake.gender_other && <IntakeRow label="Gender (Other)" value={intake.gender_other} />}
                                <IntakeRow label="Minor Children" value={intake.has_minor_children} />
                                <IntakeRow label="Referral Source" value={formatLookup(intake.referral_source, REFERRAL_MAP)} />
                                {intake.referral_source_other && <IntakeRow label="Referral (Other)" value={intake.referral_source_other} />}
                                <IntakeRow label="Legal Status" value={formatJsonbArray(intake.legal_status, LEGAL_STATUS_MAP)} />
                                <IntakeRow label="Legal Officers" value={formatJsonbArray(intake.legal_officers, LEGAL_OFFICER_MAP)} />
                            </IntakeSection>

                            {/* Emergency Contact 2 */}
                            {(intake.emergency_contact_2_name || intake.emergency_contact_2_phone) && (
                                <IntakeSection title="Second Emergency Contact" icon={Phone} color="#DC2626">
                                    <IntakeRow label="Name" value={intake.emergency_contact_2_name} />
                                    <IntakeRow label="Relationship" value={intake.emergency_contact_2_relationship} />
                                    <IntakeRow label="Phone" value={intake.emergency_contact_2_phone} />
                                </IntakeSection>
                            )}

                            {/* Health */}
                            <IntakeSection title="Health" icon={Heart} color="#EC4899">
                                <IntakeRow label="Physical Conditions" value={formatJsonbArray(intake.physical_health_conditions, PHYSICAL_MAP)} />
                                {intake.physical_health_other && <IntakeRow label="Physical (Other)" value={intake.physical_health_other} />}
                                <IntakeRow label="Takes Physical Medications" value={formatBool(intake.takes_physical_medications)} />
                                {intake.takes_physical_medications && <IntakeRow label="Physical Medications" value={intake.physical_medications} />}
                                <IntakeRow label="Mental Health Conditions" value={formatJsonbArray(intake.mental_health_conditions, MENTAL_MAP)} />
                                {intake.mental_health_other && <IntakeRow label="Mental Health (Other)" value={intake.mental_health_other} />}
                                <IntakeRow label="Takes Mental Health Medications" value={formatBool(intake.takes_mental_medications)} />
                                {intake.takes_mental_medications && <IntakeRow label="Mental Medications" value={intake.mental_medications} />}
                                <IntakeRow label="Pregnant" value={intake.is_pregnant || null} />
                                {intake.pregnancy_months && <IntakeRow label="Months Pregnant" value={String(intake.pregnancy_months)} />}
                            </IntakeSection>

                            {/* Insurance */}
                            <IntakeSection title="Insurance & Provider" icon={Activity} color="#0891B2">
                                <IntakeRow label="Insurance" value={formatLookup(intake.insurance_type, INSURANCE_MAP)} />
                                {intake.insurance_other && <IntakeRow label="Insurance (Other)" value={intake.insurance_other} />}
                                <IntakeRow label="Has Primary Provider" value={formatBool(intake.has_primary_provider)} />
                                {intake.has_primary_provider && <IntakeRow label="Provider Name" value={intake.provider_name} />}
                                {intake.has_primary_provider && <IntakeRow label="Provider Phone" value={intake.provider_phone} />}
                            </IntakeSection>

                            {/* ============================================================ */}
                            {/* Insurance, Eligibility & Authorization (billing-grade) */}
                            {/* ============================================================ */}

                            {/* Consent & Authorization */}
                            <IntakeSection title="Consent & Authorization" icon={Shield} color="#7C3AED">
                                <IntakeRow label="Consent to Treat" value={formatBool(intake.consent_to_treat)} showEmpty />
                                <IntakeRow label="Consent to Treat — Date" value={fmtDate(intake.consent_to_treat_date)} showEmpty />
                                <IntakeRow label="Consent to Bill Insurance" value={formatBool(intake.consent_to_bill_insurance)} showEmpty />
                                <IntakeRow label="Bill Consent — Date" value={fmtDate(intake.consent_to_bill_date)} showEmpty />
                                <IntakeRow label="Release of Information (ROI)" value={formatBool(intake.consent_to_release_info)} showEmpty />
                                <IntakeRow label="ROI — Date" value={fmtDate(intake.consent_to_release_date)} showEmpty />
                                <IntakeRow label="ROI — Authorized Parties" value={formatJsonbArray(intake.consent_to_release_parties, RELEASE_PARTY_MAP)} showEmpty />
                                <IntakeRow label="Signature on File" value={formatBool(intake.consent_signature_on_file)} showEmpty />
                                {intake.consent_notes && <IntakeRow label="Consent Notes" value={intake.consent_notes} />}
                            </IntakeSection>

                            {/* Primary Insurance */}
                            <IntakeSection title="Primary Insurance" icon={Activity} color="#0891B2">
                                <IntakeRow label="Insurance Type" value={formatLookup(intake.primary_insurance_type, PRIMARY_INSURANCE_TYPE_MAP)} showEmpty />
                                {intake.medicaid_mco && <IntakeRow label="Medicaid MCO" value={intake.medicaid_mco} />}
                                <IntakeRow label="Payer Name" value={intake.primary_payer_name} showEmpty />
                                {intake.primary_payer_id && <IntakeRow label="Payer ID" value={intake.primary_payer_id} />}
                                <IntakeRow label="Member / Subscriber ID" value={intake.primary_member_id} showEmpty />
                                {intake.primary_group_number && <IntakeRow label="Group Number" value={intake.primary_group_number} />}
                                {intake.primary_plan_name && <IntakeRow label="Plan Name" value={intake.primary_plan_name} />}
                                <IntakeRow label="Relationship to Subscriber" value={formatLookup(intake.primary_subscriber_relationship, SUBSCRIBER_REL_MAP)} showEmpty />
                                {intake.primary_subscriber_relationship && intake.primary_subscriber_relationship !== 'self' && (
                                    <>
                                        <IntakeRow label="Subscriber Name" value={intake.primary_subscriber_name} showEmpty />
                                        <IntakeRow label="Subscriber DOB" value={fmtDate(intake.primary_subscriber_dob)} showEmpty />
                                    </>
                                )}
                                <IntakeRow label="Coverage Effective Date" value={fmtDate(intake.primary_effective_date)} showEmpty />
                                {intake.primary_termination_date && <IntakeRow label="Termination Date" value={fmtDate(intake.primary_termination_date)} />}
                                {intake.primary_insurance_phone && <IntakeRow label="Insurance Phone" value={intake.primary_insurance_phone} />}
                                {intake.primary_insurance_verified_from && <IntakeRow label="Verified From" value={formatLookup(intake.primary_insurance_verified_from, VERIFIED_FROM_MAP)} />}
                                <IntakeRow label="Insurance Card on File" value={formatBool(intake.insurance_card_on_file)} showEmpty />
                            </IntakeSection>

                            {/* Secondary Insurance */}
                            <IntakeSection title="Secondary Insurance" icon={Activity} color="#0EA5E9">
                                <IntakeRow label="Has Secondary Insurance" value={formatBool(intake.has_secondary_insurance)} showEmpty />
                                {intake.has_secondary_insurance && (
                                    <>
                                        <IntakeRow label="Insurance Type" value={formatLookup(intake.secondary_insurance_type, PRIMARY_INSURANCE_TYPE_MAP)} showEmpty />
                                        <IntakeRow label="Payer Name" value={intake.secondary_payer_name} showEmpty />
                                        <IntakeRow label="Member ID" value={intake.secondary_member_id} showEmpty />
                                        {intake.secondary_group_number && <IntakeRow label="Group Number" value={intake.secondary_group_number} />}
                                        <IntakeRow label="Relationship to Subscriber" value={formatLookup(intake.secondary_subscriber_relationship, SUBSCRIBER_REL_MAP)} showEmpty />
                                        {intake.secondary_effective_date && <IntakeRow label="Effective Date" value={fmtDate(intake.secondary_effective_date)} />}
                                    </>
                                )}
                            </IntakeSection>

                            {/* Eligibility */}
                            <IntakeSection title="Eligibility Verification" icon={Calendar} color="#0891B2">
                                <IntakeRow label="Eligibility Verified" value={formatBool(intake.eligibility_verified)} showEmpty />
                                <IntakeRow label="Status" value={formatLookup(intake.eligibility_status, ELIGIBILITY_STATUS_MAP)} showEmpty />
                                <IntakeRow label="Date Verified" value={fmtDate(intake.eligibility_verified_date)} showEmpty />
                                {intake.eligibility_verified_method && <IntakeRow label="Method" value={formatLookup(intake.eligibility_verified_method, ELIGIBILITY_METHOD_MAP)} />}
                                {intake.eligibility_verified_by && <IntakeRow label="Verified By" value={intake.eligibility_verified_by} />}
                                {intake.eligibility_notes && <IntakeRow label="Notes" value={intake.eligibility_notes} />}
                            </IntakeSection>

                            {/* Prior Authorization */}
                            <IntakeSection title="Prior Authorization" icon={FileText} color="#D97706">
                                <IntakeRow label="Prior Auth Required" value={formatBool(intake.prior_auth_required)} showEmpty />
                                <IntakeRow label="Authorization Number" value={intake.prior_auth_number} showEmpty />
                                <IntakeRow label="Start Date" value={fmtDate(intake.prior_auth_start_date)} showEmpty />
                                <IntakeRow label="End / Expiry Date" value={fmtDate(intake.prior_auth_end_date)} showEmpty />
                                {intake.prior_auth_units_approved != null && <IntakeRow label="Units Approved" value={String(intake.prior_auth_units_approved)} />}
                            </IntakeSection>

                            {/* Referring Provider */}
                            <IntakeSection title="Referring Provider" icon={User} color="#6366F1">
                                <IntakeRow label="Provider Name" value={intake.referring_provider_name} showEmpty />
                                <IntakeRow label="NPI" value={intake.referring_provider_npi} showEmpty />
                                {intake.referring_provider_credential && <IntakeRow label="Credential" value={formatLookup(intake.referring_provider_credential, CREDENTIAL_MAP)} />}
                                {intake.referring_provider_org && <IntakeRow label="Organization" value={intake.referring_provider_org} />}
                                {intake.referring_provider_phone && <IntakeRow label="Phone" value={intake.referring_provider_phone} />}
                                <IntakeRow label="Referral / Order on File" value={formatBool(intake.referral_order_on_file)} showEmpty />
                            </IntakeSection>

                            {/* Diagnosis */}
                            <IntakeSection title="Diagnosis (ICD-10)" icon={ClipboardList} color="#DC2626">
                                <IntakeRow
                                    label="Primary Diagnosis"
                                    value={intake.primary_diagnosis_code
                                        ? `${intake.primary_diagnosis_code}${intake.primary_diagnosis_description ? ' — ' + intake.primary_diagnosis_description : ''}`
                                        : null}
                                    showEmpty
                                />
                                {intake.secondary_diagnosis_code && (
                                    <IntakeRow
                                        label="Secondary Diagnosis"
                                        value={`${intake.secondary_diagnosis_code}${intake.secondary_diagnosis_description ? ' — ' + intake.secondary_diagnosis_description : ''}`}
                                    />
                                )}
                                <IntakeRow label="Diagnosis Source" value={formatLookup(intake.diagnosis_source, DIAGNOSIS_SOURCE_MAP)} showEmpty />
                                {intake.diagnosis_date && <IntakeRow label="Date Established" value={fmtDate(intake.diagnosis_date)} />}
                            </IntakeSection>

                            {/* Education & Employment */}
                            <IntakeSection title="Education & Employment" icon={Target} color="#D97706">
                                <IntakeRow label="Education Level" value={formatLookup(intake.education_level, EDUCATION_MAP)} />
                                <IntakeRow label="Past Year Employment" value={formatLookup(intake.past_year_employment, EMPLOYMENT_MAP)} />
                                <IntakeRow label="Currently Employed" value={formatBool(intake.currently_employed)} />
                                {intake.currently_employed && <IntakeRow label="Employer" value={intake.employer} />}
                                <IntakeRow label="Monthly Income (Pre-tax)" value={intake.monthly_income_pretax ? `$${Number(intake.monthly_income_pretax).toLocaleString()}` : null} />
                                <IntakeRow label="Employer Benefits" value={formatJsonbArray(intake.employer_benefits, BENEFIT_MAP)} />
                                <IntakeRow label="Income Sources" value={formatJsonbArray(intake.income_sources, INCOME_SOURCE_MAP)} />
                                {intake.income_sources_other && <IntakeRow label="Income (Other)" value={intake.income_sources_other} />}
                            </IntakeSection>

                            {/* Social & Safety */}
                            <IntakeSection title="Social & Safety" icon={Users} color="#059669">
                                <IntakeRow label="Supportive People" value={intake.supportive_people_count != null ? String(intake.supportive_people_count) : null} />
                                <IntakeRow label="DV Survivor" value={formatBool(intake.is_dv_survivor)} />
                                {intake.is_dv_survivor && <IntakeRow label="Last DV Episode" value={formatLookup(intake.last_dv_episode, DV_TIMELINE_MAP)} />}
                                {intake.is_dv_survivor && <IntakeRow label="Currently Fleeing" value={formatBool(intake.is_currently_fleeing)} />}
                            </IntakeSection>

                            {/* Substance Use */}
                            <IntakeSection title="Substance Use History" icon={Shield} color="#F97316">
                                <IntakeRow label="Age of First Use" value={intake.age_first_use != null ? String(intake.age_first_use) : null} />
                                <IntakeRow label="Substances Used" value={formatJsonbArray(intake.substances_used, SUBSTANCE_MAP)} />
                                {intake.substances_other && <IntakeRow label="Substances (Other)" value={intake.substances_other} />}
                                <IntakeRow label="History of Overdose" value={formatBool(intake.has_overdosed)} />
                                {intake.has_overdosed && <IntakeRow label="Overdose Count" value={intake.overdose_count != null ? String(intake.overdose_count) : null} />}
                            </IntakeSection>

                            {/* Recovery History */}
                            <IntakeSection title="Recovery History" icon={Home} color="#10B981">
                                <IntakeRow label="First Recovery Attempt" value={formatBool(intake.is_first_recovery_attempt)} />
                                {intake.is_first_recovery_attempt === false && <IntakeRow label="Previous Attempts" value={intake.previous_attempt_count != null ? String(intake.previous_attempt_count) : null} />}
                                <IntakeRow label="Received Prior Treatment" value={formatBool(intake.has_received_treatment)} />
                                {intake.has_received_treatment && <IntakeRow label="Treatment Types" value={intake.treatment_types} />}
                                {intake.recovery_notes && <IntakeRow label="Notes" value={intake.recovery_notes} />}
                            </IntakeSection>
                        </>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* GOALS TAB */}
            {/* ================================================================ */}
            {activeTab === 'goals' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/goals/new?participant_id=${participant.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            Create Goal
                        </Link>
                    </div>
                    {goals.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No goals yet. Create a recovery goal for {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {goals.map(goal => {
                                const color = goalAreaColors[goal.goal_area] || '#6B7280';
                                return (
                                    <div key={goal.id} onClick={() => router.push(`/goals/${goal.id}`)} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                        style={{ backgroundColor: `${color}15`, color }}
                                                    >
                                                        {goal.goal_area}
                                                    </span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                                                        goal.status === 'active' ? 'bg-green-100 text-green-700' :
                                                        goal.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {goal.status}
                                                    </span>
                                                </div>
                                                <p className="text-[#0E2235] font-medium">{goal.smart_goal}</p>
                                                {goal.desired_outcome && (
                                                    <p className="text-sm text-gray-500 mt-1">{goal.desired_outcome}</p>
                                                )}
                                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                    {goal.timeframe && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {goal.timeframe}
                                                        </span>
                                                    )}
                                                    <span>
                                                        Created {new Date(goal.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* RECOVERY PLANS TAB */}
            {/* ================================================================ */}
            {activeTab === 'plans' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/recovery-plans?create=true&participant_id=${participant.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            New Recovery Plan
                        </Link>
                    </div>
                    {recoveryPlans.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Recovery Plans Yet</h3>
                            <p className="text-gray-500 mb-6">Create a plan using the 10-domain recovery framework to track {displayName}&apos;s recovery journey.</p>
                            <Link
                                href={`/recovery-plans?create=true&participant_id=${participant.id}`}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90 font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Create First Plan
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {recoveryPlans.map(plan => {
                                const domainCount = Number(plan.domain_count || 0);
                                const totalGoals = Number(plan.total_goals || 0);
                                const completedGoals = Number(plan.completed_goals || 0);
                                const progress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

                                return (
                                    <Link
                                        key={plan.id}
                                        href={`/recovery-plans?view=${plan.id}`}
                                        className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-all block group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize mb-2 ${
                                                    plan.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    plan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                    plan.status === 'on_hold' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {plan.status === 'on_hold' ? 'On Hold' : plan.status}
                                                </span>
                                                <h4 className="font-semibold text-[#0E2235] text-lg">{plan.plan_name || 'Recovery Plan'}</h4>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {new Date(plan.created_at).toLocaleDateString()}
                                                    {domainCount > 0 && <> · {domainCount} domain{domainCount !== 1 ? 's' : ''}</>}
                                                    {totalGoals > 0 && <> · {totalGoals} goal{totalGoals !== 1 ? 's' : ''}</>}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#1A73A8] transition-colors mt-1" />
                                        </div>

                                        {totalGoals > 0 && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-500 whitespace-nowrap">Goal Progress</span>
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-[#1A73A8] to-[#30B27A] transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                    {completedGoals}/{totalGoals} completed
                                                </span>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* CURRICULA TAB */}
            {/* ================================================================ */}
            {activeTab === 'curricula' && (
                <div className="space-y-4">
                    {participantCurricula.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                            <GraduationCap className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Not enrolled in any curricula</h3>
                            <p className="text-gray-500 mb-6">Enroll this participant from a curriculum's Enrollments tab.</p>
                            <Link
                                href="/curricula"
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-white font-medium rounded-lg"
                                style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                            >
                                <GraduationCap className="w-4 h-4" /> Browse Curricula
                            </Link>
                        </div>
                    ) : (
                        participantCurricula.map((e: any) => {
                            const pct = e.total_modules > 0 ? Math.round((e.modules_completed / e.total_modules) * 100) : 0;
                            return (
                                <Link
                                    key={e.id}
                                    href={`/curricula/${e.curriculum_id}`}
                                    className="block bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-5 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                                <GraduationCap className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-[#0E2235]">{e.curriculum_name}</h4>
                                                {e.curriculum_source && (
                                                    <p className="text-xs text-gray-400">{e.curriculum_source}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${
                                            e.status === 'active' ? 'bg-green-100 text-green-700' :
                                            e.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                            e.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {e.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                        <span>{e.modules_completed}/{e.total_modules} modules</span>
                                        <span className="font-medium">{pct}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-[#30B27A] to-[#4AC490]"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* SESSION NOTES TAB */}
            {/* ================================================================ */}
            {activeTab === 'notes' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Link
                            href={`/session-notes?participant_id=${participant.id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            New Session Note
                        </Link>
                    </div>
                    {notes.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No session notes yet. Document your sessions with {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {notes.map(note => (
                                <Link
                                    key={note.id}
                                    href={`/session-notes/${note.id}`}
                                    className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow block"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-[#0E2235]">
                                                {formatSessionDate(note)}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                <span>{getSessionType(note)}</span>
                                                {getDuration(note) && <span>{getDuration(note)}</span>}
                                                {note.source && <span className="capitalize">{note.source}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* ASSESSMENTS TAB */}
            {/* ================================================================ */}
            {activeTab === 'assessments' && (
                <div className="space-y-4">
                    <div className="flex justify-end gap-3">
                        <Link
                            href={`/assessments/barc10?participant_id=${participant.id}&type=barc10`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            BARC-10
                        </Link>
                        <Link
                            href={`/assessments/mirc28?participant_id=${participant.id}&type=mirc28`}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090]"
                        >
                            <Plus className="w-4 h-4" />
                            MIRC-28
                        </Link>
                    </div>

                    {/* Reassessment Schedule (cadence) */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-5 h-5 text-[#1A73A8]" />
                            <h3 className="font-semibold text-[#0E2235]">Reassessment Schedule</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Completing an assessment automatically sets (or advances) a 90-day cadence.
                            Use the presets, a custom interval, an explicit date, or “Due now” to adjust it.
                            Due items appear in “Assessments Due” on the dashboard.
                        </p>
                        <div className="space-y-3">
                            {(['barc10', 'mirc28'] as const).map(type => {
                                const schedule = schedules.find(s => s.assessment_type === type && s.is_active);
                                const label = type === 'barc10' ? 'BARC-10' : 'MIRC-28';
                                const overdue = !!schedule && (
                                    schedule.is_overdue === true ||
                                    (!!schedule.next_due_date && new Date(schedule.next_due_date) < new Date(new Date().toDateString()))
                                );
                                return (
                                    <div key={type} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-100">
                                        <div>
                                            <p className="font-medium text-[#0E2235]">{label}</p>
                                            {schedule ? (
                                                <p className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                    Every {schedule.interval_days} days · Next due {schedule.next_due_date ? formatDateOnly(schedule.next_due_date) : '—'}
                                                    {overdue ? ' · Overdue' : ''}
                                                    {schedule.last_completed_at ? ` · Last ${formatDateOnly(schedule.last_completed_at)}` : ''}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-400">No cadence set</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {[30, 60, 90].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setCadence(type, d)}
                                                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                                        schedule?.interval_days === d
                                                            ? 'bg-[#1A73A8] text-white border-[#1A73A8]'
                                                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {d}d
                                                </button>
                                            ))}
                                            {/* Custom interval (any number of days) */}
                                            <input
                                                type="number"
                                                min={1}
                                                placeholder="custom"
                                                title="Custom interval in days — press Enter to set"
                                                className="w-20 px-2 py-1 text-xs rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#1A73A8]"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const v = parseInt((e.target as HTMLInputElement).value, 10);
                                                        if (Number.isFinite(v) && v > 0) {
                                                            setCadence(type, v);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            {/* Explicit next-due date */}
                                            <input
                                                type="date"
                                                title="Set an explicit next-due date"
                                                className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#1A73A8]"
                                                onChange={(e) => e.target.value && setDueDate(type, e.target.value)}
                                            />
                                            {/* Due now — surfaces on the dashboard immediately */}
                                            <button
                                                onClick={() => setDueNow(type)}
                                                title="Mark due now (appears in Assessments Due)"
                                                className="px-2.5 py-1 text-xs rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                                            >
                                                Due now
                                            </button>
                                            {schedule && (
                                                <>
                                                    <button
                                                        onClick={() => markReassessed(schedule)}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-green-50 text-green-700 hover:bg-green-100"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Reassessed today
                                                    </button>
                                                    <button
                                                        onClick={() => removeCadence(schedule)}
                                                        title="Stop tracking"
                                                        className="p-1 text-gray-400 hover:text-red-500"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Outcome trends (per instrument with history) */}
                    {(['barc10', 'mirc28'] as const).some(t => assessments.some(a => a.assessment_type === t)) && (
                        <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-6">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[#1A73A8]" />
                                <h3 className="font-semibold text-[#0E2235]">Outcome Trends</h3>
                            </div>
                            {(['barc10', 'mirc28'] as const).map(type => {
                                const list = assessments.filter(a => a.assessment_type === type);
                                if (list.length === 0) return null;
                                return (
                                    <AssessmentTrendChart
                                        key={type}
                                        assessments={list.map(a => ({
                                            id: a.id,
                                            total_score: a.total_score,
                                            assessment_date: a.assessment_date,
                                            created_at: a.created_at,
                                        }))}
                                        assessmentType={type}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {assessments.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No assessments yet. Conduct a recovery capital assessment for {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {assessments.map(assessment => {
                                const maxScore = assessment.assessment_type === 'mirc28' ? 112 : assessment.assessment_type === 'barc10' ? 60 : assessment.assessment_type === 'aces' ? 10 : 60;
                                return (
                                    <div
                                        key={assessment.id}
                                        onClick={() => setSelectedAssessment({
                                            ...assessment,
                                            participant_name: fullName,
                                            created_at: assessment.created_at || assessment.assessment_date || new Date().toISOString()
                                        })}
                                        className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-[#0E2235] uppercase">
                                                    {assessment.assessment_type}
                                                </span>
                                                <p className="text-sm text-gray-500">
                                                    {formatDateOnly(assessment.assessment_date || assessment.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-[#1A73A8]">{assessment.total_score}</p>
                                                    <p className="text-xs text-gray-500">/ {maxScore}</p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* REFERRALS TAB (read-only) */}
            {/* ================================================================ */}
            {activeTab === 'referrals' && (
                <div className="space-y-4">
                    {referrals.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                            <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No referrals recorded for {displayName}.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {referrals.map(ref => {
                                const status = (ref.status || 'pending').toLowerCase();
                                const statusStyle =
                                    status === 'completed' || status === 'accepted'
                                        ? 'bg-green-100 text-green-700'
                                        : status === 'declined' || status === 'cancelled'
                                        ? 'bg-red-100 text-red-700'
                                        : status === 'in_progress' || status === 'active'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700';
                                return (
                                    <div key={ref.id} className="bg-white rounded-xl p-4 border border-gray-200">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-[#0E2235]">{ref.referred_to}</p>
                                                {ref.referral_type && (
                                                    <p className="text-sm text-gray-500 capitalize">{ref.referral_type.replace(/_/g, ' ')}</p>
                                                )}
                                                {ref.reason && (
                                                    <p className="text-sm text-gray-600 mt-1">{ref.reason}</p>
                                                )}
                                                {ref.contact_info && (
                                                    <p className="text-xs text-gray-400 mt-1">{ref.contact_info}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyle}`}>
                                                    {status.replace(/_/g, ' ')}
                                                </span>
                                                {ref.follow_up_date && (
                                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Follow-up {formatDateOnly(ref.follow_up_date)}
                                                    </span>
                                                )}
                                                {ref.referred_at && (
                                                    <span className="text-xs text-gray-400">
                                                        Referred {formatDateOnly(ref.referred_at)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {ref.notes && (
                                            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 whitespace-pre-wrap">{ref.notes}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* READINESS TAB */}
            {/* ================================================================ */}
            {activeTab === 'readiness' && participant.is_reentry_participant && (
                <ReadinessChecklist
                    participantId={participant.id}
                    organizationId={currentOrg?.id}
                    participantName={displayName}
                    isReentryParticipant={participant.is_reentry_participant}
                />
            )}

            {/* ================================================================ */}
            {/* ACTIVITY TAB - group attendance + service & resource logs */}
            {/* ================================================================ */}
            {activeTab === 'activity' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">Kiosk check-in code</h3>
                            <p className="text-2xl font-bold tracking-widest text-[#0E2235]">
                                {(participant as any).kiosk_code || '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {displayName} can enter this at the front-desk kiosk instead of their name and birthdate.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!confirm('Generate a new code? The old one will stop working.')) return;
                                try {
                                    const res = await fetch(`/api/participants/${participant.id}/kiosk-code`, { method: 'POST' });
                                    const data = await res.json();
                                    if (res.ok) setParticipant({ ...participant, kiosk_code: data.kiosk_code } as any);
                                } catch { /* no-op */ }
                            }}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                            New code
                        </button>
                    </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-6">
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#30B27A]" />
                            Group Attendance
                        </h3>
                        {groupAttendance.length === 0 ? (
                            <p className="text-sm text-gray-400">No group attendance recorded.</p>
                        ) : (
                            <div className="space-y-2">
                                {groupAttendance.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => router.push(`/groups/${a.activity_id}`)}
                                        className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-[#0E2235]">{a.activity_name}</p>
                                            <p className="text-xs text-gray-500">
                                                {formatDateOnly(a.activity_date, {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            a.attendance_status === 'no_show'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {a.attendance_status === 'no_show' ? 'No-show' : 'Present'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-6">
                        <h3 className="text-lg font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-[#1A73A8]" />
                            Service &amp; Resources
                        </h3>
                        {resourceLogs.length === 0 ? (
                            <p className="text-sm text-gray-400">No service or resource entries.</p>
                        ) : (
                            <div className="space-y-2">
                                {resourceLogs.map((l) => (
                                    <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                                        <div>
                                            <p className="text-sm font-medium text-[#0E2235] capitalize">{l.log_type}</p>
                                            <p className="text-xs text-gray-500">
                                                {formatDateOnly(l.service_date, {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-gray-600">
                                            {l.total_cost != null && Number(l.total_cost) > 0 && (
                                                <div className="font-medium">${Number(l.total_cost).toFixed(2)}</div>
                                            )}
                                            {l.total_hours != null && Number(l.total_hours) > 0 && (
                                                <div>{Number(l.total_hours)} hrs</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* DOCUMENTS TAB - S3-backed participant / intake attachments */}
            {/* ================================================================ */}
            {activeTab === 'documents' && (
                <div className="space-y-4">
                    {docsUnavailable && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2 text-sm text-amber-800">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            Document storage is not configured. Downloads are unavailable.
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-[#0E2235] flex items-center gap-2">
                                <Paperclip className="w-5 h-5 text-[#1A73A8]" />
                                Documents
                            </h3>
                            <Link
                                href={`/intake?participant_id=${participant.id}`}
                                className="text-sm font-medium text-[#1A73A8] hover:underline flex items-center gap-1.5"
                            >
                                <Upload className="w-4 h-4" /> Add via Intake
                            </Link>
                        </div>

                        {documents.length === 0 ? (
                            <div className="text-center py-10">
                                <Paperclip className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-500">No documents attached for {displayName}.</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Upload insurance cards, consent forms, and referral orders from the intake form.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {documents.map((d) => {
                                    const typeLabel = ({
                                        insurance_card: 'Insurance card',
                                        consent: 'Consent form',
                                        referral_order: 'Referral / order',
                                        other: 'Document',
                                    } as Record<string, string>)[d.doc_type] || 'Document';
                                    const sizeKb = d.size_bytes ? Math.max(1, Math.round(d.size_bytes / 1024)) : null;
                                    return (
                                        <div
                                            key={d.id}
                                            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-[#1A73A8]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-[#0E2235] truncate">
                                                    {d.file_name || 'Attached file'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {typeLabel}
                                                    {sizeKb != null && ` · ${sizeKb} KB`}
                                                    {d.created_at && ` · ${formatDateOnly(d.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDownloadDocument(d.id)}
                                                disabled={docBusyId === d.id}
                                                className="p-2 text-gray-500 hover:text-[#1A73A8] hover:bg-blue-50 rounded-lg disabled:opacity-50"
                                                title="Download"
                                            >
                                                {docBusyId === d.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Download className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDocument(d.id)}
                                                disabled={docBusyId === d.id}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Assessment Detail Modal */}
            {selectedAssessment && (
                <AssessmentDetailModal
                    assessment={selectedAssessment}
                    onClose={() => setSelectedAssessment(null)}
                    onDelete={handleDeleteAssessment}
                    onAnalyze={handleAnalyzeAssessment}
                />
            )}

            {/* Participant Snapshot Modal */}
            {showSnapshotModal && (
                <ParticipantSnapshotModal
                    participantId={participant.id}
                    participantName={displayName}
                    organizationId={currentOrg?.id}
                    onClose={() => setShowSnapshotModal(false)}
                />
            )}

            {/* Shared Journal Entries Modal */}
            {showJournalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <BookHeart className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#0E2235]">
                                        {displayName}'s Shared Journal
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'} shared with you
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowJournalModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            <div className="space-y-4">
                                {journalEntries.map((entry) => {
                                    const mood = entry.mood ? moodMap[entry.mood] : null;
                                    return (
                                        <div
                                            key={entry.id}
                                            className={`p-4 rounded-xl border ${
                                                !entry.pss_viewed
                                                    ? 'border-amber-200 bg-amber-50/50'
                                                    : 'border-gray-200 bg-white'
                                            }`}
                                        >
                                            {/* Entry Header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    {mood && (
                                                        <span className="text-xl" title={mood.label}>{mood.emoji}</span>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {new Date(entry.created_at).toLocaleDateString('en-US', {
                                                                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                                                            })}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(entry.created_at).toLocaleTimeString('en-US', {
                                                                hour: 'numeric', minute: '2-digit'
                                                            })}
                                                            {mood && ` · Feeling ${mood.label.toLowerCase()}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                {!entry.pss_viewed && (
                                                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-medium rounded-full">
                                                        New
                                                    </span>
                                                )}
                                            </div>

                                            {/* Entry Text */}
                                            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                {entry.entry_text}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 border-t border-gray-200 flex-shrink-0">
                            <div className="flex items-start gap-2">
                                <Lock className="w-4 h-4 text-gray-400 mt-0.5" />
                                <p className="text-xs text-gray-500">
                                    These entries were voluntarily shared by {displayName}. They chose to let you see this.
                                    Please use this context to support their journey.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
