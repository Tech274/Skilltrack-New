/**
 * Certifications OEM catalogue — 3-level IA hub data.
 * OEM grid sourced from public/logos/oem/MANIFEST.json (mirrored under src/data).
 * Catalogue exam paths from Operating Sheet v6 (src/data/oem-exam-paths.json).
 * Does not use FLASH accents; brand colors are local tokens for tile wells.
 */
import { OEM_MANIFEST } from "@/data/oem-manifest";
import oemExamPathsJson from "@/data/oem-exam-paths.json";
import { certifications, type Certification } from "@/lib/certifications";
import { OEM_NAMES } from "@/lib/assessment";

export type OemManifestEntry = {
  oem: string;
  slug: string;
  file: string;
  source?: string;
  status?: string;
};

export type OemExamPath = {
  examId: string;
  name: string;
  code: string;
  level: string;
};

export type OemPathTile = {
  examId: string;
  name: string;
  code: string;
  level: string;
  /** Live guide when matched; null = Coming soon */
  guide: Certification | null;
};

/** Canonical aliases: azure↔microsoft-azure, gcp↔google-cloud, hashicorp↔terraform */
const OEM_ALIASES: Record<string, string> = {
  azure: "microsoft-azure",
  "microsoft-azure": "microsoft-azure",
  gcp: "google-cloud",
  "google-cloud": "google-cloud",
  hashicorp: "terraform",
  terraform: "terraform",
};

/** Map Certification.vendor → MANIFEST (or supplemental) OEM slug */
const VENDOR_TO_OEM_SLUG: Record<string, string> = {
  "Amazon Web Services": "aws",
  Microsoft: "microsoft-azure",
  "Google Cloud": "google-cloud",
  "CNCF / Linux Foundation": "kubernetes",
  HashiCorp: "terraform",
  ISC2: "isc2",
  CompTIA: "comptia",
  Snowflake: "snowflake",
  Databricks: "databricks",
  Salesforce: "salesforce",
  ServiceNow: "servicenow",
};

/**
 * Assessment search uses OEM_NAMES keys (aws, azure, gcp, hashicorp, …).
 * MANIFEST slugs sometimes differ — resolve before linking to /assessment.
 */
const OEM_TO_ASSESSMENT_SLUG: Record<string, string> = {
  aws: "aws",
  "microsoft-azure": "azure",
  azure: "azure",
  "google-cloud": "gcp",
  gcp: "gcp",
  salesforce: "salesforce",
  servicenow: "servicenow",
  pmi: "pmi",
  comptia: "comptia",
  terraform: "hashicorp",
  hashicorp: "hashicorp",
  snowflake: "snowflake",
  databricks: "databricks",
  cisco: "cisco",
  kubernetes: "kubernetes",
};

/** Brand well colors (not FLASH accents) for dense OEM tiles */
const OEM_COLORS: Record<string, string> = {
  adobe: "#FF0000",
  aws: "#FF9900",
  cisco: "#049FD9",
  cloudera: "#F96302",
  comptia: "#E31837",
  cyberark: "#1A1A1A",
  databricks: "#FF3621",
  "ec-council": "#6B2D5C",
  "google-cloud": "#4285F4",
  isaca: "#E31837",
  isc2: "#F16B24",
  istqb: "#00A3E0",
  itil: "#00A1DE",
  juniper: "#84B135",
  kubernetes: "#326CE5",
  "microsoft-azure": "#0078D4",
  mulesoft: "#00A0DF",
  oracle: "#F80000",
  pega: "#1BB4D0",
  pmi: "#B32134",
  prince2: "#00A1DE",
  python: "#3776AB",
  salesforce: "#00A1E0",
  sap: "#0FAAFF",
  sas: "#0074C0",
  "scaled-agile": "#00A3A1",
  scrum: "#009BDE",
  servicenow: "#62D84E",
  "six-sigma": "#1B4F72",
  snowflake: "#29B5E8",
  tableau: "#E97627",
  terraform: "#7B42BC",
  "the-open-group": "#003366",
  vmware: "#607078",
};

