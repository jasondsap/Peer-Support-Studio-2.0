/**
 * Shared types for the assessment-invitation flow.
 *
 * Ported from ddor-platform with PSS-specific naming:
 *   - assessmentType uses PSS values ('barc10' | 'mirc28'), no underscore
 *   - Adds organizationId for multi-tenant scoping
 */

import type { AssessmentType } from '@/lib/assessments/questionnaires';
export { ASSESSMENT_LABELS } from '@/lib/assessments/questionnaires';
export type { AssessmentType };

export type AssessmentInviteChannel = 'email' | 'sms';

export type AssessmentInviteStatus =
    | 'sent'
    | 'opened'
    | 'completed'
    | 'expired'
    | 'superseded';

export interface SendAssessmentInviteInput {
    organizationId: string;
    participantId: string;
    assessmentType: AssessmentType;
    channel: AssessmentInviteChannel;
    /** Internal user UUID of the staff member initiating the send */
    sentByUserId: string;
}

export interface SendAssessmentInviteResult {
    invitationId: string;
    channel: AssessmentInviteChannel;
    assessmentType: AssessmentType;
    success: boolean;
    message: string;
    providerMessageId?: string;
}
