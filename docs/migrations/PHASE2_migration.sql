-- ============================================================================
-- Phase 2 migration — Standard-of-Work Spine
-- Run in the Neon SQL Editor against the "Peer Support Studio" database.
-- Idempotent (IF NOT EXISTS); safe to re-run. Run AFTER PHASE1_migration.sql.
-- ============================================================================

-- ── Reassessment cadence ────────────────────────────────────────────────────
-- One schedule row per participant + assessment type. next_due_date drives the
-- "due / overdue for reassessment" surface on the PSS work-queue.
CREATE TABLE IF NOT EXISTS assessment_schedules (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL,
    participant_id    uuid NOT NULL,
    assessment_type   text NOT NULL,            -- 'barc10' | 'mirc28' | 'phq4' | ...
    interval_days     integer NOT NULL DEFAULT 90,
    next_due_date     date,
    last_completed_at timestamptz,
    is_active         boolean NOT NULL DEFAULT true,
    created_by        uuid,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (participant_id, assessment_type)
);
CREATE INDEX IF NOT EXISTS idx_assessment_schedules_due
  ON assessment_schedules (organization_id, next_due_date)
  WHERE is_active;

-- ── Recovery plan versioning (immutable signed-artifact snapshots) ──────────
-- "Revise Plan" today mutates a signed plan in place. Snapshot the full plan
-- (plan + domains/goals/activities/outcomes/signatures) here before unlocking.
CREATE TABLE IF NOT EXISTS rc_plan_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rc_plan_id      uuid NOT NULL,
    organization_id uuid,
    version_number  integer NOT NULL,
    snapshot        jsonb NOT NULL,
    reason          text,
    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rc_plan_versions_plan
  ON rc_plan_versions (rc_plan_id, version_number DESC);

-- ── Referral loop (treatment locator + general referrals) ───────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL,
    participant_id   uuid NOT NULL,
    referred_to      text NOT NULL,             -- facility / organization name
    referral_type    text,                      -- 'treatment' | 'housing' | 'benefits' | ...
    contact_info     jsonb,                     -- phone/website/address
    reason           text,
    status           text NOT NULL DEFAULT 'referred',
        -- 'referred' | 'contacted' | 'enrolled' | 'declined' | 'closed'
    referred_by      uuid,
    referred_at      timestamptz NOT NULL DEFAULT now(),
    follow_up_date   date,
    closed_at        timestamptz,
    outcome          text,
    notes            text,
    source           jsonb,                     -- raw SAMHSA locator payload, if any
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_participant
  ON referrals (organization_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_referrals_followup
  ON referrals (organization_id, follow_up_date)
  WHERE status NOT IN ('enrolled','declined','closed');

-- ── Group / curriculum → note + billing bridge ──────────────────────────────
-- Let a session note record which group activity / curriculum session it
-- documents, and let a service-log (billable) entry reference its origin.
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS group_activity_id     uuid;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS curriculum_session_id uuid;
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS group_activity_id     uuid;
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS curriculum_session_id uuid;
