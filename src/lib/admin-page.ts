/** Shared bounds for admin list queries. PostgREST otherwise stops at 1000 rows. */
export const EXPORT_PAGE_SIZE = 1000;
export const EXPORT_MAX_ROWS = 100_000;

/**
 * Walk a PostgREST export with `.range`. A single `.limit(10000)` is still
 * clamped to the server's max rows (1000), so each page asks for at most
 * EXPORT_PAGE_SIZE rows. Throws once the export would pass EXPORT_MAX_ROWS
 * instead of silently truncating.
 */
export async function collectPagedRows<T>(
  load: (from: number, to: number) => Promise<T[]>,
  pageSize = EXPORT_PAGE_SIZE,
  maxRows = EXPORT_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const batch = await load(from, from + pageSize - 1);
    if (rows.length + batch.length > maxRows) {
      throw new Error(`Export stopped after ${maxRows} rows. Narrow the filters and try again.`);
    }
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    from += pageSize;
  }
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function pageBounds(page?: number | null, pageSize?: number | null) {
  const p = Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1;
  const requested =
    Number.isFinite(pageSize) && (pageSize as number) >= 1
      ? Math.floor(pageSize as number)
      : DEFAULT_PAGE_SIZE;
  const size = Math.min(MAX_PAGE_SIZE, requested);
  const from = (p - 1) * size;
  return { page: p, pageSize: size, from, to: from + size - 1 };
}

/**
 * Escape a search string for `ilike` and for a PostgREST `.or()` / `.ilike()` value.
 * `%`, `_`, and `\` stay in the search as literals. Commas, dots, colons, parentheses,
 * quotes, and spaces are quoted so they do not change the filter grammar.
 */
export function ilikePattern(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const literal = trimmed.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const wrapped = `%${literal}%`;
  if (!/[,.():\\"\s]/.test(wrapped)) return wrapped;
  return `"${wrapped.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Earlier of the caller's end filter and the moment the export started. */
export function exportWindowEnd(requestedTo: string | null | undefined, startedAt: string): string {
  if (requestedTo && requestedTo < startedAt) return requestedTo;
  return startedAt;
}

/** CSV cell. A leading = + - or @ is prefixed so a spreadsheet does not treat it as a formula. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
