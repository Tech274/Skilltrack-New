import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { CertBrowseEmpty, CertBrowseGrid, CertBrowseToolbar } from "@/components/cert-browse";
import {
  applyCertBrowse,
  certBrowseFacets,
  groupCertBrowseByLevel,
  isCertBrowseSort,
  listCertBrowseItems,
  type CertBrowseSort,
} from "@/lib/cert-catalog-browse";
import {
  getOem,
  getCatalogStats,
  OEM_CATALOGUE,
  type OemCatalogueEntry,
} from "@/lib/oem-catalogue";

/** Group path tiles by level when an OEM has many Catalogue rows (e.g. Cisco, Salesforce). */
const GROUP_BY_LEVEL_THRESHOLD = 20;

type CertSearch = {
  oem?: string;
  q?: string;
  vendor?: string;
  level?: string;
  domain?: string;
  sort?: CertBrowseSort;
};

function textParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const Route = createFileRoute("/certifications/")({
  validateSearch: (search: Record<string, unknown>): CertSearch => ({
    oem: textParam(search.oem),
    q: textParam(search.q),
    vendor: textParam(search.vendor),
    level: textParam(search.level),
    domain: textParam(search.domain),
    sort: (() => {
      const sort = textParam(search.sort);
      return sort && isCertBrowseSort(sort) ? sort : undefined;
    })(),
  }),
  head: () => ({
    meta: [
      { title: "Certifications — SkillTrack" },
      {
        name: "description",
        content:
          "Browse certification guides by OEM — AWS, Azure, Google Cloud, Salesforce, and more. Search, filter by vendor, level, and domain, and compare exam fees.",
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const oem = getOem(search.oem);
  const allItems = useMemo(() => listCertBrowseItems(), []);
  const allFacets = useMemo(() => certBrowseFacets(allItems), [allItems]);

  function patchSearch(patch: Partial<CertSearch>) {
    void navigate({
      to: "/certifications",
      search: (prev) => {
        const next: CertSearch = { ...prev, ...patch };
        (Object.keys(next) as (keyof CertSearch)[]).forEach((key) => {
          if (next[key] === undefined || next[key] === "") delete next[key];
        });
        return next;
      },
      replace: true,
      resetScroll: false,
    });
  }

  if (search.oem && oem) {
    return (
      <OemDetailView
        oem={oem}
        search={search}
        allItems={allItems}
        allFacets={allFacets}
        onPatch={patchSearch}
      />
    );
  }

  return (
    <OemGridView search={search} allItems={allItems} allFacets={allFacets} onPatch={patchSearch} />
  );
}

function OemGridView({
  search,
  allItems,
  allFacets,
  onPatch,
}: {
  search: CertSearch;
  allItems: ReturnType<typeof listCertBrowseItems>;
  allFacets: ReturnType<typeof certBrowseFacets>;
  onPatch: (patch: Partial<CertSearch>) => void;
}) {
  const stats = getCatalogStats();
  const browseActive = Boolean(
    search.q || search.vendor || search.level || search.domain || search.sort,
  );
  const sort = search.sort ?? "name";
  const results = browseActive
    ? applyCertBrowse(allItems, {
        q: search.q,
        vendor: search.vendor,
        level: search.level,
        domain: search.domain,
        sort,
      })
    : [];
  const guides = applyCertBrowse(
    allItems.filter((item) => item.guideSlug),
    { sort: "name" },
  );

  function clearFilters() {
    onPatch({
      q: undefined,
      vendor: undefined,
      level: undefined,
      domain: undefined,
      sort: undefined,
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">Certifications</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Choose a vendor. Open a guide.
        </h1>
        <p className="mt-3 text-muted-foreground">
          {stats.liveGuides} live guides across {stats.oems} OEMs · more vendors listed as Wave B.
          Search the catalogue, or pick an OEM to see its certification types.
        </p>
      </div>

      <CertBrowseToolbar
        q={search.q ?? ""}
        vendor={search.vendor ?? ""}
        level={search.level ?? ""}
        domain={search.domain ?? ""}
        sort={sort}
        facets={allFacets}
        onQ={(value) => onPatch({ q: value || undefined })}
        onVendor={(slug) => onPatch({ vendor: slug || undefined })}
        onLevel={(value) => onPatch({ level: value || undefined })}
        onDomain={(value) => onPatch({ domain: value || undefined })}
        onSort={(value) => onPatch({ sort: value === "name" ? undefined : value })}
      />

      {browseActive ? (
        <section className="mt-10">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {results.length} certification{results.length === 1 ? "" : "s"}
          </div>
          {results.length === 0 ? (
            <CertBrowseEmpty onClear={clearFilters} />
          ) : (
            <CertBrowseGrid items={results} showVendor />
          )}
        </section>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {OEM_CATALOGUE.map((entry) => (
              <OemTile key={entry.slug} oem={entry} />
            ))}
          </div>

          <section className="mt-14">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Guides
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Exam fee and duration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live guides include the exam fee and duration from the catalogue. Coming-soon exams
              stay unpriced until a guide is published.
            </p>
            <CertBrowseGrid items={guides} showVendor />
          </section>
        </>
      )}
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

function OemDetailView({
  oem,
  search,
  allItems,
  allFacets,
  onPatch,
}: {
  oem: OemCatalogueEntry;
  search: CertSearch;
  allItems: ReturnType<typeof listCertBrowseItems>;
  allFacets: ReturnType<typeof certBrowseFacets>;
  onPatch: (patch: Partial<CertSearch>) => void;
}) {
  const scoped = useMemo(
    () => allItems.filter((item) => item.vendorSlug === oem.slug),
    [allItems, oem.slug],
  );
  const scopedFacets = useMemo(() => certBrowseFacets(scoped), [scoped]);
  const facets = {
    ...scopedFacets,
    vendors: allFacets.vendors,
  };
  const defaultSort: CertBrowseSort = scopedFacets.hasLevel ? "level" : "name";
  const sort = search.sort ?? defaultSort;
  const filtered = applyCertBrowse(scoped, {
    q: search.q,
    level: search.level,
    domain: search.domain,
    sort,
  });
  const filtering = Boolean(
    search.q || search.level || search.domain || (search.sort && search.sort !== defaultSort),
  );
  const showGroups = !filtering && oem.pathCount >= GROUP_BY_LEVEL_THRESHOLD && sort === "level";

  function clearFilters() {
    onPatch({
      oem: oem.slug,
      q: undefined,
      vendor: undefined,
      level: undefined,
      domain: undefined,
      sort: undefined,
    });
  }

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

      <CertBrowseToolbar
        q={search.q ?? ""}
        vendor={oem.slug}
        level={search.level ?? ""}
        domain={search.domain ?? ""}
        sort={sort}
        facets={facets}
        onQ={(value) => onPatch({ q: value || undefined })}
        onVendor={(slug) =>
          onPatch({
            oem: slug || undefined,
            vendor: undefined,
          })
        }
        onLevel={(value) => onPatch({ level: value || undefined })}
        onDomain={(value) => onPatch({ domain: value || undefined })}
        onSort={(value) => onPatch({ sort: value === defaultSort ? undefined : value })}
      />

      {scoped.length === 0 ? (
        <ComingSoonPanel oem={oem} />
      ) : filtered.length === 0 ? (
        <CertBrowseEmpty onClear={clearFilters} />
      ) : showGroups ? (
        <div className="mt-10 space-y-10">
          {groupCertBrowseByLevel(filtered).map((group) => (
            <section key={group.level}>
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {group.level}
                <span className="ml-2 text-muted-foreground/70">({group.items.length})</span>
              </h2>
              <CertBrowseGrid items={group.items} accent={oem.color} />
            </section>
          ))}
        </div>
      ) : (
        <section className="mt-10">
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {filtered.length} certification{filtered.length === 1 ? "" : "s"}
          </div>
          <CertBrowseGrid items={filtered} accent={oem.color} />
        </section>
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
