export function AdminListPager({
  page,
  pageSize,
  total,
  onPage,
  capped,
  hasMore,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** True when the directory migration is not applied and the result is incomplete. */
  capped?: boolean;
  /** When the total is only a lower bound, allow another page. */
  hasMore?: boolean;
}) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canNext = hasMore || page < pages;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
      <span>
        {total === 0 ? "0 rows" : `${from}–${to} of ${total}`}
        {capped ? " · results are capped until the directory migration is applied" : ""}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span>
          Page {page}
          {total > 0 ? ` of ${pages}` : ""}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
