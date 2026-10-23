import { lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { OemTiles } from "@/components/oem-doorway";
import { listLiveCampaigns, type Campaign } from "@/lib/campaigns.functions";

const CampaignCarousel = lazy(() =>
  import("@/components/campaign-carousel").then((m) => ({ default: m.CampaignCarousel })),
);
const HomeBelowFold = lazy(() =>
  import("@/components/home-below-fold").then((m) => ({ default: m.HomeBelowFold })),
);

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
  const campaigns = (Route.useLoaderData() ?? []) as Campaign[];
  const hasCampaigns = campaigns.length > 0;

  return (
    <>
      {hasCampaigns && (
        <Suspense fallback={<div className="min-h-[28rem]" aria-hidden />}>
          <CampaignCarousel campaigns={campaigns} />
        </Suspense>
      )}
      {/* Fallback hero (no live campaigns) + platform picker */}
      <section
        className={`relative overflow-hidden ${hasCampaigns ? "border-t border-border/60" : ""}`}
      >
        {!hasCampaigns && <div className="absolute inset-0 bg-mesh" />}
        {!hasCampaigns && (
          <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        )}

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-16 md:pt-14 md:pb-20">
          <div className={`mx-auto max-w-3xl text-center ${hasCampaigns ? "hidden" : ""}`}>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight min-[380px]:text-4xl sm:text-5xl md:text-6xl">
              <span className="text-gradient inline-block px-0.5 pb-1">SkillTrack-365</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              Cert Clarity + Prep — we help you pick the right certification for your career
              progress, prepare for the exam, and get you ready to get certified.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#platforms"
                className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
              >
                Pick a platform
                <ArrowRight size={16} />
              </a>
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

      <Suspense fallback={<div className="min-h-[40rem]" aria-hidden />}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
