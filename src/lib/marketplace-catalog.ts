/**
 * Pure catalog mapping — DB rows → MarketplaceCatalog.
 * Server fetch lives in marketplace-catalog.server.ts (dynamic supabaseAdmin).
 */
import {
  STATIC_MARKETPLACE_CATALOG,
  isPrepSkuType,
  type MarketplaceCatalog,
  type MarketplaceCert,
  type MarketplaceOem,
  type PrepSkuDef,
} from "@/lib/marketplace";

export type MarketplaceOemRow = {
  id: string;
  key: string;
  name: string;
  short_name: string;
  logo_path: string;
  sort_order: number;
  active: boolean;
};

export type MarketplaceCertRow = {
  id: string;
  oem_id: string;
  key: string;
  catalog_slug: string | null;
  catalog_id: string | null;
  code: string | null;
  name: string;
  short_name: string;
  sort_order: number;
  active: boolean;
};

export type MarketplaceSkuRow = {
  id: string;
  cert_id: string;
  sku_type: string;
  title: string;
  blurb: string;
  includes: string[] | null;
  features: string[] | null;
  price_inr: number | string | null;
  currency?: string | null;
  active: boolean;
  mock_exam_id: string | null;
  study_resource_id: string | null;
  question_bank_id: string | null;
  fulfilled_on_label: string | null;
  fulfilled_on_href: string | null;
};

function logoFileFromPath(logoPath: string): string {
  const p = (logoPath || "").trim();
  if (!p) return "";
  return p.replace(/^\/logos\/oem\//, "");
}

/**
 * Build a public catalog from active DB rows.
 * Returns null when there are no active OEMs (caller falls back to static seed).
 */
export function catalogFromDbRows(
  oems: MarketplaceOemRow[],
  certs: MarketplaceCertRow[],
  skus: MarketplaceSkuRow[],
): MarketplaceCatalog | null {
  const activeOems = oems.filter((o) => o.active).sort((a, b) => a.sort_order - b.sort_order);
  if (activeOems.length === 0) return null;

  const oemById = new Map(activeOems.map((o) => [o.id, o]));
  const activeCerts = certs
    .filter((c) => c.active && oemById.has(c.oem_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const certById = new Map(activeCerts.map((c) => [c.id, c]));

  const mappedOems: MarketplaceOem[] = activeOems.map((o) => ({
    key: o.key,
    name: o.name,
    shortName: o.short_name,
    logoFile: logoFileFromPath(o.logo_path) || `${o.key}.svg`,
  }));

  const mappedCerts: MarketplaceCert[] = activeCerts.map((c) => ({
    key: c.key,
    catalogSlug: c.catalog_slug || "",
    code: c.code || "",
    name: c.name,
    shortName: c.short_name,
  }));

  const oemByCertKey: Record<string, string> = {};
  for (const c of activeCerts) {
    const oem = oemById.get(c.oem_id);
    if (oem) oemByCertKey[c.key] = oem.key;
  }

  const skusByCert: Record<string, PrepSkuDef[]> = {};
  for (const row of skus) {
    if (!row.active) continue;
    const cert = certById.get(row.cert_id);
    if (!cert || !isPrepSkuType(row.sku_type)) continue;
    const price = typeof row.price_inr === "number" ? row.price_inr : Number(row.price_inr);
    const sku: PrepSkuDef = {
      type: row.sku_type,
      title: row.title,
      blurb: row.blurb || "",
      includes: row.includes ?? [],
      features: row.features ?? [],
      priceInr: Number.isFinite(price) ? price : undefined,
      currency: row.currency || "INR",
    };
    if (row.fulfilled_on_label && row.fulfilled_on_href) {
      sku.fulfilledOn = { label: row.fulfilled_on_label, href: row.fulfilled_on_href };
    }
    const list = skusByCert[cert.key] ?? [];
    list.push(sku);
    skusByCert[cert.key] = list;
  }

  return {
    oems: mappedOems,
    certs: mappedCerts,
    skusByCert,
    oemByCertKey,
    source: "db",
  };
}

export function catalogOrStatic(catalog: MarketplaceCatalog | null): MarketplaceCatalog {
  return catalog ?? STATIC_MARKETPLACE_CATALOG;
}
