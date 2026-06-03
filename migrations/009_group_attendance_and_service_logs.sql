CREATE TABLE IF NOT EXISTS group_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    activity_type TEXT NOT NULL DEFAULT 'recovery_group',
    primary_audience TEXT,
    activity_date DATE NOT NULL,
    start_time TIME,
    duration_minutes INTEGER,
    facilitator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    headcount_total INTEGER,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES group_activities(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    attendance_status TEXT NOT NULL DEFAULT 'present',
    source TEXT NOT NULL DEFAULT 'staff',
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (activity_id, participant_id)
);

CREATE TABLE IF NOT EXISTS service_resource_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    log_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_cost NUMERIC(10,2),
    total_hours NUMERIC(6,2),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'other',
    name TEXT NOT NULL,
    unit TEXT,
    default_cost NUMERIC(10,2),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_group_activities_org_date ON group_activities(organization_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_group_activities_type ON group_activities(organization_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_group_attendance_activity ON group_attendance(activity_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_participant ON group_attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_org ON group_attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_resource_logs_org_type_date ON service_resource_logs(organization_id, log_type, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_service_resource_logs_participant ON service_resource_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_resource_items_org ON resource_items(organization_id, active);
