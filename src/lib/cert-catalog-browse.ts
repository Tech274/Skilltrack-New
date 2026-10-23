/**
 * Filter, search, and sort the certifications catalogue the public list already renders.
 * Prices and durations come only from a matched live guide (`Certification.cost` / `durationMin`).
 */
import { catalogLevelRank, OEM_CATALOGUE, type OemCatalogueEntry } from "@/lib/oem-catalogue";

export const CERT_BROWSE_SORTS = ["name", "name-desc", "level", "price", "price-desc"] as const;

export type CertBrowseSort = (typeof CERT_BROWSE_SORTS)[number];

export type CertBrowseItem = {
  id: string;
  name: string;
  code: string;
  vendorName: string;
  vendorSlug: string;
  /** Catalogue path level (Foundational, Associate, …). Null when the row has no level. */
  level: string | null;
  /** Exam blueprint domains from the live guide. Empty when no guide is matched. */
  domains: string[];
  /** OEM exam fee in USD from the live guide. Null when the guide (and therefore the fee) is missing. */
  priceUsd: number | null;
  durationMin: number | null;
  guideSlug: string | null;
};

export type CertBrowseQuery = {
  q?: string;
  vendor?: string;
  level?: string;
  domain?: string;
  sort?: CertBrowseSort;
};

export type CertBrowseFacets = {
  vendors: { slug: string; name: string }[];
  levels: string[];
  domains: string[];
  hasLevel: boolean;
  hasPrice: boolean;
};

export function isCertBrowseSort(value: string): value is CertBrowseSort {
  return (CERT_BROWSE_SORTS as readonly string[]).includes(value);
}

export function listCertBrowseItems(
  catalogue: readonly OemCatalogueEntry[] = OEM_CATALOGUE,
): CertBrowseItem[] {
  const items: CertBrowseItem[] = [];
  for (const oem of catalogue) {
    if (oem.paths.length > 0) {
      const usedGuides = new Set<string>();
      for (const path of oem.paths) {
        if (path.guide) usedGuides.add(path.guide.slug);
        items.push({
          id: `${oem.slug}:${path.examId}`,
          name: path.guide?.name || path.name,
          code: path.guide?.code || path.code,
          vendorName: oem.name,
          vendorSlug: oem.slug,
          level: path.level.trim() || null,
          domains: path.guide?.domains.map((domain) => domain.name) ?? [],
          priceUsd: path.guide ? path.guide.cost : null,
          durationMin: path.guide ? path.guide.durationMin : null,
          guideSlug: path.guide?.slug ?? null,
        });
      }
      for (const guide of oem.guides) {
        if (usedGuides.has(guide.slug)) continue;
        items.push(itemFromGuide(oem, guide));
      }
    } else {
      for (const guide of oem.guides) items.push(itemFromGuide(oem, guide));
    }
  }
  return items;
}

function itemFromGuide(
  oem: OemCatalogueEntry,
  guide: OemCatalogueEntry["guides"][number],
): CertBrowseItem {
  return {
    id: `${oem.slug}:${guide.slug}`,
    name: guide.name,
    code: guide.code,
    vendorName: oem.name,
    vendorSlug: oem.slug,
    level: null,
    domains: guide.domains.map((domain) => domain.name),
    priceUsd: guide.cost,
    durationMin: guide.durationMin,
    guideSlug: guide.slug,
  };
}

export function certBrowseFacets(items: readonly CertBrowseItem[]): CertBrowseFacets {
  const vendors = new Map<string, string>();
  const levels = new Set<string>();
  const domains = new Set<string>();
  let hasPrice = false;
  for (const item of items) {
    vendors.set(item.vendorSlug, item.vendorName);
    if (item.level) levels.add(item.level);
    for (const domain of item.domains) domains.add(domain);
    if (item.priceUsd != null) hasPrice = true;
  }
  return {
    vendors: [...vendors.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    levels: [...levels].sort(
      (a, b) => catalogLevelRank(a) - catalogLevelRank(b) || a.localeCompare(b),
    ),
    domains: [...domains].sort((a, b) => a.localeCompare(b)),
    hasLevel: levels.size > 0,
    hasPrice,
  };
}

function compareMissingLast(a: number | null, b: number | null, direction: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function applyCertBrowse(
  items: readonly CertBrowseItem[],
  query: CertBrowseQuery,
): CertBrowseItem[] {
  const q = query.q?.trim().toLowerCase() ?? "";
  const vendor = query.vendor?.trim().toLowerCase() ?? "";
  const level = query.level?.trim().toLowerCase() ?? "";
  const domain = query.domain?.trim().toLowerCase() ?? "";

  const filtered = items.filter((item) => {
    if (vendor && item.vendorSlug.toLowerCase() !== vendor) return false;
    if (level && (item.level ?? "").toLowerCase() !== level) return false;
    if (domain && !item.domains.some((name) => name.toLowerCase() === domain)) return false;
    if (q) {
      const haystack = [item.name, item.code, item.vendorName, item.level ?? "", ...item.domains]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sort = query.sort ?? "name";
  const nameDir = sort === "name-desc" ? -1 : 1;
  return [...filtered].sort((a, b) => {
    if (sort === "level") {
      const byLevel = compareMissingLast(
        a.level ? catalogLevelRank(a.level) : null,
        b.level ? catalogLevelRank(b.level) : null,
        "asc",
      );
      if (byLevel !== 0) return byLevel;
    } else if (sort === "price" || sort === "price-desc") {
      const byPrice = compareMissingLast(a.priceUsd, b.priceUsd, sort === "price" ? "asc" : "desc");
      if (byPrice !== 0) return byPrice;
    }
    const byName = a.name.localeCompare(b.name) * nameDir;
    if (byName !== 0) return byName;
    return a.vendorName.localeCompare(b.vendorName);
  });
}

export function groupCertBrowseByLevel(
  items: readonly CertBrowseItem[],
): { level: string; items: CertBrowseItem[] }[] {
  const map = new Map<string, CertBrowseItem[]>();
  for (const item of items) {
    const key = item.level?.trim() || "Other";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  const levels = [...map.keys()].sort(
    (a, b) => catalogLevelRank(a) - catalogLevelRank(b) || a.localeCompare(b),
  );
  return levels.map((level) => ({ level, items: map.get(level)! }));
}

export function formatCatalogExamFee(usd: number): string {
  return `$${usd.toLocaleString("en-US")}`;
}

export function formatCatalogDuration(minutes: number): string {
  return `${minutes} min`;
}
