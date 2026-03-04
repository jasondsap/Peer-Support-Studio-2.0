'use client';

// ============================================================================
// Peer Support Studio - Participant Intake Form
// File: /app/intake/page.tsx
// 9-step wizard for comprehensive participant intake
// ============================================================================

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, CheckCircle2, Loader2,
    Search, X, Save, UserPlus, AlertTriangle, Info,
    User, Heart, Stethoscope, GraduationCap,
    Users, Pill, RotateCcw, Phone
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
}

interface IntakeFormData {
    // Background
    other_names: string;
    ssn_last_four: string;
    home_zip: string;
    home_city_state: string;
    is_veteran: boolean;
    is_english_first_language: boolean;
    other_language: string;
    marital_status: string;
    race: string[];
    race_other: string;
    ethnicity: string;
    gender_identity: string;
    gender_other: string;
    has_minor_children: string;
    referral_source: string;
    referral_source_other: string;
    legal_status: string[];
    legal_officers: string[];

    // Emergency Contact 2
    emergency_contact_2_name: string;
    emergency_contact_2_relationship: string;
    emergency_contact_2_phone: string;

    // Health
    physical_health_conditions: string[];
    physical_health_other: string;
    takes_physical_medications: boolean | null;
    physical_medications: string;
    mental_health_conditions: string[];
    mental_health_other: string;
    takes_mental_medications: boolean | null;
    mental_medications: string;
    is_pregnant: string;
    pregnancy_months: number | null;

    // Insurance
    insurance_type: string;
    insurance_other: string;
    has_primary_provider: boolean | null;
    provider_name: string;
    provider_phone: string;

    // Education & Employment
    education_level: string;
    past_year_employment: string;
    currently_employed: boolean | null;
    employer: string;
    monthly_income_pretax: string;
    employer_benefits: string[];
    income_sources: string[];
    income_sources_other: string;

    // Social
    supportive_people_count: string;
    is_dv_survivor: boolean | null;
    last_dv_episode: string;
    is_currently_fleeing: boolean | null;

    // Substance Use
    age_first_use: string;
    substances_used: string[];
    substances_other: string;
    has_overdosed: boolean | null;
    overdose_count: string;

    // Recovery History (simplified)
    is_first_recovery_attempt: boolean | null;
    previous_attempt_count: string;
    has_received_treatment: boolean | null;
    treatment_types: string;
    recovery_notes: string;
}

const INITIAL_FORM: IntakeFormData = {
    other_names: '', ssn_last_four: '', home_zip: '', home_city_state: '',
    is_veteran: false, is_english_first_language: true, other_language: '',
    marital_status: '', race: [], race_other: '', ethnicity: '',
    gender_identity: '', gender_other: '', has_minor_children: '',
    referral_source: '', referral_source_other: '', legal_status: [], legal_officers: [],
    emergency_contact_2_name: '', emergency_contact_2_relationship: '', emergency_contact_2_phone: '',
    physical_health_conditions: [], physical_health_other: '',
    takes_physical_medications: null, physical_medications: '',
    mental_health_conditions: [], mental_health_other: '',
    takes_mental_medications: null, mental_medications: '',
    is_pregnant: '', pregnancy_months: null,
    insurance_type: '', insurance_other: '',
    has_primary_provider: null, provider_name: '', provider_phone: '',
    education_level: '', past_year_employment: '',
    currently_employed: null, employer: '', monthly_income_pretax: '',
    employer_benefits: [], income_sources: [], income_sources_other: '',
    supportive_people_count: '', is_dv_survivor: null, last_dv_episode: '', is_currently_fleeing: null,
    age_first_use: '', substances_used: [], substances_other: '',
    has_overdosed: null, overdose_count: '',
    is_first_recovery_attempt: null, previous_attempt_count: '',
    has_received_treatment: null, treatment_types: '', recovery_notes: '',
};

// =============================================
// STEP DEFINITIONS (9 steps — no Prior Housing)
// =============================================

const STEPS = [
    { key: 'select', label: 'Select Participant', icon: UserPlus, color: '#1A73A8' },
    { key: 'background', label: 'Background', icon: User, color: '#6366F1' },
    { key: 'emergency', label: 'Emergency Contact', icon: Phone, color: '#DC2626' },
    { key: 'health', label: 'Health', icon: Heart, color: '#EC4899' },
    { key: 'insurance', label: 'Insurance & Provider', icon: Stethoscope, color: '#0891B2' },
    { key: 'education', label: 'Education & Work', icon: GraduationCap, color: '#D97706' },
    { key: 'social', label: 'Social & Safety', icon: Users, color: '#059669' },
    { key: 'substance', label: 'Substance Use', icon: Pill, color: '#F97316' },
    { key: 'recovery', label: 'Recovery History', icon: RotateCcw, color: '#10B981' },
];

// =============================================
// OPTION LISTS
// =============================================

