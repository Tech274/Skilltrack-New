import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgOverview } from "@/lib/org.functions";
import { getCert } from "@/lib/certifications";

export const Route = createFileRoute("/_authenticated/org/$slug/members")({
  component: MembersList,
});

function MembersList() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgOverview);
  const q = useQuery({ queryKey: ["org-overview", slug], queryFn: () => fn({ data: { slug } }) });

  if (q.isLoading) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-destructive">{(q.error as Error).message}</div>;

  const { members, certifications } = q.data!;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h2 className="text-lg font-semibold">Members ({members.length})</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Role assignments. Invite flow & SCIM provisioning ship in the enterprise plan.
      </p>
      <div className="mt-5 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Team</Th>
              <Th>Title</Th>
              <Th>Role</Th>
              <Th>Certifications</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
              const memberCerts = certifications.filter((c) => c.member_id === m.id);
              const passed = memberCerts.filter((c) => c.status === "passed");
              return (
                <tr key={m.id}>
                  <Td className="font-medium">{m.full_name ?? "—"}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{m.email ?? "—"}</Td>
                  <Td>{m.team ?? "—"}</Td>
                  <Td className="text-xs">{m.title ?? "—"}</Td>
                  <Td>
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      {m.role}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {passed.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {passed.slice(0, 4).map((c) => {
                        const meta = getCert(c.certification_slug);
                        return (
                          <span
                            key={c.id}
                            className="rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-[10px] text-success"
                          >
                            {meta?.code ?? c.certification_slug.slice(0, 6)}
                          </span>
                        );
                      })}
                      {passed.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{passed.length - 4}</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 ${className ?? ""}`}>{children}</td>;
}
