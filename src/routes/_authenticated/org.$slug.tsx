import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, BarChart3, ShieldCheck, Grid3x3, Users2, Palette, Settings } from "lucide-react";
import { getOrgBySlug } from "@/lib/org.functions";
import { getOrgBranding } from "@/lib/org-branding.functions";

export const Route = createFileRoute("/_authenticated/org/$slug")({
  component: OrgLayout,
});

function OrgLayout() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgBySlug);
  const brandFn = useServerFn(getOrgBranding);
  const q = useQuery({
    queryKey: ["org", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const orgId = q.data?.id;
  const brand = useQuery({
    queryKey: ["org-branding", orgId],
    queryFn: () => brandFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  return (
    <div className="bg-mesh min-h-screen">
      <div className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {brand.data?.logo_light_url ? (
                <img
                  src={brand.data.logo_light_url}
                  alt={`${q.data?.name ?? slug} logo`}
                  width={40}
                  height={40}
                  decoding="async"
                  className="h-10 w-10 rounded-lg object-contain bg-white p-1 dark:hidden"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary dark:hidden">
                  <Building2 size={18} className="text-primary-foreground" />
                </div>
              )}
              {brand.data?.logo_dark_url ? (
                <img
                  src={brand.data.logo_dark_url}
                  alt={`${q.data?.name ?? slug} logo`}
                  width={40}
                  height={40}
                  decoding="async"
                  className="h-10 w-10 rounded-lg object-contain bg-neutral-900 p-1 hidden dark:block"
                />
              ) : (
                <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary dark:flex">
                  <Building2 size={18} className="text-primary-foreground" />
                </div>
              )}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-primary">Workspace</p>
                <h1 className="text-xl font-semibold tracking-tight">
                  {q.data?.name ?? slug}
                </h1>
                {q.data && (
                  <p className="text-xs text-muted-foreground">
                    {q.data.industry ?? ""} · {q.data.size_band ?? ""}
                  </p>
                )}
              </div>
            </div>
          </div>
          <nav className="mt-5 flex flex-wrap gap-1 text-xs">
            <Tab to="/org/$slug/exec" slug={slug} icon={BarChart3} label="Executive" />
            <Tab to="/org/$slug/skills" slug={slug} icon={Grid3x3} label="Skills heatmap" />
            <Tab to="/org/$slug/compliance" slug={slug} icon={ShieldCheck} label="Compliance" />
            <Tab to="/org/$slug/members" slug={slug} icon={Users2} label="Members" />
            <Tab to="/org/$slug/brand" slug={slug} icon={Palette} label="Brand" />
            <Tab to="/org/$slug/settings" slug={slug} icon={Settings} label="Settings" />
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

function Tab({
  to,
  slug,
  icon: Icon,
  label,
}: {
  to: "/org/$slug/exec" | "/org/$slug/skills" | "/org/$slug/compliance" | "/org/$slug/members" | "/org/$slug/brand" | "/org/$slug/settings";
  slug: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground"
      activeProps={{ className: "border-primary/60 bg-primary/10 text-foreground" }}
    >
      <Icon size={12} /> {label}
    </Link>
  );
}
