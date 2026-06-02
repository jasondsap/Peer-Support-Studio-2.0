CREATE TABLE IF NOT EXISTS lesson_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    category_order INTEGER NOT NULL DEFAULT 99,
    session_type TEXT NOT NULL,
    setting_type TEXT NOT NULL,
    session_length TEXT,
    recovery_model TEXT,
    group_size TEXT,
    group_composition TEXT,
    facilitator_guide TEXT,
    participant_handout TEXT,
    lesson_json TEXT,
    gamma_presentation_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_templates_category ON lesson_templates(category);
CREATE INDEX IF NOT EXISTS idx_lesson_templates_session_type ON lesson_templates(session_type);
CREATE INDEX IF NOT EXISTS idx_lesson_templates_setting_type ON lesson_templates(setting_type);
CREATE INDEX IF NOT EXISTS idx_lesson_templates_published ON lesson_templates(is_published);

ALTER TABLE saved_lessons
    ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES lesson_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_lessons_source_template ON saved_lessons(source_template_id);
CREATE INDEX IF NOT EXISTS idx_saved_lessons_category ON saved_lessons(category);
