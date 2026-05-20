-- ============================================================================
-- assessment_invitations — extend existing table for the send-by-email/SMS
-- pattern ported from ddor-platform.
--
-- The table already exists from an earlier flow that handed tokens off to an
-- external participant-assessment-app (now retired). This migration:
--   1. Adds the columns the new sender needs (delivery_method, sent_to,
--      provider tracking, IP/UA capture, snapshot fields)
--   2. Extends the status check to include 'superseded'
--   3. Backfills delivery_method from the old sent_via column where possible
--
-- Run in the Neon SQL Editor. Safe to re-run (every statement is guarded).
-- ============================================================================

-- ─── 1. New columns ────────────────────────────────────────────────────────

ALTER TABLE assessment_invitations
    ADD COLUMN IF NOT EXISTS delivery_method          TEXT,
    ADD COLUMN IF NOT EXISTS sent_to                  TEXT,
    ADD COLUMN IF NOT EXISTS send_provider_message_id TEXT,
    ADD COLUMN IF NOT EXISTS send_status              TEXT,
    ADD COLUMN IF NOT EXISTS send_error               TEXT,
    ADD COLUMN IF NOT EXISTS response_ip              TEXT,
    ADD COLUMN IF NOT EXISTS response_user_agent      TEXT,
    ADD COLUMN IF NOT EXISTS participant_first_name   TEXT,
    ADD COLUMN IF NOT EXISTS organization_name        TEXT,
    ADD COLUMN IF NOT EXISTS recovery_assessment_id   UUID
        REFERENCES recovery_assessments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS opened_at                TIMESTAMPTZ;

-- ─── 2. Backfill delivery_method from legacy sent_via ──────────────────────
-- Old values: 'link' | 'sms' | 'email' (or NULL). 'link' meant a generic
-- copy/paste share with no specific channel — leave as NULL.

UPDATE assessment_invitations
SET delivery_method = CASE
        WHEN sent_via = 'sms'   THEN 'text'
        WHEN sent_via = 'email' THEN 'email'
        ELSE delivery_method
    END
WHERE delivery_method IS NULL;

-- ─── 3. Extend the status check to allow 'superseded' ──────────────────────
-- We don't know the exact name of the existing check constraint, so look it
-- up dynamically and drop it first. If no check exists, this is a no-op.

DO $$
DECLARE
    cname text;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'assessment_invitations'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%';

    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE assessment_invitations DROP CONSTRAINT %I', cname);
    END IF;
END $$;

ALTER TABLE assessment_invitations
    ADD CONSTRAINT assessment_invitations_status_check
    CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'expired', 'superseded', 'cancelled'));

-- ─── 4. Indexes for the new access patterns ────────────────────────────────

-- Supersede-prior-pending lookup (org, participant, type, channel)
CREATE INDEX IF NOT EXISTS assessment_invitations_supersede_idx
    ON assessment_invitations (organization_id, participant_id, assessment_type, delivery_method, status);

-- Token lookup is already covered by the existing unique index on token.

-- ─── 5. (Optional, non-destructive) ─────────────────────────────────────────
-- The legacy `sent_via`, `message`, and the auto-token-generation trigger
-- are NOT dropped here — leaving them avoids breaking anything that still
-- references them. They become unused by the new flow.
