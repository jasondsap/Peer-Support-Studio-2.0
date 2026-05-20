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

-- ─── 1a. Drop legacy dependent views ───────────────────────────────────────
-- The legacy participant-app flow created `pending_invitations_view`, which
-- references the token column and blocks us from widening it. Nothing in the
-- new codebase reads from it, so drop unconditionally.

DROP VIEW IF EXISTS pending_invitations_view;

-- ─── 1b. Widen the legacy token column ─────────────────────────────────────
-- The original schema used VARCHAR(12) for an auto-generated short code.
-- The new sender writes a 43-char base64url(32) token, so widen to TEXT.

ALTER TABLE assessment_invitations
    ALTER COLUMN token TYPE TEXT;

-- ─── 1c. Disarm any auto-token-generation trigger ──────────────────────────
-- The legacy schema had a BEFORE INSERT trigger that generated a short
-- token when NULL was inserted. Since we now write tokens explicitly, the
-- trigger is at best a no-op and at worst could overwrite our values.
-- Drop any trigger on this table whose name hints at token generation.

DO $$
DECLARE
    tname text;
BEGIN
    FOR tname IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'assessment_invitations'::regclass
          AND NOT tgisinternal
          AND (tgname ILIKE '%token%' OR tgname ILIKE '%generate%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON assessment_invitations', tname);
    END LOOP;
END $$;

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
