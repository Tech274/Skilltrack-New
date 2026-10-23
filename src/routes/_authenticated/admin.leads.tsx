import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { listSavedLeads } from "@/lib/admin-leads.functions";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: [
      { title: "Leads — SkillTrack-365 Admin" },
      { name: "description", content: "Every enquiry saved from SkillTrack forms." },
      { property: "og:title", content: "Leads — SkillTrack-365 Admin" },
      { property: "og:description", content: "Every enquiry saved from SkillTrack forms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsPage,
});

const SOURCE_LABEL: Record<string, string> = {
  book_a_call: "Book a call",
  results_gate: "Results gate",
  org_seats: "Org seats",
  other: "Other",
  exam_date: "Exam date",
};

function LeadsPage() {
  const fn = useServerFn(listSavedLeads);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: () => fn(),
  });
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (source === "all" || r.source === source) &&
        (!s ||
          [r.name, r.email, r.phone, r.certs, r.target_exam_date].some((v) =>
            (v ?? "").toLowerCase().includes(s),
          )),
    );
  }, [data, q, source]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Every enquiry saved from the site, newest first.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className="rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading leads…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-md border border-destructive/40 p-4 text-sm text-destructive"
        >
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-muted-foreground">No leads yet.</div>
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
                <th className="px-3 py-2">Certification</th>
                <th className="px-3 py-2">Exam date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sheet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                  <td className="px-3 py-2">{r.certs || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.target_exam_date || "—"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
