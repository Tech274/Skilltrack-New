import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { listSavedLeads, type SavedLead } from "@/lib/admin-leads.functions";

const SOURCE_LABEL: Record<string, string> = {
  book_a_call: "Book a call",
  results_gate: "Results gate",
  org_seats: "Org seats",
  other: "Other",
};

type LeadListResult = {
  rows: SavedLead[];
  total?: number;
  page?: number;
  pageSize?: number;
};

/**
 * Form enquiries stored in `leads`. Rendered on the canonical Leads page.
 * SCRUM-150 may add `total` / `page` to `listSavedLeads`. When `total` is
 * present the server already applied search and paging; otherwise this panel
 * filters the returned page in the browser (today's behaviour).
 */
export function SavedLeadsPanel() {
  const fn = useServerFn(listSavedLeads);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "leads", page, q, source],
    queryFn: () =>
      fn({
        data: {
          page,
          pageSize,
          search: q.trim() || undefined,
          source: source === "all" ? undefined : source,
        },
      }) as Promise<LeadListResult>,
  });

  const serverPaged = typeof data?.total === "number";
  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (serverPaged) return all;
    const s = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (source === "all" || r.source === source) &&
        (!s || [r.name, r.email, r.phone].some((v) => v.toLowerCase().includes(s))),
    );
  }, [data, q, source, serverPaged]);

  const total = serverPaged ? (data?.total ?? 0) : rows.length;
  const pageCount = Math.max(1, Math.ceil((serverPaged ? total : rows.length) / pageSize));

  return (
    <section className="mt-12 border-t border-border pt-8" id="saved-enquiries">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Saved form enquiries</h2>
          <p className="text-sm text-muted-foreground">
            Every enquiry written to the database, newest first. The pipeline above is the Sales
            sheet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone"
            className="rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "enquiry" : "enquiries"}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading enquiries…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-destructive/40 p-4 text-sm text-destructive"
        >
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-muted-foreground">No saved enquiries yet.</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sheet</th>
              </tr>
            </thead>
            <tbody>
              {(serverPaged ? rows : rows.slice((page - 1) * pageSize, page * pageSize)).map(
                (r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2">{SOURCE_LABEL[r.source] ?? r.source}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2">
                      <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                        {r.email}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <a href={`tel:${r.phone}`} className="hover:underline">
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.sheet_synced_at ? (
                        <span className="text-success">Copied</span>
                      ) : r.sheet_error ? (
                        <span className="text-warning" title={r.sheet_error}>
                          Failed
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
