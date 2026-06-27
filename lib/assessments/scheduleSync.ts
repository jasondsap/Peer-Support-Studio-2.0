import { sql } from '@/lib/db';

// Instruments that support a reassessment cadence today.
const SCHEDULABLE_TYPES = new Set(['barc10', 'mirc28']);
const DEFAULT_INTERVAL_DAYS = 90;

/**
 * Keep a participant's reassessment cadence in sync whenever an assessment is
 * completed (staff-administered, comprehensive, or participant self-complete via
 * invite link). It:
 *   - advances an EXISTING schedule: stamps last_completed_at = now() and pushes
 *     next_due_date out by that schedule's own interval, and
 *   - auto-creates a default 90-day cadence if none exists,
 * so the "Assessments Due" work-queue loop is self-sustaining without anyone
 * remembering to click "Reassessed today".
 *
 * Best-effort: this NEVER throws — a scheduling hiccup must never block saving
 * the assessment itself.
 */
export async function syncScheduleOnAssessment(params: {
    organizationId: string | null | undefined;
    participantId: string | null | undefined;
    assessmentType: string | null | undefined;
    userId?: string | null;
}): Promise<void> {
    const { organizationId, participantId, assessmentType, userId } = params;
    try {
        if (!organizationId || !participantId || !assessmentType) return;
        if (!SCHEDULABLE_TYPES.has(assessmentType)) return;

        await sql`
            INSERT INTO assessment_schedules (
                organization_id, participant_id, assessment_type,
                interval_days, last_completed_at, next_due_date, is_active, created_by
            ) VALUES (
                ${organizationId}, ${participantId}, ${assessmentType},
                ${DEFAULT_INTERVAL_DAYS}, now(),
                (CURRENT_DATE + ${DEFAULT_INTERVAL_DAYS}::int), true, ${userId || null}
            )
            ON CONFLICT (participant_id, assessment_type) DO UPDATE SET
                last_completed_at = now(),
                next_due_date = (CURRENT_DATE + assessment_schedules.interval_days),
                is_active = true,
                updated_at = now()
        `;
    } catch (e) {
        // Non-fatal: log and move on so the assessment save is never blocked.
        console.error('syncScheduleOnAssessment failed (non-fatal):', e);
    }
}