/** OEMs with guides + logos but not yet in MANIFEST */
const SUPPLEMENTAL_OEMS: OemManifestEntry[] = [
  {
    oem: "ISC2",
    slug: "isc2",
    file: "isc2.svg",
    status: "supplemental",
  },
];

/** Catalogue level sort: Foundational → Associate → Professional → Specialty → Expert */
const LEVEL_ORDER: Record<string, number> = {
  foundational: 0,
  associate: 1,
  professional: 2,
  specialty: 3,
  expert: 4,
};

const OEM_EXAM_PATHS = oemExamPathsJson as Record<string, OemExamPath[]>;

export type OemCatalogueEntry = {
  slug: string;
  name: string;
  file: string;
  logoSrc: string;
  color: string;
  guideCount: number;
  guides: Certification[];
  /** Catalogue exam rows for this OEM (empty = Wave B / guides-only fallback) */
  paths: OemPathTile[];
  pathCount: number;
  livePathCount: number;
  comingSoonPathCount: number;
  /** OEM_NAMES key when assessment supports this OEM; else null */
  assessmentSlug: string | null;
};

export function oemLogoPath(file: string): string {
  return `/logos/oem/${file}`;
}

/** Resolve any alias / variant to the canonical catalogue slug */
export function resolveOemSlug(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  if (OEM_ALIASES[key]) return OEM_ALIASES[key];
  return key;
}

function assessmentSlugFor(canonicalSlug: string): string | null {
  const mapped = OEM_TO_ASSESSMENT_SLUG[canonicalSlug] ?? canonicalSlug;
  return OEM_NAMES[mapped] ? mapped : null;
}

function levelRank(level: string): number {
  return LEVEL_ORDER[level.trim().toLowerCase()] ?? 50;
}

/** Public rank for catalogue levels (Foundational → Expert). Unknown levels sort last. */
export function catalogLevelRank(level: string): number {
  return levelRank(level);
}

/**
 * Matcher for Catalogue exam ↔ live Certification guide:
 * 1. Prefer exact exam `code` (case-insensitive) against Certification.code.
 * 2. Fallback fuzzy name: lowercase, drop parentheticals / punctuation / the word
 *    "certified|certification|certificate", then equality, substring either way,
 *    or every token of the shorter name appearing in the longer (min 2 tokens).
 * Each live guide is consumed at most once (first Catalogue row wins).
 */
function normalizeExamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(certified|certification|certificate)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyExamNamesMatch(a: string, b: string): boolean {
  const na = normalizeExamName(a);
  const nb = normalizeExamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  if (shorter.length < 2) return false;
  return shorter.every((t) => longer.has(t));
}

function matchGuideToExam(
  exam: OemExamPath,
  guides: Certification[],
  used: Set<string>,
): Certification | null {
  const code = (exam.code || "").trim().toUpperCase();
  if (code) {
    for (const g of guides) {
      if (used.has(g.slug)) continue;
      if ((g.code || "").trim().toUpperCase() === code) return g;
    }
  }
  for (const g of guides) {
    if (used.has(g.slug)) continue;
    if (fuzzyExamNamesMatch(exam.name, g.name)) return g;
  }
  return null;
}

function buildPathsForOem(slug: string, guides: Certification[]): OemPathTile[] {
  const rows = OEM_EXAM_PATHS[slug] ?? [];
  if (rows.length === 0) return [];

  const used = new Set<string>();
  const tiles: OemPathTile[] = rows.map((exam) => {
    const guide = matchGuideToExam(exam, guides, used);
    if (guide) used.add(guide.slug);
    return {
      examId: exam.examId,
      name: exam.name,
      code: exam.code || "",
      level: exam.level || "",
      guide,
    };
  });

  tiles.sort((a, b) => {
    const lr = levelRank(a.level) - levelRank(b.level);
    if (lr !== 0) return lr;
    return a.name.localeCompare(b.name);
  });

  return tiles;
}

