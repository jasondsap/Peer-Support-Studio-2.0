CREATE TABLE curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    source TEXT,
    total_hours NUMERIC(5,2),
    total_modules INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_curricula_org ON curricula(organization_id);

CREATE TABLE curriculum_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    module_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    minimum_hours NUMERIC(4,2),
    minimum_minutes INTEGER,
    learning_objectives TEXT[],
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(curriculum_id, module_number)
);

CREATE INDEX idx_curriculum_modules_curriculum ON curriculum_modules(curriculum_id);

CREATE TABLE curriculum_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enrolled_by UUID REFERENCES users(id),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn', 'paused')),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    UNIQUE(curriculum_id, participant_id)
);

CREATE INDEX idx_curriculum_enrollments_participant ON curriculum_enrollments(participant_id);
CREATE INDEX idx_curriculum_enrollments_curriculum ON curriculum_enrollments(curriculum_id);
CREATE INDEX idx_curriculum_enrollments_org ON curriculum_enrollments(organization_id);

CREATE TABLE module_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES curriculum_enrollments(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    facilitator_id UUID REFERENCES users(id),
    duration_minutes INTEGER,
    score NUMERIC(5,2),
    notes TEXT,
    UNIQUE(enrollment_id, module_id)
);

CREATE INDEX idx_module_completions_enrollment ON module_completions(enrollment_id);

CREATE TABLE curriculum_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facilitator_id UUID REFERENCES users(id),
    location_id UUID REFERENCES locations(id),
    session_date DATE NOT NULL,
    start_time TIME,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_curriculum_sessions_org ON curriculum_sessions(organization_id);
CREATE INDEX idx_curriculum_sessions_date ON curriculum_sessions(session_date);

CREATE TABLE session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES curriculum_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES curriculum_enrollments(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused', 'late')),
    notes TEXT,
    UNIQUE(session_id, participant_id)
);

CREATE INDEX idx_session_attendance_session ON session_attendance(session_id);
CREATE INDEX idx_session_attendance_participant ON session_attendance(participant_id);
