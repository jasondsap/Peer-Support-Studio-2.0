// ============================================================================
// PSS Intake Form Types & Constants (Billing-Ready)
// File: lib/intakeFormTypes.ts
//
// Single source of truth for:
//   - IntakeFormData interface (form state shape)
//   - INITIAL_FORM (default values)
//   - fromDatabase() mapper (DB record → form state)
//   - toPayload() mapper (form state → API body)
//   - STEPS definition
//   - All option lists
//
// This file ensures the form state, edit loader, and submit payload
// stay in sync as fields are added. Any new field gets added in ONE
// place and flows through all three touch points.
// ============================================================================

// =============================================
// FORM DATA INTERFACE
// =============================================

export interface IntakeFormData {
    // ── Background (unchanged) ──
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

    // ── Consent & Authorization (NEW) ──
    consent_to_treat: boolean | null;
    consent_to_treat_date: string;
    consent_to_bill_insurance: boolean | null;
    consent_to_bill_date: string;
    consent_to_release_info: boolean | null;
    consent_to_release_date: string;
    consent_to_release_parties: string[];
    consent_signature_on_file: boolean;
    consent_notes: string;

    // ── Emergency Contact 2 (unchanged) ──
    emergency_contact_2_name: string;
    emergency_contact_2_relationship: string;
    emergency_contact_2_phone: string;

    // ── Health (unchanged) ──
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

    // ── Insurance — Primary (EXPANDED) ──
    insurance_type: string;                     // kept for backward compat
    insurance_other: string;                    // kept for backward compat
    primary_insurance_type: string;
    primary_payer_name: string;
    primary_payer_id: string;
    primary_member_id: string;
    primary_group_number: string;
    primary_plan_name: string;
    primary_subscriber_relationship: string;
    primary_subscriber_name: string;
    primary_subscriber_dob: string;
    primary_subscriber_address: string;
    primary_insurance_phone: string;
    primary_effective_date: string;
    primary_termination_date: string;
    primary_insurance_verified_from: string;
    medicaid_mco: string;
    insurance_card_on_file: boolean;

    // ── Insurance — Secondary (NEW) ──
    has_secondary_insurance: boolean | null;
    secondary_insurance_type: string;
    secondary_payer_name: string;
    secondary_payer_id: string;
    secondary_member_id: string;
    secondary_group_number: string;
    secondary_subscriber_relationship: string;
    secondary_subscriber_name: string;
    secondary_subscriber_dob: string;
    secondary_effective_date: string;

    // ── Eligibility Verification (NEW) ──
    eligibility_verified: boolean | null;
    eligibility_verified_date: string;
    eligibility_verified_by: string;
    eligibility_verified_method: string;
    eligibility_status: string;
    eligibility_notes: string;

    // ── Prior Authorization (NEW) ──
    prior_auth_required: boolean | null;
    prior_auth_number: string;
    prior_auth_start_date: string;
    prior_auth_end_date: string;
    prior_auth_units_approved: string;

    // ── Clinical Reference (NEW) ──
    referring_provider_name: string;
    referring_provider_npi: string;
    referring_provider_credential: string;
    referring_provider_phone: string;
    referring_provider_org: string;
    referral_order_on_file: boolean;
    primary_diagnosis_code: string;
    primary_diagnosis_description: string;
    secondary_diagnosis_code: string;
    secondary_diagnosis_description: string;
    diagnosis_source: string;
    diagnosis_date: string;

    // ── PCP (unchanged) ──
    has_primary_provider: boolean | null;
    provider_name: string;
    provider_phone: string;

    // ── Education & Employment (unchanged) ──
    education_level: string;
    past_year_employment: string;
    currently_employed: boolean | null;
    employer: string;
    monthly_income_pretax: string;
    employer_benefits: string[];
    income_sources: string[];
    income_sources_other: string;

    // ── Social (unchanged) ──
    supportive_people_count: string;
    is_dv_survivor: boolean | null;
    last_dv_episode: string;
    is_currently_fleeing: boolean | null;

    // ── Substance Use (unchanged) ──
    age_first_use: string;
    substances_used: string[];
    substances_other: string;
    has_overdosed: boolean | null;
    overdose_count: string;

