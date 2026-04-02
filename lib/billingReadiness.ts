// ============================================================================
// PSS Billing Readiness Utility
// File: lib/billingReadiness.ts
//
// Computes billing hold reasons for a participant intake record.
// Used by:
//   - Participant detail page (billing status badge)
//   - Intake form (post-save summary)
//   - Participant list (billing-ready filter)
//   - API route (stored as billing_readiness_holds JSONB on save)
// ============================================================================

export interface BillingHold {
    code: string;
    severity: 'blocker' | 'warning';
    message: string;
    field: string;              // which field to fix
    section: string;            // which intake step/section
}

export interface BillingReadinessResult {
    ready: boolean;
    blockers: BillingHold[];
    warnings: BillingHold[];
    holds: BillingHold[];       // combined, blockers first
    summary: string;            // human-readable summary
}

/**
 * Computes billing readiness for a participant intake record.
 * 
 * This function works with the raw intake record shape (as returned from DB).
 * All fields are optional — missing fields produce holds, not errors.
 * 
 * Blockers = cannot submit any claim
 * Warnings = can submit but may get flagged/denied
 */
export function computeBillingReadiness(intake: Record<string, any>): BillingReadinessResult {
    const blockers: BillingHold[] = [];
    const warnings: BillingHold[] = [];

    // ── CONSENT ──────────────────────────────────────────────

    if (!intake.consent_signature_on_file) {
        blockers.push({
            code: 'NO_SIGNATURE',
            severity: 'blocker',
            message: 'Signature on file is required for claim submission (CMS-1500 Box 12/13)',
            field: 'consent_signature_on_file',
            section: 'consent',
        });
    }

    if (!intake.consent_to_bill_insurance) {
        blockers.push({
            code: 'NO_CONSENT_TO_BILL',
            severity: 'blocker',
            message: 'Consent to bill insurance has not been obtained',
            field: 'consent_to_bill_insurance',
            section: 'consent',
        });
    }

    if (!intake.consent_to_treat) {
        blockers.push({
            code: 'NO_CONSENT_TO_TREAT',
            severity: 'blocker',
            message: 'Consent to treat has not been obtained',
            field: 'consent_to_treat',
            section: 'consent',
        });
    }

    if (!intake.consent_to_release_info) {
        warnings.push({
            code: 'NO_ROI',
            severity: 'warning',
            message: 'Release of information not on file — payer may require ROI for claims',
            field: 'consent_to_release_info',
            section: 'consent',
        });
    }

    // ── INSURANCE ────────────────────────────────────────────

    const insType = intake.primary_insurance_type || intake.insurance_type;
    
    if (!insType || insType === 'none') {
        // Not necessarily a blocker — participant may be grant-funded
        warnings.push({
            code: 'NO_INSURANCE',
            severity: 'warning',
            message: 'No insurance on file — services cannot be billed to a payer',
            field: 'primary_insurance_type',
            section: 'insurance',
        });
    } else {
        // Has insurance — check for required identifiers
        if (!intake.primary_member_id) {
            blockers.push({
                code: 'NO_MEMBER_ID',
                severity: 'blocker',
                message: 'Insurance member/subscriber ID is missing',
                field: 'primary_member_id',
                section: 'insurance',
            });
        }

        if (insType === 'medicaid' && !intake.medicaid_mco) {
            warnings.push({
                code: 'NO_MCO',
                severity: 'warning',
                message: 'Medicaid MCO not specified — needed to route claims to correct managed care org',
                field: 'medicaid_mco',
                section: 'insurance',
            });
        }

        // Subscriber info when not self
        const rel = intake.primary_subscriber_relationship;
        if (rel && rel !== 'self') {
            if (!intake.primary_subscriber_name) {
                blockers.push({
                    code: 'NO_SUBSCRIBER_NAME',
                    severity: 'blocker',
                    message: 'Subscriber name is required when participant is not the policyholder',
                    field: 'primary_subscriber_name',
                    section: 'insurance',
                });
            }
            if (!intake.primary_subscriber_dob) {
                warnings.push({
                    code: 'NO_SUBSCRIBER_DOB',
                    severity: 'warning',
                    message: 'Subscriber date of birth is missing — some payers require it',
                    field: 'primary_subscriber_dob',
                    section: 'insurance',
                });
            }
        }

        if (!intake.insurance_card_on_file) {
            warnings.push({
                code: 'NO_INSURANCE_CARD',
                severity: 'warning',
                message: 'Insurance card not on file — recommended for verification',
                field: 'insurance_card_on_file',
                section: 'insurance',
            });
        }
    }

    // ── ELIGIBILITY ──────────────────────────────────────────

    if (!intake.eligibility_verified || intake.eligibility_status !== 'active') {
        if (insType && insType !== 'none') {
            blockers.push({
                code: 'ELIGIBILITY_NOT_VERIFIED',
                severity: 'blocker',
                message: 'Insurance eligibility has not been verified as active',
                field: 'eligibility_status',
                section: 'insurance',
            });
        }
    }

    // ── PRIOR AUTHORIZATION ──────────────────────────────────

    if (intake.prior_auth_required === true) {
        if (!intake.prior_auth_number) {
            blockers.push({
                code: 'NO_PRIOR_AUTH',
                severity: 'blocker',
                message: 'Prior authorization is required but auth number is missing',
                field: 'prior_auth_number',
                section: 'insurance',
            });
        }
        if (intake.prior_auth_end_date) {
            const endDate = new Date(intake.prior_auth_end_date);
            const today = new Date();
            if (endDate < today) {
                blockers.push({
                    code: 'PRIOR_AUTH_EXPIRED',
                    severity: 'blocker',
                    message: `Prior authorization expired on ${intake.prior_auth_end_date}`,
                    field: 'prior_auth_end_date',
                    section: 'insurance',
                });
            } else {
                // Warn if expiring within 14 days
                const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry <= 14) {
                    warnings.push({
                        code: 'PRIOR_AUTH_EXPIRING',
                        severity: 'warning',
                        message: `Prior authorization expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
                        field: 'prior_auth_end_date',
                        section: 'insurance',
                    });
                }
            }
        }
    }

    // ── DIAGNOSIS ────────────────────────────────────────────

    if (!intake.primary_diagnosis_code) {
        blockers.push({
            code: 'NO_DIAGNOSIS',
            severity: 'blocker',
            message: 'Primary diagnosis code (ICD-10) is required for claim submission',
            field: 'primary_diagnosis_code',
            section: 'clinical',
        });
    }

    if (intake.diagnosis_source === 'self_report') {
        blockers.push({
            code: 'DIAGNOSIS_SELF_REPORT',
            severity: 'blocker',
            message: 'Diagnosis is self-reported only — a verified diagnosis from a provider is required before claims can be submitted',
            field: 'diagnosis_source',
            section: 'clinical',
        });
    }

    // ── REFERRING PROVIDER ───────────────────────────────────

    if (!intake.referring_provider_npi) {
        warnings.push({
            code: 'NO_REFERRING_NPI',
            severity: 'warning',
            message: 'Referring provider NPI is missing — required by many Medicaid programs',
            field: 'referring_provider_npi',
            section: 'clinical',
        });
    }

    if (!intake.referral_order_on_file) {
        warnings.push({
            code: 'NO_REFERRAL_ORDER',
            severity: 'warning',
            message: 'Referral/order not on file — some states require documented referral for H0038',
            field: 'referral_order_on_file',
            section: 'clinical',
        });
    }

    // ── COMPOSE RESULT ───────────────────────────────────────

    const holds = [...blockers, ...warnings];
    const ready = blockers.length === 0;

    let summary: string;
    if (ready && warnings.length === 0) {
        summary = 'Billing ready — all required information is on file';
    } else if (ready) {
        summary = `Billing ready with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
    } else {
        summary = `Not billing ready — ${blockers.length} issue${blockers.length === 1 ? '' : 's'} must be resolved`;
    }

    return { ready, blockers, warnings, holds, summary };
}

/**
 * Minimal version for participant list badges.
 * Returns just the status and count, not full hold details.
 */
export function getBillingStatus(intake: Record<string, any> | null): {
    status: 'ready' | 'warnings' | 'not_ready' | 'no_intake';
    blockerCount: number;
    warningCount: number;
} {
    if (!intake) {
        return { status: 'no_intake', blockerCount: 0, warningCount: 0 };
    }

    // If we have pre-computed holds stored on the record, use those
    if (intake.billing_readiness_holds && Array.isArray(intake.billing_readiness_holds)) {
        const blockerCount = intake.billing_readiness_holds.filter(
            (h: any) => h.severity === 'blocker'
        ).length;
        const warningCount = intake.billing_readiness_holds.filter(
            (h: any) => h.severity === 'warning'
        ).length;
        const status = blockerCount > 0 ? 'not_ready' : warningCount > 0 ? 'warnings' : 'ready';
        return { status, blockerCount, warningCount };
    }

    // Otherwise compute on the fly
    const result = computeBillingReadiness(intake);
    const status = result.blockers.length > 0 ? 'not_ready' : result.warnings.length > 0 ? 'warnings' : 'ready';
    return { status, blockerCount: result.blockers.length, warningCount: result.warnings.length };
}
