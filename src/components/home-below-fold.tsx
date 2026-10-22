import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { certifications, categories } from "@/lib/certifications";
import { getCatalogStats } from "@/lib/oem-catalogue";
import { CertMarketplaceCard } from "@/components/cert-marketplace-card";

/** Catalog, featured certs, and closing CTA. Loaded after the hero. */
export function HomeBelowFold() {
  const featuredCerts = certifications.slice(0, 6);
  const catalogStats = getCatalogStats();

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:auto_48rem]">
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
    </div>
  );
}
