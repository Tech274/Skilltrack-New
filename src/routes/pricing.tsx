import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Cert Clarity + Prep | SkillTrack" },
      {
        name: "description",
        content:
          "Start with a free 20-minute diagnostic call. We recommend the right certification and scope a prep plan, then quote it on the call.",
      },
      { property: "og:title", content: "Pricing — Cert Clarity + Prep | SkillTrack" },
      {
        property: "og:description",
        content: "Free diagnostic call first. Prep plans are quoted to what you actually need.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/pricing" }],
  }),
  component: PricingPage,
});

const packages = [
  {
    name: "Cert Clarity",
    price: "Free",
    cadence: "20-minute call",
    blurb: "Work out which certification is actually worth your time.",
    features: [
      "Role, experience and deadline review",
      "Shortlist of 1–2 target certifications",
      "Honest view on exam difficulty and cost",
      "Target exam date",
    ],
    featured: true,
    campaign: "pricing_clarity",
    cta: "Book free diagnostic",
  },
  {
    name: "Cert Prep",
    price: "Quoted on the call",
    cadence: "scoped to your exam",
    blurb: "A week-by-week plan and guided prep to the exam date.",
    features: [
      "Week-by-week study plan",
      "Curated resources for your exam",
      "Practice checkpoints before booking",
      "Check-ins until you sit the exam",
    ],
    featured: false,
    campaign: "pricing_prep",
    cta: "Discuss prep on the call",
  },
  {
    name: "Teams",
    price: "Custom",
    cadence: "per cohort",
    blurb: "Certify a group on one timeline.",
    features: [
      "Skill review across the team",
      "Shared cohort schedule",
      "Progress reporting for managers",
      "Invoiced billing",
    ],
    featured: false,
    campaign: "enterprise",
    cta: "Talk to us",
  },
];

function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">Pricing</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Start with the free call.
        </h1>
        <p className="mt-3 text-muted-foreground">
          We don't sell a subscription. You get clarity on the call for free, and if you want
          us to run your prep, we scope and quote it there — no surprise charges.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {packages.map((t) => (
          <div
            key={t.name}
            className={`relative flex flex-col rounded-2xl border p-8 ${
              t.featured ? "border-primary/50 bg-surface shadow-elevated" : "border-border bg-surface"
            }`}
          >
            {t.featured && (
              <div className="absolute -top-3 left-8 rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
                Start here
              </div>
            )}
            <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t.name}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-semibold">{t.price}</span>
              <span className="text-sm text-muted-foreground">{t.cadence}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t.blurb}</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 text-success shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex-1" />
            <Link
              to="/book-a-call"
              search={(prev) => ({
                ...(prev as Record<string, string>),
                utm_campaign: (prev as Record<string, string>)?.utm_campaign ?? t.campaign,
              })}
              className={`mt-8 block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium ${
                t.featured
                  ? "bg-gradient-primary text-primary-foreground shadow-card"
                  : "border border-border bg-background text-foreground hover:bg-surface-elevated"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
        Browsing the certification guides is free and needs no account.
      </p>
    </div>
  );
}
