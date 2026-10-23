import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { certifications } from "./certifications";
import { PREP_SKU_TYPE_KEYS } from "./marketplace";
import {
  SITE_ORIGIN,
  SITEMAP_EXCLUDED_PATHS,
  publicSitemapEntries,
  renderPublicSitemap,
} from "./public-sitemap";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function routeIds(): string[] {
  const ids: string[] = [];
  const re = /createFileRoute\("([^"]+)"\)/g;
  for (const file of walk("src/routes")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(re)) ids.push(match[1]);
  }
  return ids;
}

function quotedAfter(source: string, marker: RegExp): string[] {
  const values: string[] = [];
  const re = new RegExp(marker.source + String.raw`[\s\S]{0,160}?(` + "`[^`]*`" + `|"[^"]*")`, "g");
  for (const match of source.matchAll(re)) values.push(match[1]);
  return values;
}

describe("public sitemap", () => {
  const entries = publicSitemapEntries();
  const locs = new Set(
    entries.map((entry) =>
      entry.path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${entry.path}`,
    ),
  );

  it("covers static public routes, certification guides, and marketplace shelves", () => {
    const excluded = new Set<string>(SITEMAP_EXCLUDED_PATHS);
    for (const id of routeIds()) {
      if (id.startsWith("/_authenticated") || id.startsWith("/api") || id.includes("$")) continue;
      if (id.startsWith("/.lovable") || id.startsWith("/.mcp") || id.startsWith("/.well-known"))
        continue;
      const path = id === "/" ? "/" : id.replace(/\/$/, "");
      if (excluded.has(path)) {
        expect(locs.has(`${SITE_ORIGIN}${path === "/" ? "/" : path}`), path).toBe(false);
        continue;
      }
      const loc = path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
      expect(locs.has(loc), path).toBe(true);
    }

    for (const cert of certifications) {
      expect(locs.has(`${SITE_ORIGIN}/certifications/${cert.slug}`)).toBe(true);
    }
    for (const type of PREP_SKU_TYPE_KEYS) {
      expect(locs.has(`${SITE_ORIGIN}/marketplace/${type}`)).toBe(true);
    }
    expect(locs.has(`${SITE_ORIGIN}/assessment`)).toBe(true);
    expect(locs.has(`${SITE_ORIGIN}/marketplace/aws-saa/mock`)).toBe(true);
    expect(locs.has(`${SITE_ORIGIN}/marketplace/mock/aws`)).toBe(true);
  });

  it("leaves private, redirected, and robots-disallowed paths out", () => {
    const text = [...locs].join("\n");
    for (const blocked of [
      "/admin",
      "/dashboard",
      "/org",
      "/labs",
      "/api/",
      "/auth",
      "/checkout",
    ]) {
      expect(text.includes(`${SITE_ORIGIN}${blocked}`)).toBe(false);
    }
  });

  it("matches public/sitemap.xml and is referenced from robots.txt", () => {
    expect(readFileSync("public/sitemap.xml", "utf8")).toBe(renderPublicSitemap());
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe("absolute canonicals", () => {
  it("uses https://skilltrack.co.in on every public route head", () => {
    const files = walk("src/routes").filter((file) => !file.includes("/_authenticated/"));
    const found: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const hrefs = [
        ...quotedAfter(source, /rel:\s*"canonical"/),
        ...quotedAfter(source, /property:\s*"og:url"/),
      ];
      for (const href of hrefs) {
        found.push(`${file} ${href}`);
        expect(href.includes("https://skilltrack.co.in"), `${file} ${href}`).toBe(true);
        expect(href.startsWith('"/') || href.startsWith("'/") || href.startsWith("`/"), href).toBe(
          false,
        );
      }
    }
    expect(found.length).toBeGreaterThan(10);
  });
});
