# Curriculum Manager — Implementation Spec for PSS

## Overview

Add a **Curriculum Manager** module to Peer Support Studio that lets organizations set up structured curricula (e.g., PND, Living in Balance, Recovery Dynamics, Matrix Model), enroll participants, track session delivery, log attendance, and monitor completion progress. The platform is **curriculum-agnostic** — it holds the structure/skeleton, not copyrighted content.

This spec follows existing PSS patterns: Next.js 14 App Router, TypeScript, Tailwind CSS, Neon PostgreSQL, `import { authOptions } from '@/lib/auth'; import { query } from '@/lib/db';` with `$1` parameterized queries, and the existing multi-tenant organization model.

---

## 1. Database Schema (Neon SQL Editor — no `--` comments)

Run these in order. All tables use `gen_random_uuid()` for IDs and cascade on organization/curriculum delete.

### 1a. Curricula (the master template)

```sql
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
```

### 1b. Curriculum Modules (the individual sessions/modules)

```sql
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
```

### 1c. Curriculum Enrollments (participant <-> curriculum)

```sql
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
```

### 1d. Module Completions (tracking which modules a participant finished)

```sql
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
```

### 1e. Group Sessions (when a facilitator delivers a module to a group)

```sql
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
```

### 1f. Session Attendance (who attended each group session)

```sql
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
```

---

## 2. API Routes

All routes follow the existing PSS pattern: `getSession()` → `getInternalUserId()` → org authorization → `query()` with `$1` params.

### 2a. `/api/curricula` (GET, POST)

**GET** — List curricula for the org
```
Query params: organization_id (required)
Returns: { curricula: [...] } with module_count and enrollment_count
```

**POST** — Create a new curriculum
```
Body: { organization_id, name, description, source, total_hours, modules: [...] }
Returns: { curriculum: {...}, modules: [...] }
```

The POST should accept an optional `modules` array to create the curriculum and all its modules in one call. Each module: `{ module_number, title, description, minimum_hours, minimum_minutes, learning_objectives, sort_order }`.

### 2b. `/api/curricula/[id]` (GET, PUT, DELETE)

**GET** — Single curriculum with all modules, enrollment count, and completion stats
**PUT** — Update curriculum metadata
**DELETE** — Soft delete (set status to 'archived')

### 2c. `/api/curricula/[id]/modules` (GET, POST, PUT, DELETE)

CRUD for modules within a curriculum. PUT and DELETE accept module_id in the body.

### 2d. `/api/curricula/[id]/enrollments` (GET, POST)

**GET** — List enrolled participants with their progress (modules completed / total modules)
**POST** — Enroll a participant: `{ participant_id }`

### 2e. `/api/curricula/[id]/enrollments/[enrollmentId]` (PUT, DELETE)

**PUT** — Update enrollment status (withdraw, pause, complete)
**DELETE** — Remove enrollment

### 2f. `/api/curricula/[id]/sessions` (GET, POST)

**GET** — List group sessions for this curriculum, with attendance counts
**POST** — Log a group session: `{ module_id, session_date, start_time, duration_minutes, location_id, notes, attendees: [{ participant_id, status }] }`

The POST should:
1. Create the `curriculum_sessions` record
2. Create `session_attendance` records for each attendee
3. For attendees marked 'present', auto-create `module_completions` if they have an active enrollment

### 2g. `/api/curricula/[id]/sessions/[sessionId]` (GET, PUT, DELETE)

**GET** — Session detail with full attendance list
**PUT** — Update session or attendance
**DELETE** — Remove session (cascades attendance)

### 2h. `/api/participants/[id]/curricula` (GET)

Returns all curriculum enrollments for a participant with progress data. This enables showing curriculum progress on the participant detail page.

---

## 3. Pages & Components

### 3a. `/app/curricula/page.tsx` — Curriculum List

Main landing page showing all curricula for the organization.

**Layout:**
- Page header: "Curriculum Manager" with subtitle "Structured program delivery and tracking"
- "Create Curriculum" button (top right)
- Cards for each curriculum showing:
  - Name, source, description
  - Module count, total hours
  - Enrollment count (active)
  - Completion rate (enrollments completed / total)
  - Status badge (active/draft/archived)
- Click card → goes to `/curricula/[id]`

