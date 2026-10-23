import { hasSalesWhatsApp } from "@/config/contact";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { formatInvoiceAmount } from "@/lib/invoice-currency";
import { ArrowRight, Check, ExternalLink, MessageCircle } from "lucide-react";
import {
  getMarketplaceOem,
  getPrepSkuFromCatalog,
  getPrepSkuTypeHub,
  listCertsForTypeOem,
  MARKETPLACE_PRICE_INR,
  marketplaceOemLogoPath,
  marketplaceWhatsAppUrl,
  resolveMarketplaceTwoSegment,
  type MarketplaceCatalog,
  type MarketplaceCert,
  type MarketplaceOem,
  type PrepSkuDef,
  type PrepSkuTypeHub,
} from "@/lib/marketplace";
import { fetchPublicMarketplaceCatalog } from "@/lib/marketplace-catalog.server";
import { buildHandoffUrl } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";

type SkuData = {
  kind: "sku";
  catalog: MarketplaceCatalog;
  cert: MarketplaceCert;
  sku: PrepSkuDef;
  oem: MarketplaceOem | null;
  typeHub: PrepSkuTypeHub;
};

type OemCertsData = {
  kind: "oem-certs";
  catalog: MarketplaceCatalog;
  oem: MarketplaceOem;
  typeHub: PrepSkuTypeHub;
  certs: MarketplaceCert[];
};

export const Route = createFileRoute("/marketplace/$cert/$type")({
  loader: async ({ params }) => {
    const catalog = await fetchPublicMarketplaceCatalog();
    const resolved = resolveMarketplaceTwoSegment(params.cert, params.type, catalog);
    if (resolved.kind === "not-found") throw notFound();
    if (resolved.kind === "sku") {
      const data = getPrepSkuFromCatalog(resolved.certKey, resolved.skuType, catalog);
      const typeHub = getPrepSkuTypeHub(resolved.skuType);
      if (!data || !typeHub) throw notFound();
      const oemKey = catalog.oemByCertKey[data.cert.key];
      return {
        kind: "sku" as const,
        catalog,
        cert: data.cert,
        sku: data.sku,
        oem: oemKey ? getMarketplaceOem(oemKey, catalog) : null,
        typeHub,
      } satisfies SkuData;
    }
    const oem = getMarketplaceOem(resolved.oemKey, catalog);
    const typeHub = getPrepSkuTypeHub(resolved.skuType);
    const certs = listCertsForTypeOem(resolved.skuType, resolved.oemKey, catalog);
    if (!oem || !typeHub || certs.length === 0) throw notFound();
    return {
      kind: "oem-certs" as const,
      catalog,
      oem,
      typeHub,
      certs,
    } satisfies OemCertsData;
  },
  head: ({ loaderData }) => {
    const d = loaderData;
    if (!d) return {};
    if (d.kind === "sku") {
      const title = `${d.sku.title} — ${d.cert.shortName} | SkillTrack Marketplace`;
      return {
        meta: [
          { title },
          {
            name: "description",
            content: `${d.sku.blurb} Placeholder price ${formatInvoiceAmount(d.sku.priceInr ?? MARKETPLACE_PRICE_INR, d.sku.currency, 0)}. Book a call — no online checkout yet.`,
          },
          { property: "og:title", content: title },
          { property: "og:description", content: d.sku.blurb },
          { property: "og:type", content: "website" },
        ],
        links: [
          {
            rel: "canonical",
            href: `https://skilltrack.co.in/marketplace/${d.cert.key}/${d.sku.type}`,
          },
        ],
      };
    }
    const title = `${d.oem.shortName} ${d.typeHub.label} — Marketplace | SkillTrack`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Choose a ${d.oem.name} certification for ${d.typeHub.label}.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: `Certifications with ${d.typeHub.label} from ${d.oem.name}.`,
        },
        { property: "og:type", content: "website" },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://skilltrack.co.in/marketplace/${d.typeHub.type}/${d.oem.key}`,
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link to="/marketplace" className="mt-6 inline-block text-accent">
        ← Back to marketplace
      </Link>
    </div>
  ),
  component: MarketplaceTwoSegmentPage,
});

