# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # next dev (http://localhost:3000)
npm run build    # next build — note: type checking is disabled (see next.config.js)
npm run start    # next start (production server)
npm run lint     # next lint
```

There is no test framework configured. `npm run db:push` is a no-op stub — schema changes are applied manually via the Neon SQL Editor (no migration tooling in the repo). The DB schema referenced by `README.md` as `schema.sql` is not checked in.

## Stack

Next.js 14 (App Router) · TypeScript (strict, but build-time type errors ignored) · Tailwind · NextAuth v4 with AWS Cognito · Neon serverless Postgres (`@neondatabase/serverless`). Deploys to AWS Amplify SSR (`amplify.yml`). Path alias `@/*` resolves to repo root.

AI/voice integrations layered in: Anthropic, OpenAI, AssemblyAI, Hume, Gamma, AWS Polly, AWS S3, AWS Bedrock, and an external RAG service (`RAG_API_URL`).

## Architecture

### Multi-tenant + HIPAA model

Every PHI-bearing table (`participants`, `goals`, `session_notes`, `recovery_assessments`, intake records) is scoped by `organization_id`. **Every query that touches these tables must filter by `organization_id`** — there is no row-level security backstop. API routes typically take `?organization_id=xxx` and validate org membership via `requireOrgAccess(orgId)` from `lib/auth.ts`.

User roles within an org are `owner | admin | supervisor | pss`. Use `requireOrgRole(orgId, allowedRoles)` for role-gated endpoints.

PHI-mutating endpoints should call `logAuditEvent(...)` from `lib/db.ts` (failures are swallowed by design — audit logging never breaks the request).

### Identity: two different user IDs

This trips people up constantly. Two IDs co-exist:

- **`session.user.id`** = the Cognito `sub` (string). This is what NextAuth puts in the JWT.
- **Internal UUID** = the `users.id` column in Postgres. This is what foreign keys point to (`participants.created_by`, `goals.created_by`, etc.).

To go from session → internal UUID, call `getInternalUserId(session.user.id, session.user.email)` from `lib/auth.ts`. It also self-heals: if a user record exists by email but lacks `cognito_sub`, the helper backfills it. Most API routes do `getSession()` → `getInternalUserId()` as their first two steps.

### Session shape

`lib/auth-options.ts` extends the NextAuth session with:

- `session.organizations[]` — every org the user belongs to (joined from `organization_members`)
- `session.currentOrganization` — resolved from `users.preferences->>'selected_org_id'` (JSONB), falling back to the first org. The org switcher in `components/Header.tsx` POSTs to `/api/user/select-org` to update this preference, then full-reloads.

JWT session, 8-hour `maxAge`.

### Database access (`lib/db.ts`)

**Always import `sql` from `@/lib/db`** — never call `neon(process.env.DATABASE_URL)` at module top-level in API routes. The exported `sql` is a Proxy that defers the `neon()` call until the first query, because Amplify SSR Lambdas don't always have env vars loaded at module-init time. (`lib/auth-options.ts` is the one place that breaks this rule — it's loaded inside Next's auth pipeline where env vars are guaranteed.)

`sql` supports both styles:

```ts
await sql`SELECT * FROM users WHERE id = ${userId}`;    // tagged template (preferred)
await sql('SELECT * FROM users WHERE id = $1', [id]);   // function call
```

Helpers on top of `sql`: `query`, `queryOne`, `insert(table, data)`, `update(table, data, where)`, `softDelete`, `hardDelete`, `logAuditEvent`, plus a few domain helpers (`getUserOrganizations`, `getOrCreateUser`, `getParticipantsByOrg`, `getParticipantById`).

### Directory layout — semi-organic, two mirrors

There are two parallel locations for several concept buckets. Both are in active use; prefer the one already used by neighboring code rather than consolidating:

| Concept    | Root              | Under `app/`         |
| ---------- | ----------------- | -------------------- |
| Components | `components/`     | `app/components/`    |
| Lib utils  | `lib/`            | `app/lib/`           |
| Types      | `types/`          | `app/types/`         |
| —          | —                 | `app/utils/`         |

Shared cross-cutting code (`auth.ts`, `db.ts`, `intakeFormTypes.ts`, `billingReadiness.ts`, global types) lives at root. Page-local helpers and components tend to live under `app/`.

### Intake & billing readiness

`lib/intakeFormTypes.ts` is the single source of truth for the multi-step intake form: it defines `IntakeFormData`, `INITIAL_FORM`, `fromDatabase()` (DB → form state), `toPayload()` (form state → API body), and the `STEPS` array. **Add new intake fields here first**, and they flow through load/edit/submit consistently.

`lib/billingReadiness.ts` computes `BillingHold[]` (blockers vs. warnings) from an intake record — used by the participant detail badge, intake save summary, list filter, and `/api/intake` (which persists the computed holds as `billing_readiness_holds` JSONB so list views don't recompute). When changing intake fields that affect billing, update `computeBillingReadiness()` in the same change.

## Environment

`.env.local` for dev; Amplify Console env vars for prod. All server-side env vars must also be re-declared under `env:` in `next.config.js` to be available to the Amplify SSR Lambda — adding a new env var requires editing both.

**AWS credentials use the `APP_AWS_` prefix** (`APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY`, `APP_AWS_REGION`) because Amplify reserves the `AWS_` namespace for itself. Code that calls AWS SDKs needs to read from these prefixed vars.

Cognito callback URL pattern: `{NEXTAUTH_URL}/api/auth/callback/cognito`.

## Conventions

- Soft-delete (`status='archived'` or `is_archived=true`) is the default; `hardDelete` is intentionally rare.
- API responses use `NextResponse.json({ error: '...' }, { status })` for errors — match this shape, callers depend on `data.error`.
- Most AI/long-running routes set `export const runtime = 'nodejs'` and `export const maxDuration = 60`. Keep those when adding new generation endpoints.
- Security headers (X-Frame-Options DENY, etc.) are set globally in `next.config.js` — don't try to override per-route.