const MARITAL_OPTIONS = [
    { value: 'single', label: 'Single / Never Married' },
    { value: 'married', label: 'Married' },
    { value: 'partner', label: 'Domestic Partner' },
    { value: 'separated', label: 'Separated' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
];

const RACE_OPTIONS = [
    { value: 'white', label: 'White' },
    { value: 'black', label: 'Black / African American' },
    { value: 'hispanic', label: 'Hispanic / Latino' },
    { value: 'asian', label: 'Asian' },
    { value: 'native', label: 'American Indian / Alaska Native' },
    { value: 'pacific', label: 'Native Hawaiian / Pacific Islander' },
    { value: 'other', label: 'Other' },
];

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'prefer_not', label: 'Prefer not to say' },
    { value: 'other', label: 'Other' },
];

const REFERRAL_OPTIONS = [
    { value: 'self', label: 'Self' },
    { value: 'family', label: 'Family / Friend' },
    { value: 'professional', label: 'Treatment Professional' },
    { value: 'court', label: 'Court / Legal System' },
    { value: 'community', label: 'Community Organization' },
    { value: 'other', label: 'Other' },
];

const LEGAL_STATUS_OPTIONS = [
    { value: 'none', label: 'No current legal involvement' },
    { value: 'court_diversion', label: 'Court Diversion Program' },
    { value: 'probation', label: 'Probation' },
    { value: 'parole', label: 'Parole' },
    { value: 'drug_court', label: 'Drug Court' },
    { value: 'pending', label: 'Charges Pending' },
];

const LEGAL_OFFICER_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'probation_officer', label: 'Probation Officer' },
    { value: 'parole_officer', label: 'Parole Officer' },
    { value: 'case_manager', label: 'Court Case Manager' },
];

const PHYSICAL_HEALTH_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'chronic', label: 'Chronic Pain / Condition' },
    { value: 'cancer', label: 'Cancer' },
    { value: 'communicable', label: 'Communicable Disease (HIV, Hep C, etc.)' },
    { value: 'diabetes', label: 'Diabetes' },
    { value: 'heart', label: 'Heart Disease' },
    { value: 'respiratory', label: 'Respiratory Condition' },
    { value: 'seizures', label: 'Seizure Disorder' },
    { value: 'other', label: 'Other' },
];

const MENTAL_HEALTH_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'anxiety', label: 'Anxiety Disorder' },
    { value: 'mood', label: 'Mood Disorder (Depression, Bipolar)' },
    { value: 'ptsd', label: 'PTSD / Trauma-Related' },
    { value: 'behavioral', label: 'Behavioral Disorder (ADHD, etc.)' },
    { value: 'psychotic', label: 'Psychotic Disorder' },
    { value: 'eating', label: 'Eating Disorder' },
    { value: 'other', label: 'Other' },
];

const INSURANCE_OPTIONS = [
    { value: 'none', label: 'No Insurance' },
    { value: 'medicaid', label: 'Medicaid' },
    { value: 'medicare', label: 'Medicare' },
    { value: 'private_self', label: 'Private (Self)' },
    { value: 'private_family', label: 'Private (Family/Employer)' },
    { value: 'va', label: 'VA / Military' },
    { value: 'other', label: 'Other' },
];

const EDUCATION_OPTIONS = [
    { value: 'less_hs', label: 'Less than High School' },
    { value: 'hs_diploma', label: 'High School Diploma' },
    { value: 'ged', label: 'GED' },
    { value: 'some_college', label: 'Some College' },
    { value: 'associates', label: "Associate's Degree" },
    { value: 'bachelors', label: "Bachelor's Degree" },
    { value: 'technical', label: 'Technical / Vocational' },
    { value: 'military', label: 'Military Training' },
    { value: 'advanced', label: 'Advanced Degree' },
];

const EMPLOYMENT_OPTIONS = [
    { value: 'full_time', label: 'Full-Time' },
    { value: 'part_time', label: 'Part-Time (< 35 hrs/week)' },
    { value: 'part_time_seasonal', label: 'Part-Time (Seasonal / Irregular)' },
    { value: 'unemployed_student', label: 'Unemployed — Student' },
    { value: 'unemployed_homemaker', label: 'Unemployed — Homemaker / Caregiver' },
    { value: 'unemployed_looking', label: 'Unemployed' },
    { value: 'retired', label: 'Retired' },
    { value: 'unemployed_disabled', label: 'Disability / Applied for Disability' },
    { value: 'controlled_environment', label: 'In a Controlled Environment (Jail, Hospital, etc.)' },
    { value: 'other', label: 'Other' },
];

const INCOME_SOURCE_OPTIONS = [
    { value: 'employment', label: 'Employment' },
    { value: 'ssdi', label: 'SSDI' },
    { value: 'ssi', label: 'SSI' },
    { value: 'tanf', label: 'TANF' },
    { value: 'snap', label: 'SNAP / Food Stamps' },
    { value: 'unemployment', label: 'Unemployment' },
    { value: 'family_support', label: 'Family Support' },
    { value: 'va_benefits', label: 'VA Benefits' },
    { value: 'other', label: 'Other' },
];

