import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { certifications, getCert } from "./certifications";
import {
  certAliasPath,
  certAliasRedirectUrl,
  certDetailHttpStatus,
  isUnknownCertDetailPath,
  renderCertAliasRedirectLines,
} from "./cert-aliases";
import { OEM_CATALOGUE, resolveOemSlug } from "./oem-catalogue";
import { isMissingConsentColumn, notesWithConsent } from "./leads";

const origin = "https://skilltrack.co.in";

function linkedIndexSlugs(): string[] {
  const slugs = new Set<string>();
  for (const oem of OEM_CATALOGUE) {
    for (const guide of oem.guides) slugs.add(guide.slug);
    for (const path of oem.paths) {
      if (path.guide) slugs.add(path.guide.slug);
    }
  }
  return [...slugs].sort();
}

describe("certification aliases", () => {
  it("getCert matches only the exact long slug", () => {
    expect(getCert("aws-solutions-architect-associate")?.code).toBe("SAA-C03");
    expect(getCert("aws")).toBeUndefined();
    expect(getCert("saa-c03")).toBeUndefined();
    expect(getCert("salesforce")).toBeUndefined();
    expect(getCert("azure")).toBeUndefined();
  });

  it("covers every guide slug the certifications index can link", () => {
    const slugs = linkedIndexSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs).toEqual(certifications.map((cert) => cert.slug).sort());
    for (const slug of slugs) {
      expect(getCert(slug)?.slug).toBe(slug);
      expect(certAliasPath(`/certifications/${slug}`)).toBeNull();
      expect(certAliasRedirectUrl(`${origin}/certifications/${slug}`)).toBeNull();
    }
  });

  it("sends every index OEM slug to the certification hub", () => {
    expect(OEM_CATALOGUE.length).toBeGreaterThan(0);
    for (const oem of OEM_CATALOGUE) {
      const canonical = resolveOemSlug(oem.slug) ?? oem.slug;
      const target = `${origin}/certifications?oem=${canonical}`;
      expect(certAliasRedirectUrl(`${origin}/certifications/${oem.slug}`)).toBe(target);
      expect(certAliasRedirectUrl(`${origin}/${oem.slug}`)).toBe(target);
    }
  });

  it("sends OEM names and exam codes to the hub or the long slug", () => {
    expect(certAliasRedirectUrl(`${origin}/certifications/aws`)).toBe(
      `${origin}/certifications?oem=aws`,
    );
    expect(certAliasRedirectUrl(`${origin}/azure`)).toBe(
      `${origin}/certifications?oem=microsoft-azure`,
    );
    expect(certAliasRedirectUrl(`${origin}/certifications/salesforce/`)).toBe(
      `${origin}/certifications?oem=salesforce`,
    );
    expect(certAliasRedirectUrl(`${origin}/certifications/saa-c03`)).toBe(
      `${origin}/certifications/aws-solutions-architect-associate`,
    );
    expect(certAliasRedirectUrl(`${origin}/aws-saa-c03`)).toBe(
      `${origin}/certifications/aws-solutions-architect-associate`,
    );
    expect(certAliasRedirectUrl(`${origin}/SAA-C03?utm=1#guide`)).toBe(
      `${origin}/certifications/aws-solutions-architect-associate?utm=1#guide`,
    );
  });

  it("301s every published exam code, including vendor-prefixed forms", () => {
    for (const cert of certifications) {
      const code = cert.code.toLowerCase();
      if (code === cert.slug) {
        expect(certAliasPath(`/certifications/${code}`)).toBeNull();
      } else {
        expect(certAliasPath(`/certifications/${code}`)).toBe(`/certifications/${cert.slug}`);
      }
      expect(certAliasPath(`/${code}`)).toBe(`/certifications/${cert.slug}`);
    }
    expect(certAliasPath("/azure-az-104")).toBe("/certifications/azure-administrator-az-104");
    expect(certAliasPath("/salesforce-adm-201")).toBe("/certifications/salesforce-administrator");
  });

  it("does not redirect real pages or unknown paths", () => {
    expect(certAliasRedirectUrl(`${origin}/certifications`)).toBeNull();
    expect(certAliasRedirectUrl(`${origin}/login`)).toBeNull();
    expect(certAliasRedirectUrl(`${origin}/book-a-call`)).toBeNull();
    expect(certAliasPath("/certifications/not-a-real-guide")).toBeNull();
  });

  it("turns an unknown guide into a real 404 and leaves published guides alone", () => {
    expect(isUnknownCertDetailPath("/certifications/not-a-real-guide")).toBe(true);
    expect(certDetailHttpStatus("/certifications/not-a-real-guide", 200)).toBe(404);
    expect(certDetailHttpStatus("/certifications/aws-solutions-architect-associate", 200)).toBe(
      200,
    );
    expect(certDetailHttpStatus("/certifications/saa-c03", 200)).toBe(200);
    expect(isUnknownCertDetailPath("/certifications/aws")).toBe(false);
  });

  it("matches the certification section of public/_redirects", () => {
    const text = readFileSync("public/_redirects", "utf8");
    expect(text).toContain(renderCertAliasRedirectLines().trimEnd());
  });
});

describe("messaging consent storage", () => {
  it("fits consent and a timestamp into the notes column", () => {
    const stamped = notesWithConsent("Call me next week", "2026-10-23T18:00:00.000Z");
    expect(stamped).toContain("Call me next week");
    expect(stamped).toContain("[dpdp] messaging_consent=true consent_at=2026-10-23T18:00:00.000Z");
    expect(stamped.length).toBeLessThanOrEqual(1000);
    expect(
      notesWithConsent("x".repeat(2000), "2026-10-23T18:00:00.000Z").length,
    ).toBeLessThanOrEqual(1000);
  });

  it("detects a missing consent column", () => {
    expect(
      isMissingConsentColumn({ code: "42703", message: "column messaging_consent does not exist" }),
    ).toBe(true);
    expect(isMissingConsentColumn({ code: "23505", message: "duplicate" })).toBe(false);
  });
});