**Design:** Follow the same card pattern as the dashboard module cards. Use the existing PSS color scheme (navy headers, green accents for completion, amber for in-progress).

### 3b. `/app/curricula/new/page.tsx` — Create Curriculum

**Two creation modes:**

1. **Manual Build** — Form with:
   - Curriculum name, description, source (e.g., "Hazelden", "State DOC", "Internal")
   - Total hours estimate
   - Dynamic module list with add/remove:
     - Module number (auto-increment)
     - Title
     - Minimum time (hours and/or minutes)
     - Description (optional)
     - Learning objectives (optional, multi-input)
   - Save creates curriculum + all modules in one API call

2. **Quick Template** — Pre-built templates (Phase 1: just PND). Button that pre-fills the form with the template structure. User can edit before saving.

**PND Template Seed Data:**
```json
{
  "name": "Portal New Direction (PND)",
  "description": "Life skills program addressing common reentry needs and barriers across 16 modules. 21+ hours total.",
  "source": "Kentucky Department of Corrections",
  "total_hours": 21,
  "modules": [
    { "module_number": 1, "title": "Orientation, Getting Organized & Goals", "minimum_minutes": 120 },
    { "module_number": 2, "title": "Identification", "minimum_minutes": 30 },
    { "module_number": 3, "title": "Housing", "minimum_minutes": 60 },
    { "module_number": 4, "title": "Transportation", "minimum_minutes": 30 },
    { "module_number": 5, "title": "Family and Friend Relationships", "minimum_minutes": 120 },
    { "module_number": 6, "title": "Parenting & Child Support", "minimum_minutes": 120 },
    { "module_number": 7, "title": "Money & Taxes", "minimum_minutes": 60 },
    { "module_number": 8, "title": "Healthy Thinking — Healthy Living", "minimum_minutes": 120 },
    { "module_number": 9, "title": "Addictions & Mental Health", "minimum_minutes": 120 },
    { "module_number": 10, "title": "Community/Restorative Justice", "minimum_minutes": 30 },
    { "module_number": 11, "title": "Digital Literacy", "minimum_minutes": 90 },
    { "module_number": 12, "title": "Education", "minimum_minutes": 60 },
    { "module_number": 13, "title": "Employment", "minimum_minutes": 120 },
    { "module_number": 14, "title": "Supervision, Parole Board & Community Resources", "minimum_minutes": 90 },
    { "module_number": 15, "title": "Expungements and Restoration of Civil Rights", "minimum_minutes": 30 },
    { "module_number": 16, "title": "Reentry Planning", "minimum_minutes": 60 }
  ]
}
```

### 3c. `/app/curricula/[id]/page.tsx` — Curriculum Detail (Main Hub)

This is the primary working page. **Tabbed interface:**

**Tab 1: Overview**
- Curriculum name, description, source, total hours
- Visual module list (numbered, with time requirements)
- Edit curriculum button (opens edit mode or separate page)

**Tab 2: Enrollments**
- Table of enrolled participants
- Columns: Name, Enrolled Date, Status, Progress (bar showing X/16 modules), Actions
- "Enroll Participant" button → participant selector (reuse existing participant search pattern from ComposeMessageModal)
- Click participant row → expands to show which specific modules are complete/incomplete
- Bulk enroll option (select multiple participants)

**Tab 3: Sessions**
- List of delivered group sessions, most recent first
- Each row: Date, Module delivered, Facilitator, Location, Attendee count, Duration
- "Log Session" button → opens session logging form
- Click session row → shows attendance detail

**Tab 4: Reports (Phase 2, but stub the tab now)**
- Placeholder for completion reports, attendance summaries, certificate generation

### 3d. Session Logging Flow (Modal or Inline on Sessions Tab)

This is the key facilitator workflow — make it fast and mobile-friendly:

1. **Select Module** — dropdown of curriculum modules
2. **Session Date** — date picker (defaults to today)
3. **Duration** — minutes input
4. **Location** — dropdown of org locations (optional)
5. **Take Attendance** — checkable list of all enrolled participants
   - Default all to "present"
   - Toggle individual to absent/excused/late
   - Show participant name + photo if available
6. **Session Notes** — optional textarea
7. **Save** → creates session, attendance, and auto-marks module completion for present participants

### 3e. Participant Detail Integration

