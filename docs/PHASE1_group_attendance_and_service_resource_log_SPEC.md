# Phase 1 Spec — Group Attendance + Service & Resource Log

**Source:** RDP demo (see `docs/Meeting Transcripts.pdf`, `docs/Logs.pdf`).
**Scope of this phase:** Two of the three RDP-inspired features — (1) **Group Activity & Attendance** and (3) **Service & Resource Log**. The **Self-Service Kiosk** (feature 2) is a later, separately-designed phase; its check-in flow writes into the `group_attendance` table built here, so this phase is its prerequisite.
**Branch:** `feature/group-attendance-and-service-log`
**Reviewer note:** This is a spec for review *before* any code is written. Nothing here has been built or applied.

---

## 1. Why these are separate from existing PSS tables

PSS already has adjacent infrastructure that is the **wrong fit**, so we add new lightweight tables rather than overload existing ones:

- `service_plans` / `/service-log` = **billable, supervisor-approved service delivery** (draft → planned → approved → completed → verified, with `service_codes` and `service_approvals`). Operational logs (transport/volunteer/supplies) are *not* billable units and don't belong in that approval workflow.
- `curriculum_sessions` + `session_attendance` = **structured, enrollment-bound multi-week classes**. Drop-in recovery groups (SMART Recovery, Recovery Dharma, Outreach) have no enrollment and no module — forcing them through curricula would be wrong.

Decision (confirmed): build **new lightweight tables**, fully `organization_id`-scoped, following existing PSS conventions.

---

## 2. Database migration — `migrations/009_group_attendance_and_service_logs.sql`

No `--` line comments anywhere (Jason pastes into the Neon SQL Editor, which rejects them). Use blank lines for separation. Migration is **additive only**.

```sql
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
```

### Controlled vocabularies (enforced in app code, not DB enums, matching PSS convention)
- `group_activities.activity_type`: `recovery_group | outreach | community_event | class | other`
- `group_activities.primary_audience`: `recoverees | family | community | youth | general`
- `group_activities.status`: `active | archived`
- `group_attendance.attendance_status`: `present | excused | no_show`
- `group_attendance.source`: `staff | kiosk` (kiosk reserved for Phase 2)
- `service_resource_logs.log_type`: `transportation | volunteer | supplies`
- `resource_items.category`: `clothing | food | harm_reduction | hygiene | other`

### `service_resource_logs.details` JSONB shapes
- **transportation**: `{ mode, mileage, start_point, end_point, purpose }` → also set `total_cost` (e.g. Uber fare) and `total_hours` if tracked.
- **volunteer**: `{ activity, role }` → set `total_hours`.
- **supplies**: `{ items: [{ item_id, name, category, quantity, unit_cost }] }` → `total_cost` = sum(quantity × unit_cost), computed server-side.

`total_cost` / `total_hours` are denormalized onto the row so grant reports can `SUM()` across all three types without parsing JSON.

---

## 3. API routes (mirror existing PSS patterns)

All routes: `getSession()` → 401 if no `session.user.id`; resolve context with `getInternalUserId(session.user.id, session.user.email)` + `organizationId = session.currentOrganization?.id` (same `getUserContext` helper shape as `app/api/service-log/route.ts`). Every query filtered by `organization_id`. Errors as `NextResponse.json({ error }, { status })`. PHI writes call `logAuditEvent(userId, orgId, action, resourceType, resourceId, details)`.

### 3.1 `app/api/group-activities/route.ts`
- **GET** — list activities for the org. Query params: `from`, `to` (date range), `type`, `location_id`, `limit`. Returns each activity plus a computed `attendee_count` (`COUNT` from `group_attendance`).
- **POST** — create an activity. Role: `pss` and up (`requireOrgRole(orgId, ['pss','supervisor','admin','owner'])`). Audit `group_activity.create`.

### 3.2 `app/api/group-activities/[id]/route.ts`
- **GET** — single activity with full roster (join `group_attendance` → `participants` for `first_name/last_name/preferred_name`). Async `params` (`await params`), matching repo convention.
- **PATCH** — edit activity fields / set `headcount_total` / archive (`status='archived'`). Role: creator or `supervisor`+.
- **DELETE** — soft-archive (hard delete reserved, per PSS convention).

### 3.3 `app/api/group-activities/[id]/attendance/route.ts`
- **POST** — add one or many attendees: body `{ participantIds: [...], attendance_status?, notes? }`. Inserts `group_attendance` rows (`ON CONFLICT (activity_id, participant_id) DO NOTHING`), `source='staff'`, `recorded_by=userId`. Audit `group_attendance.create` per participant.
- **DELETE** — remove an attendee (`?participant_id=` or `?attendance_id=`).
- Participant picker reuses the existing org participant-fetch (the same source `getParticipantsByOrg` powers — exact endpoint confirmed at build; falls back to a thin `GET /api/group-activities/participants?q=` typeahead if no reusable list endpoint exists).

### 3.4 `app/api/service-resource-log/route.ts`
- **GET** — list logs. Params: `log_type`, `from`, `to`, `participant_id`, `limit`. Returns rows + participant name when present.
- **POST** — create a log. Server computes `total_cost` for supplies from `items`. Role `pss`+. Audit `service_resource_log.create` (PHI only when `participant_id` set).
- **PATCH** — edit / archive. **GET `?export=csv`** — streamed CSV for grant reporting (columns flattened: date, type, participant, totals, item breakdown).

