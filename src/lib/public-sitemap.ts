import { certifications } from "./certifications";
import {
  PREP_SKU_TYPE_KEYS,
  STATIC_MARKETPLACE_CATALOG,
  getPrepSkuFromCatalog,
  listOemsForType,
} from "./marketplace";

export const SITE_ORIGIN = "https://skilltrack.co.in";

/**
 * Public routes that exist but should not be indexed: account flows, legacy
 * redirects, checkout (redirects to /book-a-call), and /labs (disallowed in
 * robots.txt), and the MCP endpoint. Authenticated, admin, and API routes
 * are omitted as well.
 */
export const SITEMAP_EXCLUDED_PATHS = [
  "/auth",
  "/auth/password-reset-sent",
  "/checkout",
  "/labs",
  "/login",
  "/mcp",
  "/packs",
  "/privacy-policy",
  "/signup",
] as const;

type SitemapEntry = { path: string; priority: string };

const STATIC_PAGES: SitemapEntry[] = [
  { path: "/", priority: "1.0" },
  { path: "/book-a-call", priority: "0.9" },
  { path: "/marketplace", priority: "0.9" },
  { path: "/career-explorer", priority: "0.8" },
  { path: "/pricing", priority: "0.8" },
  { path: "/assessment", priority: "0.8" },
  { path: "/compare", priority: "0.7" },
  { path: "/certifications", priority: "0.7" },
  { path: "/certiq", priority: "0.7" },
  { path: "/salary", priority: "0.6" },
  { path: "/enterprise", priority: "0.6" },
  { path: "/blog", priority: "0.5" },
  { path: "/about", priority: "0.5" },
  { path: "/contact", priority: "0.5" },
  { path: "/privacy", priority: "0.3" },
  { path: "/terms", priority: "0.3" },
];

export function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path}`;
}

/** Indexable public URLs, including certification guides and marketplace shelves. */
export function publicSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [...STATIC_PAGES];

  for (const cert of certifications) {
    entries.push({ path: `/certifications/${cert.slug}`, priority: "0.6" });
  }

  for (const type of PREP_SKU_TYPE_KEYS) {
    entries.push({ path: `/marketplace/${type}`, priority: "0.6" });
    for (const oem of listOemsForType(type)) {
      entries.push({ path: `/marketplace/${type}/${oem.key}`, priority: "0.5" });
    }
  }

  for (const cert of STATIC_MARKETPLACE_CATALOG.certs) {
    for (const type of PREP_SKU_TYPE_KEYS) {
      if (getPrepSkuFromCatalog(cert.key, type)) {
        entries.push({ path: `/marketplace/${cert.key}/${type}`, priority: "0.5" });
      }
    }
  }

  return entries;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPublicSitemap(entries: SitemapEntry[] = publicSitemapEntries()): string {
  const urls = entries
    .map(
      (entry) =>
        `<url><loc>${escapeXml(absoluteUrl(entry.path))}</loc><priority>${entry.priority}</priority></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