On the existing participant detail page (`/participants/[id]`), add a **"Curricula" tab** (or section) showing:
- All curricula the participant is enrolled in
- Progress bar for each (modules completed / total)
- Clickable to expand and see module-by-module status
- Link to enroll in additional curricula

---

## 4. Dashboard Integration

### 4a. Add to Main Dashboard

Add a new section on the main dashboard between "Assessment & Goals" and "Connect & Support":

```
Education & Training
Structured curriculum delivery and tracking

[Curriculum Manager]     [Lesson Builder]      [Peer Advisor]
Deliver & track          Create educational     AI coaching and
structured programs      content                guidance
```

The Curriculum Manager card should use a new icon (GraduationCap from lucide-react) with color `bg-indigo-500` or similar to distinguish from other sections.

### 4b. Header Navigation

Add "Curricula" to the header nav. Consider grouping under an "Education" dropdown with Library and Lesson Builder, or add it standalone.

---

## 5. Key UX Patterns to Follow

- **Organization scoping**: All queries filter by `organization_id` from session context, same as participants/lessons
- **Loading states**: Use `<Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />` pattern
- **Empty states**: Match the existing "No lessons yet" / "No participants yet" pattern with icon + message + CTA
- **Cards**: Use `bg-white rounded-2xl shadow-sm border border-[#E7E9EC]` pattern
- **Badges**: AI badge pattern for future AI-generated quiz features
- **Status colors**: 
  - Active/Present: `text-green-700 bg-green-50` 
  - Completed: `text-blue-700 bg-blue-50`
  - Withdrawn/Absent: `text-red-700 bg-red-50`
  - Paused/Excused: `text-amber-700 bg-amber-50`
- **Progress bars**: Use green gradient `from-[#30B27A] to-[#4AC490]` for completion progress

---

## 6. Implementation Order (Suggested for Claude Code)

**Phase 1a — Schema + Basic CRUD (do first)**
1. Run all CREATE TABLE statements in Neon
2. Build `/api/curricula` route (GET, POST)
3. Build `/api/curricula/[id]` route (GET, PUT, DELETE)
4. Build `/api/curricula/[id]/modules` route
5. Build `/app/curricula/page.tsx` (list page)
6. Build `/app/curricula/new/page.tsx` (create page with PND template)
7. Build `/app/curricula/[id]/page.tsx` (detail page, Overview tab only)
8. Add to dashboard and navigation

**Phase 1b — Enrollment + Session Tracking**
9. Build `/api/curricula/[id]/enrollments` route
10. Build enrollment UI on the detail page (Enrollments tab)
11. Build `/api/curricula/[id]/sessions` route (with attendance + auto-completion logic)
12. Build session logging UI (Sessions tab)
13. Build `/api/participants/[id]/curricula` route
14. Add Curricula tab to participant detail page

**Phase 1c — Polish**
15. Progress calculations and visual progress bars
16. Completion detection (auto-mark enrollment as completed when all modules done)
17. Empty states, loading states, error handling
18. Mobile responsiveness

---

## 7. File Structure

```
app/
  curricula/
    page.tsx                    (list all curricula)
    new/
      page.tsx                  (create curriculum)
    [id]/
      page.tsx                  (curriculum detail with tabs)

app/api/
  curricula/
    route.ts                    (GET list, POST create)
    [id]/
      route.ts                  (GET, PUT, DELETE single)
      modules/
        route.ts                (CRUD modules)
      enrollments/
        route.ts                (GET, POST)
        [enrollmentId]/
          route.ts              (PUT, DELETE)
      sessions/
        route.ts                (GET, POST)
        [sessionId]/
          route.ts              (GET, PUT, DELETE)

  participants/
    [id]/
      curricula/
        route.ts                (GET participant's enrollments)
```

---

## 8. Notes for Claude Code

- Use `import { authOptions } from '@/lib/auth'; import { query } from '@/lib/db';` pattern for all API routes
- Use `$1, $2` parameterized queries, NOT tagged template literals in API routes
- All UUIDs validated with the existing `validateUUID()` helper from `@/lib/db`
- Organization ID comes from session context (`session.currentOrganization.id` on client, or from query params with server-side org membership verification)
- No SQL comments (Neon editor limitation)
- Existing table references: `organizations`, `participants`, `users`, `locations` — these already exist, just add FKs to them
