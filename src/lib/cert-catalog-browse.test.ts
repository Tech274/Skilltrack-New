import { describe, expect, it } from "vitest";
import { getCert } from "@/lib/certifications";
import {
  applyCertBrowse,
  certBrowseFacets,
  formatCatalogExamFee,
  listCertBrowseItems,
} from "@/lib/cert-catalog-browse";

const items = listCertBrowseItems();

describe("cert catalogue browse", () => {
  it("uses guide fees and durations and leaves coming-soon rows unpriced", () => {
    const saa = items.find((item) => item.code === "SAA-C03");
    expect(saa).toMatchObject({
      vendorSlug: "aws",
      level: "Associate",
      priceUsd: 150,
      durationMin: 130,
      guideSlug: "aws-solutions-architect-associate",
    });
    expect(saa?.domains).toContain("Design secure architectures");

    const guideSlugs = items.map((item) => item.guideSlug).filter((slug): slug is string => !!slug);
    expect(new Set(guideSlugs).size).toBe(guideSlugs.length);

    for (const item of items) {
      if (item.guideSlug) {
        const cert = getCert(item.guideSlug);
        expect(item.priceUsd).toBe(cert?.cost ?? null);
        expect(item.durationMin).toBe(cert?.durationMin ?? null);
      } else {
        expect(item.priceUsd).toBeNull();
        expect(item.durationMin).toBeNull();
        expect(item.domains).toEqual([]);
      }
    }
  });

  it("filters by vendor, level, and domain and searches text", () => {
    const awsAssociate = applyCertBrowse(items, { vendor: "aws", level: "Associate" });
    expect(awsAssociate.length).toBeGreaterThan(0);
    expect(
      awsAssociate.every((item) => item.vendorSlug === "aws" && item.level === "Associate"),
    ).toBe(true);

    const byDomain = applyCertBrowse(items, { domain: "Design secure architectures" });
    expect(byDomain.map((item) => item.code)).toContain("SAA-C03");
    expect(byDomain.every((item) => item.domains.includes("Design secure architectures"))).toBe(
      true,
    );

    expect(applyCertBrowse(items, { q: "saa-c03" }).map((item) => item.guideSlug)).toContain(
      "aws-solutions-architect-associate",
    );
    expect(applyCertBrowse(items, { q: "zzzz-not-a-cert" })).toEqual([]);
    expect(
      applyCertBrowse(items, {
        vendor: "aws",
        level: "Foundational",
        domain: "Design secure architectures",
      }),
    ).toEqual([]);
  });

  it("sorts by name, and by level or price with missing values last", () => {
    const byName = applyCertBrowse(items, { vendor: "google-cloud", sort: "name" });
    const names = byName.map((item) => item.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);

    const byNameDesc = applyCertBrowse(items, { vendor: "google-cloud", sort: "name-desc" });
    expect(byNameDesc.map((item) => item.name)).toEqual([...names].reverse());

    const byLevel = applyCertBrowse(items, { vendor: "aws", sort: "level" });
    const levelRanks = byLevel.map((item) => item.level);
    const firstMissing = levelRanks.findIndex((level) => !level);
    if (firstMissing >= 0) {
      expect(levelRanks.slice(firstMissing).every((level) => !level)).toBe(true);
    }

    const byPrice = applyCertBrowse(items, { vendor: "aws", sort: "price" });
    const prices = byPrice.map((item) => item.priceUsd);
    const firstNull = prices.findIndex((price) => price == null);
    const known = (firstNull === -1 ? prices : prices.slice(0, firstNull)) as number[];
    expect(known).toEqual([...known].sort((a, b) => a - b));
    if (firstNull >= 0) expect(prices.slice(firstNull).every((price) => price == null)).toBe(true);

    const byPriceDesc = applyCertBrowse(items, { vendor: "aws", sort: "price-desc" });
    const descPrices = byPriceDesc.map((item) => item.priceUsd);
    const descNull = descPrices.findIndex((price) => price == null);
    const descKnown = (descNull === -1 ? descPrices : descPrices.slice(0, descNull)) as number[];
    expect(descKnown).toEqual([...descKnown].sort((a, b) => b - a));
    if (descNull >= 0)
      expect(descPrices.slice(descNull).every((price) => price == null)).toBe(true);
  });

  it("builds facets from the rows that have each field", () => {
    const facets = certBrowseFacets(items);
    expect(facets.vendors.map((vendor) => vendor.slug)).toContain("aws");
    expect(facets.levels).toContain("Associate");
    expect(facets.domains).toContain("Design secure architectures");
    expect(facets.hasLevel).toBe(true);
    expect(facets.hasPrice).toBe(true);
    expect(formatCatalogExamFee(150)).toBe("$150");

    const unpriced = certBrowseFacets(items.filter((item) => item.priceUsd == null));
    expect(unpriced.hasPrice).toBe(false);
  });
});
