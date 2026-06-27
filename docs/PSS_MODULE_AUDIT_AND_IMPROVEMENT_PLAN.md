# Peer Support Studio — Module Audit & Improvement Plan

**Date:** 2026-06-26
**Scope:** Full audit of every module in `pss-neon-cognito`, evaluating (a) workflow completeness — "are we finishing the full process?", (b) efficiency for the Peer Support Specialist (PSS), and (c) standard-of-work / compliance.
**Benchmark:** The target feature set is RDP (Recovery Data Platform), the Salesforce-based electronic recovery record demoed in `docs/Meeting Transcripts.pdf`. PSS's intended edge is layering AI/voice/RAG on top of that standard.

> **Method note.** Findings were produced by seven parallel module audits reading the actual code. File:line citations are accurate as of this date but the DB schema is not checked into the repo, so column-level claims are inferred from SQL in the routes. Security findings are from reading route source (imports / missing guards), not runtime exploit tests — but they are concrete and reproducible by inspection.

---

## 1. Executive Summary

Peer Support Studio is **feature-broad and genuinely capable** — intake with billing-readiness, AI session notes, recovery plans with e-signatures, validated assessments, groups, curriculum, kiosk, journaling, messaging, an evidence-grounded RAG advisor. The newer modules (recovery plans, service log, curriculum, kiosk, messaging) are well-built and security-conscious.

But the audit found three systemic problems that undercut the product's promise of being an "audit-ready," standard-of-work tool:

1. **A HIPAA-class security epidemic.** At least **13 PHI endpoints** either have no authentication at all or trust an `organization_id` from the request without verifying the caller belongs to that org. There is no row-level-security backstop, so these are real cross-tenant read/write/delete holes for participant PHI. **This is priority zero.** (§3)

2. **Broken end-to-end loops.** Almost every module *starts* a workflow it never *finishes*: billing-readiness leads to no billing; service plans never link to the note that fulfills them; assessment-recommended goals can't become goals; treatment-locator results can't become tracked referrals; the journal "new" badge never clears; lesson surveys 404. The PSS is repeatedly walked to the edge of a process and dropped. (§4)