function MarketplaceTwoSegmentPage() {
  const data = Route.useLoaderData();
  if (data.kind === "sku") return <MarketplaceSkuPage {...data} />;
  return <MarketplaceOemCertListPage {...data} />;
}

function MarketplaceOemCertListPage({ oem, typeHub, certs }: OemCertsData) {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-mesh" />
      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link to="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <span>/</span>
          <Link
            to="/marketplace/$type"
            params={{ type: typeHub.type }}
            className="hover:text-foreground"
          >
            {typeHub.label}
          </Link>
          <span>/</span>
          <span>{oem.shortName}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <img
            src={marketplaceOemLogoPath(oem.key)}
            alt={`${oem.name} logo`}
            className="h-10 w-auto max-w-[160px] object-contain"
          />
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-accent">OEM</div>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight md:text-5xl">
              {oem.shortName}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {typeHub.label} for {oem.name}
            </p>
          </div>
        </div>

        <section className="mt-12">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Certifications
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {certs.map((cert) => (
              <Link
                key={cert.key}
                to="/marketplace/$cert/$type"
                params={{ cert: cert.key, type: typeHub.type }}
                className="group flex flex-col rounded-xl border border-border bg-surface p-6 shadow-card transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
              >
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {cert.code || "Cert"}
                </div>
                <h2 className="mt-3 text-lg font-semibold tracking-tight group-hover:text-primary">
                  {cert.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{cert.shortName}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  View {typeHub.label} <ArrowRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MarketplaceSkuPage({ cert, sku, oem, typeHub }: SkuData) {
  const handoff = useHandoffContext();
  const price = sku.priceInr ?? MARKETPLACE_PRICE_INR;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-mesh" />

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link to="/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <span>/</span>
          <Link
            to="/marketplace/$type"
            params={{ type: typeHub.type }}
            className="hover:text-foreground"
          >
            {typeHub.label}
          </Link>
          {oem && (
            <>
              <span>/</span>
              <Link
                to="/marketplace/$cert/$type"
                params={{ cert: typeHub.type, type: oem.key }}
                className="hover:text-foreground"
              >
                {oem.shortName}
              </Link>
            </>
          )}
          <span>/</span>
          <span>{cert.shortName}</span>
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="font-mono">{cert.code}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              Prep stub
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{sku.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{cert.name}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{sku.blurb}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/book-a-call"
                search={{ utm_campaign: "marketplace", cert: cert.code, type: sku.type } as any}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
              >
                Talk to us to enrol <ArrowRight size={16} />
              </Link>
              {hasSalesWhatsApp && (
              <a
                href={marketplaceWhatsAppUrl(cert)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
              )}
            </div>
            {sku.fulfilledOn && (
              <p className="mt-4 text-sm text-muted-foreground">
                <a
                  href={buildHandoffUrl(sku.fulfilledOn.href, {
                    ...handoff,
                    sku: sku.type,
                    cert: cert.key,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                >
                  {sku.fulfilledOn.label}
                  <ExternalLink size={14} />
                </a>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Price
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold">{formatInvoiceAmount(price, sku.currency, 0)}</span>
              <span className="text-sm text-muted-foreground">placeholder</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No Razorpay / Stripe on these SKUs yet. Scope and quote happen on the diagnostic call.
            </p>
            <Link
              to="/book-a-call"
              className="mt-6 block w-full rounded-md bg-gradient-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground shadow-card"
            >
              Book free diagnostic
            </Link>
            {cert.catalogSlug ? (
              <Link
                to="/certifications/$slug"
                params={{ slug: cert.catalogSlug }}
                className="mt-3 block w-full rounded-md border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-surface-elevated"
              >
                View cert guide
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">What&apos;s included</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {sku.includes.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Features</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {sku.features.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
