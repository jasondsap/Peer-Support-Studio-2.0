/**
 * Date-only helpers that avoid the UTC off-by-one bug.
 *
 * Postgres `DATE` columns serialize to date-only strings ("2026-01-02").
 * `new Date("2026-01-02")` parses as midnight **UTC**, and rendering that in a
 * timezone behind UTC (anywhere in the Americas) shows the *previous* day.
 * Appending a local time component forces local-time interpretation.
 *
 * Use these for DATE-only values (date_of_birth, intake_date, planned_date,
 * service_date, obtained_date, etc.). For full timestamps (created_at,
 * updated_at, signed_at, …) plain `new Date(value)` is already correct.
 */

/**
 * Format a DATE-only value ("YYYY-MM-DD", or a timestamp we only want the date
 * of) in local time without shifting the day.
 */
export function formatDateOnly(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'en-US'
): string {
  if (!value) return '';
  const ymd = String(value).slice(0, 10); // tolerate "YYYY-MM-DD" or a full ISO timestamp
  const d = new Date(ymd + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, options);
}

/**
 * Parse a DATE-only value into a Date at local midnight (no UTC shift).
 * Useful when you need a Date object (e.g. for day-diff math) rather than a string.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Today's date as a "YYYY-MM-DD" string in the **local** timezone.
 * Use this for form defaults instead of `new Date().toISOString().split('T')[0]`,
 * which returns the UTC date and can pre-fill tomorrow late in the evening.
 */
export function todayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
