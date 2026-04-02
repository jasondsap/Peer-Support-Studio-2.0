import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql, logAuditEvent } from '@/lib/db';
import { computeBillingReadiness } from '@/lib/billingReadiness';

// =============================================
// PARTICIPANT INTAKE API (Billing-Ready)
// File: app/api/intake/route.ts
//
// Handles comprehensive intake form data including
// consent, insurance, eligibility, clinical reference,
// and billing readiness computation.
// =============================================

// Helper: convert JS arrays to JSONB string for Neon
const toJsonb = (val: any) => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return JSON.stringify(val);
    return val;
};

// =============================================
// All billing-related field names (new in Phase 1a)
// Used by both POST and PUT to destructure body
// =============================================
const BILLING_FIELDS = [
    // Consent & Authorization
    'consent_to_treat', 'consent_to_treat_date',
    'consent_to_bill_insurance', 'consent_to_bill_date',
    'consent_to_release_info', 'consent_to_release_date',
    'consent_to_release_parties', 'consent_signature_on_file', 'consent_notes',
    // Primary Insurance
    'primary_insurance_type', 'primary_payer_name', 'primary_payer_id',
    'primary_member_id', 'primary_group_number', 'primary_plan_name',
    'primary_subscriber_relationship', 'primary_subscriber_name',
    'primary_subscriber_dob', 'primary_subscriber_address',
    'primary_insurance_phone', 'primary_effective_date', 'primary_termination_date',
    'primary_insurance_verified_from', 'medicaid_mco', 'insurance_card_on_file',
    // Secondary Insurance
    'has_secondary_insurance', 'secondary_insurance_type', 'secondary_payer_name',
    'secondary_payer_id', 'secondary_member_id', 'secondary_group_number',
    'secondary_subscriber_relationship', 'secondary_subscriber_name',
    'secondary_subscriber_dob', 'secondary_effective_date',
    // Eligibility
    'eligibility_verified', 'eligibility_verified_date', 'eligibility_verified_by',
    'eligibility_verified_method', 'eligibility_status', 'eligibility_notes',
    // Prior Auth
    'prior_auth_required', 'prior_auth_number',
    'prior_auth_start_date', 'prior_auth_end_date', 'prior_auth_units_approved',
    // Referring Provider
    'referring_provider_name', 'referring_provider_npi', 'referring_provider_credential',
    'referring_provider_phone', 'referring_provider_org', 'referral_order_on_file',
    // Diagnosis
    'primary_diagnosis_code', 'primary_diagnosis_description',
    'secondary_diagnosis_code', 'secondary_diagnosis_description',
    'diagnosis_source', 'diagnosis_date',
    // Billing metadata
    'billing_info_completed_by', 'billing_info_completed_at',
] as const;

// Original intake fields (unchanged)
const ORIGINAL_FIELDS = [
    'other_names', 'ssn_last_four', 'home_zip', 'home_city_state',
    'is_veteran', 'is_english_first_language', 'other_language',
    'marital_status', 'race', 'race_other', 'ethnicity',
    'gender_identity', 'gender_other', 'has_minor_children',
    'referral_source', 'referral_source_other', 'legal_status', 'legal_officers',
    'emergency_contact_2_name', 'emergency_contact_2_relationship', 'emergency_contact_2_phone',
    'physical_health_conditions', 'physical_health_other',
    'takes_physical_medications', 'physical_medications',
    'mental_health_conditions', 'mental_health_other',
    'takes_mental_medications', 'mental_medications',
    'is_pregnant', 'pregnancy_months',
    'insurance_type', 'insurance_other',
    'has_primary_provider', 'provider_name', 'provider_phone',
    'education_level', 'past_year_employment',
    'currently_employed', 'employer', 'monthly_income_pretax', 'employer_benefits',
    'income_sources', 'income_sources_other',
    'supportive_people_count', 'is_dv_survivor', 'last_dv_episode', 'is_currently_fleeing',
    'age_first_use', 'substances_used', 'substances_other',
    'has_overdosed', 'overdose_count',
    'is_first_recovery_attempt', 'previous_attempt_count',
    'has_received_treatment', 'treatment_types', 'recovery_notes',
] as const;

