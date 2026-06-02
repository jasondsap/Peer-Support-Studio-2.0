/**
 * One-time data migration: build system-owned lesson_templates from the intern's
 * new-batch saved_lessons, then clean up her library down to the preserved personal lessons.
 *
 * This script is NON-DESTRUCTIVE on its own: it only READS the database and WRITES a
 * SQL file. Jason pastes that file into the Neon SQL Editor to apply it.
 *
 * Prerequisite: apply migrations/008_create_lesson_templates.sql first (creates the table).
 *
 * Usage:
 *   node scripts/migrate-lesson-templates.mjs                 generate the SQL file
 *   node scripts/migrate-lesson-templates.mjs --allow-missing proceed even if some seed topics are unmatched
 *   node scripts/migrate-lesson-templates.mjs --force         ignore the idempotency guard
 *
 * Reads DATABASE_URL from the environment, falling back to .env.local.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SEED_PATH = join(ROOT, 'data', 'lesson_templates_seed.json');
const OUTPUT_PATH = join(ROOT, 'migrations', '008_lesson_templates_data.sql');

// ── Known inputs (from the brief, section 4) ────────────────────────────────
const INTERN_USER_ID = 'd091f630-14b9-47ea-afe5-efd01c97476c';
const NEW_BATCH_CUTOFF = '2026-05-20';
const PRESERVE_IDS = [
    '3a90a284-2db2-436a-8e50-391959a64359',
    '56f81bb8-2bdc-4d1e-86c2-b2ed52377998',
];

const args = process.argv.slice(2);
const ALLOW_MISSING = args.includes('--allow-missing');
const FORCE = args.includes('--force');
// --dry-run: skip the table-exists guard so the matcher can be validated against a
// database where lesson_templates has not been created yet. Still prints the report
// and writes the SQL file. Reads remain read-only; nothing is applied to the DB.
const DRY_RUN = args.includes('--dry-run');

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    const envPath = join(ROOT, '.env.local');
    if (existsSync(envPath)) {
        const lines = readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
            if (m) {
                return m[1].replace(/^["']|["']$/g, '').trim();
            }
        }
    }
    return null;
}

function normalize(s) {
    if (!s) return '';
    return s
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.!?,;:]+$/g, '');
}

// SQL string literal (standard_conforming_strings assumed; double single quotes).
function lit(value) {
    if (value === null || value === undefined) return 'NULL';
    return `'${String(value).replace(/'/g, "''")}'`;
}

function intLit(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? String(n) : '99';
}

async function main() {
    const databaseUrl = loadDatabaseUrl();
    if (!databaseUrl) {
        console.error('ERROR: DATABASE_URL not set and not found in .env.local');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    // ── Load seed ────────────────────────────────────────────────────────────
    const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
    const seedLessons = seed.lessons;
    if (!Array.isArray(seedLessons) || seedLessons.length === 0) {
        console.error('ERROR: seed file has no lessons');
        process.exit(1);
    }

    // ── Idempotency guard ──────────────────────────────────────────────────────
    let existingTitles = [];
    if (!DRY_RUN) {
        try {
            const rows = await sql`SELECT title FROM lesson_templates`;
            existingTitles = rows.map((r) => normalize(r.title));
        } catch (err) {
            console.error(
                'ERROR: could not read lesson_templates. Apply migrations/008_create_lesson_templates.sql first.'
            );
            console.error(err.message);
            process.exit(1);
        }
    } else {
        console.log('[dry-run] skipping lesson_templates idempotency guard\n');
    }
    if (existingTitles.length > 0 && !FORCE) {
        const seedTitleSet = new Set(seedLessons.map((l) => normalize(l.title)));
        const collision = existingTitles.some((t) => seedTitleSet.has(t));
        if (collision) {
            console.error(
                `ERROR: lesson_templates already contains rows matching seed titles (${existingTitles.length} rows). ` +
                    'Pass --force to override.'
            );
            process.exit(1);
        }
    }

    // ── Fetch new-batch DB rows (oldest first for canonical tiebreak) ──────────
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

    // ── Match: longest seed-title prefix of normalized DB topic wins ───────────
    const seedByNorm = seedLessons.map((l) => ({ ...l, norm: normalize(l.title) }));
    // longest first so a shorter title can't shadow a more specific match
    seedByNorm.sort((a, b) => b.norm.length - a.norm.length);

    const buckets = new Map(); // seed.row_number -> [dbRows...]
    let unmatchedRows = 0;

    for (const row of dbRows) {
        const topicNorm = normalize(row.topic);
        const match = seedByNorm.find((s) => s.norm.length > 0 && topicNorm.startsWith(s.norm));
        if (!match) {
            unmatchedRows += 1;
            continue;
        }
        if (!buckets.has(match.row_number)) buckets.set(match.row_number, []);
        buckets.get(match.row_number).push(row);
    }

    // ── Determine canonical row per seed, collect unmatched seeds ──────────────
    const templates = [];
    const xlsxUnmatched = [];
    for (const s of seedLessons) {
        const bucket = buckets.get(s.row_number);
        if (!bucket || bucket.length === 0) {
            xlsxUnmatched.push(s.title);
            continue;
        }
        // bucket preserves the query's (created_at ASC, id ASC) order
        templates.push({ seed: s, canonical: bucket[0], candidates: bucket.length });
    }

    // ── Report ─────────────────────────────────────────────────────────────────
    const canonicalIds = new Set(templates.map((t) => t.canonical.id));
    const nonCanonicalDupes = dbRows.filter(
        (r) => !canonicalIds.has(r.id) && !PRESERVE_IDS.includes(r.id)
    ).length;
    const settingMismatch = templates.filter(
        (t) => t.canonical.setting_type !== t.seed.setting_type
    ).length;

    const preCutoff = (
        await sql`
            SELECT COUNT(*)::int AS n FROM saved_lessons
            WHERE user_id = ${INTERN_USER_ID}::uuid AND created_at < ${NEW_BATCH_CUTOFF}::date
        `
    )[0].n;

    console.log('───────────────────────────────────────────────');
    console.log(`Seed entries: ${seedLessons.length}`);
    console.log(`New-batch DB rows (>= ${NEW_BATCH_CUTOFF}): ${dbRows.length}`);
    console.log(`Unique topics matched: ${templates.length} / ${seedLessons.length}`);
    console.log(`Canonical source rows (will become templates): ${templates.length}`);
    console.log(`Non-canonical dupes in new batch (will be deleted): ${nonCanonicalDupes}`);
    console.log(`Old pre-cutoff DB rows (will be deleted): ${preCutoff}`);
    console.log(`DB rows unmatched to any seed: ${unmatchedRows}`);
    console.log(`xlsx seeds with no DB candidate: ${xlsxUnmatched.length}`);
    console.log(`Setting label differs from generated content setting: ${settingMismatch}`);
    console.log(`Preserve IDs (will remain): ${PRESERVE_IDS.length}`);
    console.log(`Templates produced: ${templates.length}`);
    console.log('───────────────────────────────────────────────');

    if (xlsxUnmatched.length > 0) {
        console.log('\nUNMATCHED xlsx seed titles:');
        xlsxUnmatched.forEach((t) => console.log(`  - ${t}`));
        if (!ALLOW_MISSING) {
            console.error(
                `\nERROR: ${xlsxUnmatched.length} seed topic(s) have no DB candidate. ` +
                    'Pass --allow-missing to generate SQL for the matched topics only.'
            );
            process.exit(1);
        }
        console.log('\n--allow-missing set: proceeding with matched topics only.\n');
    }

    // ── Build SQL ────────────────────────────────────────────────────────────
    const valueRows = templates.map(({ seed: s, canonical: c }) => {
        const cols = [
            'gen_random_uuid()',
            lit(s.title), // title  (canonical xlsx)
            lit(s.title), // topic  (canonical xlsx, not DB combined string)
            lit(s.description), // description (xlsx)
            lit(s.category), // category (xlsx)
            intLit(s.category_order), // category_order (xlsx)
            lit(s.session_type), // session_type (xlsx)
            lit(s.setting_type), // setting_type (xlsx)
            lit(c.session_length), // session_length (DB canonical)
            lit(c.recovery_model), // recovery_model (DB canonical)
            lit(c.group_size), // group_size (DB canonical)
            lit(c.group_composition), // group_composition (DB canonical)
            lit(c.facilitator_guide), // facilitator_guide (DB canonical)
            lit(c.participant_handout), // participant_handout (DB canonical)
            lit(c.lesson_json), // lesson_json (DB canonical)
            lit(c.gamma_presentation_url), // gamma_presentation_url (DB canonical)
            'true', // is_published
            '0', // use_count
            'NOW()', // created_at
            'NOW()', // updated_at
        ];
        return `    (${cols.join(', ')})`;
    });

    const preserveList = PRESERVE_IDS.map((id) => `    ${lit(id)}::uuid`).join(',\n');

    const out = `BEGIN;

INSERT INTO lesson_templates (
    id, title, topic, description, category, category_order,
    session_type, setting_type, session_length, recovery_model,
    group_size, group_composition, facilitator_guide,
    participant_handout, lesson_json, gamma_presentation_url,
    is_published, use_count, created_at, updated_at
)
VALUES
${valueRows.join(',\n')}
;

DELETE FROM saved_lessons
WHERE user_id = ${lit(INTERN_USER_ID)}::uuid
  AND id NOT IN (
${preserveList}
  );

COMMIT;
`;

    writeFileSync(OUTPUT_PATH, out, 'utf8');
    console.log(`\nWrote ${templates.length} template inserts + cleanup DELETE to:`);
    console.log(`  ${OUTPUT_PATH}`);
    console.log('\nReview the file, then paste it into the Neon SQL Editor (PSS main DB).');
    console.log('SQL is wrapped in a single transaction; change COMMIT to ROLLBACK to dry-run.');
}

main().catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
});
