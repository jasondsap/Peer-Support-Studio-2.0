# Claude Code Brief: Lesson Template Library

**Repo:** `jasondsap/Peer-Support-Studio-2.0`
**Database:** PSS main Neon instance
**Branch suggestion:** `feature/lesson-template-library`
**Scope:** Build a separate, system-owned "Lesson Library" page with 145 premade templates that authenticated users can browse, filter, search, and clone into their personal library.

---

## 1. Goal

Today, all lessons live in `saved_lessons` scoped by `user_id`. An intern (Maddie) has generated lessons in her personal library covering all 145 xlsx topics. After review, those lessons should become **system-owned templates** available to every PSS user.

Build:
1. A new `lesson_templates` table (system-owned, no `user_id`)
2. A `/lesson-library` browse page with filters and pagination
3. A `/lesson-library/[id]` read-only detail page with a **"Use this lesson"** clone action
4. Supporting API routes
5. A one-time migration that pulls 145 canonical lessons from Maddie's new-batch library (`created_at >= '2026-05-20'`), de-duplicates multi-candidate topics (oldest wins), inserts them into `lesson_templates` enriched with xlsx-canonical title/category/session/setting, then cleans up all of Maddie's `saved_lessons` rows except 2 preserved personal lessons
6. Dashboard nav link to the new page

**The brief is self-contained. Do not request additional context. Match existing code patterns in the repo unless this brief overrides them.**

---

## 2. Non-Goals (do NOT build)

- No in-app admin UI for editing templates. Editing happens via Neon SQL Editor in v1.
- No multi-tenant replication. This builds against the PSS main DB only. Fletcher Group's and REBOOT's Neon instances are out of scope.
- No template versioning, drafts, or approval workflow.
- Do NOT touch: `/library` page, lesson detail page, lesson builder, any survey logic, billing logic, HubSpot integration code.
- Do not introduce new dependencies. Use what's already in `package.json`.

---

## 3. Architecture Decisions (locked — do not change)

| Decision | Choice |
|---|---|
| Storage | New `lesson_templates` table, separate from `saved_lessons` |
| User permissions | All authenticated users can read and clone; no one can edit/delete via the app |
| Clone tracking | Add `source_template_id` to `saved_lessons` for usage analytics |
| Intern's library after migration | Delete all rows in `saved_lessons` for `INTERN_USER_ID` **except** the 2 preserved personal lesson IDs. Catches both the old broken pre-May-20 batch and the new-batch dupes |
| Multi-candidate dedup tiebreaker | Oldest wins: `ORDER BY created_at ASC, id ASC` |
| Filters | Category, Session Type, Setting, Search by title |
| Pagination | Match existing `/library` pattern: page-size selector (25/50/100/200/all) + numbered page nav |
| Migration safety | Generate SQL file first, log unmatched rows, do not auto-execute destructive operations |

---

## 4. Inputs Required From Jason Before Running

**All values below are known.** Use directly:

```ts
const INTERN_USER_ID = 'd091f630-14b9-47ea-afe5-efd01c97476c';
const NEW_BATCH_CUTOFF = '2026-05-20';
const PRESERVE_IDS = [
    '3a90a284-2db2-436a-8e50-391959a64359',
    '56f81bb8-2bdc-4d1e-86c2-b2ed52377998',
];
```

`PRESERVE_IDS` are Maddie's 2 truly personal lessons (`Building Healthy Relationships in Recovery`, `Navigating High Stress Situations: Building Your Recovery Toolkit`) — not xlsx-derived, should remain in her library after cleanup.

`NEW_BATCH_CUTOFF` scopes the migration to the regenerated lessons (created on or after this date) and excludes the 153 pre-cutoff broken lessons.

Expected migration state (verified via diagnostic + Maddie added 2 missing topics):

- Maddie's `saved_lessons` total before migration: ~322 (153 old broken + ~171 new batch + 2 personal — exact count may vary slightly if she generated re-runs)
- New-batch DB rows (`created_at >= '2026-05-20'`): ~171
- Unique xlsx topics with at least one DB candidate in new batch: **145 / 145** ✓
- Multi-candidate topics in new batch (oldest wins): ~25
- Templates produced: **145**

