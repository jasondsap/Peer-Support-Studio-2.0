-- ============================================================================
-- Phase 1 migration — Close the Loops
-- Run in the Neon SQL Editor against the "Peer Support Studio" database.
-- All statements are idempotent (IF NOT EXISTS) and safe to re-run.
-- ============================================================================

-- ── Session note lifecycle: draft → submitted → approved/locked ─────────────
-- `status` already exists on session_notes (legacy: draft/review/approved).
-- We add an explicit supervisory review lifecycle alongside it so existing
-- reads keep working.
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS review_status   text NOT NULL DEFAULT 'draft';
  -- review_status ∈ ('draft','submitted','approved','changes_requested')
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS submitted_at    timestamptz;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS submitted_by    uuid;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS reviewed_at     timestamptz;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS reviewed_by     uuid;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS review_notes    text;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS is_locked       boolean NOT NULL DEFAULT false;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS locked_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_session_notes_review
  ON session_notes (organization_id, review_status)
  WHERE NOT is_archived;

-- ── Immutable version history for notes (audit-grade edit trail) ────────────
CREATE TABLE IF NOT EXISTS session_note_versions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_note_id  uuid NOT NULL,
    organization_id  uuid,
    version_number   integer NOT NULL,
    snapshot         jsonb NOT NULL,       -- full note row at time of edit
    edited_by        uuid,
    edit_reason      text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_note_versions_note
  ON session_note_versions (session_note_id, version_number DESC);

-- ── Note Reviewer: link a rubric review back onto the note ──────────────────
-- note_reviews already exists (user-scoped). Add an optional FK to the note it
-- scored so the score/billable flag can be surfaced on the note itself.
ALTER TABLE note_reviews ADD COLUMN IF NOT EXISTS session_note_id uuid;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS last_review_score    integer;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS last_review_billable boolean;
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS last_reviewed_at     timestamptz;

-- ── Journal review loop: record who/when the PSS reviewed a shared entry ────
-- pss_viewed boolean already exists. Add attribution.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS pss_viewed_by uuid;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS pss_viewed_at timestamptz;

-- ── Intake draft/resume ─────────────────────────────────────────────────────
-- participant_intakes already stores a `status`. Ensure 'draft' is allowed and
-- track last-saved step for resume. (status is free-text today; no enum change
-- required — code writes 'draft' until the wizard is completed.)
ALTER TABLE participant_intakes ADD COLUMN IF NOT EXISTS last_step       integer;
ALTER TABLE participant_intakes ADD COLUMN IF NOT EXISTS last_saved_at   timestamptz;

-- ── Assessment → goal linkage (provenance) ──────────────────────────────────
-- Lets a goal created from an assessment recommendation point back to its source.
ALTER TABLE saved_goals ADD COLUMN IF NOT EXISTS source_assessment_id uuid;
ALTER TABLE saved_goals ADD COLUMN IF NOT EXISTS source_type          text; -- e.g. 'assessment_recommendation'
