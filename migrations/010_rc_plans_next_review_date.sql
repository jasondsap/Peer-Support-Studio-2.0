-- Recovery Plans: review cadence
-- Applied to production via direct connection on 2026-06-11.
ALTER TABLE rc_plans ADD COLUMN IF NOT EXISTS next_review_date DATE;