    // ── Recovery History (unchanged) ──
    is_first_recovery_attempt: boolean | null;
    previous_attempt_count: string;
    has_received_treatment: boolean | null;
    treatment_types: string;
    recovery_notes: string;
}

// =============================================
// INITIAL FORM STATE
// =============================================

export const INITIAL_FORM: IntakeFormData = {
    // Background
    other_names: '', ssn_last_four: '', home_zip: '', home_city_state: '',
    is_veteran: false, is_english_first_language: true, other_language: '',
    marital_status: '', race: [], race_other: '', ethnicity: '',
    gender_identity: '', gender_other: '', has_minor_children: '',
    referral_source: '', referral_source_other: '', legal_status: [], legal_officers: [],

    // Consent & Authorization
    consent_to_treat: null, consent_to_treat_date: '',
    consent_to_bill_insurance: null, consent_to_bill_date: '',
    consent_to_release_info: null, consent_to_release_date: '',
    consent_to_release_parties: [], consent_signature_on_file: false, consent_notes: '',

    // Emergency Contact 2
    emergency_contact_2_name: '', emergency_contact_2_relationship: '', emergency_contact_2_phone: '',

    // Health
    physical_health_conditions: [], physical_health_other: '',
    takes_physical_medications: null, physical_medications: '',
    mental_health_conditions: [], mental_health_other: '',
    takes_mental_medications: null, mental_medications: '',
    is_pregnant: '', pregnancy_months: null,

    // Insurance — Primary
    insurance_type: '', insurance_other: '',
    primary_insurance_type: '', primary_payer_name: '', primary_payer_id: '',
    primary_member_id: '', primary_group_number: '', primary_plan_name: '',
    primary_subscriber_relationship: '', primary_subscriber_name: '',
    primary_subscriber_dob: '', primary_subscriber_address: '',
    primary_insurance_phone: '', primary_effective_date: '', primary_termination_date: '',
    primary_insurance_verified_from: '', medicaid_mco: '', insurance_card_on_file: false,

    // Insurance — Secondary
    has_secondary_insurance: null, secondary_insurance_type: '',
    secondary_payer_name: '', secondary_payer_id: '', secondary_member_id: '',
    secondary_group_number: '', secondary_subscriber_relationship: '',
    secondary_subscriber_name: '', secondary_subscriber_dob: '', secondary_effective_date: '',

    // Eligibility
    eligibility_verified: null, eligibility_verified_date: '', eligibility_verified_by: '',
    eligibility_verified_method: '', eligibility_status: '', eligibility_notes: '',

    // Prior Auth
    prior_auth_required: null, prior_auth_number: '',
    prior_auth_start_date: '', prior_auth_end_date: '', prior_auth_units_approved: '',

    // Clinical Reference
    referring_provider_name: '', referring_provider_npi: '', referring_provider_credential: '',
    referring_provider_phone: '', referring_provider_org: '', referral_order_on_file: false,
    primary_diagnosis_code: '', primary_diagnosis_description: '',
    secondary_diagnosis_code: '', secondary_diagnosis_description: '',
    diagnosis_source: '', diagnosis_date: '',

    // PCP
    has_primary_provider: null, provider_name: '', provider_phone: '',

    // Education & Employment
    education_level: '', past_year_employment: '',
    currently_employed: null, employer: '', monthly_income_pretax: '',
    employer_benefits: [], income_sources: [], income_sources_other: '',

    // Social
    supportive_people_count: '', is_dv_survivor: null, last_dv_episode: '', is_currently_fleeing: null,

    // Substance Use
    age_first_use: '', substances_used: [], substances_other: '',
    has_overdosed: null, overdose_count: '',

    // Recovery History
    is_first_recovery_attempt: null, previous_attempt_count: '',
    has_received_treatment: null, treatment_types: '', recovery_notes: '',
};

// =============================================
// DB → FORM STATE MAPPER (edit mode loader)
// =============================================

/**
 * Maps a database intake record into form state.
 * Handles JSONB parsing, null → empty string, date formatting.
 * 
 * Usage in edit loader:
 *   const intake = data.intakes?.[0];
 *   if (intake) setForm(fromDatabase(intake));
 */
