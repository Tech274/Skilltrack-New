import { requireAdmin } from "@/lib/admin-auth.server";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { directoryLearner, queryAdminDirectory } from "@/lib/admin-directory.server";
import { ilikePattern, pageBounds } from "@/lib/admin-page";

const WRITE_ROLES = ["admin", "support_admin"] as const;
const READ_ROLES = ["admin", "support_admin", "finance_admin"] as const;

async function assertRead(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const isSuper = await isSuperAdminUser(userId);
  const list = (roles ?? []).map((r: any) => r.role);
  if (!isSuper && !list.some((r: string) => READ_ROLES.includes(r as any))) {
    throw new Error("Forbidden: admin role required");
  }
  return { isSuper, roles: list };
}

async function assertWrite(supabase: any, userId: string) {
  const { isSuper, roles } = await assertRead(supabase, userId);
  if (!isSuper && !roles.some((r: string) => WRITE_ROLES.includes(r as any))) {
    throw new Error("Forbidden: learner write permission required");
  }
}

/** Returns one page of learners. Email search uses admin_directory_page so it is not capped at 1000. */
export const listLearners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    search: z.string().max(200).optional(),
    status: z.enum(["all", "active", "disabled"]).optional(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }).partial().optional())
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bounds = pageBounds(data?.page, data?.pageSize);
    const directory = await queryAdminDirectory(supabaseAdmin, {
      role: "learner",
      search: data?.search,
      status: data?.status,
      page: bounds.page,
      pageSize: bounds.pageSize,
      order: "created_at",
    });
    if (directory) {
      return {
        rows: directory.rows.map(directoryLearner),
        total: directory.total,
        page: directory.page,
        pageSize: directory.pageSize,
        capped: false,
      };
    }
    return fallbackLearners(supabaseAdmin, data, bounds);
  });

async function fallbackLearners(supabaseAdmin: any, data: { search?: string; status?: string } | undefined, bounds: { page: number; pageSize: number; from: number; to: number }) {
  const { data: learnerRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "learner");
  const ids = (learnerRoles ?? []).map((r: any) => r.user_id).slice(0, 1000);
  if (ids.length === 0) {
    return { rows: [], total: 0, page: bounds.page, pageSize: bounds.pageSize, capped: true };
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, headline, country, target_role, timezone, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const emailMap = new Map<string, { email: string | null; banned: boolean }>();
  let page = 1;
  for (let i = 0; i < 5; i++) {
    const { data: u } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    const users = u?.users ?? [];
    for (const usr of users) {
      emailMap.set(usr.id, { email: usr.email ?? null, banned: Boolean((usr as any).banned_until && new Date((usr as any).banned_until).getTime() > Date.now()) });
    }
    if (users.length < 200) break;
    page++;
  }

  let rows = (profiles ?? []).map((p: any) => {
    const info = emailMap.get(p.id);
    return {
      id: p.id,
      display_name: p.display_name,
      email: info?.email ?? null,
      headline: p.headline,
      country: p.country,
      target_role: p.target_role,
      timezone: p.timezone,
      status: info?.banned ? "disabled" : "active",
      created_at: p.created_at,
    };
  });

  const pattern = ilikePattern(data?.search)?.slice(1, -1).toLowerCase();
  if (pattern) {
    rows = rows.filter((r: any) =>
      (r.display_name ?? "").toLowerCase().includes(pattern) ||
      (r.email ?? "").toLowerCase().includes(pattern) ||
      (r.target_role ?? "").toLowerCase().includes(pattern),
    );
  }
  if (data?.status && data.status !== "all") {
    rows = rows.filter((r: any) => r.status === data.status);
  }
  return {
    rows: rows.slice(bounds.from, bounds.from + bounds.pageSize),
    total: rows.length,
    page: bounds.page,
    pageSize: bounds.pageSize,
    capped: true,
  };
}

export const getLearner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", data.id).maybeSingle();
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.id);
    const { data: subs } = await supabaseAdmin.from("learner_subscriptions").select("*").eq("learner_id", data.id).order("created_at", { ascending: false });
    const { data: invs } = await supabaseAdmin.from("invoices").select("id, invoice_number, total, currency, status, issue_date").eq("learner_id", data.id).order("issue_date", { ascending: false }).limit(20);
    const { data: assigns } = await supabaseAdmin.from("learner_assignments").select("*").eq("learner_id", data.id).order("created_at", { ascending: false });

    return {
      profile,
      email: u?.user?.email ?? null,
      status: (u?.user as any)?.banned_until ? "disabled" : "active",
      subscriptions: subs ?? [],
      invoices: invs ?? [],
      assignments: assigns ?? [],
    };
  });