// JSONB array fields that need toJsonb() wrapping
const JSONB_FIELDS = new Set([
    'race', 'legal_status', 'legal_officers',
    'physical_health_conditions', 'mental_health_conditions',
    'employer_benefits', 'income_sources', 'substances_used',
    'consent_to_release_parties',
]);

// Boolean fields
const BOOLEAN_FIELDS = new Set([
    'is_veteran', 'is_english_first_language',
    'takes_physical_medications', 'takes_mental_medications',
    'has_primary_provider', 'currently_employed',
    'is_dv_survivor', 'is_currently_fleeing',
    'has_overdosed', 'is_first_recovery_attempt', 'has_received_treatment',
    // New billing booleans
    'consent_to_treat', 'consent_to_bill_insurance', 'consent_to_release_info',
    'consent_signature_on_file', 'insurance_card_on_file',
    'has_secondary_insurance', 'eligibility_verified',
    'prior_auth_required', 'referral_order_on_file',
]);

// Integer fields
const INT_FIELDS = new Set([
    'pregnancy_months', 'supportive_people_count', 'age_first_use',
    'overdose_count', 'previous_attempt_count', 'prior_auth_units_approved',
]);

// Numeric (decimal) fields
const NUMERIC_FIELDS = new Set(['monthly_income_pretax']);

/**
 * Normalize a field value based on its type for DB insertion
 */
function normalizeField(key: string, val: any): any {
    if (val === '' || val === undefined) return null;
    if (JSONB_FIELDS.has(key)) return toJsonb(val);
    if (BOOLEAN_FIELDS.has(key)) return val ?? null;
    if (INT_FIELDS.has(key)) {
        if (val === null) return null;
        const parsed = parseInt(String(val), 10);
        return isNaN(parsed) ? null : parsed;
    }
    if (NUMERIC_FIELDS.has(key)) {
        if (val === null) return null;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? null : parsed;
    }
    return val || null;
}

// =============================================
// GET /api/intake
// =============================================

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        let results;
        if (participantId) {
            results = await sql`
                SELECT * FROM participant_intakes
                WHERE organization_id = ${organizationId}::uuid
                AND participant_id = ${participantId}::uuid
                ORDER BY intake_date DESC
            `;
        } else {
            results = await sql`
                SELECT * FROM participant_intakes
                WHERE organization_id = ${organizationId}::uuid
                ORDER BY intake_date DESC
                LIMIT 100
            `;
        }

        return NextResponse.json({ success: true, intakes: results });
    } catch (error) {
        console.error('Error fetching intakes:', error);
        return NextResponse.json({ error: 'Failed to fetch intakes' }, { status: 500 });
    }
}

// =============================================
// POST /api/intake — Create new intake
// =============================================

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await req.json();
        const { organization_id, participant_id, intake_date, status: intakeStatus } = body;

        if (!organization_id || !participant_id) {
            return NextResponse.json(
                { error: 'organization_id and participant_id are required' },
                { status: 400 }
            );
        }

        // Build columns and values dynamically from all known fields
        const allFields = [...ORIGINAL_FIELDS, ...BILLING_FIELDS];
        const columns: string[] = [
            'organization_id', 'participant_id', 'completed_by',
            'intake_date', 'status',
        ];
        const values: any[] = [
            organization_id, participant_id, userId,
            intake_date || new Date().toISOString().split('T')[0],
            intakeStatus || 'completed',
        ];

        for (const field of allFields) {
            if (field in body) {
                columns.push(field);
                values.push(normalizeField(field, body[field]));
            }
        }

        // Compute billing readiness and store it
        const billingResult = computeBillingReadiness(body);
        columns.push('billing_readiness_holds');
        values.push(JSON.stringify(billingResult.holds));

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const castOrgId = columns.indexOf('organization_id') + 1;
        const castPartId = columns.indexOf('participant_id') + 1;
        const castCompBy = columns.indexOf('completed_by') + 1;

        // Build query with UUID casts for ID fields
        const colStr = columns.join(', ');
        const valStr = values.map((_, i) => {
            const idx = i + 1;
            if (idx === castOrgId || idx === castPartId || idx === castCompBy) {
                return `$${idx}::uuid`;
            }
            return `$${idx}`;
        }).join(', ');

        const queryText = `
            INSERT INTO participant_intakes (${colStr})
            VALUES (${valStr})
            RETURNING *
        `;

        const result = await sql(queryText, values);

        // Audit log
        await logAuditEvent(
            userId, organization_id, 'create', 'participant_intake',
            result[0]?.id, { participant_id, billing_ready: billingResult.ready }
        );

        return NextResponse.json({
            success: true,
            intake: result[0],
            billingReadiness: billingResult,
        });
    } catch (error) {
        console.error('Error creating intake:', error);
        return NextResponse.json({ error: 'Failed to save intake' }, { status: 500 });
    }
}

