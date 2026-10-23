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
 * Strip characters that break a PostgREST `or()` filter or act as LIKE wildcards,
 * then wrap the remainder for `ilike`.
 */
export function ilikePattern(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const safe = trimmed
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return null;
  return `%${safe}%`;
}