### 3.5 `app/api/resource-items/route.ts`
- **GET** — active catalog items for the org (for the supplies dropdown).
- **POST / PATCH** — manage catalog. Role: `admin`/`owner`.

---

## 4. Pages & UI (Tailwind only; brand palette `#0E2235`/`#1A73A8`/`#30B27A`; person-first copy)

### 4.1 `/groups` — Group Activities list
Mirrors the list pattern we just shipped for `/lesson-library` (header breadcrumb Dashboard › Group Activities, search, filters by type/date/location, page-size selector, pagination). Each row: name, type badge, date/time, location, facilitator, **attendee count** (or "headcount: N" when bulk-only). Primary action **"+ New Activity"**; row click → detail.

### 4.2 `/groups/[id]` — Activity detail + roster
- Activity metadata header (editable for supervisor+).
- **Roster table**: participant name, status (present/excused/no-show toggle), check-in time, source badge (staff/kiosk), remove.
- **"Add attendee"** button → participant lookup modal (search the org's active participants) → multi-select add.
- **Bulk headcount** field (`headcount_total`) for groups that only need an aggregate count (RDP's "general discount" / 14-attendees case) — usable with or without individual rows.

### 4.3 `/groups/new` — Create activity
Simple form: name, type, audience, date, start time, duration, location, facilitator, notes. (Inline modal acceptable instead of a route.)

### 4.4 `/service-resource-log` — Service & Resource Log
- Tab switcher: **Transportation | Volunteer | Supplies** (single unified page, per your "one module not three" call).
- List of logs for the active tab with date, participant (optional), key fields, total cost/hours; CSV **Export** button.
- **"+ New entry"** opens a type-specific form:
  - Transportation: participant (optional), date, mode, mileage, start/end point, cost, purpose, notes.
  - Volunteer: volunteer (participant/optional), date, activity, role, hours, notes.
  - Supplies: participant (optional), date, **line items** chosen from `resource_items` dropdown with quantity (auto-totals cost), notes.
- Settings affordance (admin) to manage the `resource_items` catalog.

### 4.5 Participant record integration — `app/participants/[id]/page.tsx`
Add two read-only cards/sections to the participant timeline:
- **Group Attendance** — activities this participant attended (date, activity name, status).
- **Service & Resources** — transportation/volunteer/supplies entries tied to this participant.

### 4.6 Dashboard tiles — `app/page.tsx`
Two new tiles in `documentationTools` (matching the existing `{title, description, icon, href, badge, color}` shape):
- **Group Attendance** → `/groups`, icon `Users`/`CalendarCheck`.
- **Service & Resource Log** → `/service-resource-log`, icon `ClipboardList`/`HandHeart`.

---

## 5. Roles & audit
- Log/create attendance and resource entries: `pss | supervisor | admin | owner`.
- Edit/archive activities, manage `resource_items` catalog: `supervisor | admin | owner` (`requireOrgRole`).
- `logAuditEvent` on every attendance insert/delete and resource-log create/update (PHI-bearing when a participant is attached). Audit failures never break the request (existing behavior).

## 6. Reporting / grant export (built in from day one)
- Group attendance: counts per activity, per type, per date range; participant-level roster export.
- Service & resource: `SUM(total_cost)`, `SUM(total_hours)`, counts per `log_type` and date range; CSV export endpoint.
- These satisfy the "unglamorous but essential grant-reporting" need called out for the operational logs.

## 7. Out of scope for Phase 1 (later phases)
- **Self-Service Kiosk** (Phase 2) — public/QR check-in + self-enroll; writes into `group_attendance` (`source='kiosk'`). Needs its own security design (no PHI display, no enumeration, rate limiting, staff-review quarantine, token rotation).
- Recurring-activity templates / auto-scheduling.
- Advanced reporting dashboards / charts.
- Telephonic Recovery Support and Brief Interaction record types (other RDP "Support & Service" types).

## 8. Testing checklist
- Migration runs clean (validate on a throwaway Neon **branch** — and confirm isolation with a sentinel read before any writes; see memory `neon-branch-writes-hit-prod`).
- Create activity → add 3 attendees → counts/roster correct; duplicate add is a no-op (UNIQUE).
- Bulk headcount works with zero individual rows.
- Cross-org isolation: user in org A cannot see/POST activities or logs for org B.
- Supplies total_cost computed correctly from line items; CSV export opens in Excel.
- Attendance + resource entries appear on the participant record.
- Unauthenticated requests to all routes → 401; role-gated actions → 403 for `pss` where supervisor required.
- Dashboard tiles route correctly.

## 9. Commit plan
1. `migrations: group activities, attendance, service & resource logs`
2. `api: group activities + attendance`
3. `feat: group activities list + detail/roster pages`
4. `api: service & resource log + resource items`
5. `feat: service & resource log page (transport/volunteer/supplies)`
6. `feat: participant record attendance + resource cards`
7. `feat: dashboard tiles + CSV export`

One PR: `feature/group-attendance-and-service-log`. **Schema migration applied to prod manually by Jason** (Neon SQL Editor) before deploy, per the lesson-library rollout pattern — additive, so it won't break existing flows.
