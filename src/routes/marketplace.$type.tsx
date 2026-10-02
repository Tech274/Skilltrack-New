import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  getPrepSkuTypeHub,
  listOemsForType,
  marketplaceOemLogoPath,
  resolveMarketplaceOneSegment,
  type MarketplaceOem,
  type PrepSkuTypeHub,
} from "@/lib/marketplace";
import { fetchPublicMarketplaceCatalog } from "@/lib/marketplace-catalog.server";

export const Route = createFileRoute("/marketplace/$type")({
  loader: async ({ params }) => {
    const catalog = await fetchPublicMarketplaceCatalog();
    const resolved = resolveMarketplaceOneSegment(params.type, catalog);
    if (resolved.kind === "redirect-index") {
      throw redirect({ to: "/marketplace" });
    }
    if (resolved.kind === "not-found") throw notFound();
    const hub = getPrepSkuTypeHub(resolved.skuType);
    if (!hub) throw notFound();
    return { hub, oems: listOemsForType(resolved.skuType, catalog), catalog };
  },
  head: ({ loaderData }) => {
    const d = loaderData;
    if (!d) return {};
    const title = `${d.hub.label} — Marketplace | SkillTrack`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `${d.hub.blurb} Choose an OEM to see certifications with this prep type.`,
        },
        { property: "og:title", content: title },
        { property: "og:description", content: d.hub.blurb },
        { property: "og:type", content: "website" },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://skilltrack.co.in/marketplace/${d.hub.type}`,
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="text-3xl font-semibold">Type not found</h1>
      <Link to="/marketplace" className="mt-6 inline-block text-accent">
        ← Back to marketplace
      </Link>
    </div>
  ),
  component: MarketplaceTypeHubPage,
});

function MarketplaceTypeHubPage() {
  const { hub, oems } = Route.useLoaderData();

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-mesh" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <span>/</span>
          <span>{hub.label}</span>
        </div>

        <div className="mt-6 max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-wider text-accent">Prep type</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{hub.label}</h1>
          <p className="mt-4 text-muted-foreground">{hub.blurb}</p>
        </div>

        <section className="mt-12">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            OEMs
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {oems.map((oem) => (
              <OemCard key={oem.key} oem={oem} hub={hub} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function OemCard({ oem, hub }: { oem: MarketplaceOem; hub: PrepSkuTypeHub }) {
  return (
    <Link
      to="/marketplace/$cert/$type"
      params={{ cert: hub.type, type: oem.key }}
      className="group flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
    >
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        OEM
      </div>
      <div className="mt-4 flex h-14 items-center">
        <img
          src={marketplaceOemLogoPath(oem.key)}
          alt=""
          className="h-10 w-auto max-w-[160px] object-contain"
        />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight group-hover:text-primary">
        {oem.shortName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{oem.name}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        View certifications <ArrowRight size={14} />
      </div>
    </Link>
  );
}