export const createLearner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    email: z.string().email(),
    display_name: z.string().min(1).max(120),
    headline: z.string().max(200).optional().nullable(),
    country: z.string().max(80).optional().nullable(),
    target_role: z.string().max(120).optional().nullable(),
    timezone: z.string().max(60).optional().nullable(),
    send_invite: z.boolean().default(true),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create or invite auth user
    let userId: string;
    if (data.send_invite) {
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { display_name: data.display_name },
      });
      if (inviteErr || !invited?.user) throw new Error(inviteErr?.message ?? "Could not invite learner");
      userId = invited.user.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: { display_name: data.display_name },
      });
      if (createErr || !created?.user) throw new Error(createErr?.message ?? "Could not create learner");
      userId = created.user.id;
    }

    // Profile row is auto-created by handle_new_user trigger. Patch fields:
    await supabaseAdmin.from("profiles").update({
      display_name: data.display_name,
      headline: data.headline ?? null,
      country: data.country ?? null,
      target_role: data.target_role ?? null,
      timezone: data.timezone ?? "UTC",
    }).eq("id", userId);

    // Ensure 'learner' role exists (trigger does this; safety net)
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "learner" as any }).select().maybeSingle();

    return { id: userId };
  });

export const updateLearner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    display_name: z.string().min(1).max(120).optional(),
    headline: z.string().max(200).optional().nullable(),
    country: z.string().max(80).optional().nullable(),
    target_role: z.string().max(120).optional().nullable(),
    timezone: z.string().max(60).optional().nullable(),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const patch: any = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLearnerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["active","disabled"]) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ban_duration = data.status === "disabled" ? "876000h" : "none";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * CSV import. Expected columns: email, display_name, headline, country, target_role, timezone
 * Duplicates (email already exists in auth) FAIL the row.
 */
export const importLearnersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    rows: z.array(z.object({
      email: z.string().email().optional().or(z.literal("")),
      display_name: z.string().optional(),
      headline: z.string().optional(),
      country: z.string().optional(),
      target_role: z.string().optional(),
      timezone: z.string().optional(),
    })).min(1).max(2000),
    send_invite: z.boolean().default(true),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-load existing emails
    const existing = new Set<string>();
    let page = 1;
    for (let i = 0; i < 5; i++) {
      const { data: u } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      for (const usr of u?.users ?? []) if (usr.email) existing.add(usr.email.toLowerCase());
      if ((u?.users ?? []).length < 200) break;
      page++;
    }

    const results: Array<{ row: number; email: string; status: "created" | "error"; message?: string }> = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      const email = (r.email ?? "").trim().toLowerCase();
      const name = (r.display_name ?? email.split("@")[0] ?? "Learner").trim();
      if (!email) { results.push({ row: i + 1, email: "", status: "error", message: "Missing email" }); continue; }
      if (existing.has(email)) { results.push({ row: i + 1, email, status: "error", message: "Duplicate email" }); continue; }
      try {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: !data.send_invite,
          user_metadata: { display_name: name },
        });
        if (error || !created?.user) throw new Error(error?.message ?? "Create failed");
        await supabaseAdmin.from("profiles").update({
          display_name: name,
          headline: r.headline ?? null,
          country: r.country ?? null,
          target_role: r.target_role ?? null,
          timezone: r.timezone ?? "UTC",
        }).eq("id", created.user.id);
        existing.add(email);
        results.push({ row: i + 1, email, status: "created" });
      } catch (e: any) {
        results.push({ row: i + 1, email, status: "error", message: e?.message ?? "Unknown error" });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const errors = results.length - created;
    return { total: results.length, created, errors, results };
  });
