import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listMyOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("role, org_id, organizations(id, name, slug, industry, size_band)")
      .eq("user_id", userId);
    if (error) throw error;
    return (memberships ?? []).map((m) => ({
      role: m.role,
      org: m.organizations as { id: string; name: string; slug: string; industry: string | null; size_band: string | null },
    }));
  });

export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(2).max(120),
      slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
      industry: z.string().max(120).optional(),
      sizeBand: z.string().max(60).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("create_organization", {
      _name: data.name,
      _slug: data.slug,
      _industry: data.industry ?? undefined,
      _size_band: data.sizeBand ?? undefined,

    });
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { id: row.id as string, slug: row.slug as string };
  });

export const joinDemoOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("join_demo_organization");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { slug: row.slug as string };
  });


async function requireMembership(supabase: any, orgId: string, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Organization not found or you don't have access");
  return data.role as "exec" | "hr" | "learner";
}

export const getOrgBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, name, slug, industry, size_band")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!org) throw new Error("Organization not found or you don't have access");
    await requireMembership(context.supabase, org.id, context.userId);
    return org;
  });

export const getOrgOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, industry, size_band")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");
    const role = await requireMembership(supabase, org.id, userId);
    const canSeeEmail = role === "exec" || role === "hr";


    // Sensitive columns (email/full_name/title/team) are not readable via
    // the authenticated client because of column-level GRANTs. Use the
    // service-role client AFTER verifying the caller's membership/role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: certs }] = await Promise.all([
      supabaseAdmin
        .from("organization_members")
        .select("id, full_name, email, team, title, role")
        .eq("org_id", org.id),
      supabaseAdmin
        .from("workforce_certifications")
        .select("id, member_id, certification_slug, status, obtained_on, expires_at")
        .eq("org_id", org.id),
    ]);

    const safeMembers = (members ?? []).map((m: any) =>
      canSeeEmail ? m : { ...m, email: null },
    );

    return { org, members: safeMembers, certifications: certs ?? [] };

  });
