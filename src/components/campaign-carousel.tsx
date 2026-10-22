import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Campaign } from "@/lib/campaigns.functions";

const ROTATE_MS = 7000;

function track(event: string, c: Campaign, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, campaign_id: c.analytics_id ?? c.slug, campaign_type: c.campaign_type, ...extra });
}

function CtaLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/** Text-led artwork used when a campaign has no image (never a broken image). */
function FallbackArt({ c }: { c: Campaign }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface/60">
      <div className="absolute inset-0 bg-mesh opacity-80" />
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="relative px-8 text-center">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">
          {c.campaign_type.replace("-", " ")}
        </div>
        <div className="mt-3 text-2xl font-semibold text-gradient md:text-3xl">{c.title}</div>
      </div>
    </div>
  );
}

function SlideArt({ c, eager }: { c: Campaign; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const desktop = c.desktop_src;
  const mobile = c.mobile_src ?? desktop;
  if (failed || (!desktop && !mobile)) return <FallbackArt c={c} />;
  return (
    <picture className="block h-full w-full overflow-hidden rounded-2xl border border-border bg-surface">
      {mobile && <source media="(max-width: 767px)" srcSet={mobile} />}
      <img
        src={desktop ?? mobile ?? undefined}
        alt={c.image_alt ?? ""}
        width={1000}
        height={800}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-center"
      />
    </picture>
  );
}

export function CampaignSlide({ c, eager = true }: { c: Campaign; eager?: boolean }) {
  const center = c.text_alignment === "center";
  const artLeft = c.image_position === "left";
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={`${artLeft ? "md:order-2" : "md:order-1"} ${center ? "text-center md:text-center" : ""}`}>
        <div className={`flex flex-wrap items-center gap-2 ${center ? "justify-center" : ""}`}>
          {c.eyebrow && (
            <span className="font-mono text-xs uppercase tracking-wider text-accent">{c.eyebrow}</span>
          )}
          {c.badge && (
            <span className="rounded-full bg-gradient-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {c.badge}
            </span>
          )}
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
          {c.headline}
        </h2>
        {c.description && (
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">{c.description}</p>
        )}
        <div className={`mt-7 flex flex-wrap items-center gap-4 ${center ? "justify-center" : ""}`}>
          <CtaLink
            href={c.primary_cta_url}
            onClick={() => track("campaign_cta_click", c, { cta: "primary" })}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {c.primary_cta_label}
            <ArrowRight size={16} aria-hidden />
          </CtaLink>
          {c.secondary_cta_label && c.secondary_cta_url && (
            <CtaLink
              href={c.secondary_cta_url}
              onClick={() => track("campaign_cta_click", c, { cta: "secondary" })}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {c.secondary_cta_label}
            </CtaLink>
          )}
        </div>
      </div>
      <div className={`-order-1 aspect-[4/3] w-full md:aspect-[5/4] ${artLeft ? "md:order-1" : "md:order-2"}`}>
        <SlideArt c={c} eager={eager} />
      </div>
    </div>
  );
}

export function CampaignCarousel({ campaigns }: { campaigns: Campaign[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const seen = useRef(new Set<number>());
  const count = campaigns.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  const paused = hovered || focused || userPaused || reducedMotion || count < 2;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => go(index + 1), ROTATE_MS);
    return () => window.clearTimeout(t);
  }, [paused, index, go]);

  useEffect(() => {
    const c = campaigns[index];
    if (c && !seen.current.has(index)) {
      seen.current.add(index);
      track("campaign_impression", c, { position: index + 1 });
    }
  }, [index, campaigns]);

  if (count === 0) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="SkillTrack campaigns"
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-10 md:pt-14">
        <h1 className="sr-only">SkillTrack-365 — certification, skilling and career platform</h1>
        <div className="grid">
          {campaigns.map((c, i) => (
            <div
              key={c.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${c.title}`}
              aria-hidden={i !== index}
              inert={i !== index ? true : undefined}
              className={`col-start-1 row-start-1 ${
                reducedMotion ? "" : "transition-opacity duration-500"
              } ${i === index ? "relative z-10 opacity-100" : "pointer-events-none invisible z-0 opacity-0 [&_*]:pointer-events-none"}`}
            >
              <CampaignSlide c={c} eager={i === 0} />
            </div>
          ))}
        </div>

        {count > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3" onKeyDown={onKey}>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous campaign"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose campaign">
              {campaigns.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show campaign ${i + 1}: ${c.title}`}
                  onClick={() => go(i)}
                  className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    i === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next campaign"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? "Resume rotation" : "Pause rotation"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {userPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
              </button>
            )}
          </div>
        )}
        <div aria-live="polite" className="sr-only">
          {paused ? `Campaign ${index + 1} of ${count}: ${campaigns[index]?.headline}` : ""}
        </div>
      </div>
    </section>
  );
}