export function fromDatabase(intake: Record<string, any>): IntakeFormData {
    const parseJsonb = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch { return []; }
        }
        return [];
    };

    const str = (val: any): string => {
        if (val === null || val === undefined) return '';
        return String(val);
    };

    const dateStr = (val: any): string => {
        if (!val) return '';
        return String(val).split('T')[0];
    };

    return {
        // Background
        other_names: str(intake.other_names),
        ssn_last_four: str(intake.ssn_last_four),
        home_zip: str(intake.home_zip),
        home_city_state: str(intake.home_city_state),
        is_veteran: intake.is_veteran ?? false,
        is_english_first_language: intake.is_english_first_language ?? true,
        other_language: str(intake.other_language),
        marital_status: str(intake.marital_status),
        race: parseJsonb(intake.race),
        race_other: str(intake.race_other),
        ethnicity: str(intake.ethnicity),
        gender_identity: str(intake.gender_identity),
        gender_other: str(intake.gender_other),
        has_minor_children: str(intake.has_minor_children),
        referral_source: str(intake.referral_source),
        referral_source_other: str(intake.referral_source_other),
        legal_status: parseJsonb(intake.legal_status),
        legal_officers: parseJsonb(intake.legal_officers),

        // Consent & Authorization
        consent_to_treat: intake.consent_to_treat ?? null,
        consent_to_treat_date: dateStr(intake.consent_to_treat_date),
        consent_to_bill_insurance: intake.consent_to_bill_insurance ?? null,
        consent_to_bill_date: dateStr(intake.consent_to_bill_date),
        consent_to_release_info: intake.consent_to_release_info ?? null,
        consent_to_release_date: dateStr(intake.consent_to_release_date),
        consent_to_release_parties: parseJsonb(intake.consent_to_release_parties),
        consent_signature_on_file: intake.consent_signature_on_file ?? false,
        consent_notes: str(intake.consent_notes),

        // Emergency Contact 2
        emergency_contact_2_name: str(intake.emergency_contact_2_name),
        emergency_contact_2_relationship: str(intake.emergency_contact_2_relationship),
        emergency_contact_2_phone: str(intake.emergency_contact_2_phone),

        // Health
        physical_health_conditions: parseJsonb(intake.physical_health_conditions),
        physical_health_other: str(intake.physical_health_other),
        takes_physical_medications: intake.takes_physical_medications ?? null,
        physical_medications: str(intake.physical_medications),
        mental_health_conditions: parseJsonb(intake.mental_health_conditions),
        mental_health_other: str(intake.mental_health_other),
        takes_mental_medications: intake.takes_mental_medications ?? null,
        mental_medications: str(intake.mental_medications),
        is_pregnant: str(intake.is_pregnant),
        pregnancy_months: intake.pregnancy_months ?? null,

        // Insurance — Primary
        insurance_type: str(intake.insurance_type),
        insurance_other: str(intake.insurance_other),
        primary_insurance_type: str(intake.primary_insurance_type || intake.insurance_type),
        primary_payer_name: str(intake.primary_payer_name),
        primary_payer_id: str(intake.primary_payer_id),
        primary_member_id: str(intake.primary_member_id),
        primary_group_number: str(intake.primary_group_number),
        primary_plan_name: str(intake.primary_plan_name),
        primary_subscriber_relationship: str(intake.primary_subscriber_relationship),
        primary_subscriber_name: str(intake.primary_subscriber_name),
        primary_subscriber_dob: dateStr(intake.primary_subscriber_dob),
        primary_subscriber_address: str(intake.primary_subscriber_address),
        primary_insurance_phone: str(intake.primary_insurance_phone),
        primary_effective_date: dateStr(intake.primary_effective_date),
        primary_termination_date: dateStr(intake.primary_termination_date),
        primary_insurance_verified_from: str(intake.primary_insurance_verified_from),
        medicaid_mco: str(intake.medicaid_mco),
        insurance_card_on_file: intake.insurance_card_on_file ?? false,

        // Insurance — Secondary
        has_secondary_insurance: intake.has_secondary_insurance ?? null,
        secondary_insurance_type: str(intake.secondary_insurance_type),
        secondary_payer_name: str(intake.secondary_payer_name),
        secondary_payer_id: str(intake.secondary_payer_id),
        secondary_member_id: str(intake.secondary_member_id),
        secondary_group_number: str(intake.secondary_group_number),
        secondary_subscriber_relationship: str(intake.secondary_subscriber_relationship),
        secondary_subscriber_name: str(intake.secondary_subscriber_name),
        secondary_subscriber_dob: dateStr(intake.secondary_subscriber_dob),
        secondary_effective_date: dateStr(intake.secondary_effective_date),

        // Eligibility
        eligibility_verified: intake.eligibility_verified ?? null,
        eligibility_verified_date: dateStr(intake.eligibility_verified_date),
        eligibility_verified_by: str(intake.eligibility_verified_by),
        eligibility_verified_method: str(intake.eligibility_verified_method),
        eligibility_status: str(intake.eligibility_status),
        eligibility_notes: str(intake.eligibility_notes),

        // Prior Auth
        prior_auth_required: intake.prior_auth_required ?? null,
        prior_auth_number: str(intake.prior_auth_number),
        prior_auth_start_date: dateStr(intake.prior_auth_start_date),
        prior_auth_end_date: dateStr(intake.prior_auth_end_date),
        prior_auth_units_approved: intake.prior_auth_units_approved != null ? String(intake.prior_auth_units_approved) : '',

        // Clinical Reference
        referring_provider_name: str(intake.referring_provider_name),
        referring_provider_npi: str(intake.referring_provider_npi),
        referring_provider_credential: str(intake.referring_provider_credential),
        referring_provider_phone: str(intake.referring_provider_phone),
        referring_provider_org: str(intake.referring_provider_org),
        referral_order_on_file: intake.referral_order_on_file ?? false,
        primary_diagnosis_code: str(intake.primary_diagnosis_code),
        primary_diagnosis_description: str(intake.primary_diagnosis_description),
        secondary_diagnosis_code: str(intake.secondary_diagnosis_code),
        secondary_diagnosis_description: str(intake.secondary_diagnosis_description),
        diagnosis_source: str(intake.diagnosis_source),
        diagnosis_date: dateStr(intake.diagnosis_date),

        // PCP
        has_primary_provider: intake.has_primary_provider ?? null,
        provider_name: str(intake.provider_name),
        provider_phone: str(intake.provider_phone),

        // Education & Employment
        education_level: str(intake.education_level),
        past_year_employment: str(intake.past_year_employment),
        currently_employed: intake.currently_employed ?? null,
        employer: str(intake.employer),
        monthly_income_pretax: intake.monthly_income_pretax ? String(intake.monthly_income_pretax) : '',
        employer_benefits: parseJsonb(intake.employer_benefits),
        income_sources: parseJsonb(intake.income_sources),
        income_sources_other: str(intake.income_sources_other),

        // Social
        supportive_people_count: intake.supportive_people_count != null ? String(intake.supportive_people_count) : '',
        is_dv_survivor: intake.is_dv_survivor ?? null,
        last_dv_episode: str(intake.last_dv_episode),
        is_currently_fleeing: intake.is_currently_fleeing ?? null,

        // Substance Use
        age_first_use: intake.age_first_use != null ? String(intake.age_first_use) : '',
        substances_used: parseJsonb(intake.substances_used),
        substances_other: str(intake.substances_other),
        has_overdosed: intake.has_overdosed ?? null,
        overdose_count: intake.overdose_count != null ? String(intake.overdose_count) : '',

        // Recovery History
        is_first_recovery_attempt: intake.is_first_recovery_attempt ?? null,
        previous_attempt_count: intake.previous_attempt_count != null ? String(intake.previous_attempt_count) : '',
        has_received_treatment: intake.has_received_treatment ?? null,
        treatment_types: str(intake.treatment_types),
        recovery_notes: str(intake.recovery_notes),
    };
}

