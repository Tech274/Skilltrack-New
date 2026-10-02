import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgOverview } from "@/lib/org.functions";
import { categories, getCert } from "@/lib/certifications";

export const Route = createFileRoute("/_authenticated/org/$slug/skills")({
  component: SkillsHeatmap,
});

function SkillsHeatmap() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgOverview);
  const q = useQuery({ queryKey: ["org-overview", slug], queryFn: () => fn({ data: { slug } }) });

  if (q.isLoading) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-destructive">{(q.error as Error).message}</div>;

  const { members, certifications } = q.data!;
  const teams = Array.from(new Set(members.map((m) => m.team ?? "Other"))).sort();
  const cats = categories.map((c) => c.slug);

  // Build matrix team x category -> count of passed
  const matrix: Record<string, Record<string, { passed: number; studying: number; total: number }>> = {};
  for (const t of teams) {
    matrix[t] = {};
    const teamMemberIds = members.filter((m) => (m.team ?? "Other") === t).map((m) => m.id);
    for (const cat of cats) {
      const teamCerts = certifications.filter((c) => teamMemberIds.includes(c.member_id));
      const inCat = teamCerts.filter((c) => getCert(c.certification_slug)?.categorySlug === cat);
      matrix[t][cat] = {
        passed: inCat.filter((c) => c.status === "passed").length,
        studying: inCat.filter((c) => c.status === "studying").length,
        total: teamMemberIds.length,
      };
    }
  }

  const max = Math.max(
    1,
    ...teams.flatMap((t) => cats.map((c) => matrix[t][c].passed)),
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight">Workforce skills heatmap</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Certified count per team × skill area. Hover a cell for breakdown.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  Team
                </th>
                {cats.map((c) => (
                  <th
                    key={c}
                    className="p-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {categories.find((x) => x.slug === c)?.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t}>
                  <td className="py-2 pr-3 text-xs font-medium">{t}</td>
                  {cats.map((c) => {
                    const cell = matrix[t][c];
                    const intensity = cell.passed / max;
                    return (
                      <td key={c} className="p-1">
                        <div
                          title={`${t} · ${categories.find((x) => x.slug === c)?.name}\n${cell.passed} passed, ${cell.studying} studying of ${cell.total} members`}
                          className="flex h-14 flex-col items-center justify-center rounded-md border border-border text-[11px] font-semibold"
                          style={{
                            background: `color-mix(in oklab, oklch(0.78 0.15 78) ${Math.round(intensity * 70)}%, transparent)`,
                          }}
                        >
                          <span>{cell.passed}</span>
                          {cell.studying > 0 && (
                            <span className="text-[9px] font-normal text-muted-foreground">
                              +{cell.studying} learning
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>Less coverage</span>
          <div className="flex h-2 w-40 overflow-hidden rounded-full border border-border">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div
                key={v}
                className="flex-1"
                style={{ background: `color-mix(in oklab, oklch(0.78 0.15 78) ${v * 70}%, transparent)` }}
              />
            ))}
          </div>
          <span>More coverage</span>
        </div>
      </div>
    </div>
  );
}
