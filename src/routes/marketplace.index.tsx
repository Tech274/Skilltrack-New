import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import {
  formatListedPrice,
  listPrepBundles,
  listPrepSkuTypeHubs,
  MARKETPLACE_TILES,
  priceSummaryForType,
  priceSummaryLabel,
  type MarketplaceCatalog,
  type MarketplaceTile,
  type PrepBundleOffer,
  type PrepSkuTypeHub,
} from "@/lib/marketplace";
import { fetchPublicMarketplaceCatalog } from "@/lib/marketplace-catalog.server";
import { buildHandoffUrl } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";

export const Route = createFileRoute("/marketplace/")({
  loader: async () => {
    const catalog = await fetchPublicMarketplaceCatalog();
    return { catalog, bundles: listPrepBundles(catalog) };
  },
  head: () => ({
    meta: [
      { title: "Marketplace — Prep SKUs & platforms | SkillTrack" },
      {
        name: "description",
        content:
          "Browse SkillTrack marketplace by type: Mock Exams, Practice Questions, Notes/Blueprints, and Labs — then pick an OEM and certification. Plus SkillHub Labs and SkillBridge.",
      },
      { property: "og:title", content: "Marketplace — SkillTrack" },
      {
        property: "og:description",
        content: "SKU-led marketplace: type hubs, then OEM, then certification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/marketplace" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/marketplace" }],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const handoff = useHandoffContext();
  const { catalog, bundles } = Route.useLoaderData();
  const typeHubs = listPrepSkuTypeHubs();
  const platformTiles = MARKETPLACE_TILES.filter((t) => t.kind === "platform");

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-mesh" />

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-wider text-accent">Marketplace</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Prep by type</h1>
          <p className="mt-4 text-muted-foreground">
            Pick a SKU type, then an OEM, then a certification.
          </p>
          <Link
            to="/book-a-call"
            search={{ utm_campaign: "marketplace" }}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
          >
            Talk to us to enrol
          </Link>
        </div>

        <section className="mt-12">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Prep types
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {typeHubs.map((hub) => (
              <TypeHubCard key={hub.type} hub={hub} catalog={catalog} />
            ))}
          </div>
        </section>

        {bundles.length > 0 ? (
          <section className="mt-14">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Bundles
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Prep bundles</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Each bundle is the prep types already listed for that certification.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {bundles.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Platforms
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">SkillHub &amp; SkillBridge</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sibling platforms — not OEM shelves.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformTiles.map((tile) => (
              <a
                key={tile.id}
                href={buildHandoffUrl(tile.href, handoff)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
              >
                <TileBody tile={tile} external />
              </a>
            ))}
          </div>
        </section>

        <div className="relative mt-14 overflow-hidden rounded-2xl border border-border bg-surface p-8 md:p-10">
          <div className="absolute inset-0 bg-mesh opacity-40 pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-accent">
                Not sure?
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Free diagnostic call first.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                We pick the right cert and prep mix on a 20-minute call — then quote prep if you
                want it.
              </p>
            </div>
            <Link
              to="/book-a-call"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
            >
              Book a call <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeHubCard({ hub, catalog }: { hub: PrepSkuTypeHub; catalog: MarketplaceCatalog }) {
  return (
    <Link
      to="/marketplace/$type"
      params={{ type: hub.type }}
      className="group flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
    >
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Prep type
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight group-hover:text-primary">
        {hub.label}
      </h2>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{hub.blurb}</p>
      <div className="mt-4 font-mono text-sm font-semibold text-foreground">
        {priceSummaryLabel(priceSummaryForType(hub.type, catalog))}
      </div>
      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        Browse OEMs <ArrowRight size={14} />
      </div>
    </Link>
  );
}

function BundleCard({ bundle }: { bundle: PrepBundleOffer }) {
  const firstType = bundle.skuTypes[0];
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Bundle
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">{bundle.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{bundle.certName}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-foreground">
        {bundle.skuTypes.map((type, index) => (
          <li key={type}>
            <Link
              to="/marketplace/$cert/$type"
              params={{ cert: bundle.certKey, type }}
              className="text-accent hover:underline"
            >
              {bundle.includes[index]}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 font-mono text-lg font-semibold">{formatListedPrice(bundle.price)}</div>
      {firstType ? (
        <Link
          to="/marketplace/$cert/$type"
          params={{ cert: bundle.certKey, type: firstType }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
        >
          View prep <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function TileBody({ tile, external }: { tile: MarketplaceTile; external?: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Platform
        </div>
        {tile.badge && (
          <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tile.badge}
          </span>
        )}
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight group-hover:text-primary">
        {tile.title}
      </h2>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{tile.blurb}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        {external ? (
          <>
            Open platform <ExternalLink size={14} />
          </>
        ) : (
          <>
            View details <ArrowRight size={14} />
          </>
        )}
      </div>
    </>
  );
}