// =============================================
// PUT /api/intake — Update existing intake
// =============================================

export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await req.json();
        const { id, organization_id } = body;

        if (!id || !organization_id) {
            return NextResponse.json(
                { error: 'id and organization_id required' },
                { status: 400 }
            );
        }

        // Verify intake exists and belongs to org
        const existing = await sql`
            SELECT id FROM participant_intakes
            WHERE id = ${id}::uuid AND organization_id = ${organization_id}::uuid
        `;
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Intake not found' }, { status: 404 });
        }

        // Build SET clause dynamically
        const allFields = [...ORIGINAL_FIELDS, ...BILLING_FIELDS];
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

        // Always update these
        if (body.intake_date) {
            setClauses.push(`intake_date = $${paramIdx}`);
            values.push(body.intake_date);
            paramIdx++;
        }
        if (body.status) {
            setClauses.push(`status = $${paramIdx}`);
            values.push(body.status);
            paramIdx++;
        }
        setClauses.push(`completed_by = $${paramIdx}::uuid`);
        values.push(userId);
        paramIdx++;

        // Update all provided fields
        for (const field of allFields) {
            if (field in body) {
                setClauses.push(`${field} = $${paramIdx}`);
                values.push(normalizeField(field, body[field]));
                paramIdx++;
            }
        }

        // Recompute billing readiness
        // Merge existing record with updates so the check sees the full picture
        const fullRecord = await sql`SELECT * FROM participant_intakes WHERE id = ${id}::uuid`;
        const merged = { ...fullRecord[0], ...body };
        const billingResult = computeBillingReadiness(merged);

        setClauses.push(`billing_readiness_holds = $${paramIdx}`);
        values.push(JSON.stringify(billingResult.holds));
        paramIdx++;

        // Track who last updated billing info (if any billing field was touched)
        const billingFieldSet = new Set(BILLING_FIELDS);
        const touchedBilling = Object.keys(body).some(k => billingFieldSet.has(k));
        if (touchedBilling) {
            setClauses.push(`billing_info_completed_by = $${paramIdx}::uuid`);
            values.push(userId);
            paramIdx++;
            setClauses.push(`billing_info_completed_at = NOW()`);
        }

        // Add WHERE clause params
        values.push(id);
        const idParam = paramIdx;
        paramIdx++;
        values.push(organization_id);
        const orgParam = paramIdx;

        const queryText = `
            UPDATE participant_intakes
            SET ${setClauses.join(', ')}, updated_at = NOW()
            WHERE id = $${idParam}::uuid AND organization_id = $${orgParam}::uuid
            RETURNING *
        `;

        const result = await sql(queryText, values);

        // Audit log
        await logAuditEvent(
            userId, organization_id, 'update', 'participant_intake',
            id, {
                updated_fields: Object.keys(body).filter(k => k !== 'id' && k !== 'organization_id'),
                billing_ready: billingResult.ready,
            }
        );

        return NextResponse.json({
            success: true,
            intake: result[0],
            billingReadiness: billingResult,
        });
    } catch (error) {
        console.error('Error updating intake:', error);
        return NextResponse.json({ error: 'Failed to update intake' }, { status: 500 });
    }
}
