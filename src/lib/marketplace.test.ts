import { SALES_WHATSAPP } from "@/config/contact";
import { describe, expect, it } from "vitest";
import {
  buildStaticMarketplaceCatalog,
  CERT_TO_OEM,
  formatListedPrice,
  getMarketplaceCert,
  getMarketplaceCertByCatalogSlug,
  getMarketplaceOem,
  getPrepSku,
  getPrepSkuTypeHub,
  listCertsForTypeOem,
  listOemsForType,
  listPrepBundles,
  listPrepSkus,
  listPrepSkuTypeHubs,
  listedSkuPrice,
  marketplaceOemLogoPath,
  MARKETPLACE_CERTS,
  MARKETPLACE_OEM_KEYS,
  MARKETPLACE_PRICE_INR,
  MARKETPLACE_WHATSAPP_NUMBER_PLACEHOLDER,
  marketplaceWhatsAppUrl,
  oemKeyForCert,
  prepBundleForCert,
  priceSummaryForType,
  priceSummaryLabel,
  resolveMarketplaceOneSegment,
  resolveMarketplaceTwoSegment,
} from "./marketplace";

const EXPECTED_KEYS = ["aws-saa", "az-104", "salesforce-admin", "gcp-ace"] as const;
const SKU_TYPES = ["mock", "practice", "notes", "labs"] as const;

describe("marketplace P2a expand", () => {
  it("exposes Architect-locked certs plus SAA", () => {
    expect(MARKETPLACE_CERTS.map((c) => c.key)).toEqual([...EXPECTED_KEYS]);
  });

  it("provides 4 SKUs per cert", () => {
    for (const key of EXPECTED_KEYS) {
      const skus = listPrepSkus(key);
      expect(skus.map((s) => s.type)).toEqual([...SKU_TYPES]);
      for (const type of SKU_TYPES) {
        const hit = getPrepSku(key, type);
        expect(hit?.cert.key).toBe(key);
        expect(hit?.sku.type).toBe(type);
      }
    }
  });

  it("maps catalog slugs used by cert guides", () => {
    expect(getMarketplaceCertByCatalogSlug("azure-administrator-az-104")?.key).toBe("az-104");
    expect(getMarketplaceCertByCatalogSlug("salesforce-administrator")?.key).toBe(
      "salesforce-admin",
    );
    expect(getMarketplaceCertByCatalogSlug("gcp-associate-cloud-engineer")?.key).toBe("gcp-ace");
    expect(getMarketplaceCertByCatalogSlug("aws-solutions-architect-associate")?.key).toBe(
      "aws-saa",
    );
  });

  it("keeps WhatsApp as an explicit placeholder number", () => {
    const cert = getMarketplaceCert("az-104")!;
    const url = marketplaceWhatsAppUrl(cert);
    expect(url).toContain(`wa.me/${MARKETPLACE_WHATSAPP_NUMBER_PLACEHOLDER}`);
    expect(MARKETPLACE_WHATSAPP_NUMBER_PLACEHOLDER).toBe(SALES_WHATSAPP);
    expect(url).toContain(encodeURIComponent("AZ-104"));
  });

  it("returns null for unknown cert/sku", () => {
    expect(getPrepSku("nope", "mock")).toBeNull();
    expect(getPrepSku("aws-saa", "nope")).toBeNull();
  });
});

