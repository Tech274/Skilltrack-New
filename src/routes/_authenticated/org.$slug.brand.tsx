import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrgBySlug } from "@/lib/org.functions";
import { OrgBrandSettings } from "@/components/org/org-brand-settings";

export const Route = createFileRoute("/_authenticated/org/$slug/brand")({
  head: () => ({ meta: [{ title: "Brand — Workspace" }] }),
  component: OrgBrandPage,
});

function OrgBrandPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgBySlug);
  const { data: org, isLoading } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="text-xl font-semibold tracking-tight">Brand & logos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload separate light- and dark-mode logos. They appear in your workspace header and on invoices and emails sent for this organization.
      </p>
      <div className="mt-6">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {org && <OrgBrandSettings orgId={org.id} />}
      </div>
    </div>
  );
}
