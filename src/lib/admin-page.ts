/** Shared bounds for admin list queries. PostgREST otherwise stops at 1000 rows. */
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
