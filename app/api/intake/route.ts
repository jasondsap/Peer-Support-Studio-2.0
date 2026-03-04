import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

// =============================================
// PARTICIPANT INTAKE API
// File: app/api/intake/route.ts
// Saves comprehensive intake form data.
// One intake record per admission per participant.
// =============================================

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
                SELECT 
                    ri.*,
                    p.first_name,
                    p.last_name,
                    p.preferred_name,
                    p.date_of_birth,
                    p.gender,
                    CASE 
                        WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                        ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                    END as completed_by_name
                FROM participant_intakes ri
                LEFT JOIN participants p ON ri.participant_id = p.id
                LEFT JOIN users u ON ri.completed_by = u.id
                WHERE ri.organization_id = ${organizationId}::uuid
                AND ri.participant_id = ${participantId}::uuid
                ORDER BY ri.intake_date DESC
            `;
        } else {
            results = await sql`
                SELECT 
                    ri.*,
                    p.first_name,
                    p.last_name,
                    p.preferred_name,
                    p.date_of_birth,
                    p.gender,
                    CASE 
                        WHEN u.display_name IS NOT NULL AND u.display_name != '' THEN u.display_name
                        ELSE TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))
                    END as completed_by_name
                FROM participant_intakes ri
                LEFT JOIN participants p ON ri.participant_id = p.id
                LEFT JOIN users u ON ri.completed_by = u.id
                WHERE ri.organization_id = ${organizationId}::uuid
                ORDER BY ri.intake_date DESC
            `;
        }

        return NextResponse.json({
            success: true,
            intakes: results,
        });
    } catch (error) {
        console.error('Error fetching intakes:', error);
        return NextResponse.json({ error: 'Failed to fetch intakes' }, { status: 500 });
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
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        // Verify intake exists and belongs to this org
        const existing = await sql`
            SELECT id FROM participant_intakes 
            WHERE id = ${id}::uuid AND organization_id = ${organization_id}::uuid
        `;
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Intake not found' }, { status: 404 });
        }

        const toJsonb = (val: any) => {
            if (val === null || val === undefined) return null;
            if (Array.isArray(val)) return JSON.stringify(val);
            return val;
        };

        const {
            intake_date, status: intakeStatus,
            other_names, ssn_last_four, home_zip, home_city_state,
            is_veteran, is_english_first_language, other_language,
            marital_status, race, race_other, ethnicity,
            gender_identity, gender_other, has_minor_children,
            referral_source, referral_source_other,
            legal_status, legal_officers,
            emergency_contact_2_name, emergency_contact_2_relationship, emergency_contact_2_phone,
            physical_health_conditions, physical_health_other,
            takes_physical_medications, physical_medications,
            mental_health_conditions, mental_health_other,
            takes_mental_medications, mental_medications,
            is_pregnant, pregnancy_months,
            insurance_type, insurance_other,
            has_primary_provider, provider_name, provider_phone,
            education_level, past_year_employment,
            currently_employed, employer, monthly_income_pretax, employer_benefits,
            income_sources, income_sources_other,
            supportive_people_count, is_dv_survivor, last_dv_episode, is_currently_fleeing,
            age_first_use, substances_used, substances_other,
            has_overdosed, overdose_count,
            is_first_recovery_attempt, previous_attempt_count,
            has_received_treatment, treatment_types, recovery_notes,
        } = body;

        const result = await sql`
            UPDATE participant_intakes SET
                completed_by = ${userId}::uuid,
                intake_date = ${intake_date || new Date().toISOString().split('T')[0]},
                status = ${intakeStatus || 'completed'},
                other_names = ${other_names || null},
                ssn_last_four = ${ssn_last_four || null},
                home_zip = ${home_zip || null},
                home_city_state = ${home_city_state || null},
                is_veteran = ${is_veteran ?? false},
                is_english_first_language = ${is_english_first_language ?? true},
                other_language = ${other_language || null},
                marital_status = ${marital_status || null},
                race = ${toJsonb(race)},
                race_other = ${race_other || null},
                ethnicity = ${ethnicity || null},
                gender_identity = ${gender_identity || null},
                gender_other = ${gender_other || null},
                has_minor_children = ${has_minor_children || null},
                referral_source = ${referral_source || null},
                referral_source_other = ${referral_source_other || null},
                legal_status = ${toJsonb(legal_status)},
                legal_officers = ${toJsonb(legal_officers)},
                emergency_contact_2_name = ${emergency_contact_2_name || null},
                emergency_contact_2_relationship = ${emergency_contact_2_relationship || null},
                emergency_contact_2_phone = ${emergency_contact_2_phone || null},
                physical_health_conditions = ${toJsonb(physical_health_conditions)},
                physical_health_other = ${physical_health_other || null},
                takes_physical_medications = ${takes_physical_medications ?? null},
                physical_medications = ${physical_medications || null},
                mental_health_conditions = ${toJsonb(mental_health_conditions)},
                mental_health_other = ${mental_health_other || null},
                takes_mental_medications = ${takes_mental_medications ?? null},
                mental_medications = ${mental_medications || null},
                is_pregnant = ${is_pregnant || null},
                pregnancy_months = ${pregnancy_months ?? null},
                insurance_type = ${insurance_type || null},
                insurance_other = ${insurance_other || null},
                has_primary_provider = ${has_primary_provider ?? null},
                provider_name = ${provider_name || null},
                provider_phone = ${provider_phone || null},
                education_level = ${education_level || null},
                past_year_employment = ${past_year_employment || null},
                currently_employed = ${currently_employed ?? null},
                employer = ${employer || null},
                monthly_income_pretax = ${monthly_income_pretax ? parseFloat(monthly_income_pretax) : null},
                employer_benefits = ${toJsonb(employer_benefits)},
                income_sources = ${toJsonb(income_sources)},
                income_sources_other = ${income_sources_other || null},
                supportive_people_count = ${supportive_people_count ? parseInt(supportive_people_count) : null},
                is_dv_survivor = ${is_dv_survivor ?? null},
                last_dv_episode = ${last_dv_episode || null},
                is_currently_fleeing = ${is_currently_fleeing ?? null},
                age_first_use = ${age_first_use ? parseInt(age_first_use) : null},
                substances_used = ${toJsonb(substances_used)},
                substances_other = ${substances_other || null},
                has_overdosed = ${has_overdosed ?? null},
                overdose_count = ${overdose_count ? parseInt(overdose_count) : null},
                is_first_recovery_attempt = ${is_first_recovery_attempt ?? null},
                previous_attempt_count = ${previous_attempt_count ? parseInt(previous_attempt_count) : null},
                has_received_treatment = ${has_received_treatment ?? null},
                treatment_types = ${treatment_types || null},
                recovery_notes = ${recovery_notes || null}
            WHERE id = ${id}::uuid AND organization_id = ${organization_id}::uuid
            RETURNING *
        `;

        return NextResponse.json({ success: true, intake: result[0] });
    } catch (error) {
        console.error('Error updating intake:', error);
        return NextResponse.json({ error: 'Failed to update intake' }, { status: 500 });
    }
}

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
        const {
            organization_id,
            participant_id,
            intake_date,
            status: intakeStatus,

            // Background
            other_names, ssn_last_four, home_zip, home_city_state,
            is_veteran, is_english_first_language, other_language,
            marital_status, race, race_other, ethnicity,
            gender_identity, gender_other, has_minor_children,
            referral_source, referral_source_other,
            legal_status, legal_officers,

            // Emergency Contact 2
            emergency_contact_2_name, emergency_contact_2_relationship, emergency_contact_2_phone,

            // Health
            physical_health_conditions, physical_health_other,
            takes_physical_medications, physical_medications,
            mental_health_conditions, mental_health_other,
            takes_mental_medications, mental_medications,
            is_pregnant, pregnancy_months,

            // Insurance
            insurance_type, insurance_other,
            has_primary_provider, provider_name, provider_phone,

            // Education & Employment
            education_level, past_year_employment,
            currently_employed, employer, monthly_income_pretax, employer_benefits,
            income_sources, income_sources_other,

            // Social
            supportive_people_count, is_dv_survivor, last_dv_episode, is_currently_fleeing,

            // Substance Use
            age_first_use, substances_used, substances_other,
            has_overdosed, overdose_count,

            // Recovery History (simplified)
            is_first_recovery_attempt, previous_attempt_count,
            has_received_treatment, treatment_types, recovery_notes,
        } = body;

        if (!organization_id || !participant_id) {
            return NextResponse.json(
                { error: 'organization_id and participant_id are required' },
                { status: 400 }
            );
        }

        // Convert JSONB fields - ensure arrays are properly formatted
        const toJsonb = (val: any) => {
            if (val === null || val === undefined) return null;
            if (Array.isArray(val)) return JSON.stringify(val);
            return val;
        };

        const result = await sql`
            INSERT INTO participant_intakes (
                organization_id, participant_id, completed_by, intake_date, status,
                other_names, ssn_last_four, home_zip, home_city_state,
                is_veteran, is_english_first_language, other_language,
                marital_status, race, race_other, ethnicity,
                gender_identity, gender_other, has_minor_children,
                referral_source, referral_source_other,
                legal_status, legal_officers,
                emergency_contact_2_name, emergency_contact_2_relationship, emergency_contact_2_phone,
                physical_health_conditions, physical_health_other,
                takes_physical_medications, physical_medications,
                mental_health_conditions, mental_health_other,
                takes_mental_medications, mental_medications,
                is_pregnant, pregnancy_months,
                insurance_type, insurance_other,
                has_primary_provider, provider_name, provider_phone,
                education_level, past_year_employment,
                currently_employed, employer, monthly_income_pretax, employer_benefits,
                income_sources, income_sources_other,
                supportive_people_count, is_dv_survivor, last_dv_episode, is_currently_fleeing,
                age_first_use, substances_used, substances_other,
                has_overdosed, overdose_count,
                is_first_recovery_attempt, previous_attempt_count,
                has_received_treatment, treatment_types, recovery_notes
            ) VALUES (
                ${organization_id}::uuid,
                ${participant_id}::uuid,
                ${userId}::uuid,
                ${intake_date || new Date().toISOString().split('T')[0]},
                ${intakeStatus || 'completed'},
                ${other_names || null},
                ${ssn_last_four || null},
                ${home_zip || null},
                ${home_city_state || null},
                ${is_veteran ?? false},
                ${is_english_first_language ?? true},
                ${other_language || null},
                ${marital_status || null},
                ${toJsonb(race)},
                ${race_other || null},
                ${ethnicity || null},
                ${gender_identity || null},
                ${gender_other || null},
                ${has_minor_children || null},
                ${referral_source || null},
                ${referral_source_other || null},
                ${toJsonb(legal_status)},
                ${toJsonb(legal_officers)},
                ${emergency_contact_2_name || null},
                ${emergency_contact_2_relationship || null},
                ${emergency_contact_2_phone || null},
                ${toJsonb(physical_health_conditions)},
                ${physical_health_other || null},
                ${takes_physical_medications ?? null},
                ${physical_medications || null},
                ${toJsonb(mental_health_conditions)},
                ${mental_health_other || null},
                ${takes_mental_medications ?? null},
                ${mental_medications || null},
                ${is_pregnant || null},
                ${pregnancy_months ?? null},
                ${insurance_type || null},
                ${insurance_other || null},
                ${has_primary_provider ?? null},
                ${provider_name || null},
                ${provider_phone || null},
                ${education_level || null},
                ${past_year_employment || null},
                ${currently_employed ?? null},
                ${employer || null},
                ${monthly_income_pretax ? parseFloat(monthly_income_pretax) : null},
                ${toJsonb(employer_benefits)},
                ${toJsonb(income_sources)},
                ${income_sources_other || null},
                ${supportive_people_count ? parseInt(supportive_people_count) : null},
                ${is_dv_survivor ?? null},
                ${last_dv_episode || null},
                ${is_currently_fleeing ?? null},
                ${age_first_use ? parseInt(age_first_use) : null},
                ${toJsonb(substances_used)},
                ${substances_other || null},
                ${has_overdosed ?? null},
                ${overdose_count ? parseInt(overdose_count) : null},
                ${is_first_recovery_attempt ?? null},
                ${previous_attempt_count ? parseInt(previous_attempt_count) : null},
                ${has_received_treatment ?? null},
                ${treatment_types || null},
                ${recovery_notes || null}
            )
            RETURNING *
        `;

        return NextResponse.json({
            success: true,
            intake: result[0],
        });
    } catch (error) {
        console.error('Error saving intake:', error);
        return NextResponse.json({ error: 'Failed to save intake' }, { status: 500 });
    }
}