describe("marketplace type-OEM IA", () => {
  it("maps certs to Architect OEM keys", () => {
    expect(CERT_TO_OEM["aws-saa"]).toBe("aws");
    expect(CERT_TO_OEM["az-104"]).toBe("azure");
    expect(CERT_TO_OEM["gcp-ace"]).toBe("gcp");
    expect(CERT_TO_OEM["salesforce-admin"]).toBe("salesforce");
    expect(oemKeyForCert("aws-saa")).toBe("aws");
    expect(oemKeyForCert("az-104")).toBe("azure");
    expect(oemKeyForCert("gcp-ace")).toBe("gcp");
    expect(oemKeyForCert("salesforce-admin")).toBe("salesforce");
    expect(oemKeyForCert("nope")).toBeNull();
  });

  it("labels type hubs", () => {
    expect(getPrepSkuTypeHub("mock")?.label).toBe("Mock Exams");
    expect(getPrepSkuTypeHub("practice")?.label).toBe("Practice Questions");
    expect(getPrepSkuTypeHub("notes")?.label).toBe("Notes/Blueprints");
    expect(getPrepSkuTypeHub("labs")?.label).toBe("Labs");
    expect(getPrepSkuTypeHub("nope")).toBeNull();
    expect(listPrepSkuTypeHubs().map((h) => h.type)).toEqual([...SKU_TYPES]);
  });

  it("lists all 4 OEMs for each type (every cert has all SKUs today)", () => {
    for (const type of SKU_TYPES) {
      expect(listOemsForType(type).map((o) => o.key)).toEqual([...MARKETPLACE_OEM_KEYS]);
    }
    expect(listOemsForType("nope")).toEqual([]);
  });

  it("lists certs for type + OEM", () => {
    expect(listCertsForTypeOem("mock", "aws").map((c) => c.key)).toEqual(["aws-saa"]);
    expect(listCertsForTypeOem("labs", "azure").map((c) => c.key)).toEqual(["az-104"]);
    expect(listCertsForTypeOem("notes", "gcp").map((c) => c.key)).toEqual(["gcp-ace"]);
    expect(listCertsForTypeOem("practice", "salesforce").map((c) => c.key)).toEqual([
      "salesforce-admin",
    ]);
    expect(listCertsForTypeOem("mock", "nope")).toEqual([]);
    expect(listCertsForTypeOem("nope", "aws")).toEqual([]);
  });

  it("resolves marketplace OEM logo public paths", () => {
    expect(marketplaceOemLogoPath("aws")).toBe("/logos/oem/aws.svg");
    expect(marketplaceOemLogoPath("azure")).toBe("/logos/oem/microsoft-azure.svg");
    expect(marketplaceOemLogoPath("gcp")).toBe("/logos/oem/google-cloud.svg");
    expect(marketplaceOemLogoPath("salesforce")).toBe("/logos/oem/salesforce.svg");
    expect(getMarketplaceOem("azure")?.logoFile).toBe("microsoft-azure.svg");
    expect(getMarketplaceOem("nope")).toBeNull();
  });

  it("disambiguates two-segment marketplace URLs", () => {
    expect(resolveMarketplaceTwoSegment("aws-saa", "mock")).toEqual({
      kind: "sku",
      certKey: "aws-saa",
      skuType: "mock",
    });
    expect(resolveMarketplaceTwoSegment("az-104", "labs")).toEqual({
      kind: "sku",
      certKey: "az-104",
      skuType: "labs",
    });
    expect(resolveMarketplaceTwoSegment("mock", "aws")).toEqual({
      kind: "oem-certs",
      skuType: "mock",
      oemKey: "aws",
    });
    expect(resolveMarketplaceTwoSegment("notes", "gcp")).toEqual({
      kind: "oem-certs",
      skuType: "notes",
      oemKey: "gcp",
    });
    expect(resolveMarketplaceTwoSegment("aws-saa", "aws")).toEqual({ kind: "not-found" });
    expect(resolveMarketplaceTwoSegment("mock", "mock")).toEqual({ kind: "not-found" });
    expect(resolveMarketplaceTwoSegment("aws", "mock")).toEqual({ kind: "not-found" });
    expect(resolveMarketplaceTwoSegment("nope", "mock")).toEqual({ kind: "not-found" });
  });

  it("resolves one-segment marketplace URLs", () => {
    expect(resolveMarketplaceOneSegment("mock")).toEqual({ kind: "type-hub", skuType: "mock" });
    expect(resolveMarketplaceOneSegment("practice")).toEqual({
      kind: "type-hub",
      skuType: "practice",
    });
    expect(resolveMarketplaceOneSegment("aws-saa")).toEqual({ kind: "redirect-index" });
    expect(resolveMarketplaceOneSegment("az-104")).toEqual({ kind: "redirect-index" });
    expect(resolveMarketplaceOneSegment("aws")).toEqual({ kind: "not-found" });
    expect(resolveMarketplaceOneSegment("nope")).toEqual({ kind: "not-found" });
  });
});

