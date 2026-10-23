/**
 * Short and guessed certification URLs.
 *
 * getCert() matches only the exact long catalog slug, so /certifications/aws,
 * /aws-saa-c03, /salesforce, and /azure render "Certification not found".
 * These aliases 301 instead: OEM names to the hub, exam codes to the long slug.
 */
import { certifications, getCert } from "@/lib/certifications";
import { OEM_CATALOGUE, resolveOemSlug } from "@/lib/oem-catalogue";

const RESERVED_ROOT = new Set([
  "about",
  "admin",
  "api",
  "assessment",
  "assets",
  "auth",
  "billing",
  "blog",
  "book-a-call",
  "career-explorer",
  "certifications",
  "certiq",
  "checkout",
  "compare",
  "contact",
  "dashboard",
  "enterprise",
  "favicon.ico",
  "labs",
  "login",
  "logos",
  "marketplace",
  "org",
  "packs",
  "pricing",
  "privacy",
  "privacy-policy",
  "robots.txt",
  "salary",
  "security",
  "signup",
  "sitemap.xml",
  "terms",
]);

/** Extra OEM words that are not catalogue slugs. */
const EXTRA_OEM_ALIASES: Record<string, string> = {
  azure: "microsoft-azure",
  gcp: "google-cloud",
  hashicorp: "terraform",
  microsoft: "microsoft-azure",
  amazon: "aws",
  google: "google-cloud",
};

const VENDOR_PREFIXES: Record<string, string[]> = {
  "Amazon Web Services": ["aws"],
  Microsoft: ["azure", "microsoft-azure"],
  "Google Cloud": ["gcp", "google-cloud"],
  "CNCF / Linux Foundation": ["kubernetes", "cncf"],
  HashiCorp: ["hashicorp", "terraform"],
  ISC2: ["isc2"],
  CompTIA: ["comptia"],
  Snowflake: ["snowflake"],
  Databricks: ["databricks"],
  Salesforce: ["salesforce"],
};

export function normalizeAliasKey(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "");
  return pathname;
}

type AliasMaps = {
  /** key -> canonical OEM catalogue slug */
  oem: Map<string, string>;
  /** key -> published certification slug. Never contains a published slug as a key. */
  cert: Map<string, string>;
};

function buildAliasMaps(): AliasMaps {
  const oem = new Map<string, string>();
  const cert = new Map<string, string>();

  const addOem = (raw: string, canonical: string) => {
    const key = normalizeAliasKey(raw);
    if (!key || getCert(key)) return;
    const resolved = resolveOemSlug(canonical) ?? canonical;
    if (!OEM_CATALOGUE.some((entry) => entry.slug === resolved)) return;
    const existing = oem.get(key);
    if (existing && existing !== resolved) return;
    oem.set(key, resolved);
  };

  for (const entry of OEM_CATALOGUE) {
    const canonical = resolveOemSlug(entry.slug) ?? entry.slug;
    addOem(entry.slug, canonical);
    addOem(entry.name, canonical);
  }
  for (const [alias, canonical] of Object.entries(EXTRA_OEM_ALIASES)) {
    addOem(alias, canonical);
  }

  const addCert = (raw: string, slug: string) => {
    const key = normalizeAliasKey(raw);
    if (!key || key === slug || getCert(key)) return;
    const existing = cert.get(key);
    if (existing && existing !== slug) return;
    cert.set(key, slug);
  };

  for (const item of certifications) {
    const code = normalizeAliasKey(item.code);
    if (!code) continue;
    addCert(code, item.slug);
    const compact = code.replace(/-/g, "");
    if (compact !== code) addCert(compact, item.slug);
    for (const prefix of VENDOR_PREFIXES[item.vendor] ?? []) {
      addCert(`${prefix}-${code}`, item.slug);
      if (compact !== code) addCert(`${prefix}-${compact}`, item.slug);
    }
  }

  return { oem, cert };
}

const ALIASES = buildAliasMaps();

/** Path + search to send for this pathname, or null when it should not redirect. */
export function certAliasPath(pathname: string): string | null {
  const path = stripTrailingSlash(pathname);
  const underCert = path.match(/^\/certifications\/([^/]+)$/);
  if (underCert) {
    const key = normalizeAliasKey(underCert[1]);
    if (!key || getCert(underCert[1]) || getCert(key)) return null;
    const certSlug = ALIASES.cert.get(key);
    if (certSlug) return `/certifications/${certSlug}`;
    const oem = ALIASES.oem.get(key);
    if (oem) return `/certifications?oem=${oem}`;
    return null;
  }

  const root = path.match(/^\/([^/]+)$/);
  if (!root) return null;
  const key = normalizeAliasKey(root[1]);
  if (!key || RESERVED_ROOT.has(key)) return null;
  const certSlug = ALIASES.cert.get(key);
  if (certSlug) return `/certifications/${certSlug}`;
  if (getCert(key)) return `/certifications/${key}`;
  const oem = ALIASES.oem.get(key);
  if (oem) return `/certifications?oem=${oem}`;
  return null;
}

