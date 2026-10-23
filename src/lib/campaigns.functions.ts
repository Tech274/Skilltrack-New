/**
 * Homepage campaign carousel data.
 * Images live in the private `campaign-images` bucket; columns store either a
 * storage path or an absolute https URL. Paths are signed on read.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ilikePattern, pageBounds } from "@/lib/admin-page";

export const CAMPAIGN_TYPES = [
  "platform",
  "certification",
  "offer",
  "career",
  "lab",
  "enterprise",
  "assessment",
  "new-launch",
  "announcement",
] as const;
export const CAMPAIGN_AUDIENCES = [
  "all",
  "learner",
  "professional",
  "enterprise",
  "lnd",
  "administrator",
] as const;

export type Campaign = {
  id: string;
  slug: string;
  campaign_type: string;
  title: string;
  eyebrow: string | null;
  headline: string;
  description: string | null;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  image_alt: string | null;
  primary_cta_label: string;
  primary_cta_url: string;
  secondary_cta_label: string | null;
  secondary_cta_url: string | null;
  audience: string;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  theme: string;
  text_alignment: string;
  image_position: string;
  badge: string | null;
  analytics_id: string | null;
  /** Resolved, displayable URLs (signed when stored as paths). */
  desktop_src?: string | null;
  mobile_src?: string | null;
};

const BUCKET = "campaign-images";
const SIGN_SECONDS = 60 * 60 * 24;

async function resolveImages(storage: any, rows: Campaign[]): Promise<Campaign[]> {
  const paths = new Set<string>();
  for (const r of rows) {
    for (const v of [r.desktop_image_url, r.mobile_image_url]) {
      if (v && !/^https?:\/\//.test(v)) paths.add(v);
    }
  }
  const signed = new Map<string, string>();
  if (paths.size) {
    const { data } = await storage.from(BUCKET).createSignedUrls([...paths], SIGN_SECONDS);
    for (const d of data ?? []) if (d.signedUrl && d.path) signed.set(d.path, d.signedUrl);
  }
  const res = (v: string | null) =>
    !v ? null : /^https?:\/\//.test(v) ? v : (signed.get(v) ?? null);
  return rows.map((r) => ({
    ...r,
    desktop_src: res(r.desktop_image_url),
    mobile_src: res(r.mobile_image_url),
  }));
}

/** Public: live campaigns (RLS limits to active + in date window), priority order. */
export const listLiveCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("campaigns")
      .select("*")
      .order("priority", { ascending: true })
      .limit(8);
    if (error || !data) return [] as Campaign[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await resolveImages(supabaseAdmin.storage, data as Campaign[]);
  } catch {
    return [] as Campaign[];
  }
});

/** Admin: one page of campaigns. RLS restricts reads to admin / content_admin / super admin. */
export const listCampaignsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      search: z.string().max(200).optional(),
    }).optional(),
  )
  .handler(async ({ data, context }) => {
    const bounds = pageBounds(data?.page, data?.pageSize);
    let q = context.supabase
      .from("campaigns")
      .select("*", { count: "exact" })
      .order("priority", { ascending: true });
    const pattern = ilikePattern(data?.search);
    if (pattern) q = q.or(`title.ilike.${pattern},headline.ilike.${pattern},slug.ilike.${pattern}`);
    const { data: rows, error, count } = await q.range(bounds.from, bounds.to);
    if (error) throw new Error(error.message);
    return {
      rows: await resolveImages(context.supabase.storage, (rows ?? []) as Campaign[]),
      total: count ?? 0,
      page: bounds.page,
      pageSize: bounds.pageSize,
    };
  });

const urlOrPath = z
  .string()
  .max(500)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v) || v === "", "Use /path or https:// URL");

const optText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const campaignInput = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens"),
    campaign_type: z.enum(CAMPAIGN_TYPES),
    title: z.string().min(2).max(120),
    eyebrow: optText(80),
    headline: z.string().min(4).max(120),
    description: optText(280),
    desktop_image_url: optText(500),
    mobile_image_url: optText(500),
    image_alt: optText(200),
    primary_cta_label: z.string().min(2).max(40),
    primary_cta_url: urlOrPath.refine((v) => v !== "", "Required"),
    secondary_cta_label: optText(40),
    secondary_cta_url: optText(500),
    audience: z.enum(CAMPAIGN_AUDIENCES),
    priority: z.number().int().min(0).max(9999),
    start_date: optText(40),
    end_date: optText(40),
    is_active: z.boolean(),
    theme: z.enum(["dark", "light"]),
    text_alignment: z.enum(["left", "center"]),
    image_position: z.enum(["right", "left", "background"]),
    badge: optText(40),
    analytics_id: optText(80),
  })
  .refine((d) => !d.start_date || !d.end_date || new Date(d.end_date) > new Date(d.start_date), {
    message: "End date must be after start date",
  })
  .refine((d) => !(d.desktop_image_url || d.mobile_image_url) || !!d.image_alt, {
    message: "Alt text is required when an image is set",
  })
  .refine((d) => !d.secondary_cta_label === !d.secondary_cta_url, {
    message: "Secondary action needs both a label and a link",
  });

export type CampaignInput = z.input<typeof campaignInput>;

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(campaignInput)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("campaigns").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert({ ...rest, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
