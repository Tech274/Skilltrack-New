import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Clock,
  DollarSign,
  GraduationCap,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCert, certifications } from "@/lib/certifications";
import { getMarketplaceCertByCatalogSlug } from "@/lib/marketplace";
import { brandForVendor } from "@/lib/vendor-brands";
import { VendorLogo } from "@/components/cert-marketplace-card";
import { RegionSelect } from "@/components/region-select";
import {
  EXAM_COST_TIP,
  REGION_DISCLAIMER,
  formatExamCost,
  formatSalary,
  useRegion,
} from "@/lib/region-currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/certifications/$slug")({
  loader: ({ params }) => {
    const cert = getCert(params.slug);
    if (!cert) throw notFound();
    return { cert };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.cert;
    if (!c) return {};
    return {
      meta: [
        { title: `${c.name} — Certification Guide | SkillTrack-365` },
        {
          name: "description",
          content: `${c.name} (${c.code}): cost, difficulty, domains, salary, and ROI. ${c.tagline}`,
        },
        { property: "og:title", content: `${c.name} — SkillTrack-365` },
        { property: "og:description", content: c.tagline },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/certifications/${c.slug}` },
      ],
      links: [{ rel: "canonical", href: `/certifications/${c.slug}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            name: c.name,
            description: c.description,
            provider: { "@type": "Organization", name: c.vendor },
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="text-3xl font-semibold">Certification not found</h1>
      <Link to="/certifications" className="mt-6 inline-block text-accent">
        ← Back to certifications
      </Link>
    </div>
  ),
  component: CertPage,
});

function CertPage() {
  const { cert } = Route.useLoaderData() as { cert: NonNullable<ReturnType<typeof getCert>> };
  const brand = brandForVendor(cert.vendor);
  const { regionCode, region, setRegion } = useRegion();
  const marketplaceCert = getMarketplaceCertByCatalogSlug(cert.slug);
  const related = certifications
    .filter((c) => c.categorySlug === cert.categorySlug && c.slug !== cert.slug)
    .slice(0, 3);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-mesh" />

      <div className="relative mx-auto max-w-6xl px-6 pt-12 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/certifications" className="hover:text-foreground">
            Certifications
          </Link>
          <span>/</span>
          <span>{cert.category}</span>
        </div>

        {/* Header — dense two-column: CTAs left, Quick Facts + KPIs right */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="font-mono">{cert.code}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              {cert.vendor}
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{cert.name}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{cert.tagline}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{cert.description}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <StartStudyButton slug={cert.slug} />
              <Link
                to="/book-a-call"
                search={{ cert: cert.slug, utm_source: "site", utm_medium: "cert_detail", utm_campaign: cert.slug }}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
              >
                Book a free diagnostic
              </Link>
              <BookmarkButton slug={cert.slug} />
              <Link
                to="/compare"
                search={{ add: cert.slug }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
              >
                Add to compare
              </Link>
              {marketplaceCert && (
                <Link
                  to="/marketplace/$cert/$type"
                  params={{ cert: marketplaceCert.key, type: "mock" }}
                  className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent/20"
                >
                  Browse prep on Marketplace <ArrowRight size={16} />
                </Link>
              )}
            </div>

            {/* Domains */}
            <section className="mt-8 space-y-8">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Exam domains</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Weight of each domain on the certification exam.
                </p>
                <div className="mt-6 space-y-4">
                  {cert.domains.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{d.name}</span>
                        <span className="font-mono text-muted-foreground">{d.weight}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-gradient-primary"
                          style={{ width: `${d.weight * 3}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Skills you'll prove</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Skills validated by employers when they see this credential.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {cert.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <h3 className="mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Common roles
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cert.roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-md bg-primary/15 px-3 py-1 text-sm text-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Quick facts + KPIs in the same right column — no full-width gap */}
          <div className="space-y-4">
            {/* Vendor logo hero */}
            <div
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-5 py-4 shadow-card"
              style={{
                backgroundImage: `linear-gradient(135deg, ${brand.color}1f 0%, transparent 60%)`,
              }}
            >
              <VendorLogo
                label={brand.shortLabel}
                color={brand.color}
                localSrc={brand.localSrc}
                simpleIcon={brand.simpleIcon}
                layout={brand.logoLayout ?? "mark"}
                hero
              />
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {cert.vendor}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Quick facts
                </div>
                <RegionSelect value={regionCode} onChange={setRegion} />
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Fact
                  icon={DollarSign}
                  label="Exam cost"
                  value={formatExamCost(cert.cost, regionCode)}
                />
                <Fact icon={Clock} label="Duration" value={`${cert.durationMin} min`} />
                <Fact icon={Target} label="Passing score" value={String(cert.passingScore)} />
                <Fact icon={RefreshCw} label="Validity" value={`${cert.validityYears} yr`} />
                <Fact icon={GraduationCap} label="Difficulty" value={cert.difficulty} />
                <Fact icon={TrendingUp} label="Success rate" value={`${cert.successRate}%`} />
              </dl>
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                {REGION_DISCLAIMER} {EXAM_COST_TIP}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Metric
                label={`Avg salary (${region.currency})`}
                value={formatSalary(cert.avgSalary, regionCode)}
                accent
              />
              <Metric label="Market demand" value={`${cert.demandScore} / 100`} />
              <Metric label="Open roles" value={cert.jobOpenings.toLocaleString()} />
              <Metric label="ROI score" value={`${cert.roiScore} / 100`} accent />
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-20 border-t border-border/60 pt-16">
            <h2 className="text-2xl font-semibold tracking-tight">Related certifications</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {related.map((c) => (
                <Link
                  key={c.slug}
                  to="/certifications/$slug"
                  params={{ slug: c.slug }}
                  className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
                >
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {c.vendor}
                  </div>
                  <div className="mt-2 font-semibold">{c.name}</div>
                  <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        {label}
      </span>
      <span className="font-mono font-medium text-foreground">{value}</span>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border p-3.5 ${accent ? "bg-primary/10" : "bg-surface"}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-mono text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function useUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return uid;
}

function BookmarkButton({ slug }: { slug: string }) {
  const uid = useUserId();
  const navigate = useNavigate();
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("user_bookmarks")
      .select("id")
      .eq("certification_slug", slug)
      .maybeSingle()
      .then(({ data }) => setBookmarked(!!data));
  }, [uid, slug]);

  async function toggle() {
    if (!uid) {
      navigate({ to: "/auth", search: { next: `/certifications/${slug}` } });
      return;
    }
    setLoading(true);
    if (bookmarked) {
      const { error } = await supabase
        .from("user_bookmarks")
        .delete()
        .eq("certification_slug", slug);
      if (error) toast.error(error.message);
      else {
        setBookmarked(false);
        toast.success("Bookmark removed");
      }
    } else {
      const { error } = await supabase
        .from("user_bookmarks")
        .insert({ user_id: uid, certification_slug: slug });
      if (error) toast.error(error.message);
      else {
        setBookmarked(true);
        toast.success("Bookmarked — visible in your dashboard");
      }
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-elevated disabled:opacity-60"
    >
      {bookmarked ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}

function StartStudyButton({ slug }: { slug: string }) {
  const uid = useUserId();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Returning from sign-in with ?start=1: add once, clean the URL, go to dashboard.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!uid || autoStarted.current) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("start") !== "1") return;
    autoStarted.current = true;
    q.delete("start");
    const rest = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function start() {
    if (!uid) {
      navigate({ to: "/auth", search: { next: `/certifications/${slug}?start=1` } });
      return;
    }
    setLoading(true);
    const { data: existing } = await supabase
      .from("user_certifications")
      .select("id")
      .eq("certification_slug", slug)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("user_certifications")
        .insert({ user_id: uid, certification_slug: slug, status: "studying" });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
    }
    toast.success("Added to your study plan");
    navigate({ to: "/dashboard" });
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card disabled:opacity-60"
    >
      Start study plan <ArrowRight size={16} />
    </button>
  );
}
