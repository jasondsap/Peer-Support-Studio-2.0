CREATE TABLE IF NOT EXISTS org_kiosks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    token TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT 'Front desk kiosk',
    allow_self_enroll BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kiosk_checkin_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id UUID REFERENCES org_kiosks(id) ON DELETE CASCADE,
    ip TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE participants ADD COLUMN IF NOT EXISTS kiosk_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_kiosk_code
    ON participants(organization_id, kiosk_code) WHERE kiosk_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kiosk_attempts_rate
    ON kiosk_checkin_attempts(kiosk_id, ip, created_at);

INSERT INTO org_kiosks (organization_id, token)
SELECT o.id, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM org_kiosks k WHERE k.organization_id = o.id
);

DO $$
DECLARE
    r RECORD;
    newcode TEXT;
    alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    i INT;
BEGIN
    FOR r IN SELECT id FROM participants WHERE kiosk_code IS NULL AND status = 'active' LOOP
        LOOP
            newcode := '';
            FOR i IN 1..8 LOOP
                newcode := newcode || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
            END LOOP;
            BEGIN
                UPDATE participants SET kiosk_code = newcode WHERE id = r.id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
            END;
        END LOOP;
    END LOOP;
END $$;
