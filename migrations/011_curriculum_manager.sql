/* Curriculum Manager schema delta.
   The base tables (curricula, curriculum_modules, curriculum_enrollments,
   module_completions, curriculum_sessions, session_attendance) already exist
   in the database from an earlier spec migration. This migration only applies
   the scoping fix: add organization_id to the two PHI-bearing child tables that
   were created without it, so every query can filter by organization_id directly
   per the multi-tenant rule in CLAUDE.md. Additive and idempotent. */

ALTER TABLE module_completions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE session_attendance ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_module_completions_org ON module_completions(organization_id);

CREATE INDEX IF NOT EXISTS idx_module_completions_enrollment ON module_completions(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_session_attendance_org ON session_attendance(organization_id);