const BENEFIT_OPTIONS = [
    { value: 'health_insurance', label: 'Health Insurance' },
    { value: 'retirement', label: 'Retirement / 401k' },
    { value: 'pto', label: 'Paid Time Off' },
];

const SUBSTANCE_OPTIONS = [
    { value: 'alcohol', label: 'Alcohol' },
    { value: 'tobacco', label: 'Tobacco / Nicotine' },
    { value: 'marijuana', label: 'Marijuana / Cannabis' },
    { value: 'opiates', label: 'Prescription Opioids' },
    { value: 'heroin', label: 'Heroin' },
    { value: 'methadone', label: 'Methadone' },
    { value: 'suboxone', label: 'Suboxone / Buprenorphine' },
    { value: 'cocaine', label: 'Cocaine / Crack' },
    { value: 'stimulants', label: 'Stimulants (Meth, Adderall)' },
    { value: 'sedatives', label: 'Sedatives / Benzos' },
    { value: 'hallucinogens', label: 'Hallucinogens' },
    { value: 'inhalants', label: 'Inhalants' },
    { value: 'synthetic', label: 'Synthetic Drugs' },
    { value: 'none', label: 'None' },
    { value: 'other', label: 'Other' },
];

const DV_TIMELINE_OPTIONS = [
    { value: 'within_3mo', label: 'Within 3 months' },
    { value: '3_6mo', label: '3 - 6 months ago' },
    { value: '7_12mo', label: '7 - 12 months ago' },
    { value: 'over_1yr', label: 'Over 1 year ago' },
];

// =============================================
// REUSABLE FIELD COMPONENTS
// =============================================

function TextInput({ label, value, onChange, placeholder, type = 'text', required, maxLength }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; required?: boolean; maxLength?: number;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] outline-none transition-all"
            />
        </div>
    );
}

