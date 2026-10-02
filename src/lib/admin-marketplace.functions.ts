/**
 * Admin Marketplace Catalog CRUD.
 * Read: admin / content_admin / support_admin / super.
 * Write: admin / content_admin / super.
 * Soft-deactivate preferred over hard delete.
 */
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  CERT_TO_OEM,
  MARKETPLACE_CERTS,
  MARKETPLACE_OEMS,
  MARKETPLACE_PRICE_INR,
  PREP_SKU_TYPE_KEYS,
  listPrepSkus,
  marketplaceOemLogoPath,
} from "@/lib/marketplace";

const WRITE_ROLES = ["admin", "content_admin"] as const;
const READ_ROLES = ["admin", "content_admin", "support_admin"] as const;

const keySchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

async function assertRead(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isSuper = await isSuperAdminUser(userId);
  const list = (roles ?? []).map((r: any) => r.role);
  if (!isSuper && !list.some((r: string) => READ_ROLES.includes(r as any))) {
    throw new Error("Forbidden: content role required");
  }
  return { isSuper, roles: list };
}

async function assertWrite(supabase: any, userId: string) {
  const { isSuper, roles } = await assertRead(supabase, userId);
  if (!isSuper && !roles.some((r: string) => WRITE_ROLES.includes(r as any))) {
    throw new Error("Forbidden: content write permission required");
  }
}

export const listMarketplaceCatalogAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [oems, certs, skus] = await Promise.all([
      supabaseAdmin.from("marketplace_oems").select("*").order("sort_order"),
      supabaseAdmin.from("marketplace_certs").select("*").order("sort_order"),
      supabaseAdmin.from("marketplace_skus").select("*").order("sku_type"),
    ]);
    if (oems.error) throw new Error(oems.error.message);
    if (certs.error) throw new Error(certs.error.message);
    if (skus.error) throw new Error(skus.error.message);
    return { oems: oems.data ?? [], certs: certs.data ?? [], skus: skus.data ?? [] };
  });

const oemInput = z.object({
  id: z.string().uuid().optional(),
  key: keySchema,
  name: z.string().min(2).max(160),
  short_name: z.string().min(1).max(80),
  logo_path: z.string().min(1).max(240),
  sort_order: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const upsertMarketplaceOem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(oemInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("marketplace_oems").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_oems")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setMarketplaceOemActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketplace_oems")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const certInput = z.object({
  id: z.string().uuid().optional(),
  oem_id: z.string().uuid(),
  key: keySchema,
  catalog_slug: z.string().max(160).optional().nullable(),
  catalog_id: z.string().uuid().optional().nullable(),
  code: z.string().max(60).optional().nullable(),
  name: z.string().min(2).max(200),
  short_name: z.string().min(1).max(80),
  sort_order: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const upsertMarketplaceCert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(certInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data };
    if (payload.catalog_slug === "") payload.catalog_slug = null;
    if (payload.code === "") payload.code = null;
    const { id, ...rest } = payload;
    if (id) {
      const { error } = await supabaseAdmin.from("marketplace_certs").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_certs")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setMarketplaceCertActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketplace_certs")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const skuInput = z.object({
  id: z.string().uuid().optional(),
  cert_id: z.string().uuid(),
  sku_type: z.enum(["mock", "practice", "notes", "labs"]),
  title: z.string().min(1).max(160),
  blurb: z.string().max(2000).optional().nullable(),
  includes: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  price_inr: z.number().min(0).max(1000000).default(MARKETPLACE_PRICE_INR),
  currency: z.enum(["INR", "USD", "CAD", "EUR"]).default("INR"),
  active: z.boolean().default(true),
  mock_exam_id: z.string().uuid().optional().nullable(),
  study_resource_id: z.string().uuid().optional().nullable(),
  question_bank_id: z.string().uuid().optional().nullable(),
  fulfilled_on_label: z.string().max(120).optional().nullable(),
  fulfilled_on_href: z.string().max(400).optional().nullable(),
});

export const upsertMarketplaceSku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(skuInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data };
    for (const k of [
      "blurb",
      "mock_exam_id",
      "study_resource_id",
      "question_bank_id",
      "fulfilled_on_label",
      "fulfilled_on_href",
    ]) {
      if (payload[k] === "") payload[k] = null;
    }
    const { id, ...rest } = payload;
    if (id) {
      const { error } = await supabaseAdmin.from("marketplace_skus").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_skus")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setMarketplaceSkuActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("marketplace_skus")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Upsert the static 4 OEM × 4 cert × 4 SKU seed (idempotent by key). */
export const seedMarketplaceCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const [i, oem] of MARKETPLACE_OEMS.entries()) {
      const { error } = await supabaseAdmin.from("marketplace_oems").upsert(
        {
          key: oem.key,
          name: oem.name,
          short_name: oem.shortName,
          logo_path: marketplaceOemLogoPath(oem.key),
          sort_order: (i + 1) * 10,
          active: true,
        },
        { onConflict: "key" },
      );
      if (error) throw new Error(error.message);
    }

    const { data: oemRows, error: oemErr } = await supabaseAdmin
      .from("marketplace_oems")
      .select("id, key");
    if (oemErr) throw new Error(oemErr.message);
    const oemIdByKey = new Map((oemRows ?? []).map((r: any) => [r.key, r.id]));

    for (const [i, cert] of MARKETPLACE_CERTS.entries()) {
      const oemKey = CERT_TO_OEM[cert.key as keyof typeof CERT_TO_OEM];
      const oem_id = oemIdByKey.get(oemKey);
      if (!oem_id) throw new Error(`Missing OEM ${oemKey} while seeding`);
      const { error } = await supabaseAdmin.from("marketplace_certs").upsert(
        {
          oem_id,
          key: cert.key,
          catalog_slug: cert.catalogSlug,
          code: cert.code,
          name: cert.name,
          short_name: cert.shortName,
          sort_order: (i + 1) * 10,
          active: true,
        },
        { onConflict: "key" },
      );
      if (error) throw new Error(error.message);
    }

    const { data: certRows, error: certErr } = await supabaseAdmin
      .from("marketplace_certs")
      .select("id, key");
    if (certErr) throw new Error(certErr.message);
    const certIdByKey = new Map((certRows ?? []).map((r: any) => [r.key, r.id]));

    for (const cert of MARKETPLACE_CERTS) {
      const cert_id = certIdByKey.get(cert.key);
      if (!cert_id) continue;
      for (const sku of listPrepSkus(cert.key)) {
        const { error } = await supabaseAdmin.from("marketplace_skus").upsert(
          {
            cert_id,
            sku_type: sku.type,
            title: sku.title,
            blurb: sku.blurb,
            includes: sku.includes,
            features: sku.features,
            price_inr: sku.priceInr ?? MARKETPLACE_PRICE_INR,
            active: true,
            fulfilled_on_label: sku.fulfilledOn?.label ?? null,
            fulfilled_on_href: sku.fulfilledOn?.href ?? null,
          },
          { onConflict: "cert_id,sku_type" },
        );
        if (error) throw new Error(error.message);
      }
    }

    return {
      ok: true,
      oems: MARKETPLACE_OEMS.length,
      certs: MARKETPLACE_CERTS.length,
      skus: MARKETPLACE_CERTS.length * PREP_SKU_TYPE_KEYS.length,
    };
  });
