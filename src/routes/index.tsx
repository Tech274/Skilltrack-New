import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { certifications, categories } from "@/lib/certifications";
import { getCatalogStats } from "@/lib/oem-catalogue";
import { OemTiles } from "@/components/oem-doorway";
import { CertMarketplaceCard } from "@/components/cert-marketplace-card";
import { CampaignCarousel } from "@/components/campaign-carousel";
import { listLiveCampaigns, type Campaign } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillTrack — Pick the right certification and pass it" },
      {
        name: "description",
        content:
          "Cert Clarity + Prep from SkillTrack. Book a free 20-minute diagnostic: we help you choose the right cloud or DevOps certification and build a prep plan that fits your week.",
      },
      { property: "og:title", content: "SkillTrack — Cert Clarity + Prep" },
      {
        property: "og:description",
        content: "Know which certification to take, and get a prep plan that fits your week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/" }],
  }),
  loader: () => listLiveCampaigns(),
  errorComponent: () => <div className="p-8">Something went wrong loading the homepage.</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
  component: HomePage,
});

function HomePage() {
  const featuredCerts = certifications.slice(0, 6);
  const catalogStats = getCatalogStats();
  const campaigns = (Route.useLoaderData() ?? []) as Campaign[];
  const hasCampaigns = campaigns.length > 0;

  return (
    <>
      {hasCampaigns && <CampaignCarousel campaigns={campaigns} />}
      {/* Fallback hero (no live campaigns) + platform picker */}
      <section className={`relative overflow-hidden ${hasCampaigns ? "border-t border-border/60" : ""}`}>
        {!hasCampaigns && <div className="absolute inset-0 bg-mesh" />}
        {!hasCampaigns && (
          <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        )}

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-16 md:pt-14 md:pb-20">
          <div className={`mx-auto max-w-3xl text-center ${hasCampaigns ? "hidden" : ""}`}>
            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              <span className="text-gradient">SkillTrack-365</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Cert Clarity + Prep — we help you pick the right certification for your career
              progress, prepare for the exam, and get you ready to get certified.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#platforms"
                className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
              >
                Get started
                <ArrowRight size={16} />
              </a>
              <Link
                to="/book-a-call"
                search={(prev) => ({
                  ...(prev as Record<string, string>),
                  utm_campaign: (prev as Record<string, string>)?.utm_campaign ?? "home_hero",
                })}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur hover:bg-surface"
              >
                Book free diagnostic
              </Link>
            </div>
          </div>

          <div id="platforms" className="mt-12 scroll-mt-24">
            <div className="text-center font-mono text-xs uppercase tracking-wider text-accent">
              Pick your platform
            </div>
            <div className="mt-6">
              <OemTiles limit={8} />
            </div>
            <div className="mt-6 text-center">
              <Link
                to="/assessment"
                search={{ oem: undefined }}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                See all platforms <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-accent">Catalog</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Browse by category
              </h2>
            </div>
            <Link
              to="/certifications"
              className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              All certifications <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/certifications"
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:bg-surface-elevated"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(catalogStats.byCategory[c.slug] ?? 0).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  View certifications <ArrowRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured certs */}
      <section className="border-t border-border/60 bg-surface/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-accent">
                In demand now
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Top certifications this quarter
              </h2>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredCerts.map((c) => (
              <CertMarketplaceCard key={c.slug} cert={c} variant="featured" />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-20 border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-10 md:p-14">
            <div className="absolute inset-0 bg-mesh opacity-60" />
            <div className="relative">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                Stop guessing which certification is next.
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Twenty minutes with us and you'll leave with a shortlist, a target exam date, and a
                prep plan that fits the hours you actually have.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/book-a-call"
                  search={(prev) => ({
                    ...(prev as Record<string, string>),
                    utm_campaign: (prev as Record<string, string>)?.utm_campaign ?? "home_footer",
                  })}
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
                >
                  Book free diagnostic <ArrowRight size={16} />
                </Link>
                <Link
                  to="/enterprise"
                  resetScroll
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
                >
                  Talk to enterprise
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