// =============================================
// FORM STATE → API PAYLOAD MAPPER
// =============================================

/**
 * Converts form state into the API request body.
 * Handles type conversions (string → number, etc.)
 * 
 * Usage in submit handler:
 *   const payload = toPayload(form, { organization_id, participant_id, intake_date });
 *   fetch('/api/intake', { method: 'POST', body: JSON.stringify(payload) });
 */
export function toPayload(
    form: IntakeFormData,
    meta: {
        id?: string;
        organization_id: string;
        participant_id: string;
        intake_date: string;
        status?: string;
    }
): Record<string, any> {
    return {
        ...meta,
        status: meta.status || 'completed',
        ...form,
        // Type conversions for numeric fields
        pregnancy_months: form.pregnancy_months,
        monthly_income_pretax: form.monthly_income_pretax ? parseFloat(form.monthly_income_pretax) : null,
        supportive_people_count: form.supportive_people_count ? parseInt(form.supportive_people_count) : null,
        age_first_use: form.age_first_use ? parseInt(form.age_first_use) : null,
        overdose_count: form.overdose_count ? parseInt(form.overdose_count) : null,
        previous_attempt_count: form.previous_attempt_count ? parseInt(form.previous_attempt_count) : null,
        prior_auth_units_approved: form.prior_auth_units_approved ? parseInt(form.prior_auth_units_approved) : null,
    };
}