function SelectInput({ label, value, onChange, options, placeholder, required }: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; placeholder?: string; required?: boolean;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/30 focus:border-[#1A73A8] outline-none transition-all bg-white"
            >
                <option value="">{placeholder || 'Select...'}</option>
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

function CheckboxGroup({ label, options, selected, onChange, otherValue, onOtherChange }: {
    label: string; options: { value: string; label: string }[];
    selected: string[]; onChange: (vals: string[]) => void;
    otherValue?: string; onOtherChange?: (v: string) => void;
}) {
    const toggle = (val: string) => {
        if (val === 'none') {
            onChange(selected.includes('none') ? [] : ['none']);
            return;
        }
        const without = selected.filter(s => s !== 'none');
        if (without.includes(val)) {
            onChange(without.filter(s => s !== val));
        } else {
            onChange([...without, val]);
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {options.map(o => (
                    <label
                        key={o.value}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                            selected.includes(o.value)
                                ? 'bg-blue-50 border-[#1A73A8]/40'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(o.value)}
                            onChange={() => toggle(o.value)}
                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                        />
                        <span className="text-sm text-gray-700">{o.label}</span>
                    </label>
                ))}
            </div>
            {selected.includes('other') && onOtherChange && (
                <input
                    type="text"
                    value={otherValue || ''}
                    onChange={(e) => onOtherChange(e.target.value)}
                    placeholder="Please specify..."
                    className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/30 outline-none"
                />
            )}
        </div>
    );
}

function YesNoToggle({ label, value, onChange, infoText }: {
    label: string; value: boolean | null; onChange: (v: boolean) => void; infoText?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            {infoText && <p className="text-xs text-gray-500 mb-2">{infoText}</p>}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onChange(true)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                        value === true
                            ? 'bg-[#1A73A8] text-white border-[#1A73A8]'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                >
                    Yes
                </button>
                <button
                    type="button"
                    onClick={() => onChange(false)}
                    className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                        value === false
                            ? 'bg-gray-500 text-white border-gray-500'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                >
                    No
                </button>
            </div>
        </div>
    );
}

function SectionNote({ text, type = 'info' }: { text: string; type?: 'info' | 'warning' }) {
    return (
        <div className={`rounded-lg p-3 flex items-start gap-2 text-sm ${
            type === 'warning'
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
            {type === 'warning'
                ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            }
            <span>{text}</span>
        </div>
    );
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function IntakePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        }>
            <IntakeContent />
        </Suspense>
    );
}

function IntakeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;
    const topRef = useRef<HTMLDivElement>(null);

    // URL params for edit mode and pre-selection
    const paramParticipantId = searchParams.get('participant_id');
    const isEditMode = searchParams.get('edit') === 'true';
    const editIntakeId = searchParams.get('intake_id');

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<IntakeFormData>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [editLoaded, setEditLoaded] = useState(false);

    // Participant selection
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [intakeDate, setIntakeDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/auth/signin');
    }, [status, router]);

    // Auto-select participant from URL param
    useEffect(() => {
        if (paramParticipantId && currentOrg?.id && !selectedParticipant) {
            fetch(`/api/participants/${paramParticipantId}?organization_id=${currentOrg.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.participant) {
                        const p = data.participant;
                        setSelectedParticipant({
                            id: p.id,
                            first_name: p.first_name,
                            last_name: p.last_name,
                            preferred_name: p.preferred_name,
                            date_of_birth: p.date_of_birth,
                            gender: p.gender,
                        });
                        if (p.gender) {
                            setForm(prev => ({ ...prev, gender_identity: p.gender || '' }));
                        }
                        // If not edit mode, skip to step 1
                        if (!isEditMode) setStep(1);
                    }
                })
                .catch(() => {});
        }
    }, [paramParticipantId, currentOrg?.id]);

    // Load existing intake for edit mode
    useEffect(() => {
        if (isEditMode && editIntakeId && currentOrg?.id && !editLoaded) {
            fetch(`/api/intake?organization_id=${currentOrg.id}&participant_id=${paramParticipantId}`)
                .then(res => res.json())
                .then(data => {
                    const intake = data.intakes?.find((i: any) => i.id === editIntakeId) || data.intakes?.[0];
                    if (intake) {
                        // Parse JSONB fields that might come as strings
                        const parseJsonb = (val: any): string[] => {
                            if (!val) return [];
                            if (Array.isArray(val)) return val;
                            if (typeof val === 'string') {
                                try { return JSON.parse(val); } catch { return []; }
                            }
                            return [];
                        };

                        setForm({
                            other_names: intake.other_names || '',
                            ssn_last_four: intake.ssn_last_four || '',
                            home_zip: intake.home_zip || '',
                            home_city_state: intake.home_city_state || '',
                            is_veteran: intake.is_veteran ?? false,
                            is_english_first_language: intake.is_english_first_language ?? true,
                            other_language: intake.other_language || '',
                            marital_status: intake.marital_status || '',
                            race: parseJsonb(intake.race),
                            race_other: intake.race_other || '',
                            ethnicity: intake.ethnicity || '',
                            gender_identity: intake.gender_identity || '',
                            gender_other: intake.gender_other || '',
                            has_minor_children: intake.has_minor_children || '',
                            referral_source: intake.referral_source || '',
                            referral_source_other: intake.referral_source_other || '',
                            legal_status: parseJsonb(intake.legal_status),
                            legal_officers: parseJsonb(intake.legal_officers),
                            emergency_contact_2_name: intake.emergency_contact_2_name || '',
                            emergency_contact_2_relationship: intake.emergency_contact_2_relationship || '',
                            emergency_contact_2_phone: intake.emergency_contact_2_phone || '',
                            physical_health_conditions: parseJsonb(intake.physical_health_conditions),
                            physical_health_other: intake.physical_health_other || '',
                            takes_physical_medications: intake.takes_physical_medications ?? null,
                            physical_medications: intake.physical_medications || '',
                            mental_health_conditions: parseJsonb(intake.mental_health_conditions),
                            mental_health_other: intake.mental_health_other || '',
                            takes_mental_medications: intake.takes_mental_medications ?? null,
                            mental_medications: intake.mental_medications || '',
                            is_pregnant: intake.is_pregnant || '',
                            pregnancy_months: intake.pregnancy_months ?? null,
                            insurance_type: intake.insurance_type || '',
                            insurance_other: intake.insurance_other || '',
                            has_primary_provider: intake.has_primary_provider ?? null,
                            provider_name: intake.provider_name || '',
                            provider_phone: intake.provider_phone || '',
                            education_level: intake.education_level || '',
                            past_year_employment: intake.past_year_employment || '',
                            currently_employed: intake.currently_employed ?? null,
                            employer: intake.employer || '',
                            monthly_income_pretax: intake.monthly_income_pretax ? String(intake.monthly_income_pretax) : '',
                            employer_benefits: parseJsonb(intake.employer_benefits),
                            income_sources: parseJsonb(intake.income_sources),
                            income_sources_other: intake.income_sources_other || '',
                            supportive_people_count: intake.supportive_people_count != null ? String(intake.supportive_people_count) : '',
                            is_dv_survivor: intake.is_dv_survivor ?? null,
                            last_dv_episode: intake.last_dv_episode || '',
                            is_currently_fleeing: intake.is_currently_fleeing ?? null,
                            age_first_use: intake.age_first_use != null ? String(intake.age_first_use) : '',
                            substances_used: parseJsonb(intake.substances_used),
                            substances_other: intake.substances_other || '',
                            has_overdosed: intake.has_overdosed ?? null,
                            overdose_count: intake.overdose_count != null ? String(intake.overdose_count) : '',
                            is_first_recovery_attempt: intake.is_first_recovery_attempt ?? null,
                            previous_attempt_count: intake.previous_attempt_count != null ? String(intake.previous_attempt_count) : '',
                            has_received_treatment: intake.has_received_treatment ?? null,
                            treatment_types: intake.treatment_types || '',
                            recovery_notes: intake.recovery_notes || '',
                        });
                        if (intake.intake_date) {
                            setIntakeDate(intake.intake_date.split('T')[0]);
                        }
                        setStep(1); // Skip participant selection in edit mode
                        setEditLoaded(true);
                    }
                })
                .catch(() => {});
        }
    }, [isEditMode, editIntakeId, currentOrg?.id, editLoaded, paramParticipantId]);

    useEffect(() => {
        if (currentOrg?.id && participantSearch.length >= 2) {
            fetch(`/api/participants?organization_id=${currentOrg.id}&search=${participantSearch}&status=active`)
                .then(res => res.json())
                .then(data => setParticipants(data.participants || []))
                .catch(() => setParticipants([]));
        }
    }, [participantSearch, currentOrg?.id]);

    const selectParticipant = (p: Participant) => {
        setSelectedParticipant(p);
        setParticipantSearch('');
        setShowDropdown(false);
        if (p.gender) {
            setForm(prev => ({ ...prev, gender_identity: p.gender || '' }));
        }
    };

    const updateForm = (field: keyof IntakeFormData, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const nextStep = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const prevStep = () => {
        if (step > 0) {
            setStep(step - 1);
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const canProceedFromSelect = selectedParticipant !== null;

    const handleSubmit = async () => {
        if (!selectedParticipant || !currentOrg?.id) return;
        setSaving(true);
        setError('');

        try {
            const payload = {
                ...(isEditMode && editIntakeId ? { id: editIntakeId } : {}),
                organization_id: currentOrg.id,
                participant_id: selectedParticipant.id,
                intake_date: intakeDate,
                status: 'completed',
                ...form,
                pregnancy_months: form.pregnancy_months,
                monthly_income_pretax: form.monthly_income_pretax ? parseFloat(form.monthly_income_pretax) : null,
                supportive_people_count: form.supportive_people_count ? parseInt(form.supportive_people_count) : null,
                age_first_use: form.age_first_use ? parseInt(form.age_first_use) : null,
                overdose_count: form.overdose_count ? parseInt(form.overdose_count) : null,
                previous_attempt_count: form.previous_attempt_count ? parseInt(form.previous_attempt_count) : null,
            };

            const res = await fetch('/api/intake', {
                method: isEditMode && editIntakeId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                setSaved(true);
            } else {
                setError(data.error || 'Failed to save intake');
            }
        } catch (e: any) {
            setError(e.message || 'Network error');
        }
        setSaving(false);
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    // Success screen
    if (saved) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">
                        {isEditMode ? 'Intake Updated' : 'Intake Complete'}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Intake form {isEditMode ? 'updated' : 'saved'} for {selectedParticipant?.preferred_name || selectedParticipant?.first_name} {selectedParticipant?.last_name}.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push(`/participants/${selectedParticipant?.id}`)}
                            className="flex-1 py-3 bg-[#1A73A8] text-white rounded-xl font-semibold hover:bg-[#156090]"
                        >
                            View Participant
                        </button>
                        {!isEditMode && (
                            <button
                                onClick={() => {
                                    setForm(INITIAL_FORM);
                                    setSelectedParticipant(null);
                                    setStep(0);
                                    setSaved(false);
                                }}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                            >
                                New Intake
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const currentStep = STEPS[step];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => step === 0 ? router.push('/') : prevStep()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">
                                    {isEditMode ? 'Edit Intake' : 'Participant Intake'}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {selectedParticipant
                                        ? `${selectedParticipant.preferred_name || selectedParticipant.first_name} ${selectedParticipant.last_name}`
                                        : 'Peer Support Studio'
                                    }
                                </p>
                            </div>
                        </div>
                        <span className="text-sm text-gray-500">
                            Step {step + 1} of {STEPS.length}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex gap-1 mt-3" ref={topRef}>
                        {STEPS.map((s, i) => (
                            <div
                                key={s.key}
                                className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                                    i < step ? 'bg-[#30B27A]'
                                    : i === step ? 'bg-[#1A73A8]'
                                    : 'bg-gray-200'
                                }`}
                                onClick={() => {
                                    if (i <= step || (step === 0 && canProceedFromSelect)) setStep(i);
                                }}
                            />
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* Step header */}
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${currentStep.color}15` }}
                    >
                        <currentStep.icon className="w-5 h-5" style={{ color: currentStep.color }} />
                    </div>
                    <h2 className="text-lg font-bold text-[#0E2235]">{currentStep.label}</h2>
                </div>

                <div className="space-y-6">

                    {/* ===== STEP 0: SELECT PARTICIPANT ===== */}
                    {step === 0 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Intake Date</label>
                                <input
                                    type="date"
                                    value={intakeDate}
                                    onChange={(e) => setIntakeDate(e.target.value)}
                                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/30 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Participant</label>
                                <div className="relative">
                                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-3">
                                        <Search className="w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={selectedParticipant
                                                ? `${selectedParticipant.preferred_name || selectedParticipant.first_name} ${selectedParticipant.last_name}`
                                                : participantSearch
                                            }
                                            onChange={(e) => { setParticipantSearch(e.target.value); setShowDropdown(true); setSelectedParticipant(null); }}
                                            onFocus={() => setShowDropdown(true)}
                                            placeholder="Search participants by name..."
                                            className="flex-1 bg-transparent border-none outline-none"
                                        />
                                        {selectedParticipant && (
                                            <button onClick={() => { setSelectedParticipant(null); setParticipantSearch(''); }} className="p-1 hover:bg-gray-100 rounded">
                                                <X className="w-4 h-4 text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                    {showDropdown && participantSearch.length >= 2 && participants.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-10">
                                            {participants.map(p => (
                                                <button key={p.id} onClick={() => selectParticipant(p)} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-sm font-medium">
                                                        {p.first_name[0]}{p.last_name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{p.preferred_name || p.first_name} {p.last_name}</p>
                                                        {p.date_of_birth && <p className="text-xs text-gray-500">DOB: {p.date_of_birth}</p>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {selectedParticipant && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800">
                                            {selectedParticipant.preferred_name || selectedParticipant.first_name} {selectedParticipant.last_name}
                                        </p>
                                        <p className="text-sm text-green-600">Ready to begin intake</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== STEP 1: BACKGROUND ===== */}
                    {step === 1 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <SectionNote text="This supplements what's already on the participant record (name, DOB, contact)." />
                            <TextInput label="Other Names / Aliases" value={form.other_names} onChange={v => updateForm('other_names', v)} placeholder="Any other names used" />
                            <TextInput label="Last 4 of SSN" value={form.ssn_last_four} onChange={v => updateForm('ssn_last_four', v)} placeholder="XXXX" maxLength={4} />
                            <div className="grid grid-cols-2 gap-4">
                                <TextInput label="Home ZIP Before Services" value={form.home_zip} onChange={v => updateForm('home_zip', v)} placeholder="40201" maxLength={10} />
                                <TextInput label="City / State (if ZIP unknown)" value={form.home_city_state} onChange={v => updateForm('home_city_state', v)} placeholder="Louisville, KY" />
                            </div>
                            <YesNoToggle label="Veteran" value={form.is_veteran} onChange={v => updateForm('is_veteran', v)} />
                            <div>
                                <YesNoToggle label="English as First Language" value={form.is_english_first_language} onChange={v => updateForm('is_english_first_language', v)} />
                                {form.is_english_first_language === false && (
                                    <div className="mt-3">
                                        <TextInput label="Primary Language" value={form.other_language} onChange={v => updateForm('other_language', v)} placeholder="Spanish, etc." />
                                    </div>
                                )}
                            </div>
                            <SelectInput label="Marital Status" value={form.marital_status} onChange={v => updateForm('marital_status', v)} options={MARITAL_OPTIONS} />
                            <CheckboxGroup
                                label="Race — select all that apply"
                                options={RACE_OPTIONS}
                                selected={form.race}
                                onChange={v => updateForm('race', v)}
                                otherValue={form.race_other}
                                onOtherChange={v => updateForm('race_other', v)}
                            />
                            <SelectInput label="Ethnicity" value={form.ethnicity} onChange={v => updateForm('ethnicity', v)} options={[
                                { value: 'hispanic_latinx', label: 'Hispanic / Latino/a/x' },
                                { value: 'non_hispanic', label: 'Not Hispanic / Latino/a/x' },
                            ]} />
                            <div>
                                <SelectInput label="Gender Identity" value={form.gender_identity} onChange={v => updateForm('gender_identity', v)} options={GENDER_OPTIONS} />
                                {form.gender_identity === 'other' && (
                                    <div className="mt-2">
                                        <TextInput label="Please specify" value={form.gender_other} onChange={v => updateForm('gender_other', v)} />
                                    </div>
                                )}
                            </div>
                            <SelectInput label="Minor Children" value={form.has_minor_children} onChange={v => updateForm('has_minor_children', v)} options={[
                                { value: 'no', label: 'No' },
                                { value: 'yes_living', label: 'Yes — living with me' },
                                { value: 'yes_not_living', label: 'Yes — not living with me' },
                            ]} />
                            <div>
                                <SelectInput label="Referral Source" value={form.referral_source} onChange={v => updateForm('referral_source', v)} options={REFERRAL_OPTIONS} />
                                {form.referral_source === 'other' && (
                                    <div className="mt-2">
                                        <TextInput label="Please specify" value={form.referral_source_other} onChange={v => updateForm('referral_source_other', v)} />
                                    </div>
                                )}
                            </div>
                            <CheckboxGroup label="Legal Status" options={LEGAL_STATUS_OPTIONS} selected={form.legal_status} onChange={v => updateForm('legal_status', v)} />
                            <CheckboxGroup label="Legal Officers / Contacts" options={LEGAL_OFFICER_OPTIONS} selected={form.legal_officers} onChange={v => updateForm('legal_officers', v)} />
                        </div>
                    )}

                    {/* ===== STEP 2: EMERGENCY CONTACT ===== */}
                    {step === 2 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <SectionNote text="Primary emergency contact is stored on the participant record. This is for a second emergency contact." />
                            <TextInput label="Name" value={form.emergency_contact_2_name} onChange={v => updateForm('emergency_contact_2_name', v)} placeholder="Full name" />
                            <TextInput label="Relationship" value={form.emergency_contact_2_relationship} onChange={v => updateForm('emergency_contact_2_relationship', v)} placeholder="Mother, friend, sponsor, etc." />
                            <TextInput label="Phone" value={form.emergency_contact_2_phone} onChange={v => updateForm('emergency_contact_2_phone', v)} placeholder="(555) 555-5555" type="tel" />
                        </div>
                    )}

                    {/* ===== STEP 3: HEALTH ===== */}
                    {step === 3 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <CheckboxGroup
                                label="Physical Health Conditions"
                                options={PHYSICAL_HEALTH_OPTIONS}
                                selected={form.physical_health_conditions}
                                onChange={v => updateForm('physical_health_conditions', v)}
                                otherValue={form.physical_health_other}
                                onOtherChange={v => updateForm('physical_health_other', v)}
                            />
                            <div>
                                <YesNoToggle label="Currently taking physical health medications?" value={form.takes_physical_medications} onChange={v => updateForm('takes_physical_medications', v)} />
                                {form.takes_physical_medications && (
                                    <div className="mt-3">
                                        <TextInput label="List medications" value={form.physical_medications} onChange={v => updateForm('physical_medications', v)} placeholder="Medication names and dosages" />
                                    </div>
                                )}
                            </div>
                            <CheckboxGroup
                                label="Mental Health Conditions"
                                options={MENTAL_HEALTH_OPTIONS}
                                selected={form.mental_health_conditions}
                                onChange={v => updateForm('mental_health_conditions', v)}
                                otherValue={form.mental_health_other}
                                onOtherChange={v => updateForm('mental_health_other', v)}
                            />
                            <div>
                                <YesNoToggle label="Currently taking mental health medications?" value={form.takes_mental_medications} onChange={v => updateForm('takes_mental_medications', v)} />
                                {form.takes_mental_medications && (
                                    <div className="mt-3">
                                        <TextInput label="List medications" value={form.mental_medications} onChange={v => updateForm('mental_medications', v)} placeholder="Medication names and dosages" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <SelectInput label="Pregnancy Status" value={form.is_pregnant} onChange={v => updateForm('is_pregnant', v)} options={[
                                    { value: 'no', label: 'No' },
                                    { value: 'yes', label: 'Yes' },
                                    { value: 'not_applicable', label: 'Not Applicable' },
                                ]} />
                                {form.is_pregnant === 'yes' && (
                                    <div className="mt-2">
                                        <TextInput label="How many months?" value={form.pregnancy_months?.toString() || ''} onChange={v => updateForm('pregnancy_months', v ? parseInt(v) : null)} type="number" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 4: INSURANCE ===== */}
                    {step === 4 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <div>
                                <SelectInput label="Insurance Type" value={form.insurance_type} onChange={v => updateForm('insurance_type', v)} options={INSURANCE_OPTIONS} />
                                {form.insurance_type === 'other' && (
                                    <div className="mt-2">
                                        <TextInput label="Please specify" value={form.insurance_other} onChange={v => updateForm('insurance_other', v)} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <YesNoToggle label="Has primary care provider?" value={form.has_primary_provider} onChange={v => updateForm('has_primary_provider', v)} />
                                {form.has_primary_provider && (
                                    <div className="mt-3 grid grid-cols-2 gap-4">
                                        <TextInput label="Provider Name" value={form.provider_name} onChange={v => updateForm('provider_name', v)} placeholder="Dr. Smith" />
                                        <TextInput label="Provider Phone" value={form.provider_phone} onChange={v => updateForm('provider_phone', v)} placeholder="(555) 555-5555" type="tel" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 5: EDUCATION & EMPLOYMENT ===== */}
                    {step === 5 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <SelectInput label="Highest Education Level" value={form.education_level} onChange={v => updateForm('education_level', v)} options={EDUCATION_OPTIONS} />
                            <SelectInput label="Past Year Employment Status" value={form.past_year_employment} onChange={v => updateForm('past_year_employment', v)} options={EMPLOYMENT_OPTIONS} />
                            <div>
                                <YesNoToggle label="Currently Employed?" value={form.currently_employed} onChange={v => updateForm('currently_employed', v)} />
                                {form.currently_employed && (
                                    <div className="mt-3 space-y-3">
                                        <TextInput label="Employer" value={form.employer} onChange={v => updateForm('employer', v)} />
                                        <TextInput label="Monthly Pre-Tax Income" value={form.monthly_income_pretax} onChange={v => updateForm('monthly_income_pretax', v)} placeholder="2500" type="number" />
                                        <CheckboxGroup label="Employer Benefits" options={BENEFIT_OPTIONS} selected={form.employer_benefits} onChange={v => updateForm('employer_benefits', v)} />
                                    </div>
                                )}
                            </div>
                            <CheckboxGroup
                                label="Income Sources"
                                options={INCOME_SOURCE_OPTIONS}
                                selected={form.income_sources}
                                onChange={v => updateForm('income_sources', v)}
                                otherValue={form.income_sources_other}
                                onOtherChange={v => updateForm('income_sources_other', v)}
                            />
                        </div>
                    )}

                    {/* ===== STEP 6: SOCIAL & SAFETY ===== */}
                    {step === 6 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <TextInput
                                label="How many supportive people in your life?"
                                value={form.supportive_people_count}
                                onChange={v => updateForm('supportive_people_count', v)}
                                placeholder="0"
                                type="number"
                            />
                            <SectionNote text="The following questions are about domestic violence. Approach with sensitivity." type="warning" />
                            <div>
                                <YesNoToggle label="Have you ever been a survivor of domestic violence?" value={form.is_dv_survivor} onChange={v => updateForm('is_dv_survivor', v)} />
                                {form.is_dv_survivor && (
                                    <div className="mt-3 space-y-3">
                                        <SelectInput label="When was the most recent episode?" value={form.last_dv_episode} onChange={v => updateForm('last_dv_episode', v)} options={DV_TIMELINE_OPTIONS} />
                                        <YesNoToggle label="Are you currently fleeing a DV situation?" value={form.is_currently_fleeing} onChange={v => updateForm('is_currently_fleeing', v)} />
                                        {form.is_currently_fleeing && (
                                            <SectionNote text="If currently fleeing, ensure safety plan is in place and connect with local DV resources immediately." type="warning" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 7: SUBSTANCE USE ===== */}
                    {step === 7 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <TextInput label="Age of first substance use" value={form.age_first_use} onChange={v => updateForm('age_first_use', v)} type="number" placeholder="14" />
                            <CheckboxGroup
                                label="Substances used — select all that apply"
                                options={SUBSTANCE_OPTIONS}
                                selected={form.substances_used}
                                onChange={v => updateForm('substances_used', v)}
                                otherValue={form.substances_other}
                                onOtherChange={v => updateForm('substances_other', v)}
                            />
                            <div>
                                <YesNoToggle label="Have you ever overdosed?" value={form.has_overdosed} onChange={v => updateForm('has_overdosed', v)} />
                                {form.has_overdosed && (
                                    <div className="mt-3">
                                        <TextInput label="How many times?" value={form.overdose_count} onChange={v => updateForm('overdose_count', v)} type="number" placeholder="1" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== STEP 8: RECOVERY HISTORY (Simplified) ===== */}
                    {step === 8 && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
                            <div>
                                <YesNoToggle label="Is this your first recovery attempt?" value={form.is_first_recovery_attempt} onChange={v => updateForm('is_first_recovery_attempt', v)} />
                                {form.is_first_recovery_attempt === false && (
                                    <div className="mt-3">
                                        <TextInput label="How many previous attempts?" value={form.previous_attempt_count} onChange={v => updateForm('previous_attempt_count', v)} type="number" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <YesNoToggle label="Have you previously received treatment or recovery support services?" value={form.has_received_treatment} onChange={v => updateForm('has_received_treatment', v)} />
                                {form.has_received_treatment && (
                                    <div className="mt-3">
                                        <TextInput label="What types of treatment or support?" value={form.treatment_types} onChange={v => updateForm('treatment_types', v)} placeholder="Inpatient, outpatient, peer support, recovery housing, MAT, etc." />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Anything else you'd like us to know about your recovery journey?
                                </label>
                                <textarea
                                    value={form.recovery_notes}
                                    onChange={(e) => updateForm('recovery_notes', e.target.value)}
                                    rows={4}
                                    placeholder="Goals, concerns, what's worked before, what you're hoping for..."
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/30 outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* Navigation */}
                <div className="mt-8 flex gap-4">
                    {step > 0 && (
                        <button
                            onClick={prevStep}
                            className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}

                    {step < STEPS.length - 1 ? (
                        <button
                            onClick={nextStep}
                            disabled={step === 0 && !canProceedFromSelect}
                            className="flex-1 py-3 bg-[#1A73A8] text-white rounded-xl font-semibold hover:bg-[#156090] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex-1 py-3 bg-[#30B27A] text-white rounded-xl font-semibold hover:bg-[#28996A] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : isEditMode ? 'Update Intake' : 'Complete Intake'}
                        </button>
                    )}
                </div>

                {/* Step list (compact, below navigation) */}
                <div className="mt-6 bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sections</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => { if (i <= step || canProceedFromSelect) setStep(i); }}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
                                        i === step
                                            ? 'bg-blue-50 text-[#1A73A8] font-medium'
                                            : i < step
                                            ? 'text-[#30B27A] hover:bg-green-50'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {i < step ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                    ) : (
                                        <Icon className="w-3 h-3" />
                                    )}
                                    <span className="truncate">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
