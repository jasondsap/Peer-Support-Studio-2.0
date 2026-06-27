-- ============================================================================
-- Phase 3 migration — Efficiency & Polish
-- Run in the Neon SQL Editor against the "Peer Support Studio" database.
-- Idempotent (IF NOT EXISTS); safe to re-run. Run AFTER PHASE2_migration.sql.
-- ============================================================================

-- ── Tasks / reminders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    assigned_to     uuid,                       -- PSS responsible (users.id)
    participant_id  uuid,                        -- optional subject
    title           text NOT NULL,
    description     text,
    task_type       text,                        -- 'note_due' | 'review_due' | 'plan_review' | 'follow_up' | 'custom'
    due_date        date,
    priority        text NOT NULL DEFAULT 'normal',  -- 'low' | 'normal' | 'high'
    status          text NOT NULL DEFAULT 'open',    -- 'open' | 'done' | 'dismissed'
    created_by      uuid,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_queue
  ON tasks (organization_id, assigned_to, status, due_date);

-- ── Note templates + reuse ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    name            text NOT NULL,
    description     text,
    body            jsonb NOT NULL,              -- prefill for the note form
    is_shared       boolean NOT NULL DEFAULT true,
    created_by      uuid,
    use_count       integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_note_templates_org ON note_templates (organization_id);

-- ── Org-scope saved lessons (so teams share their built lessons) ────────────
ALTER TABLE saved_lessons ADD COLUMN IF NOT EXISTS organization_id uuid;
-- Backfill: set organization_id from each creator's current org. Review before running.
-- UPDATE saved_lessons sl SET organization_id = (
--   SELECT om.organization_id FROM organization_members om
--   WHERE om.user_id = sl.user_id ORDER BY om.created_at LIMIT 1
-- ) WHERE sl.organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_lessons_org ON saved_lessons (organization_id);

-- ── Link lessons to delivery (curriculum module / group activity) ───────────
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS lesson_id uuid;       -- saved_lessons.id or system template id
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS lesson_source text;   -- 'saved' | 'template'
ALTER TABLE group_activities  ADD COLUMN IF NOT EXISTS lesson_id uuid;
ALTER TABLE group_activities  ADD COLUMN IF NOT EXISTS lesson_source text;

-- ── Intake document attachments (S3-backed) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS participant_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    participant_id  uuid NOT NULL,
    intake_id       uuid,
    doc_type        text,                        -- 'insurance_card' | 'consent' | 'referral_order' | 'other'
    file_name       text,
    s3_key          text NOT NULL,
    content_type    text,
    size_bytes      integer,
    uploaded_by     uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_participant_documents
  ON participant_documents (organization_id, participant_id);

-- ── Messaging delivery / read receipts ──────────────────────────────────────
-- messages.status exists but is never advanced; ensure columns for delivery.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at      timestamptz;
-- crisis flagging on inbound participant content (messages + journal)
ALTER TABLE messages        ADD COLUMN IF NOT EXISTS flagged_crisis boolean NOT NULL DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS flagged_crisis boolean NOT NULL DEFAULT false;