// =============================================
// STEP DEFINITIONS (10 steps)
// =============================================

import {
    UserPlus, User, Shield, Phone, Heart, Stethoscope,
    GraduationCap, Users, Pill, RotateCcw,
} from 'lucide-react';

export const STEPS = [
    { key: 'select',     label: 'Select Participant',      icon: UserPlus,     color: '#1A73A8' },
    { key: 'consent',    label: 'Consent & Authorization',  icon: Shield,       color: '#7C3AED' },
    { key: 'background', label: 'Background',               icon: User,         color: '#6366F1' },
    { key: 'emergency',  label: 'Emergency Contact',        icon: Phone,        color: '#DC2626' },
    { key: 'health',     label: 'Health',                   icon: Heart,        color: '#EC4899' },
    { key: 'insurance',  label: 'Insurance & Eligibility',  icon: Stethoscope,  color: '#0891B2' },
    { key: 'education',  label: 'Education & Work',         icon: GraduationCap, color: '#D97706' },
    { key: 'social',     label: 'Social & Safety',          icon: Users,        color: '#059669' },
    { key: 'substance',  label: 'Substance Use',            icon: Pill,         color: '#F97316' },
    { key: 'recovery',   label: 'Recovery History',         icon: RotateCcw,    color: '#10B981' },
];

// =============================================
// OPTION LISTS (new billing-related ones)
// =============================================

export const INSURANCE_TYPE_OPTIONS = [
    { value: 'none',        label: 'Uninsured / Self-Pay' },
    { value: 'medicaid',    label: 'Medicaid' },
    { value: 'medicare',    label: 'Medicare' },
    { value: 'dual',        label: 'Dual Eligible (Medicare + Medicaid)' },
    { value: 'private',     label: 'Private / Commercial' },
    { value: 'va',          label: 'VA / TRICARE' },
    { value: 'marketplace', label: 'ACA Marketplace' },
    { value: 'other',       label: 'Other' },
];

export const KY_MEDICAID_MCO_OPTIONS = [
    { value: 'humana_caresource', label: 'Humana CareSource' },
    { value: 'anthem',            label: 'Anthem Blue Cross Blue Shield' },
    { value: 'aetna',             label: 'Aetna Better Health of KY' },
    { value: 'molina',            label: 'Molina Healthcare (Passport)' },
    { value: 'united',            label: 'UnitedHealthcare Community Plan' },
    { value: 'wellcare',          label: 'WellCare of Kentucky' },
    { value: 'fee_for_service',   label: 'Fee-for-Service (no MCO)' },
    { value: 'unknown',           label: 'Unknown' },
];

export const SUBSCRIBER_RELATIONSHIP_OPTIONS = [
    { value: 'self',   label: 'Self' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'child',  label: 'Child' },
    { value: 'other',  label: 'Other Dependent' },
];

