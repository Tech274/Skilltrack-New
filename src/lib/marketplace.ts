import { SALES_WHATSAPP, waLink } from "@/config/contact";
/**
 * Marketplace shelf + prep SKU stubs (thin MVP, no payments).
 * P2a: aws-saa + az-104 + salesforce-admin + gcp-ace × 4 SKU types.
 */

import { SKILLBRIDGE_BASE_URL, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { formatInvoiceAmount } from "@/lib/invoice-currency";

export type PrepSkuType = "mock" | "practice" | "notes" | "labs";

export type MarketplaceCertKey = "aws-saa" | "az-104" | "salesforce-admin" | "gcp-ace";

export type MarketplaceTileKind = "prep" | "platform";

export type MarketplaceCert = {
  key: string;
  catalogSlug: string;
  code: string;
  name: string;
  shortName: string;
};

export type PrepSkuDef = {
  type: PrepSkuType;
  title: string;
  blurb: string;
  includes: string[];
  features: string[];
  /** Optional fulfillment deep-link shown on the SKU detail page */
  fulfilledOn?: { label: string; href: string };
  /** Price currency stored with the SKU. Absent currency is treated as INR when a price exists. */
  currency?: string;
  /**
   * Stored prep price. Public pages show this amount only.
   * They do not fall back to MARKETPLACE_PRICE_INR — that constant is the admin seed placeholder.
   */
  priceInr?: number;
};

export type MarketplaceTile =
  | {
      id: string;
      kind: "prep";
      title: string;
      blurb: string;
      certKey: MarketplaceCertKey;
      skuType: PrepSkuType;
      badge?: string;
    }
  | {
      id: string;
      kind: "platform";
      title: string;
      blurb: string;
      href: string;
      external: true;
      badge?: string;
    };

export const MARKETPLACE_CERTS: MarketplaceCert[] = [
  {
    key: "aws-saa",
    catalogSlug: "aws-solutions-architect-associate",
    code: "SAA-C03",
    name: "AWS Solutions Architect — Associate",
    shortName: "AWS SAA",
  },
  {
    key: "az-104",
    catalogSlug: "azure-administrator-az-104",
    code: "AZ-104",
    name: "Microsoft Azure Administrator",
    shortName: "AZ-104",
  },
  {
    key: "salesforce-admin",
    catalogSlug: "salesforce-administrator",
    code: "ADM-201",
    name: "Salesforce Certified Administrator",
    shortName: "SF Admin",
  },
  {
    key: "gcp-ace",
    catalogSlug: "gcp-associate-cloud-engineer",
    code: "ACE",
    name: "Google Associate Cloud Engineer",
    shortName: "GCP ACE",
  },
];

/** @deprecated Prefer MARKETPLACE_CERTS / getMarketplaceCert — kept for SAA call sites */
export const MARKETPLACE_CERT = MARKETPLACE_CERTS[0]!;

const SKU_TITLES: Record<PrepSkuType, string> = {
  mock: "Mocks",
  practice: "Practice question bank",
  notes: "Notes / blueprint",
  labs: "Labs",
};

function labsFulfilled(): PrepSkuDef["fulfilledOn"] {
  return { label: "Fulfilled on SkillHub", href: SKILLHUB_BASE_URL };
}

/** Per-cert SKU copy (4 types each), mirroring SAA tone with sensible placeholders. */
const CERT_PREP_SKUS: Record<MarketplaceCertKey, PrepSkuDef[]> = {
  "aws-saa": [
    {
      type: "mock",
      title: SKU_TITLES.mock,
      blurb: "Full-length timed mock exams mapped to SAA-C03 domains.",
      includes: [
        "2 full-length timed mocks",
        "Domain-weighted scoring",
        "Explanations for every item",
        "Weak-area report after each attempt",
      ],
      features: [
        "SAA-C03 domain coverage",
        "Exam-day timer mode",
        "Review mode with rationales",
        "Progress saved to your account (coming soon)",
      ],
    },
    {
      type: "practice",
      title: SKU_TITLES.practice,
      blurb: "Drill by domain with a curated SAA practice bank.",
      includes: [
        "500+ practice items (stub catalog)",
        "Filter by domain and difficulty",
        "Instant feedback + explanations",
        "Spaced review queue",
      ],
      features: [
        "Domain filters (secure / resilient / high-performing / cost)",
        "Bookmark tough items",
        "Export weak topics to your study plan",
      ],
    },
    {
      type: "notes",
      title: SKU_TITLES.notes,
      blurb: "Condensed notes and exam blueprint for AWS SAA.",
      includes: [
        "Domain-by-domain study notes",
        "Official-style blueprint map",
        "Cheatsheets for VPC, IAM, storage",
        "Last-week revision checklist",
      ],
      features: [
        "Printable PDF stubs",
        "Architecture pattern callouts",
        "Common trap questions called out",
        "Links into practice by topic",
      ],
    },
    {
      type: "labs",
      title: SKU_TITLES.labs,
      blurb: "Guided hands-on labs aligned to SAA architectures.",
      includes: [
        "6 guided lab scenarios (stub)",
        "Step-by-step walkthroughs",
        "Architecture diagrams",
        "Cleanup checklists",
      ],
      features: [
        "VPC + multi-AZ patterns",
        "S3 / CloudFront / WAF basics",
        "IAM least-privilege drills",
        "Cost-aware design labs",
      ],
      fulfilledOn: labsFulfilled(),
    },
  ],
  "az-104": [
    {
      type: "mock",
      title: SKU_TITLES.mock,
      blurb: "Full-length timed mock exams mapped to AZ-104 domains.",
      includes: [
        "2 full-length timed mocks",
        "Domain-weighted scoring",
        "Explanations for every item",
        "Weak-area report after each attempt",
      ],
      features: [
        "AZ-104 domain coverage",
        "Exam-day timer mode",
        "Review mode with rationales",
        "Progress saved to your account (coming soon)",
      ],
    },
    {
      type: "practice",
      title: SKU_TITLES.practice,
      blurb: "Drill by domain with a curated Azure Administrator practice bank.",
      includes: [
        "500+ practice items (stub catalog)",
        "Filter by domain and difficulty",
        "Instant feedback + explanations",
        "Spaced review queue",
      ],
      features: [
        "Domain filters (identity / storage / compute / networking / monitor)",
        "Bookmark tough items",
        "Export weak topics to your study plan",
      ],
    },
    {
      type: "notes",
      title: SKU_TITLES.notes,
      blurb: "Condensed notes and exam blueprint for AZ-104.",
      includes: [
        "Domain-by-domain study notes",
        "Official-style blueprint map",
        "Cheatsheets for Entra ID, VNets, storage",
        "Last-week revision checklist",
      ],
      features: [
        "Printable PDF stubs",
        "Portal + CLI/PowerShell callouts",
        "Common trap questions called out",
        "Links into practice by topic",
      ],
    },
    {
      type: "labs",
      title: SKU_TITLES.labs,
      blurb: "Guided hands-on labs aligned to Azure admin workloads.",
      includes: [
        "6 guided lab scenarios (stub)",
        "Step-by-step walkthroughs",
        "Architecture diagrams",
        "Cleanup checklists",
      ],
      features: [
        "Identity & RBAC drills",
        "Storage + backup patterns",
        "VM / App Service compute labs",
        "VNet + NSG networking labs",
      ],
      fulfilledOn: labsFulfilled(),
    },
  ],
  "salesforce-admin": [
    {
      type: "mock",
      title: SKU_TITLES.mock,
      blurb: "Full-length timed mock exams mapped to ADM-201 domains.",
      includes: [
        "2 full-length timed mocks",
        "Domain-weighted scoring",
        "Explanations for every item",
        "Weak-area report after each attempt",
      ],
      features: [
        "ADM-201 domain coverage",
        "Exam-day timer mode",
        "Review mode with rationales",
        "Progress saved to your account (coming soon)",
      ],
    },
    {
      type: "practice",
      title: SKU_TITLES.practice,
      blurb: "Drill by domain with a curated Salesforce Admin practice bank.",
      includes: [
        "500+ practice items (stub catalog)",
        "Filter by domain and difficulty",
        "Instant feedback + explanations",
        "Spaced review queue",
      ],
      features: [
        "Domain filters (setup / objects / sales / service / automation)",
        "Bookmark tough items",
        "Export weak topics to your study plan",
      ],
    },
    {
      type: "notes",
      title: SKU_TITLES.notes,
      blurb: "Condensed notes and exam blueprint for Salesforce Administrator.",
      includes: [
        "Domain-by-domain study notes",
        "Official-style blueprint map",
        "Cheatsheets for Flows, sharing, reports",
        "Last-week revision checklist",
      ],
      features: [
        "Printable PDF stubs",
        "Lightning UI callouts",
        "Common trap questions called out",
        "Links into practice by topic",
      ],
    },
    {
      type: "labs",
      title: SKU_TITLES.labs,
      blurb: "Guided hands-on labs in a Salesforce org (sandbox-style stubs).",
      includes: [
        "6 guided lab scenarios (stub)",
        "Step-by-step walkthroughs",
        "Org configuration diagrams",
        "Cleanup checklists",
      ],
      features: [
        "Object & field setup drills",
        "Flow automation labs",
        "Sharing & permission sets",
        "Reports & dashboards labs",
      ],
      fulfilledOn: labsFulfilled(),
    },
  ],
  "gcp-ace": [
    {
      type: "mock",
      title: SKU_TITLES.mock,
      blurb: "Full-length timed mock exams mapped to Associate Cloud Engineer domains.",
      includes: [
        "2 full-length timed mocks",
        "Domain-weighted scoring",
        "Explanations for every item",
        "Weak-area report after each attempt",
      ],
      features: [
        "ACE domain coverage",
        "Exam-day timer mode",
        "Review mode with rationales",
        "Progress saved to your account (coming soon)",
      ],
    },
    {
      type: "practice",
      title: SKU_TITLES.practice,
      blurb: "Drill by domain with a curated GCP ACE practice bank.",
      includes: [
        "500+ practice items (stub catalog)",
        "Filter by domain and difficulty",
        "Instant feedback + explanations",
        "Spaced review queue",
      ],
      features: [
        "Domain filters (setup / planning / deploy / ops / security)",
        "Bookmark tough items",
        "Export weak topics to your study plan",
      ],
    },
    {
      type: "notes",
      title: SKU_TITLES.notes,
      blurb: "Condensed notes and exam blueprint for GCP Associate Cloud Engineer.",
      includes: [
        "Domain-by-domain study notes",
        "Official-style blueprint map",
        "Cheatsheets for IAM, GCE, GKE basics, networking",
        "Last-week revision checklist",
      ],
      features: [
        "Printable PDF stubs",
        "gcloud CLI callouts",
        "Common trap questions called out",
        "Links into practice by topic",
      ],
    },
    {
      type: "labs",
      title: SKU_TITLES.labs,
      blurb: "Guided hands-on labs aligned to ACE operational tasks.",
      includes: [
        "6 guided lab scenarios (stub)",
        "Step-by-step walkthroughs",
        "Architecture diagrams",
        "Cleanup checklists",
      ],
      features: [
        "Project & IAM setup drills",
        "Compute Engine deploy labs",
        "VPC + firewall basics",
        "Monitoring & ops labs",
      ],
      fulfilledOn: labsFulfilled(),
    },
  ],
};

/** Flat list of shared SKU type metadata (titles) — prefer getPrepSku for cert copy. */
export const PREP_SKU_TYPES: PrepSkuDef[] = CERT_PREP_SKUS["aws-saa"];

/**
 * Historical marketplace price placeholder (the old `price_inr` default of 999).
 * Not a quoted prep price. Public catalogue pages treat this amount as missing.
 * The column is nullable with no default; rows that still store 999 are left as-is.
 */
export const MARKETPLACE_PRICE_INR = 999;

export const PRICE_ON_REQUEST_LABEL = "Price on request";

export type ListedPrice = {
  amount: number;
  currency: string;
};

/**
 * A quoted prep price stored on the SKU.
 * Missing, null, non-finite, and placeholder amounts (MARKETPLACE_PRICE_INR) are not listed.
 */
export function listedSkuPrice(sku: {
  priceInr?: number | null;
  currency?: string | null;
}): ListedPrice | null {
  if (typeof sku.priceInr !== "number" || !Number.isFinite(sku.priceInr)) return null;
  if (sku.priceInr === MARKETPLACE_PRICE_INR) return null;
  const currency = (sku.currency || "INR").trim().toUpperCase() || "INR";
  return { amount: sku.priceInr, currency };
}

export function formatListedPrice(price: ListedPrice | null): string {
  if (!price) return PRICE_ON_REQUEST_LABEL;
  return formatInvoiceAmount(price.amount, price.currency, 0);
}

export type PriceSummary =
  { kind: "none" } | { kind: "exact"; price: ListedPrice } | { kind: "from"; price: ListedPrice };

/**
 * Summarize stored prices for a set of SKUs.
 * `totalCount` is how many SKUs are in the set, including ones with no price.
 * A single shared amount is "exact" only when every SKU in the set has that price.
 */
export function summarizeListedPrices(
  prices: Array<ListedPrice | null>,
  totalCount: number,
): PriceSummary {
  const present = prices.filter((price): price is ListedPrice => price !== null);
  if (present.length === 0 || totalCount === 0) return { kind: "none" };
  const currency = present[0]!.currency;
  if (present.some((price) => price.currency !== currency)) return { kind: "none" };
  const amounts = present.map((price) => price.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const price = { amount: min, currency };
  if (min === max && present.length === totalCount) return { kind: "exact", price };
  return { kind: "from", price };
}

export function priceSummaryLabel(summary: PriceSummary): string {
  if (summary.kind === "none") return PRICE_ON_REQUEST_LABEL;
  const formatted = formatListedPrice(summary.price);
  return summary.kind === "from" ? `From ${formatted}` : formatted;
}

export type PrepBundleOffer = {
  id: string;
  certKey: string;
  certName: string;
  title: string;
  skuTypes: PrepSkuType[];
  includes: string[];
  /**
   * Sum of quoted SKU prices when every included SKU has a real, non-placeholder
   * price in the same currency. Otherwise null (shown as Price on request).
   */
  price: ListedPrice | null;
};

/**
 * A bundle is the prep SKUs already listed for one certification (at least two).
 * No bundle price is stored. The amount is the sum of quoted SKU prices only when
 * every included SKU has a real, non-placeholder price in the same currency.
 */
export function prepBundleForCert(
  certKey: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): PrepBundleOffer | null {
  const cert = catalog.certs.find((row) => row.key === certKey);
  if (!cert) return null;
  const skus = catalog.skusByCert[certKey] ?? [];
  if (skus.length < 2) return null;
  const prices = skus.map((sku) => listedSkuPrice(sku));
  let price: ListedPrice | null = null;
  if (prices.every((row): row is ListedPrice => row !== null)) {
    const currency = prices[0]!.currency;
    if (prices.every((row) => row.currency === currency)) {
      price = {
        amount: prices.reduce((sum, row) => sum + row.amount, 0),
        currency,
      };
    }
  }
  return {
    id: `${cert.key}-prep-bundle`,
    certKey: cert.key,
    certName: cert.name,
    title: `${cert.shortName} prep bundle`,
    skuTypes: skus.map((sku) => sku.type),
    includes: skus.map((sku) => sku.title),
    price,
  };
}

export function listPrepBundles(
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): PrepBundleOffer[] {
  return catalog.certs
    .map((cert) => prepBundleForCert(cert.key, catalog))
    .filter((bundle): bundle is PrepBundleOffer => bundle !== null);
}

export function priceSummaryForType(
  type: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): PriceSummary {
  if (!isPrepSkuType(type)) return { kind: "none" };
  const skus: PrepSkuDef[] = [];
  for (const cert of catalog.certs) {
    const sku = (catalog.skusByCert[cert.key] ?? []).find((row) => row.type === type);
    if (sku) skus.push(sku);
  }
  return summarizeListedPrices(
    skus.map((sku) => listedSkuPrice(sku)),
    skus.length,
  );
}

export function priceSummaryForTypeOem(
  type: string,
  oem: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): PriceSummary {
  const certs = listCertsForTypeOem(type, oem, catalog);
  const skus: PrepSkuDef[] = [];
  for (const cert of certs) {
    const sku = (catalog.skusByCert[cert.key] ?? []).find((row) => row.type === type);
    if (sku) skus.push(sku);
  }
  return summarizeListedPrices(
    skus.map((sku) => listedSkuPrice(sku)),
    skus.length,
  );
}

/** Sales WhatsApp number lives in src/config/contact.ts. */
export const MARKETPLACE_WHATSAPP_NUMBER_PLACEHOLDER = SALES_WHATSAPP;

/** Generic SAA-oriented placeholder kept for older call sites. */
export const MARKETPLACE_WHATSAPP_PLACEHOLDER = marketplaceWhatsAppUrl(MARKETPLACE_CERT);

export function marketplaceWhatsAppUrl(cert: MarketplaceCert): string {
  return waLink(`Hi SkillTrack — I want ${cert.shortName} (${cert.code}) prep`);
}

export function getMarketplaceCert(key: string): MarketplaceCert | null {
  return MARKETPLACE_CERTS.find((c) => c.key === key) ?? null;
}

export function getMarketplaceCertByCatalogSlug(slug: string): MarketplaceCert | null {
  return MARKETPLACE_CERTS.find((c) => c.catalogSlug === slug) ?? null;
}

export function listPrepSkus(certKey: string): PrepSkuDef[] {
  const cert = getMarketplaceCert(certKey);
  if (!cert) return [];
  return CERT_PREP_SKUS[cert.key as MarketplaceCertKey] ?? [];
}

export function getPrepSku(certKey: string, type: string) {
  const cert = getMarketplaceCert(certKey);
  if (!cert) return null;
  const sku = CERT_PREP_SKUS[cert.key as MarketplaceCertKey]?.find((s) => s.type === type);
  if (!sku) return null;
  return { cert, sku };
}

function buildPrepTiles(): MarketplaceTile[] {
  const tiles: MarketplaceTile[] = [];
  for (const cert of MARKETPLACE_CERTS) {
    const certKey = cert.key as MarketplaceCertKey;
    for (const sku of CERT_PREP_SKUS[certKey]) {
      tiles.push({
        id: `${certKey}-${sku.type}`,
        kind: "prep",
        title: sku.title,
        blurb: sku.blurb,
        certKey,
        skuType: sku.type,
        badge: cert.shortName,
      });
    }
  }
  return tiles;
}

export const MARKETPLACE_TILES: MarketplaceTile[] = [
  ...buildPrepTiles(),
  {
    id: "skillhub-labs",
    kind: "platform",
    title: "SkillHub Labs",
    blurb: "Platform labs on SkillHub 365.",
    href: SKILLHUB_BASE_URL,
    external: true,
    badge: "Platform",
  },
  {
    id: "skillbridge",
    kind: "platform",
    title: "SkillBridge",
    blurb: "Resume builder plus career and jobs programs on SkillBridge 365.",
    href: SKILLBRIDGE_BASE_URL,
    external: true,
    badge: "Platform",
  },
];

/** Marketplace OEM keys (Architect map — not Certifications hub slugs). */
export type MarketplaceOemKey = "aws" | "azure" | "gcp" | "salesforce";

export type MarketplaceOem = {
  key: string;
  name: string;
  shortName: string;
  logoFile: string;
};

/** Snapshot used by public IA pages — DB catalog when available, else static seed. */
export type MarketplaceCatalog = {
  oems: MarketplaceOem[];
  certs: MarketplaceCert[];
  skusByCert: Record<string, PrepSkuDef[]>;
  oemByCertKey: Record<string, string>;
  source: "static" | "db";
};

export type PrepSkuTypeHub = {
  type: PrepSkuType;
  label: string;
  blurb: string;
};

export type MarketplaceTwoSegment =
  | { kind: "sku"; certKey: string; skuType: PrepSkuType }
  | { kind: "oem-certs"; skuType: PrepSkuType; oemKey: string }
  | { kind: "not-found" };

export type MarketplaceOneSegment =
  { kind: "type-hub"; skuType: PrepSkuType } | { kind: "redirect-index" } | { kind: "not-found" };

export const PREP_SKU_TYPE_KEYS: readonly PrepSkuType[] = ["mock", "practice", "notes", "labs"];

export const MARKETPLACE_OEM_KEYS: readonly MarketplaceOemKey[] = [
  "aws",
  "azure",
  "gcp",
  "salesforce",
];

/** Architect cert → OEM map. */
export const CERT_TO_OEM: Record<MarketplaceCertKey, MarketplaceOemKey> = {
  "aws-saa": "aws",
  "az-104": "azure",
  "gcp-ace": "gcp",
  "salesforce-admin": "salesforce",
};

/**
 * Official pack files under public/logos/oem/.
 * Azure/GCP accept alias filenames (azure.svg / gcp.svg) — we use the catalogue names.
 */
const OEM_LOGO_FILES: Record<MarketplaceOemKey, string> = {
  aws: "aws.svg",
  azure: "microsoft-azure.svg",
  gcp: "google-cloud.svg",
  salesforce: "salesforce.svg",
};

export const MARKETPLACE_OEMS: MarketplaceOem[] = [
  { key: "aws", name: "Amazon Web Services", shortName: "AWS", logoFile: OEM_LOGO_FILES.aws },
  { key: "azure", name: "Microsoft Azure", shortName: "Azure", logoFile: OEM_LOGO_FILES.azure },
  { key: "gcp", name: "Google Cloud", shortName: "GCP", logoFile: OEM_LOGO_FILES.gcp },
  {
    key: "salesforce",
    name: "Salesforce",
    shortName: "Salesforce",
    logoFile: OEM_LOGO_FILES.salesforce,
  },
];

export const PREP_SKU_TYPE_HUBS: Record<PrepSkuType, PrepSkuTypeHub> = {
  mock: {
    type: "mock",
    label: "Mock Exams",
    blurb: "Full-length timed mock exams mapped to exam domains.",
  },
  practice: {
    type: "practice",
    label: "Practice Questions",
    blurb: "Drill by domain with curated practice banks.",
  },
  notes: {
    type: "notes",
    label: "Notes/Blueprints",
    blurb: "Condensed notes and exam blueprints.",
  },
  labs: {
    type: "labs",
    label: "Labs",
    blurb: "Guided hands-on labs aligned to exam architectures.",
  },
};

export function buildStaticMarketplaceCatalog(): MarketplaceCatalog {
  const skusByCert: Record<string, PrepSkuDef[]> = {};
  for (const key of Object.keys(CERT_PREP_SKUS) as MarketplaceCertKey[]) {
    skusByCert[key] = CERT_PREP_SKUS[key];
  }
  return {
    oems: MARKETPLACE_OEMS,
    certs: MARKETPLACE_CERTS,
    skusByCert,
    oemByCertKey: { ...CERT_TO_OEM },
    source: "static",
  };
}

export const STATIC_MARKETPLACE_CATALOG = buildStaticMarketplaceCatalog();

export function isPrepSkuType(value: string): value is PrepSkuType {
  return (PREP_SKU_TYPE_KEYS as readonly string[]).includes(value);
}

export function isMarketplaceCertKey(value: string): value is MarketplaceCertKey {
  return MARKETPLACE_CERTS.some((c) => c.key === value);
}

export function isMarketplaceOemKey(value: string): value is MarketplaceOemKey {
  return (MARKETPLACE_OEM_KEYS as readonly string[]).includes(value);
}

export function getMarketplaceOem(
  key: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): MarketplaceOem | null {
  return catalog.oems.find((o) => o.key === key) ?? null;
}

export function oemKeyForCert(
  certKey: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): string | null {
  return catalog.oemByCertKey[certKey] ?? null;
}

export function getPrepSkuTypeHub(type: string): PrepSkuTypeHub | null {
  return isPrepSkuType(type) ? PREP_SKU_TYPE_HUBS[type] : null;
}

export function listPrepSkuTypeHubs(): PrepSkuTypeHub[] {
  return PREP_SKU_TYPE_KEYS.map((t) => PREP_SKU_TYPE_HUBS[t]);
}

/** Public path for a marketplace OEM logo (`/logos/oem/…`). */
export function marketplaceOemLogoPath(
  oem: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): string {
  const row = catalog.oems.find((o) => o.key === oem);
  const file = row?.logoFile ?? (isMarketplaceOemKey(oem) ? OEM_LOGO_FILES[oem] : `${oem}.svg`);
  if (file.startsWith("/")) return file;
  return `/logos/oem/${file}`;
}

export function getPrepSkuFromCatalog(
  certKey: string,
  type: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
) {
  const cert = catalog.certs.find((c) => c.key === certKey);
  if (!cert) return null;
  const sku = (catalog.skusByCert[certKey] ?? []).find((s) => s.type === type);
  if (!sku) return null;
  return { cert, sku };
}

/** OEMs that have ≥1 cert offering this SKU type (catalog OEM order). */
export function listOemsForType(
  type: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): MarketplaceOem[] {
  if (!isPrepSkuType(type)) return [];
  const keys = new Set<string>();
  for (const cert of catalog.certs) {
    if (getPrepSkuFromCatalog(cert.key, type, catalog)) {
      const oem = catalog.oemByCertKey[cert.key];
      if (oem) keys.add(oem);
    }
  }
  return catalog.oems.filter((o) => keys.has(o.key));
}

/** Certs for an OEM that offer this SKU type (catalog cert order). */
export function listCertsForTypeOem(
  type: string,
  oem: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): MarketplaceCert[] {
  if (!isPrepSkuType(type)) return [];
  return catalog.certs.filter(
    (c) =>
      catalog.oemByCertKey[c.key] === oem && Boolean(getPrepSkuFromCatalog(c.key, type, catalog)),
  );
}

/**
 * One two-param marketplace route serves both:
 *   /marketplace/{type}/{oem}  → OEM cert list
 *   /marketplace/{cert}/{type} → existing SKU leaf
 * Sets do not overlap (type ≠ cert key ≠ oem key).
 */
export function resolveMarketplaceTwoSegment(
  seg1: string,
  seg2: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): MarketplaceTwoSegment {
  const oemKeys = new Set(catalog.oems.map((o) => o.key));
  const certKeys = new Set(catalog.certs.map((c) => c.key));
  if (isPrepSkuType(seg1) && oemKeys.has(seg2)) {
    if (listCertsForTypeOem(seg1, seg2, catalog).length === 0) return { kind: "not-found" };
    return { kind: "oem-certs", skuType: seg1, oemKey: seg2 };
  }
  if (certKeys.has(seg1) && isPrepSkuType(seg2)) {
    if (!getPrepSkuFromCatalog(seg1, seg2, catalog)) return { kind: "not-found" };
    return { kind: "sku", certKey: seg1, skuType: seg2 };
  }
  return { kind: "not-found" };
}

/**
 * /marketplace/{type} is a type hub only.
 * A cert key as a single segment redirects to /marketplace — no invented cert hub.
 */
export function resolveMarketplaceOneSegment(
  seg: string,
  catalog: MarketplaceCatalog = STATIC_MARKETPLACE_CATALOG,
): MarketplaceOneSegment {
  if (isPrepSkuType(seg)) return { kind: "type-hub", skuType: seg };
  if (catalog.certs.some((c) => c.key === seg) || isMarketplaceCertKey(seg)) {
    return { kind: "redirect-index" };
  }
  return { kind: "not-found" };
}
