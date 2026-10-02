import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Clock3 } from "lucide-react";
import { z } from "zod";
import { CertMarketplaceCard } from "@/components/cert-marketplace-card";
import {
  getOem,
  groupPathsByLevel,
  OEM_CATALOGUE,
  getCatalogStats,
  type OemCatalogueEntry,
  type OemPathTile,
} from "@/lib/oem-catalogue";

const searchSchema = z.object({
  oem: z.string().optional(),
});

/** Group path tiles by level when an OEM has many Catalogue rows (e.g. Cisco, Salesforce). */
const GROUP_BY_LEVEL_THRESHOLD = 20;

export const Route = createFileRoute("/certifications/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Certifications — SkillTrack" },
      {
        name: "description",
        content:
          "Browse certification guides by OEM — AWS, Azure, Google Cloud, Salesforce, and more. Pick a vendor, then open a guide.",
      },
      { property: "og:title", content: "Certifications — SkillTrack" },
      {
        property: "og:description",
        content:
          "OEM-first certification hub. Choose a vendor, then open a guide for cost, difficulty, demand, and salary.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://skilltrack.co.in/certifications" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/certifications" }],
  }),
  component: CertsPage,
});

function CertsPage() {
  const { oem: oemParam } = Route.useSearch();
  const oem = getOem(oemParam);

  if (oemParam && oem) {
    return <OemDetailView oem={oem} />;
  }

  return <OemGridView />;
}

function OemGridView() {
  const stats = getCatalogStats();
  const withGuides = stats.oems;
  const totalGuides = stats.liveGuides;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">Certifications</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Choose a vendor. Open a guide.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {totalGuides} live guides across {withGuides} OEMs · more vendors listed as Wave B. Pick
          an OEM to see its certification types, then open a full guide.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {OEM_CATALOGUE.map((entry) => (
          <OemTile key={entry.slug} oem={entry} />
        ))}
      </div>
    </div>
  );
}

function OemTile({ oem }: { oem: OemCatalogueEntry }) {
  return (
    <Link
      to="/certifications"
      search={{ oem: oem.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
      style={{
        backgroundImage: `linear-gradient(160deg, ${oem.color}18 0%, transparent 55%)`,
      }}
    >
      <div
        className="flex aspect-[5/3] items-center justify-center px-4 py-5"
        style={{
          backgroundColor: `${oem.color}12`,
          backgroundImage: `linear-gradient(135deg, ${oem.color}22 0%, transparent 65%)`,
        }}
      >
        <OemLogoMark oem={oem} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{oem.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {getCatalogStats().byOem[oem.slug].live > 0
              ? `${getCatalogStats().byOem[oem.slug].live} guide${getCatalogStats().byOem[oem.slug].live === 1 ? "" : "s"}`
              : "Coming soon"}
          </div>
        </div>
        <ArrowRight
          size={14}
          className="shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </Link>
  );
}

function OemLogoMark({ oem }: { oem: OemCatalogueEntry }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-lg text-sm font-bold"
        style={{ backgroundColor: `${oem.color}22`, color: oem.color }}
        aria-hidden
      >
        {oem.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={oem.logoSrc}
      alt=""
      width={120}
      height={56}
      loading="lazy"
      className="max-h-14 w-auto max-w-[140px] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function OemDetailView({ oem }: { oem: OemCatalogueEntry }) {
  const hasPaths = oem.pathCount > 0;
  const hasGuides = oem.guides.length > 0;
  const groupByLevel = hasPaths && oem.pathCount >= GROUP_BY_LEVEL_THRESHOLD;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Link
        to="/certifications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        All OEMs
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className="flex h-28 w-full max-w-xs shrink-0 items-center justify-center rounded-xl border border-border/60 px-6 sm:w-52"
          style={{
            backgroundColor: "#ffffff",
            backgroundImage: `linear-gradient(135deg, ${oem.color}1f 0%, ${oem.color}0d 100%)`,
          }}
        >
          <OemLogoMark oem={oem} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs uppercase tracking-wider text-accent">
            Certifications
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{oem.name}</h1>
          <p className="mt-2 text-muted-foreground">{detailBlurb(oem)}</p>
        </div>
      </div>

      {hasPaths ? (
        groupByLevel ? (
          <div className="mt-10 space-y-10">
            {groupPathsByLevel(oem.paths).map((group) => (
              <section key={group.level}>
                <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {group.level}
                  <span className="ml-2 text-muted-foreground/70">({group.paths.length})</span>
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {group.paths.map((path) => (
                    <PathTile key={path.examId} path={path} accent={oem.color} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {oem.paths.map((path) => (
              <PathTile key={path.examId} path={path} accent={oem.color} />
            ))}
          </div>
        )
      ) : hasGuides ? (
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {oem.guides.map((c) => (
            <CertMarketplaceCard key={c.slug} cert={c} variant="marketplace" />
          ))}
        </div>
      ) : (
        <ComingSoonPanel oem={oem} />
      )}
    </div>
  );
}

function detailBlurb(oem: OemCatalogueEntry): string {
  if (oem.pathCount > 0) {
    const live = oem.livePathCount;
    const soon = getCatalogStats().byOem[oem.slug].comingSoon;
    return `${oem.pathCount} path${oem.pathCount === 1 ? "" : "s"}: ${live} live, ${soon} coming soon. Open a live guide for domains, cost, demand, and salary.`;
  }
  if (oem.guides.length > 0) {
    return `${oem.guideCount} certification guide${oem.guideCount === 1 ? "" : "s"} for this vendor. Open a guide for domains, cost, demand, and salary.`;
  }
  return "Guides for this vendor are on the way. Book a call or start an assessment while we publish them.";
}

function PathTile({ path, accent }: { path: OemPathTile; accent: string }) {
  if (path.guide) {
    return <CertMarketplaceCard cert={path.guide} variant="marketplace" />;
  }
  return <ComingSoonPathCard path={path} accent={accent} />;
}

/** Non-linking tile for Catalogue exams without a live guide page yet. */
function ComingSoonPathCard({ path, accent }: { path: OemPathTile; accent: string }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border border-dashed border-border bg-surface/70 p-6"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent}0f 0%, transparent 55%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-l-xl opacity-40"
        style={{ backgroundColor: accent, width: 4 }}
      />

      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-foreground">
            {path.name}
          </h3>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/80 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Clock3 size={12} aria-hidden />
          Coming soon
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
        {path.code ? (
          <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {path.code}
          </span>
        ) : null}
        {path.level ? (
          <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {path.level}
          </span>
        ) : null}
      </div>

      <p className="mt-auto pt-5 pl-1 text-sm text-muted-foreground">
        Full guide not published yet — exam stays listed from the Catalogue.
      </p>
    </div>
  );
}

function ComingSoonPanel({ oem }: { oem: OemCatalogueEntry }) {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen size={22} />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">Guides coming soon</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        We&apos;re preparing {oem.name} certification guides. Meanwhile, talk to us about your path
        {oem.assessmentSlug ? " or start a free OEM assessment" : ""}.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/book-a-call"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Book a call
          <ArrowRight size={14} />
        </Link>
        {oem.assessmentSlug && (
          <Link
            to="/assessment"
            search={{ oem: oem.assessmentSlug }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            Start {oem.name} assessment
          </Link>
        )}
      </div>
    </div>
  );
}