3. **No standard-of-work spine.** There is no PSS work-queue (caseload / notes due / overdue reviews / today's sessions), no supervisor review-and-cosign of notes, no agency reporting, and no reminder/notification system. RDP's whole value proposition is the coach dashboard and supervisory oversight — PSS has the data but never assembles it. (§5)

Plus two **clinical-correctness defects**: the MIRC-28 assessment is AI-scored against the *wrong question bank*, and its percentage is computed against the wrong maximum. (§6)

The good news: the data model already supports most of what's missing (caseload `primary_pss_id`, note `status`, `next_review_date`, `linked_note_id` columns, `service_approvals` audit pattern). The gaps are mostly *wiring and guards*, not greenfield builds.

---

## 2. Cross-Cutting Themes (the patterns behind the findings)

| Theme | What it looks like | Where it shows up |
|---|---|---|
| **Inconsistent org scoping** | Newer routes use `requireOrgAccess`; older/clinical routes trust the `organization_id` param | participants, recovery-assessments, saved-goals, journal, journey, ally-intelligence, service-log/approve, curricula sessions |
| **Sparse audit logging** | `logAuditEvent` exists but fires in only ~22 of ~85 routes — and is missing on the *highest-value* events (clinical notes, approvals, staff invites, AI-over-PHI) | session-notes, recovery-assessments, service-log/approve, organizations, ally-* , journey, messages send/read |
| **`neon()` proxy rule violated** | ~13 routes call `neon(process.env.DATABASE_URL!)` at module top instead of importing `sql` from `@/lib/db` — an Amplify cold-start reliability footgun | ally-intelligence, journey-*, recovery-assessments/analyze, assessment-invitations, organizations, journey-entries |
| **Started-but-unfinished loops** | A workflow's "next step" button is missing, dead, or points nowhere | billing, service↔note, assessment→goal, referral, journal review, surveys, advice capture |
| **Double/triple data entry** | Running one group means entering attendance, then a note, then a billing unit — none carry across | groups ↔ notes ↔ service-log |
| **Weak list/search/pagination** | Client-side search over a capped fetch (50–100 rows); no real pagination or filters | participants, session-notes library, journey |
| **Code/constant duplication & drift** | Same constants copied 3–4× and drifted apart, causing real bugs | MIRC-28 bank (×3), BARC-10, `goalAreas` (×3), participant-search UI |
| **Orphaned/dead surfaces** | Pages and APIs left behind by refactors that now show empty or 404 | advisor-library + advisor-sessions + Hume voice; lesson-surveys API; journey `linked_*` columns; `/session-note` Word form |

---

## 3. 🔴 P0 — Security: Cross-Tenant PHI Exposure (do this first)

There is **no RLS backstop** (per `CLAUDE.md`), so every one of these is exploitable by any authenticated user (or, in two cases, *anyone*) who supplies a known UUID.

**Unauthenticated PHI endpoints (no session check at all):**
- `app/api/ally-intelligence/route.ts` — no `getSession`/auth; trusts `organizationId` from the body; queries names, note text, assessment scores, internal notes. Worst offender (AI-over-PHI, fully open).
- `app/api/journal/route.ts` (Studio read branch, ~lines 20–50) — returns shared journal PHI with no `requireAuth` when `participant_id`+`organization_id` are in the query. The sibling branch *does* auth — clearly an accidental omission.
- `app/api/journey-entries/insights/route.ts` — auth explicitly commented out (`// TODO: Add proper auth check`).
- `app/api/ally-chat/route.ts` — no auth (open OpenAI proxy; no PHI/DB, lower risk).

**Authenticated but no org-membership verification (cross-tenant / IDOR):**
- `app/api/participants/route.ts` — GET (org branch) and POST both use `organization_id` from request with no `requireOrgAccess`.
- `app/api/recovery-assessments/route.ts` — GET/POST/DELETE, no org check.
- `app/api/recovery-assessments/[id]/analyze/route.ts` — fetches by id, zero org check.
- `app/api/saved-goals/route.ts` — no org check anywhere.
- `app/api/assessment-invitations/route.ts` — no org check; PATCH acts on `invitation_id` unscoped.
- `app/api/journey-entries/route.ts` & `journey-domains/route.ts` — session-exists only; trust query `organization_id`; `DELETE ... WHERE id = ${id}` not even org-scoped.
- `app/api/service-log/approve/route.ts` — approves/verifies `WHERE id = ${serviceId}` with **no org scope and no role check** (anyone can approve any service plan).
- `app/api/curricula/[id]/sessions/route.ts` (POST + sessionId PUT) — inserts attendee `participant_id`s after only `validateUUID`, no `organization_id` filter (can write a foreign org's participant into your attendance).

**Action (P0, ~M total):** Add `requireAuth` + `requireOrgAccess(orgId)` (and `requireOrgRole` where mutating/approving) to every route above, deriving `organization_id` server-side from membership rather than trusting the client. Scope all PATCH/DELETE by `organization_id`. This is a coordinated sweep — do it as one hardening pass with a checklist, and add a lint/test that every route under `app/api/**` that reads a PHI table calls a guard.

---

## 4. 🔴/🟠 Broken End-to-End Loops (the "are we completing the process?" answer — mostly **no**)

This is the heart of the user's question. Each row is a workflow the PSS can start but not finish.

| Loop | Where it breaks | Impact | Fix priority |
|---|---|---|---|
| **Intake → billing** | Billing-readiness computes "Ready" but there is **no claims/billing module, no service→claim link, no 837/CMS-1500 export, no "mark billed"** | The entire billing-readiness apparatus has no downstream consumer | P1 (big) |
| **Service plan → session note** | `service-log/[id]` "Create Session Note" navigates to `/session-notes?serviceId=…` but the notes page never reads `serviceId`, and nothing ever calls the `action:'link-note'` endpoint. `service_plans.session_note_id` is never set | Supervisor Review permanently shows "Session Note: Not created"; deliver→document loop never closes | P0 (wiring) |
| **Assessment → goal/plan** | AI `recommendedGoals` render in `AssessmentDetailModal` but there's no "Create goal"/"Add to plan" action; `saved_goals`, `rc_plan_goals`, `recovery_assessments` share no keys | PSS hand-retypes recommendations; assessment insight evaporates | P1 |
| **Treatment locator → referral** | Facility results can't be saved/attached/tracked; no referral record, status, or follow-up | "Get Directions" and the trail ends; no closeable referral loop | P1 |
| **Journal review** | `pss_viewed` is **never set to true** anywhere; the "X new" badge never clears | The "PSS reviewed" half of the consent loop is missing | P1 (S) |
| **Journey → note/goal** | `journey_entries.linked_note_id` / `linked_goal_id` are selected but the UI never sends them | Status changes are never tied to the note/goal that caused them | P2 |
| **Note Reviewer** | Accepts pasted text only; can't load a saved note; rubric score/billable flag stored in `note_reviews` but never written back onto the note | A QA gate that lives outside the workflow it should gate | P1 |
| **Lesson surveys** | `app/api/lesson-surveys/` is **empty (no files)** but `app/library` POSTs/GETs it → 404; survey UI also points at external `lesson-survey-app.vercel.app` | In-app outcome capture is broken/dead-ended | P0 (ship or hide) |
| **Group/curriculum → note → billing** | No group-note generation; no attendance→billing bridge despite `duration_minutes` being captured | Triple entry: attendance, then per-person note, then billing unit | P1 |
| **Advisor advice → record** | RAG advisor has no "save to note/attach to participant"; conversations are user+org only | Guidance is lost when the conversation is deleted | P1 |
| **Orphaned voice cluster** | `advisor-library` reads `advisor_sessions`, but the current RAG chat writes `advisor_conversations`; nothing writes `advisor_sessions` | "Session Library" is permanently empty; `advisor-summary` (the one feature that turned advice into tool deep-links) is dead | P1 (delete or rebuild) |

---

## 5. 🟠 Missing Standard-of-Work Spine (what RDP has and PSS doesn't)

These are the capabilities that turn a collection of tools into a tool that *drives* a standard of work.

- **No PSS work-queue dashboard.** `app/page.tsx` is a static launcher grid; the only dynamic signal is one overdue-plan counter. RDP's coach dashboard shows: my caseload, assessments in progress, plans in progress, referrals to follow up, upcoming sessions, **assessments due/past due**, and **"participants to call today."** The data exists (`primary_pss_id`, note `status`, `next_review_date`) but is never assembled. **(P1, M)**
- **No supervisor review + co-signature for notes.** `GET /api/session-notes` filters `WHERE user_id = …`, so a supervisor literally cannot see a PSS's notes through the API. `session_notes` has no `reviewed_by/reviewed_at/review_status`. Supervisors have a role with no powers. (The service-log `service_approvals` pattern is the model to copy.) **(P1, L)**
- **No note finalize/lock lifecycle.** `status` supports draft/review/approved but **no UI ever transitions a note out of draft**, and PATCH lets an "approved" note be overwritten forever. Billable clinical records are mutable with no version history. **(P0/P1, L)**
- **No agency reporting/analytics.** No notes-per-PSS, billing-readiness %, assessment-completion, or productivity rollups for owner/admin. RDP's super-admin reporting is a core paid tier. **(P1, M)**
- **No task/reminder/notification system.** One hard-coded overdue counter is the entire proactive surface. No note-due, review-due, reassessment-due, or follow-up reminders; the Resend + Twilio channels already exist and are unused for this. **(P2, L)**
- **No reassessment cadence.** Assessments are point-in-time inserts; FLOC-1's own UI says "intake / during stay / exit" but nothing schedules or reminds. RDP schedules 30/60/90-day intervals. **(P1, M)**
- **No outcome trend visualization.** History views are flat lists; no delta-vs-prior, no line chart, no participant rollup — despite `created_at`/`recorded_at` supporting it. RDP shows recovery-capital-over-time. **(P1, M)**
- **No global search / participant 360 in nav.** A `snapshot` endpoint exists but isn't wired into navigation; the header exposes only ~6 of ~20 modules; org-switch does a full page reload. **(P2, M)**
- **No telephone-recovery-support schedule.** RDP's recurring-call schedule (days/times, did they answer) has no equivalent. **(P2, M)**

---

## 6. 🔴 Clinical-Correctness Defects (assessments)

- **MIRC-28 is AI-scored against the wrong items.** Items 15–28 differ between the canonical `lib/assessments/questionnaires.ts` (what the participant answers) and `app/api/recovery-assessments/[id]/analyze/route.ts` (what the AI scores) — different question text *and* different reverse-scoring flags. `recovery-capital/comprehensive/route.ts` has yet a third copy. The participant answers one instrument; the AI interprets a different one → **clinically invalid output.** **(P0, M — unify to one source of truth.)**
- **MIRC-28 percentage uses the wrong max.** History view divides by **140**; true max is **112** (28×4). Every MIRC-28 percentage shown to staff is understated. **(P0, S.)**
- **Silent default answers corrupt scores.** BARC-10 uses `answers[qN] || 3` and comprehensive uses `|| 2` for missing items — a skipped item is silently scored at the midpoint instead of flagged. **(P1, S.)**

---

## 7. Per-Module Summary (condensed)

### Intake & Participants
Solid 10-step billing-grade wizard; `intakeFormTypes.ts` is a clean single source of truth. **Gaps:** intake is all-or-nothing (no draft/resume — `status` hardcoded `completed`); the billing/clinical section is **not shown in read mode** (invisible without re-opening the editor); "on file" fields have no file upload (S3 exists but unused); no eligibility-staleness flag; no duplicate detection on re-referral; list search is name-only/capped-100 with no billing-readiness column despite the lib advertising one; gender/insurance value keys drift between participant and intake forms (auto-filled gender renders blank). **Top fixes:** show billing data in read mode (P0,M); draft/resume (P0,M); billing-readiness list filter (P0,M); document attachments (P1,L).

### Documentation (Session Notes & Service Logs)
Multiple capture paths (record/dictate/upload/manual/quick) + a strong `service_plans` approval lifecycle with a real audit trail. **Gaps:** no note finalize/lock/co-sign (P0); **no `logAuditEvent` on any session-notes route** (P0, violates CLAUDE.md); service↔note link broken end-to-end (P0); **likely duplicate-save bug** on record/dictate (generate route inserts, then UI POSTs again → two rows, P1); inconsistent note bodies break the viewer (manual→`pss_summary`, quick→`pss_note.content` which the detail page doesn't render, P1); a separate orphaned `/session-note` Word-only group form with pre-checked MSE boilerplate (audit liability, P2); AI parse-failure writes placeholder text as a real note (P2).

### Recovery Planning & Assessments
Three weakly-connected systems (AI `saved_goals`, template `rc_plan_*`, point-in-time `recovery_assessments`). `rc-plans` is the **best-built, best-secured** module (consistent `requireOrgAccess`, e-signatures, lock). **Gaps:** assess→plan→goal→note linkage absent; no reassessment cadence/reminders; no trend view; plan review is a passive badge with no default cadence; **"Revise Plan" mutates signed content in place** (no immutable versioned artifact, P1); the MIRC-28 defects in §6; cross-tenant holes in §3; uneven audit (`saved-goals` logs nothing). Goals can float free of any participant. Heavy constant duplication (`goalAreas` ×3) caused the MIRC drift.

### Groups & Curriculum
Curriculum Manager and Lesson Library track their specs closely (per-participant module progress, sticky completions, 145 templates, clone-to-use). **Gaps:** `/api/lesson-surveys` is **missing entirely** → My Lessons survey buttons 404 (P0); two parallel attendance systems with different status vocabularies and no relationship; lessons can't attach to curriculum modules or group activities (rich AI content disconnected from delivery); no group-note generation; no attendance→billing bridge; Reports tab is a "coming soon" stub (grant export was a day-one spec item); `saved_lessons` is user-scoped not org-scoped (teams can't share); curriculum session attendees not org-checked (§3); status changes unaudited.

### Participant Engagement (Kiosk, Journey, Messaging, Journaling)
**Kiosk is the most complete, most security-conscious module** — token-as-credential, no enumeration, lockout, full audit; matches the Phase-2 spec. Messaging is org-scoped and membership-checked. **Gaps:** journal review loop dead (`pss_viewed` never set, P1); journey `linked_*` columns never populated; two-way messaging has **no delivery leg** (a participant message is just a DB row — no SMS/email/push; PSS learns of replies only via 30s polling); read receipts are decorative (`messages.status` never advances); dead buttons (Archive/Mute/Discard/Attach have no handlers); **the §3 security holes (journal, journey insights, journey CRUD)**; no proactive surfacing of risk-cluster / 14-day-inactivity insights; crisis handling is passive banners only (no keyword/mood escalation). `lib/sms/twilio.ts` exists but is wired only to assessment invites.

### AI Advisor & Resources
The RAG **Peer Advisor is the strongest AI piece** — evidence-grounded, visible citations, history. **Gaps:** `ally-intelligence` open PHI hole (§3); no `logAuditEvent` on any AI route; advice can't be captured into the record; treatment-locator has no referral loop; citations don't deep-link to the doc-library PDF; the entire **orphaned voice cluster** (advisor-library/sessions/summary/Hume) shows an empty page; broken `/login` redirect (should be `/auth/signin`) 404s unauthenticated users on two pages; conversation titles never set (blank history list); `help/page.tsx` still describes the advisor as a *voice* tool (stale/misleading); no PHI-redaction or crisis/988 guardrail before sending to RAG/OpenAI.

### Platform & Oversight
See §3 and §5. Onboarding is org-creation only (no profile/credential capture, no guided first-run). Settings have no org-level "standards" configuration (required-fields policy, review cadence, note templates). Caseload assignment exists at the data layer (`primary_pss_id`, `pss_filter=mine|unassigned`) but is never surfaced as a "my caseload" home.

---

## 8. Prioritized Roadmap

Phased so each phase ships something the PSS or supervisor feels.

### Phase 0 — Security & Correctness Hardening (P0, ~1–2 weeks)
*Non-negotiable; these are breach-class and clinical-validity issues.*
1. Org-access/auth sweep across all §3 endpoints (one coordinated PR + a guard checklist/test). **M**
2. Role-gate + org-scope `service-log/approve`. **S**
3. Add `logAuditEvent` to clinical/security events: session-notes CRUD, recovery-assessments, service approvals, **org create & staff invite**, AI-over-PHI routes. **M**
4. Fix MIRC-28: unify the item bank to `lib/assessments/questionnaires.ts`; fix `/140`→`/112`; stop silent midpoint defaults. **M**
5. Migrate the ~13 top-level `neon()` routes to the `@/lib/db` `sql` proxy. **S**
6. Ship or hide the missing `/api/lesson-surveys` routes (stop the 404s). **S**

### Phase 1 — Close the Loops (P0/P1, ~3–5 weeks)
*Make the processes the PSS starts actually finish.*
1. Wire service plan ↔ session note (read `serviceId`, call `link-note`, show both ways). **M**
2. Note lifecycle: `draft → submitted → approved/locked`, block PATCH on locked, keep version history. **L**
3. Supervisor review queue + co-sign (org-scope team-notes read; `reviewed_by/at/status`). **L**
4. Fix the record/dictate **double-save** and unify the note body model so the viewer always renders. **M**
5. Journal review loop: PSS endpoint to set `pss_viewed=true` (audited); badge clears. **S**
6. Assessment `recommendedGoals` → "Create goal / Add to plan" actions. **M**
7. Intake: draft/resume + show billing/clinical section in read mode. **M**
8. Note Reviewer: load saved notes, write score back onto the note. **M**

### Phase 2 — The Standard-of-Work Spine (P1, ~4–6 weeks)
*Turn the launcher into a tool that drives the standard.*
1. **PSS work-queue dashboard:** my caseload, draft notes, overdue reviews, assessments due, today's groups/sessions, "to call today." **M**
2. Reassessment cadence + "due/overdue" surface (reuse the invite sender). **M**
3. Outcome trend views (line/delta per participant across instruments and plan outcomes). **M**
4. Agency analytics page (notes/PSS, billing-readiness %, assessment completion, unassigned participants). **M**
5. Plan versioning: snapshot the signed artifact before "Revise." **M**
6. Referral loop on treatment-locator (tracked referral + follow-up on the participant record). **M**
7. Group/curriculum → draft per-attendee notes; attendance→billing bridge. **L**

### Phase 3 — Efficiency & Polish (P2, ongoing)
1. Lightweight task/reminder model surfaced on the work-queue + emailed via Resend/Twilio. **L**
2. Note templates + "copy my last note for this participant." **M**
3. Server-side search/filters/pagination across participants, notes, journey. **M**
4. Global search + participant 360 wired into the header; org-switch without full reload. **M**
5. Delete or rebuild the orphaned voice cluster; fix `/login` redirects; set conversation titles; update `help` copy. **S–M**
6. Capture advisor advice into notes; deep-link citations to the doc-library. **M**
7. Org-scope `saved_lessons`; link lessons to modules/activities; build curricula Reports/CSV. **M–L**
8. Real message delivery (SMS/email/push) + truthful read receipts; wire the dead buttons. **M–L**
9. Document attachments (S3) for intake "on file" fields; duplicate-participant detection; bulk participant actions. **M**
10. Crisis keyword/mood escalation across messaging + journaling. **M**
11. Extract shared constants/components (kill the duplication that caused the MIRC drift). **S**

---

## 9. Benchmark Gap vs RDP (quick scorecard)

| RDP capability | PSS status |
|---|---|
| Org 10k-ft dashboard (engaged / active-support / in-progress) | ❌ static launcher only |
| Coach dashboard (caseload, due, to-call-today) | ❌ data exists, not assembled |
| Telephone Recovery Support schedule | ❌ none |
| Participant lifecycle (engage→discharge→re-engage) | 🟡 status exists; no discharge flow/waitlist-at-create |
| Status & involvement over time | 🟡 journey tracker is the analog; not the same model |
| Consents / file attachments | 🟡 checkboxes, no file upload |
| Supports/services, transportation, volunteer logs | ✅ service-resource-log |
| Recovery coaching session w/ 15-min billable units | 🟡 service-log has units; not linked to notes/billing |
| Outcomes & referrals loop | ❌ no referral tracking |
| Built-in + custom assessments, scheduled intervals | 🟡 instruments exist; no cadence/scheduling |
| Recovery-capital-over-time graph | ❌ flat lists only |
| Group activities & attendance | ✅ groups + kiosk |
| Reporting + Excel/CSV export | 🟡 service-resource-log CSV only; no agency reports |
| Kiosk (signup + check-in, QR) | ✅ strongest module |
| **AI advisor / generation / RAG (PSS's edge)** | ✅ ahead of RDP |

**Net:** PSS already beats RDP on AI and on the kiosk/curriculum builds, but trails badly on the **dashboard/oversight/reporting spine** and on **closing operational loops** — exactly the things that make RDP feel like a "system of record." Phases 1–2 close that gap.

---

## 10. The One-Paragraph Answer to "Are we completing the full process?"

**No — and that's the highest-leverage thing to fix.** Individually the modules are good, but the product consistently builds the front half of a workflow and omits the back half: it computes billing-readiness but can't bill; it plans a service but can't link the note that delivers it; it recommends goals but can't create them; it finds a referral but can't track it; it flags a new journal entry but can't mark it reviewed; it assesses but can't schedule the reassessment; it documents but can't route the note to a supervisor. Closing those loops (Phase 1) plus standing up the PSS work-queue and supervisor oversight (Phase 2) — on top of an urgent security/correctness hardening pass (Phase 0) — is what converts Peer Support Studio from a strong set of tools into a tool that actually drives a standard of work.