describe("marketplace catalog from DB rows", () => {
  it("maps active OEM/cert/SKU rows and ignores inactive", async () => {
    const { catalogFromDbRows } = await import("./marketplace-catalog");
    const mapped = catalogFromDbRows(
      [
        {
          id: "o1",
          key: "aws",
          name: "Amazon Web Services",
          short_name: "AWS",
          logo_path: "/logos/oem/aws.svg",
          sort_order: 1,
          active: true,
        },
        {
          id: "o2",
          key: "azure",
          name: "Microsoft Azure",
          short_name: "Azure",
          logo_path: "/logos/oem/microsoft-azure.svg",
          sort_order: 2,
          active: false,
        },
      ],
      [
        {
          id: "c1",
          oem_id: "o1",
          key: "aws-saa",
          catalog_slug: "aws-solutions-architect-associate",
          catalog_id: null,
          code: "SAA-C03",
          name: "AWS Solutions Architect — Associate",
          short_name: "AWS SAA",
          sort_order: 1,
          active: true,
        },
        {
          id: "c2",
          oem_id: "o2",
          key: "az-104",
          catalog_slug: "azure-administrator-az-104",
          catalog_id: null,
          code: "AZ-104",
          name: "Microsoft Azure Administrator",
          short_name: "AZ-104",
          sort_order: 1,
          active: true,
        },
      ],
      [
        {
          id: "s1",
          cert_id: "c1",
          sku_type: "mock",
          title: "Mocks",
          blurb: "Timed mocks",
          includes: ["2 mocks"],
          features: ["Timer"],
          price_inr: 1299,
          active: true,
          mock_exam_id: null,
          study_resource_id: null,
          question_bank_id: null,
          fulfilled_on_label: null,
          fulfilled_on_href: null,
        },
        {
          id: "s2",
          cert_id: "c1",
          sku_type: "labs",
          title: "Labs",
          blurb: "Hands-on",
          includes: [],
          features: [],
          price_inr: 999,
          active: false,
          mock_exam_id: null,
          study_resource_id: null,
          question_bank_id: null,
          fulfilled_on_label: "Fulfilled on SkillHub",
          fulfilled_on_href: "https://skillhub365.co.in",
        },
      ],
    );
    expect(mapped?.source).toBe("db");
    expect(mapped?.oems.map((o) => o.key)).toEqual(["aws"]);
    expect(mapped?.certs.map((c) => c.key)).toEqual(["aws-saa"]);
    expect(mapped?.skusByCert["aws-saa"]?.map((s) => s.type)).toEqual(["mock"]);
    expect(mapped?.skusByCert["aws-saa"]?.[0]?.priceInr).toBe(1299);
    expect(mapped?.oemByCertKey["aws-saa"]).toBe("aws");
  });

  it("returns null when no active OEMs so callers fall back to static", async () => {
    const { catalogFromDbRows } = await import("./marketplace-catalog");
    expect(catalogFromDbRows([], [], [])).toBeNull();
  });
});

describe("marketplace prices and bundles", () => {
  it("does not invent a price when the static catalogue has none", () => {
    for (const key of EXPECTED_KEYS) {
      for (const sku of listPrepSkus(key)) {
        expect(sku.priceInr).toBeUndefined();
        expect(listedSkuPrice(sku)).toBeNull();
      }
    }
    expect(priceSummaryLabel(priceSummaryForType("mock"))).toBe("Price on request");
    expect(formatListedPrice(null)).toBe("Price on request");

    const bundles = listPrepBundles();
    expect(bundles.map((bundle) => bundle.certKey)).toEqual([...EXPECTED_KEYS]);
    for (const bundle of bundles) {
      expect(bundle.includes).toEqual([
        "Mocks",
        "Practice question bank",
        "Notes / blueprint",
        "Labs",
      ]);
      expect(bundle.price).toBeNull();
      expect(bundle.price).not.toEqual({ amount: MARKETPLACE_PRICE_INR, currency: "INR" });
    }
  });

  it("sums a bundle only when every included SKU has a stored price in one currency", () => {
    const catalog = buildStaticMarketplaceCatalog();
    catalog.skusByCert["aws-saa"] = catalog.skusByCert["aws-saa"]!.map((sku) => ({
      ...sku,
      priceInr: 100,
      currency: "INR",
    }));
    expect(prepBundleForCert("aws-saa", catalog)?.price).toEqual({ amount: 400, currency: "INR" });

    for (const key of ["az-104", "gcp-ace", "salesforce-admin"] as const) {
      catalog.skusByCert[key] = catalog.skusByCert[key]!.map((sku) => ({
        ...sku,
        priceInr: sku.type === "mock" ? 100 : undefined,
        currency: "INR",
      }));
    }
    const exact = formatListedPrice({ amount: 100, currency: "INR" });
    expect(priceSummaryLabel(priceSummaryForType("mock", catalog))).toBe(exact);

    catalog.skusByCert["az-104"] = catalog.skusByCert["az-104"]!.map((sku) =>
      sku.type === "mock" ? { ...sku, priceInr: 250 } : sku,
    );
    expect(priceSummaryLabel(priceSummaryForType("mock", catalog))).toBe(`From ${exact}`);

    catalog.skusByCert["aws-saa"] = catalog.skusByCert["aws-saa"]!.map((sku, index) =>
      index === 0 ? { ...sku, currency: "USD" } : sku,
    );
    expect(prepBundleForCert("aws-saa", catalog)?.price).toBeNull();

    catalog.skusByCert["aws-saa"] = catalog.skusByCert["aws-saa"]!.map((sku, index) => ({
      ...sku,
      currency: "INR",
      priceInr: index === 1 ? undefined : sku.priceInr,
    }));
    expect(prepBundleForCert("aws-saa", catalog)?.price).toBeNull();
  });
});
