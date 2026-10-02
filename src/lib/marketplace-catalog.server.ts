/**
 * Public marketplace catalog fetch (server-only).
 * Reads active rows via service role; falls back to static seed on empty/error.
 */
import { createServerFn } from "@tanstack/react-start";
import { STATIC_MARKETPLACE_CATALOG, type MarketplaceCatalog } from "@/lib/marketplace";
import {
  catalogFromDbRows,
  type MarketplaceCertRow,
  type MarketplaceOemRow,
  type MarketplaceSkuRow,
} from "@/lib/marketplace-catalog";

export async function fetchPublicMarketplaceCatalog(): Promise<MarketplaceCatalog> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [oemsRes, certsRes, skusRes] = await Promise.all([
      supabaseAdmin.from("marketplace_oems").select("*").eq("active", true).order("sort_order"),
      supabaseAdmin.from("marketplace_certs").select("*").eq("active", true).order("sort_order"),
      supabaseAdmin.from("marketplace_skus").select("*").eq("active", true),
    ]);
    if (oemsRes.error || certsRes.error || skusRes.error) {
      return STATIC_MARKETPLACE_CATALOG;
    }
    const mapped = catalogFromDbRows(
      (oemsRes.data ?? []) as MarketplaceOemRow[],
      (certsRes.data ?? []) as MarketplaceCertRow[],
      (skusRes.data ?? []) as MarketplaceSkuRow[],
    );
    return mapped ?? STATIC_MARKETPLACE_CATALOG;
  } catch {
    return STATIC_MARKETPLACE_CATALOG;
  }
}

/** Optional client/server-fn wrapper (loaders should call fetchPublicMarketplaceCatalog). */
export const loadPublicMarketplaceCatalog = createServerFn({ method: "GET" }).handler(async () => {
  return fetchPublicMarketplaceCatalog();
});