After migration: `lesson_templates` has 145 rows; Maddie's `saved_lessons` has exactly 2 rows (the preserved personal lessons).

---

## 5. Database Migration

Create `migrations/008_create_lesson_templates.sql`. **No SQL line comments (`--`) anywhere** — Jason pastes into Neon SQL Editor, which rejects them. Use blank lines for separation.

```sql
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
```

**Apply order:**
1. Jason pastes this into Neon SQL Editor (PSS main DB).
2. Then run the data migration script (Section 8) to populate `lesson_templates`.

---

## 6. Files to Create

### 6.1 `app/lesson-library/page.tsx` — Browse page (the main deliverable)

**Pattern to follow:** copy structure and styling from `app/library/page.tsx` (the existing My Lessons page). Reuse the pagination logic, search input, view-mode toggle (grid/list), and the page-size selector pattern that was just added.

**Differences from `/library`:**
- Page title: "Lesson Library" with subtitle "Browse premade lessons created by the PSS team."
- Header breadcrumb: Dashboard › Lesson Library
- **No** "+ New Lesson" button (templates aren't user-created)
- **No** delete / generate-presentation / send-survey menu items
- Card/row click → `/lesson-library/[id]` (read-only detail)
- Replace the `recent/starred/shared` tab group with **three filter dropdowns** (multi-not-required, but support all/none):
  - **Category** (12 options from xlsx, sorted by `category_order`)
  - **Session Type** (Group / Individual / Both)
  - **Setting** (General / Jail / Residential / Mental Health / Developmental Disability / Youth / Outpatient — display with `.replace(/-/g, ' ')` then capitalize)
- Each card/row shows: title, category badge, session type, setting, short description (first 120 chars), and a small "Used X times" badge if `use_count > 0`.
- Card click on the "Use this lesson" CTA: triggers POST to `/api/lesson-templates/[id]/clone` and on success redirects to `/lesson/[new-id]`.

**State:**
```ts
const [categoryFilter, setCategoryFilter] = useState<string>('all');
const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('all');
const [settingFilter, setSettingFilter] = useState<string>('all');
```

Filter logic combines with `searchQuery` (case-insensitive title match) and resets `currentPage` to 1 on any filter change (use the same `useEffect` pattern as `/library`).

### 6.2 `app/lesson-library/[id]/page.tsx` — Template detail page (read-only)

**Pattern:** simplified version of `app/lesson/[id]/page.tsx` (read-only mode — no edit controls).

**Content:**
- Breadcrumb: Dashboard › Lesson Library › [Title]
- Title, category badge, session type, setting, session length
- Full description
- Render `lesson_json` (parsed) the same way the existing lesson detail page does: overview, objectives, activities, discussion prompts, materials, etc.
- Two CTAs at top:
  - **Primary:** "Use this lesson" (clones → redirects to `/lesson/[new-id]`)
  - **Secondary:** "Back to Library" → `/lesson-library`
- Show `use_count` in a small stat block (e.g., "Used by 47 facilitators")

### 6.3 `app/api/lesson-templates/route.ts` — GET list

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const templates = await sql`
            SELECT
                id, title, topic, description, category, category_order,
                session_type, setting_type, session_length, recovery_model,
                group_size, group_composition, gamma_presentation_url,
                use_count, created_at
            FROM lesson_templates
            WHERE is_published = true
            ORDER BY category_order ASC, title ASC
            LIMIT 500
        `;

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching lesson templates:', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}
```

Note: list endpoint deliberately omits `lesson_json`, `facilitator_guide`, `participant_handout` for payload size. Detail endpoint returns the full record.

### 6.4 `app/api/lesson-templates/[id]/route.ts` — GET single template

Returns full record including `lesson_json`, `facilitator_guide`, `participant_handout`. Same auth pattern.

### 6.5 `app/api/lesson-templates/[id]/clone/route.ts` — POST clone

This is the workhorse. When a user clicks "Use this lesson":

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const templateRows = await sql`
            SELECT * FROM lesson_templates WHERE id = ${params.id}::uuid AND is_published = true
        `;
        const template = templateRows[0];
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const result = await sql`
            INSERT INTO saved_lessons (
                user_id, title, topic, facilitator_guide, participant_handout,
                lesson_json, session_type, session_length, setting_type,
                recovery_model, group_size, group_composition,
                source_template_id, category,
                created_at, updated_at
            ) VALUES (
                ${userId}::uuid,
                ${template.title},
                ${template.topic},
                ${template.facilitator_guide},
                ${template.participant_handout},
                ${template.lesson_json},
                ${template.session_type},
                ${template.session_length || '60'},
                ${template.setting_type},
                ${template.recovery_model || 'General/Flexible'},
                ${template.group_size},
                ${template.group_composition},
                ${template.id}::uuid,
                ${template.category},
                NOW(),
                NOW()
            )
            RETURNING id, title, created_at
        `;

        await sql`
            UPDATE lesson_templates
            SET use_count = use_count + 1, updated_at = NOW()
            WHERE id = ${params.id}::uuid
        `;

        return NextResponse.json({ success: true, lesson: result[0] });
    } catch (error) {
        console.error('Error cloning template:', error);
        return NextResponse.json({ error: 'Failed to clone template' }, { status: 500 });
    }
}
```

Note: `gamma_presentation_url` is intentionally **not** copied — clones start without a presentation; users generate their own.

### 6.6 `components/LessonTemplateCard.tsx` (optional but recommended)

Pull the card markup out of the browse page if it gets unwieldy. Otherwise inline is fine.

### 6.7 Dashboard nav

In `app/page.tsx` (main dashboard, file path may be `main_dashboard_page.tsx`), add a new tile/link to `/lesson-library`. Mirror the existing tile styling. Suggested copy:
- Title: "Lesson Library"
- Subtitle: "145 premade lessons. Browse, customize, and use."
- Icon: `BookOpen` from lucide-react

Also add to any global navigation if one exists (check `Header.tsx`).

### 6.8 `scripts/migrate-lesson-templates.ts` — One-time migration (Section 8)

---

## 7. Files to Modify

- **`app/api/lessons/route.ts`** — When inserting a saved lesson via the existing builder flow, accept optional `source_template_id` and `category` in the POST body and persist them. This unblocks the clone endpoint above and any future clone paths.
- **`app/page.tsx`** (or `main_dashboard_page.tsx`) — Add the new tile.
- **`Header.tsx`** — Add nav link if appropriate.

No other files should change. Specifically: leave `/library/page.tsx` exactly as-is (the recent pagination addition is correct; do not refactor it).

---

## 8. Data Migration Script

Create `scripts/migrate-lesson-templates.ts`.

### Critical matching rule

**Match xlsx `title` (seed file) against DB `topic` column.** Maddie's regeneration flow combined `title + description` and pasted the combined string as the topic prompt. The AI then generated a polished display title in the DB's `title` column. So the xlsx-derived value is preserved as the **prefix** of `saved_lessons.topic`, while `saved_lessons.title` is AI-generated and should NOT be used for matching.

The match logic: a DB row matches an xlsx seed entry if the normalized DB topic **starts with** the normalized xlsx title. (Use longest-prefix-first when checking, to avoid false matches between similar titles.)

### Behavior

1. Read `data/lesson_templates_seed.json` (committed to repo, 145 entries).
2. Connect to PSS DB via `DATABASE_URL` env var.
3. Fetch new-batch `saved_lessons`:
   ```ts
   const dbRows = await sql`
       SELECT id, title, topic, facilitator_guide, participant_handout,
              lesson_json, session_type, session_length, setting_type,
              recovery_model, group_size, group_composition,
              gamma_presentation_url, created_at
       FROM saved_lessons
       WHERE user_id = ${INTERN_USER_ID}::uuid
         AND created_at >= ${NEW_BATCH_CUTOFF}::date
       ORDER BY created_at ASC, id ASC
   `;
   ```
4. Normalize topics and seed titles using:
   ```ts
   function normalize(s: string | null | undefined): string {
       if (!s) return '';
       return s
           .toLowerCase()
           .trim()
           .replace(/\s+/g, ' ')
           .replace(/[.!?,;:]+$/g, '');
   }
   ```
5. Sort seed normalized titles by length DESC (longest first) — prevents short titles from accidentally matching when a longer title would have been more specific.
6. For each DB row: find the seed entry whose normalized title is the longest prefix of the row's normalized topic. Bucket the row under that seed entry.
7. For each seed entry's bucket:
   - **Empty bucket** → log as `xlsx_unmatched` (expected: 0 after Maddie added the 2 missing topics; bail with non-zero exit if any are found unless `--allow-missing` is passed).
   - **1+ rows** → bucket is already sorted by `(created_at ASC, id ASC)` from the query; take `bucket[0]` as the **canonical source row**.
8. Build INSERT statements. For each seed entry mapped to a canonical DB row, the template row uses:

   | template column | source |
   |---|---|
   | `id` | `gen_random_uuid()` |
   | `title` | **xlsx seed `title`** (canonical, curated) |
   | `topic` | **xlsx seed `title`** (use canonical value, not DB's combined topic+description string) |
   | `description` | **xlsx seed `description`** |
   | `category` | **xlsx seed `category`** |
   | `category_order` | **xlsx seed `category_order`** |
   | `session_type` | **xlsx seed `session_type`** |
   | `setting_type` | **xlsx seed `setting_type`** |
   | `session_length` | DB canonical row |
   | `recovery_model` | DB canonical row |
   | `group_size` | DB canonical row |
   | `group_composition` | DB canonical row |
   | `facilitator_guide` | DB canonical row |
   | `participant_handout` | DB canonical row |
   | `lesson_json` | DB canonical row |
   | `gamma_presentation_url` | DB canonical row (kept for template preview; cloning still strips it per Section 6.5) |
   | `is_published` | `true` |
   | `use_count` | `0` |
   | `created_at`, `updated_at` | `NOW()` |

9. Build a single DELETE that wipes everything in Maddie's library except `PRESERVE_IDS`:
   ```sql
   DELETE FROM saved_lessons
   WHERE user_id = '<INTERN_USER_ID>'::uuid
     AND id NOT IN (<preserve_ids>);
   ```
   This catches the old broken pre-cutoff lessons (~153), the non-canonical dupes from the new batch (~25), and the canonical rows themselves (~145) — all in one statement. Total expected deletion: ~323 rows.
10. Write all SQL to `migrations/008_lesson_templates_data.sql`.
11. Print a match report to stdout:
    ```
    Seed entries: 145
    New-batch DB rows (>= 2026-05-20): ~171
    Unique topics matched: 145 / 145
    Canonical source rows (will become templates): 145
    Non-canonical dupes (will be deleted): ~26
    Old pre-cutoff DB rows (will be deleted): ~153
    Preserve IDs (will remain): 2
    Templates produced: 145
    ```
12. **Do not execute SQL automatically.** Output the file and exit. Jason pastes into Neon SQL Editor.

### Output SQL structure (no `--` comments)

```sql
BEGIN;

INSERT INTO lesson_templates (
    id, title, topic, description, category, category_order,
    session_type, setting_type, session_length, recovery_model,
    group_size, group_composition, facilitator_guide,
    participant_handout, lesson_json, gamma_presentation_url,
    is_published, use_count, created_at, updated_at
)
VALUES
    (gen_random_uuid(), 'Title 1', 'Title 1', 'Description 1', 'Recovery Foundations', 1, 'group', 'general', '60', 'General/Flexible', NULL, NULL, '...', '...', '...', NULL, true, 0, NOW(), NOW()),
    ...
;

DELETE FROM saved_lessons
WHERE user_id = 'd091f630-14b9-47ea-afe5-efd01c97476c'::uuid
  AND id NOT IN (
    '3a90a284-2db2-436a-8e50-391959a64359'::uuid,
    '56f81bb8-2bdc-4d1e-86c2-b2ed52377998'::uuid
  );

COMMIT;
```

Wrap in a single transaction so a failed insert rolls back the deletes. If Jason wants to inspect mid-migration, change `COMMIT` to `ROLLBACK` and re-run after fixing.

### Idempotency

Script refuses to run if `lesson_templates` already contains rows whose `title` matches any seed title. Prints a warning and bails out unless `--force` is passed.

### Place files at

- Script: `scripts/migrate-lesson-templates.ts`
- Seed: `data/lesson_templates_seed.json`
- Output (gitignored): `migrations/008_lesson_templates_data.sql`

---

## 9. UI Polish Notes

- Brand palette: navy `#0E2235`, blue `#1A73A8`, green `#30B27A` (match `/library` exactly).
- Category badges: use a subtle background per category — pick from the existing color tokens, do not introduce new colors. Simplest: same blue/green badges used in `/library` for `gamma_presentation_url` status.
- Person-first language throughout copy.
- Empty state (no templates match filters): icon + "No lessons match these filters" + "Clear filters" button that resets all three filter dropdowns and the search query.

---

## 10. Testing Checklist

Before opening a PR, verify:

- [ ] Migration SQL runs cleanly in a fresh Neon branch (use Neon's branching feature for testing).
- [ ] After data migration, `SELECT count(*) FROM lesson_templates` returns **145**.
- [ ] After data migration, Maddie's `saved_lessons` count is exactly **2** (the preserved personal lessons).
- [ ] Verify the 2 preserved rows are the right ones: `SELECT id, title FROM saved_lessons WHERE user_id = 'd091f630-14b9-47ea-afe5-efd01c97476c'::uuid` returns rows with ids `3a90a284-2db2-436a-8e50-391959a64359` and `56f81bb8-2bdc-4d1e-86c2-b2ed52377998`.
- [ ] Match report logged: 145 matched, 0 xlsx_unmatched, ~26 non-canonical dupes deleted, ~153 old pre-cutoff rows deleted, 2 preserved.
- [ ] Spot-check 5 templates across different categories: `title`, `topic`, `category`, `session_type`, `setting_type` all match xlsx values; `lesson_json` and `facilitator_guide` are non-null and contain real content.
- [ ] Verify all 12 categories are represented: `SELECT category, count(*) FROM lesson_templates GROUP BY category ORDER BY MIN(category_order)`.
- [ ] Verify session_type distribution is varied: 3 distinct values (`group`, `individual`, `both`), none of which is overwhelmingly dominant.
- [ ] Verify setting_type distribution is varied: 7 distinct values, with `general` being most common but other settings present.
- [ ] `/lesson-library` loads, shows 145 lessons paginated 50 per page, all filters work independently and together.
- [ ] Category dropdown lists 12 categories in `category_order`.
- [ ] Search-by-title filters correctly within the active filter set.
- [ ] Page-size selector switches between 25/50/100/200/all and resets to page 1.
- [ ] `/lesson-library/[id]` renders read-only detail with no edit affordances.
- [ ] "Use this lesson" creates a new row in `saved_lessons` for the logged-in user with `source_template_id` populated and `category` populated. Redirects to `/lesson/[new-id]`.
- [ ] `use_count` on the template increments by 1 per clone.
- [ ] Cloned lesson appears in the user's `/library` and can be edited, surveyed, presentation-generated normally. Note: the clone's `gamma_presentation_url` is null (template's URL is intentionally not copied; see Section 6.5).
- [ ] Unauthenticated requests to all new API routes return 401.
- [ ] Dashboard tile links to `/lesson-library`.
- [ ] No regression: `/library` still works exactly as before (pagination, search, view mode toggle, all menus).
- [ ] Other users' `saved_lessons` rows untouched. Run a quick `SELECT COUNT(*) FROM saved_lessons WHERE user_id != 'd091f630-14b9-47ea-afe5-efd01c97476c'::uuid` before and after; counts identical.

---

## 11. Rollback Plan

If something goes wrong after the data migration:

```sql
BEGIN;

INSERT INTO saved_lessons (id, user_id, title, topic, facilitator_guide, participant_handout, lesson_json, session_type, session_length, setting_type, recovery_model, group_size, group_composition, gamma_presentation_url, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'INTERN_USER_ID'::uuid,
    title, topic, facilitator_guide, participant_handout, lesson_json,
    session_type, session_length, setting_type, recovery_model,
    group_size, group_composition, gamma_presentation_url,
    created_at, NOW()
FROM lesson_templates;

DELETE FROM lesson_templates;

COMMIT;
```

Then drop the schema:

```sql
ALTER TABLE saved_lessons DROP COLUMN IF EXISTS source_template_id;
ALTER TABLE saved_lessons DROP COLUMN IF EXISTS category;
DROP TABLE IF EXISTS lesson_templates;
```

Recommended: run the data migration first in a Neon branch, validate, then apply to main.

---

## 12. Code Conventions (match the existing repo)

- API routes: `import { getSession, getInternalUserId } from '@/lib/auth'` and `import { sql } from '@/lib/db'` (tagged-template style, as seen in `app/api/lessons/route.ts`).
- Next.js 14 App Router conventions.
- Tailwind classes only, no new CSS files.
- TypeScript strict — no `any` unless interfacing with parsed `lesson_json`.
- Use `lucide-react` icons already imported elsewhere.
- Person-first language in all user-facing copy.

---

## 13. Out of Scope (future work, do not build now)

- Admin UI for template editing
- Multi-tenant template replication (Fletcher Group, REBOOT)
- Template versioning / change history
- Template recommendation engine
- User favoriting / starring templates
- Template ratings or reviews
- Bulk clone / "clone full category"

---

## 14. Commit Strategy

Small, reviewable commits in this order:

1. `migrations: add lesson_templates table and source_template_id`
2. `api: GET /api/lesson-templates and /[id]`
3. `api: POST /api/lesson-templates/[id]/clone`
4. `feat: lesson library browse page`
5. `feat: lesson library template detail page`
6. `feat: dashboard tile and nav link`
7. `data: migrate intern's lessons to lesson_templates` (includes the script + generated SQL file)
8. `chore: extend POST /api/lessons to accept source_template_id and category`

Open one PR with all commits. Description should link this brief.

---

## 15. Appendix: How We Got Here

Before this brief was finalized, Jason and Claude went through several rounds of diagnostic and a content-quality decision that materially shaped the migration logic. Record here so it isn't re-discovered or undone:

**Finding A: First-round lessons were generated with defaults.** Maddie's original 153 lessons (created 2026-05-06 through 2026-05-11) all had `session_type='group'` and `setting_type='outpatient'` regardless of what the xlsx specified. The xlsx descriptions weren't used as prompt context either. These lessons were generic outpatient/group output and not suitable as templates.

**Finding B: The lesson generator materially uses `sessionType` and `settingType`.** Confirmed by reading `app/api/generate-lesson/route.tsx` — individual vs group sessions use entirely different query templates, and the setting label is injected into both the query string and the RAG context. So mismatched metadata isn't just labeling; it changes content.

**Finding C: Maddie regenerated everything between 2026-05-20 and 2026-05-21.** New batch is ~171 rows. She combined `title + description` as the topic prompt and configured `session_type` and `setting_type` per the xlsx. Coverage: all 145 xlsx topics now have at least one DB candidate.

**Finding D: 25 xlsx topics have multiple DB candidates in the new batch.** Maddie generated some topics twice (likely re-runs for better output). Both versions typically have full content. The migration picks the oldest of each set and the cleanup deletes all non-canonical dupes.

**Finding E: The lesson builder rewrites titles.** The combined `title + description` prompt is preserved as the prefix of `saved_lessons.topic`. The `title` column is AI-generated and differs from the xlsx title. **Match on `topic` (prefix), not `title`.** This is why Section 8 uses longest-prefix-first matching.

**Finding F: 2 truly personal lessons exist** that aren't in the xlsx and should be preserved through cleanup: `Building Healthy Relationships in Recovery` (id `3a90a284-2db2-436a-8e50-391959a64359`) and `Navigating High Stress Situations: Building Your Recovery Toolkit` (id `56f81bb8-2bdc-4d1e-86c2-b2ed52377998`). The `PRESERVE_IDS` list in Section 4 prevents the cleanup from touching them.

**Finding G: The original migration plan (move Maddie's first-round lessons) was discarded.** The Section 8 logic in this brief migrates from the **new-batch** (`created_at >= '2026-05-20'`), not the original 153. If you see references in commit history or related docs to "migrate 145 lessons → templates," that's the old plan — this brief supersedes it.

---

**End of brief.**
