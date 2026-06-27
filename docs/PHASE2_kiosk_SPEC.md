# Phase 2 Spec — Self-Service Kiosk (check-in)

**Source:** RDP demo (`docs/Meeting Transcripts.pdf`). Builds on Phase 1 (`group_activities` + `group_attendance`).
**Decisions (confirmed):** identify by **Name + Date of Birth OR a per-participant code**; **check-in only** (no self-enroll in v1); confirmation shows **first name only**. Every org gets a kiosk.
**Proven pattern reused:** PSS's public assessment-invite route (`/api/assessment-invitations/[token]`) — no auth, the **token is the credential**, no global middleware. The kiosk mirrors this exactly.
**Branch:** `feature/kiosk`. **Reviewer note:** spec for review before code; nothing built yet.

---

## 1. Data model — `migrations/010_kiosk.sql` (additive)

```sql
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
```

- **Token** = 32+ char random (high entropy), stored as-is and looked up directly (parity with `assessment_invitations.token`); rotatable + `active` flag for revocation. (Hashing-at-rest is a possible hardening follow-up.)
- **`participants.kiosk_code`** = 8-char unguessable alphanumeric (no ambiguous chars like O/0/I/1), unique per org.

### Provisioning ("every org has a kiosk")
- **Backfill:** one `org_kiosks` row per existing org (16).
- **Backfill:** generate a `kiosk_code` for every existing **active** participant.
- **Lazy/auto:** new orgs get a kiosk on first Settings→Kiosk visit; new participants get a `kiosk_code` at creation (extend `POST /api/participants`).

---

## 2. Public API — token-validated, **no `getSession`** (mirrors the assessment route)

`export const runtime = 'nodejs'`. Captures `x-forwarded-for` IP + `user-agent`; `logAuditEvent(null, orgId, …)` for provenance.

### `GET /api/kiosk/[token]`
Validate token (404 if unknown/inactive). Returns **non-PHI** kiosk context: org name, optional location, and **today's** `group_activities` for that org/location (`id, name, start_time`). Updates `last_used_at`. Nothing about participants.

### `POST /api/kiosk/[token]/checkin`
Body: `{ activity_id, method: 'name_dob' | 'code', first_name?, last_name?, dob?, code? }`.
1. Validate token + that `activity_id` belongs to the token's org and is dated today.
2. **Rate-limit / lockout:** if ≥ 5 failed attempts from this IP+kiosk in the last 10 min → generic "Please see staff," no match attempt.
3. **Match (exact, org-scoped, status='active'):**
   - `name_dob`: `LOWER(first_name)=LOWER($1) AND LOWER(last_name)=LOWER($2) AND date_of_birth=$3`.
   - `code`: `kiosk_code = $1` (case-insensitive).
4. **Exactly one match** → `INSERT INTO group_attendance (… source='kiosk', recorded_by=NULL) ON CONFLICT (activity_id, participant_id) DO NOTHING`; log success; return `{ matched: true, first_name }`.
5. **Zero or multiple matches** → log failed attempt; return **identical generic** `{ matched: false }` (no enumeration, no "did you mean").
6. Every attempt (success/fail) → row in `kiosk_checkin_attempts` + `logAuditEvent` with IP/UA.

### Admin API — `GET/POST /api/org-kiosks` (authed, `requireOrgRole(['admin','owner'])`)
View the org's kiosk(s) + URL, **rotate token**, toggle `active`.

---

## 3. Pages

### Public kiosk — `app/kiosk/[token]/page.tsx` (`'use client'`, no session, full-screen)
Tablet-optimized, large touch targets, auto-resets after each check-in. Screens:
1. **Welcome** — org name; "Check in to today's group."
2. **Pick event** — buttons for today's activities (from `GET`).
3. **Identify** — toggle between **Name + DOB** and **Enter your code**.
4. **Confirm** — "✓ Checked in, {firstName}." → 3-sec auto-return to Welcome.
5. **Not found** — "We couldn't find you — please check in with staff." (generic).
No links to the authenticated app; intended to run in iOS **Guided Access**.

### Admin — Settings → Kiosk (`app/settings/kiosk/page.tsx` or a card in `settings/organization`)
- Show the kiosk **URL** (copyable) + **QR code**, `active` toggle, **Rotate token** (invalidates the old URL), last-used time.
- Guidance: open URL on the iPad, enable Guided Access.

### Participant record
- Show the participant's **`kiosk_code`** on `app/participants/[id]` (Overview) so staff can give it to them; allow regenerate.

---

## 4. Security checklist (public surface touching PHI)
- No PHI rendered beyond a matched first name on confirmation; no participant lists ever.
- **No enumeration:** identical response for no-match vs multi-match; exact matching only.
- **Rate limiting + lockout** per IP+kiosk via `kiosk_checkin_attempts`.
- **Token**: high entropy, `active` flag, **rotatable/revocable**; bound to one org (+ optional location).
- **Audit** every check-in attempt with IP + user-agent (`logAuditEvent(null, orgId, …)`).
- Kiosk can only read **today's** activities for its own org; no history, no cross-org.
- Codes are 8-char unambiguous; code-only check-in is low-stakes (no PHI returned) and rate-limited.

## 5. Out of scope (later)
- **Self-enrollment** at kiosk (would land in a `kiosk_pending` quarantine for staff approval).
- Kiosk usage analytics; multi-tablet management UI (table already supports many per org).
- Phone/email as additional identifiers.

## 6. Commit plan
1. `migrations: org_kiosks, kiosk attempts, participant kiosk_code`
2. `api: public kiosk token + check-in (rate-limited, no enumeration)`
3. `feat: public kiosk check-in page`
4. `api+feat: admin kiosk settings (URL/QR, rotate token)`
5. `feat: show participant kiosk code on record + generate on create`
6. `data: backfill kiosks for all orgs + codes for active participants`

Schema migration applied to prod manually (additive), then code merged + deployed — same rollout as Phases 1.
```