function joinTarget(origin: string, target: string, suffix: string): string {
  const hashAt = suffix.indexOf("#");
  const hash = hashAt >= 0 ? suffix.slice(hashAt) : "";
  const search = hashAt >= 0 ? suffix.slice(0, hashAt) : suffix;
  const extra = search.startsWith("?") ? search.slice(1) : search;
  if (!extra) return `${origin}${target}${hash}`;
  const joiner = target.includes("?") ? "&" : "?";
  return `${origin}${target}${joiner}${extra}${hash}`;
}

/** Absolute URL for a 301, or null. Search and hash are kept. */
export function certAliasRedirectUrl(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const target = certAliasPath(url.pathname);
  if (!target) return null;
  const pathStart = requestUrl.indexOf(url.pathname);
  const suffix =
    pathStart >= 0 ? requestUrl.slice(pathStart + url.pathname.length) : `${url.search}${url.hash}`;
  return joinTarget(url.origin, target, suffix);
}

/** Router href for a matched alias, preserving search and hash. */
export function certAliasLocationHref(pathname: string, href: string): string | null {
  const target = certAliasPath(pathname);
  if (!target) return null;
  const suffix = href.startsWith(pathname) ? href.slice(pathname.length) : "";
  return joinTarget("", target, suffix);
}

/** True when /certifications/:slug is neither a guide nor an alias. */
export function isUnknownCertDetailPath(pathname: string): boolean {
  const path = stripTrailingSlash(pathname);
  const match = path.match(/^\/certifications\/([^/]+)$/);
  if (!match) return false;
  if (getCert(match[1]) || getCert(normalizeAliasKey(match[1]))) return false;
  if (certAliasPath(path)) return false;
  return true;
}

/**
 * Force a real 404 when the cert detail route rendered its not-found page
 * but the upstream response stayed 200.
 */
export function certDetailHttpStatus(pathname: string, upstreamStatus: number): number {
  if (upstreamStatus === 200 && isUnknownCertDetailPath(pathname)) return 404;
  return upstreamStatus;
}

export type CertRedirectRule = { from: string; to: string };

/** Static 301 lines for Cloudflare `_redirects`, plus root copies of long slugs. */
export function certAliasRedirectRules(): CertRedirectRule[] {
  const byFrom = new Map<string, string>();
  const add = (from: string, to: string) => {
    if (from === to || byFrom.has(from)) return;
    byFrom.set(from, to);
  };
  const addBoth = (key: string, to: string, includeRoot: boolean) => {
    if (includeRoot && !RESERVED_ROOT.has(key)) {
      add(`/${key}`, to);
      add(`/${key}/`, to);
    }
    if (!getCert(key)) {
      add(`/certifications/${key}`, to);
      add(`/certifications/${key}/`, to);
    }
  };

  for (const [key, oem] of ALIASES.oem) {
    addBoth(key, `/certifications?oem=${oem}`, true);
  }
  for (const [key, slug] of ALIASES.cert) {
    const to = `/certifications/${slug}`;
    // Exam codes win over an OEM name if they ever share a key.
    byFrom.delete(`/${key}`);
    byFrom.delete(`/${key}/`);
    byFrom.delete(`/certifications/${key}`);
    byFrom.delete(`/certifications/${key}/`);
    addBoth(key, to, true);
  }
  for (const item of certifications) {
    if (RESERVED_ROOT.has(item.slug)) continue;
    add(`/${item.slug}`, `/certifications/${item.slug}`);
    add(`/${item.slug}/`, `/certifications/${item.slug}`);
  }

  return [...byFrom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, to]) => ({ from, to }));
}

export function renderCertAliasRedirectLines(): string {
  const lines = certAliasRedirectRules().map((rule) => `${rule.from} ${rule.to} 301`);
  return [
    "# Certification aliases. OEM names go to the hub; exam codes go to the long guide slug.",
    "# Query strings are kept by Cloudflare Pages. Do not edit by hand — source is src/lib/cert-aliases.ts.",
    ...lines,
    "",
  ].join("\n");
}
