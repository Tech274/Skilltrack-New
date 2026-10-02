import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "org-logos";

async function assertExecOrHr(supabase: any, orgId: string, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organization not found or you don't have access");
  if (data.role !== "exec" && data.role !== "hr") throw new Error("Only org execs/HR can manage branding");
}

/**
 * Returns the org's current branding (logos + version) plus short-lived signed
 * URLs the client can render directly. Members of the org can read.
 */
export const getOrgBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("organization_members").select("role").eq("org_id", data.orgId).eq("user_id", context.userId).maybeSingle();
    if (!member) throw new Error("Not a member of this organization");

    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, name, slug, logo_light_path, logo_dark_path, brand_version")
      .eq("id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Organization not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sign = async (p: string | null) => {
      if (!p) return null;
      const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(p, 60 * 60 * 24 * 7);
      return s?.signedUrl ? `${s.signedUrl}${s.signedUrl.includes("?") ? "&" : "?"}v=${org.brand_version}` : null;
    };
    const [lightUrl, darkUrl] = await Promise.all([sign(org.logo_light_path), sign(org.logo_dark_path)]);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      brand_version: org.brand_version,
      logo_light_url: lightUrl,
      logo_dark_url: darkUrl,
      logo_light_path: org.logo_light_path,
      logo_dark_path: org.logo_dark_path,
      role: member.role,
    };
  });

/**
 * Issues a signed upload URL for one of the org logo slots. The client uploads
 * directly to storage with that URL, then calls `setOrgLogoPath` to persist the
 * path on the organization row. Only org execs/HR can do this.
 */
export const createOrgLogoUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    orgId: z.string().uuid(),
    variant: z.enum(["light", "dark"]),
    filename: z.string().min(1).max(120),
  }))
  .handler(async ({ data, context }) => {
    await assertExecOrHr(context.supabase, data.orgId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.filename.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
    const path = `${data.orgId}/${data.variant}-${Date.now()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/**
 * Persists the uploaded logo path on the organization row and bumps brand_version.
 * Only org execs/HR can do this.
 */
export const setOrgLogoPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    orgId: z.string().uuid(),
    variant: z.enum(["light", "dark"]),
    path: z.string().min(1).max(300).nullable(),
  }))
  .handler(async ({ data, context }) => {
    await assertExecOrHr(context.supabase, data.orgId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("organizations").select("brand_version").eq("id", data.orgId).maybeSingle();
    const nextVersion = ((cur?.brand_version ?? 1) | 0) + 1;
    const now = new Date().toISOString();
    const patch = data.variant === "light"
      ? { logo_light_path: data.path, brand_version: nextVersion, logo_updated_at: now }
      : { logo_dark_path: data.path, brand_version: nextVersion, logo_updated_at: now };
    const { error } = await supabaseAdmin.from("organizations")
      .update(patch)
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);

    // Bumping brand_version is what makes the on-demand invoice PDF renderer
    // (and signed-URL cache-buster) pick up the new logo on the next render.
    // We log a per-enterprise audit row so org members can see exactly when a
    // logo change invalidated their cached invoice PDFs.
    const { logInvoiceAction } = await import("@/lib/invoice-audit.server");
    await logInvoiceAction({
      orgId: data.orgId,
      actorId: context.userId,
      action: "logo_updated",
      metadata: {
        variant: data.variant,
        path: data.path,
        brand_version: nextVersion,
        regenerates_pdfs: true,
      },
    });

    return { ok: true, brand_version: nextVersion };
  });
