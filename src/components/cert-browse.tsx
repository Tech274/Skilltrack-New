import { Link } from "@tanstack/react-router";
import { Clock3, SearchX } from "lucide-react";
import {
  CERT_BROWSE_SORTS,
  formatCatalogDuration,
  formatCatalogExamFee,
  type CertBrowseFacets,
  type CertBrowseItem,
  type CertBrowseSort,
} from "@/lib/cert-catalog-browse";

const SORT_LABELS: Record<CertBrowseSort, string> = {
  name: "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  level: "Level",
  price: "Price: low to high",
  "price-desc": "Price: high to low",
};

const fieldClass =
  "mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CertBrowseToolbar({
  q,
  vendor,
  level,
  domain,
  sort,
  facets,
  onQ,
  onVendor,
  onLevel,
  onDomain,
  onSort,
}: {
  q: string;
  vendor: string;
  level: string;
  domain: string;
  sort: CertBrowseSort;
  facets: CertBrowseFacets;
  onQ: (value: string) => void;
  onVendor: (slug: string) => void;
  onLevel: (value: string) => void;
  onDomain: (value: string) => void;
  onSort: (value: CertBrowseSort) => void;
}) {
  const sorts = CERT_BROWSE_SORTS.filter((option) => {
    if (option === "level") return facets.hasLevel;
    if (option === "price" || option === "price-desc") return facets.hasPrice;
    return true;
  });

  return (
    <form
      className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      role="search"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="block sm:col-span-2 lg:col-span-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Search
        </span>
        <input
          type="search"
          value={q}
          onChange={(event) => onQ(event.target.value)}
          placeholder="Name, code, or domain"
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Vendor
        </span>
        <select
          value={vendor}
          onChange={(event) => onVendor(event.target.value)}
          className={fieldClass}
        >
          <option value="">All vendors</option>
          {facets.vendors.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Level
        </span>
        <select
          value={level}
          onChange={(event) => onLevel(event.target.value)}
          className={fieldClass}
          disabled={facets.levels.length === 0}
        >
          <option value="">All levels</option>
          {facets.levels.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Domain
        </span>
        <select
          value={domain}
          onChange={(event) => onDomain(event.target.value)}
          className={fieldClass}
          disabled={facets.domains.length === 0}
        >
          <option value="">All domains</option>
          {facets.domains.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Sort
        </span>
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as CertBrowseSort)}
          className={fieldClass}
        >
          {sorts.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}

export function CertBrowseEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <SearchX size={22} />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">No certifications match</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Nothing in the catalogue matches this search and these filters.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Clear filters
      </button>
    </div>
  );
}

export function CertBrowseCard({
  item,
  showVendor = false,
  accent,
}: {
  item: CertBrowseItem;
  showVendor?: boolean;
  accent?: string;
}) {
  const comingSoon = !item.guideSlug;
  const body = (
    <>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-l-xl"
        style={{
          backgroundColor: accent ?? "var(--primary)",
          width: 4,
          opacity: comingSoon ? 0.4 : 1,
        }}
      />
      <div className="flex items-start justify-between gap-3 pl-1">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-foreground">
          {item.name}
        </h3>
        {comingSoon ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/80 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Clock3 size={12} aria-hidden />
            Coming soon
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
        {item.code ? (
          <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {item.code}
          </span>
        ) : null}
        {item.level ? (
          <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            {item.level}
          </span>
        ) : null}
        {showVendor ? (
          <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {item.vendorName}
          </span>
        ) : null}
      </div>
      {item.domains.length > 0 ? (
        <p className="mt-3 line-clamp-2 pl-1 text-sm text-muted-foreground">
          {item.domains.slice(0, 2).join(" · ")}
          {item.domains.length > 2 ? ` · +${item.domains.length - 2}` : ""}
        </p>
      ) : comingSoon ? (
        <p className="mt-3 pl-1 text-sm text-muted-foreground">
          Full guide not published yet — listed from the catalogue.
        </p>
      ) : null}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-4 pl-1 text-xs">
        <div>
          <div className="text-muted-foreground">Exam fee</div>
          <div className="mt-0.5 font-mono font-semibold text-foreground">
            {item.priceUsd != null ? formatCatalogExamFee(item.priceUsd) : "Price on request"}
          </div>
        </div>
        {item.durationMin != null ? (
          <div>
            <div className="text-muted-foreground">Duration</div>
            <div className="mt-0.5 font-mono font-semibold text-foreground">
              {formatCatalogDuration(item.durationMin)}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  const className = comingSoon
    ? "relative flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-border bg-surface/70 p-6"
    : "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated";

  if (!item.guideSlug) {
    return (
      <div
        className={className}
        style={
          accent
            ? { backgroundImage: `linear-gradient(135deg, ${accent}0f 0%, transparent 55%)` }
            : undefined
        }
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      to="/certifications/$slug"
      params={{ slug: item.guideSlug }}
      className={className}
      style={
        accent
          ? { backgroundImage: `linear-gradient(135deg, ${accent}14 0%, transparent 55%)` }
          : undefined
      }
    >
      {body}
    </Link>
  );
}

export function CertBrowseGrid({
  items,
  showVendor = false,
  accent,
}: {
  items: CertBrowseItem[];
  showVendor?: boolean;
  accent?: string;
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <CertBrowseCard key={item.id} item={item} showVendor={showVendor} accent={accent} />
      ))}
    </div>
  );
}