export const ELIGIBILITY_STATUS_OPTIONS = [
    { value: 'active',      label: 'Active — Verified' },
    { value: 'inactive',    label: 'Inactive / Terminated' },
    { value: 'pending',     label: 'Pending Verification' },
    { value: 'not_checked', label: 'Not Yet Checked' },
];

export const ELIGIBILITY_METHOD_OPTIONS = [
    { value: 'portal',        label: 'Payer Portal' },
    { value: 'phone',         label: 'Phone Call' },
    { value: 'clearinghouse', label: 'Clearinghouse (270/271)' },
    { value: 'payer_website',  label: 'Payer Website' },
];

export const INSURANCE_VERIFIED_FROM_OPTIONS = [
    { value: 'insurance_card', label: 'Insurance Card' },
    { value: 'portal',         label: 'Payer Portal' },
    { value: 'phone',          label: 'Phone Verification' },
    { value: 'clearinghouse',  label: 'Clearinghouse' },
    { value: 'payer_website',  label: 'Payer Website' },
    { value: 'referral_docs',  label: 'Referral/Discharge Paperwork' },
];

export const RELEASE_PARTY_OPTIONS = [
    { value: 'insurance',          label: 'Insurance / Payer' },
    { value: 'referring_provider', label: 'Referring Provider' },
    { value: 'pcp',                label: 'Primary Care Provider' },
    { value: 'treatment_team',     label: 'Treatment Team' },
    { value: 'legal',              label: 'Court / Probation / Parole' },
    { value: 'family',             label: 'Family Member(s)' },
    { value: 'other',              label: 'Other' },
];

export const CREDENTIAL_OPTIONS = [
    { value: 'md',   label: 'MD' },
    { value: 'do',   label: 'DO' },
    { value: 'lcsw', label: 'LCSW' },
    { value: 'lpcc', label: 'LPCC' },
    { value: 'lmft', label: 'LMFT' },
    { value: 'psyd', label: 'PsyD' },
    { value: 'aprn', label: 'APRN' },
    { value: 'cadc', label: 'CADC' },
    { value: 'other', label: 'Other' },
];

export const DIAGNOSIS_SOURCE_OPTIONS = [
    { value: 'referring_provider',  label: 'Referring Provider' },
    { value: 'treatment_team',      label: 'Treatment Team' },
    { value: 'hospital_discharge',  label: 'Hospital Discharge' },
    { value: 'assessment',          label: 'Clinical Assessment on File' },
    { value: 'self_report',         label: 'Self-Report (unverified)' },
];

// Common ICD-10 codes for peer support populations
// MVP: dropdown + manual entry. Future: searchable ICD-10 API lookup.
export const COMMON_DIAGNOSIS_OPTIONS = [
    { value: 'F10.20', label: 'F10.20 — Alcohol use disorder, moderate' },
    { value: 'F10.21', label: 'F10.21 — Alcohol use disorder, moderate, in remission' },
    { value: 'F10.10', label: 'F10.10 — Alcohol use disorder, mild' },
    { value: 'F11.20', label: 'F11.20 — Opioid use disorder, moderate' },
    { value: 'F11.21', label: 'F11.21 — Opioid use disorder, moderate, in remission' },
    { value: 'F14.20', label: 'F14.20 — Cocaine use disorder, moderate' },
    { value: 'F15.20', label: 'F15.20 — Stimulant use disorder, moderate' },
    { value: 'F19.20', label: 'F19.20 — Other substance use disorder, moderate' },
    { value: 'F19.21', label: 'F19.21 — Other substance use disorder, moderate, in remission' },
    { value: 'F32.1',  label: 'F32.1 — Major depressive disorder, single episode, moderate' },
    { value: 'F33.1',  label: 'F33.1 — Major depressive disorder, recurrent, moderate' },
    { value: 'F41.1',  label: 'F41.1 — Generalized anxiety disorder' },
    { value: 'F43.10', label: 'F43.10 — Post-traumatic stress disorder' },
    { value: 'F31.9',  label: 'F31.9 — Bipolar disorder, unspecified' },
    { value: 'manual', label: 'Other — enter code manually' },
];