/** Group path tiles by level for large OEM detail views (preserves LEVEL_ORDER). */
export function groupPathsByLevel(paths: OemPathTile[]): { level: string; paths: OemPathTile[] }[] {
  const map = new Map<string, OemPathTile[]>();
  for (const p of paths) {
    const key = p.level?.trim() || "Other";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  const levels = [...map.keys()].sort((a, b) => levelRank(a) - levelRank(b) || a.localeCompare(b));
  return levels.map((level) => ({ level, paths: map.get(level)! }));
}

function buildEntries(): OemCatalogueEntry[] {
  const bySlug = new Map<string, OemManifestEntry>();
  for (const row of OEM_MANIFEST) {
    bySlug.set(row.slug, row);
  }
  for (const row of SUPPLEMENTAL_OEMS) {
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
  }

  const guidesByOem = new Map<string, Certification[]>();
  for (const cert of certifications) {
    const oemSlug = VENDOR_TO_OEM_SLUG[cert.vendor];
    if (!oemSlug) continue;
    const canonical = resolveOemSlug(oemSlug) ?? oemSlug;
    const list = guidesByOem.get(canonical) ?? [];
    list.push(cert);
    guidesByOem.set(canonical, list);
  }

  const entries: OemCatalogueEntry[] = [];
  for (const row of bySlug.values()) {
    const guides = guidesByOem.get(row.slug) ?? [];
    const paths = buildPathsForOem(row.slug, guides);
    const livePathCount = paths.filter((p) => p.guide).length;
    entries.push({
      slug: row.slug,
      name: row.oem,
      file: row.file,
      logoSrc: oemLogoPath(row.file),
      color: OEM_COLORS[row.slug] ?? "#64748B",
      guideCount: guides.length,
      guides,
      paths,
      pathCount: paths.length,
      livePathCount,
      comingSoonPathCount: paths.length - livePathCount,
      assessmentSlug: assessmentSlugFor(row.slug),
    });
  }

  // OEMs with guides first, then alpha by name
  entries.sort((a, b) => {
    if (a.guideCount !== b.guideCount) return b.guideCount - a.guideCount;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export const OEM_CATALOGUE: OemCatalogueEntry[] = buildEntries();

export function getOem(slug: string | undefined | null): OemCatalogueEntry | undefined {
  const canonical = resolveOemSlug(slug);
  if (!canonical) return undefined;
  return OEM_CATALOGUE.find((o) => o.slug === canonical);
}

export function guidesForOem(slug: string | undefined | null): Certification[] {
  return getOem(slug)?.guides ?? [];
}

export function pathsForOem(slug: string | undefined | null): OemPathTile[] {
  return getOem(slug)?.paths ?? [];
}

export type CatalogStats = {
  liveGuides: number;
  oems: number;
  byOem: Record<string, { live: number; comingSoon: number }>;
  byCategory: Record<string, number>;
};

/** Single source for public catalog numbers. Live = a guide page exists for the cert. */
export function getCatalogStats(): CatalogStats {
  const byOem: CatalogStats["byOem"] = {};
  const byCategory: Record<string, number> = {};
  let liveGuides = 0;
  for (const o of OEM_CATALOGUE) {
    const live = o.guideCount;
    const comingSoon = o.pathCount > 0 ? o.pathCount - o.livePathCount : 0;
    byOem[o.slug] = { live, comingSoon };
    liveGuides += live;
    for (const g of o.guides) byCategory[g.categorySlug] = (byCategory[g.categorySlug] ?? 0) + 1;
  }
  return {
    liveGuides,
    oems: Object.values(byOem).filter((v) => v.live > 0).length,
    byOem,
    byCategory,
  };
}
