import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PASS_OUTLOOK } from "./certifications";

const PASS_RATE_SURFACES = [
  "src/components/cert-marketplace-card.tsx",
  "src/routes/compare.tsx",
  "src/routes/_authenticated/dashboard.compare.tsx",
  "src/routes/certifications.$slug.tsx",
];

const EXTERNAL_LINK_SURFACES = [
  "src/components/site-layout.tsx",
  "src/components/campaign-carousel.tsx",
  "src/components/certiq-tabs.tsx",
  "src/components/PaymentTestModeBanner.tsx",
  "src/routes/labs.tsx",
  "src/routes/contact.tsx",
  "src/routes/book-a-call.tsx",
  "src/routes/certiq.tsx",
  "src/routes/marketplace.index.tsx",
  "src/routes/marketplace.$cert.$type.tsx",
  "src/routes/_authenticated/security.tsx",
];

describe("unsourced pass rates", () => {
  it("uses a non-numeric outlook instead of successRate percentages", () => {
    expect(PASS_OUTLOOK).not.toMatch(/\d/);
    for (const file of PASS_RATE_SURFACES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/successRate/);
      expect(src, file).not.toMatch(/Success rate/);
      expect(src, file).not.toMatch(/Easiest pass/);
      expect(src, file).toContain("Pass outlook");
      expect(src, file).toContain("PASS_OUTLOOK");
    }
  });
});

describe("external links", () => {
  it("marks every off-site anchor with the icon helper and a safe rel", () => {
    for (const file of EXTERNAL_LINK_SURFACES) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("ExternalLinkMarker");
      expect(src, file).toMatch(/noopener/);
      expect(src, file).toMatch(/noreferrer/);
    }
    const marker = readFileSync("src/components/external-link.tsx", "utf8");
    expect(marker).toContain('export const OPENS_IN_NEW_TAB = "opens in new tab"');
  });
});
