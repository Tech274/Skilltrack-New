import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { csvCell, exportWindowEnd, ilikePattern } from "@/lib/admin-page";

async function assertSuper(userId: string) {
  if (!(await isSuperAdminUser(userId))) {
    throw new Error("Forbidden: Super Admin only");
  }
}

// Ad-hoc rate limit. The platform doesn't ship a rate-limit primitive, so we
// count this actor's grant/revoke audit rows in the last 60s and refuse if
// the actor is moving suspiciously fast. Threshold deliberately low — a
// human operating the UI tops out at ~1-2 changes/min.
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 5;

async function assertNotRateLimited(actorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("super_admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    throw new Error(
      `Rate limit exceeded: at most ${RATE_LIMIT_MAX} Super Admin changes per ${RATE_LIMIT_WINDOW_SEC}s. Try again shortly.`,
    );
  }
}

async function notifyAdmins(args: {
  action: "grant" | "revoke";
  actorId: string;
  actorEmail: string | null;
  targetUserId: string;
  targetEmail: string | null;
}) {
  const { getAdminRecipientIds, notify } = await import("@/lib/admin-notify.server");
  const recipients = await getAdminRecipientIds();
  if (recipients.length === 0) return;
  const verb = args.action === "grant" ? "granted" : "revoked";
  const title = `Super Admin access ${verb}`;
  const body =
    `${args.actorEmail ?? args.actorId} ${verb} Super Admin access ` +
    `${args.action === "grant" ? "to" : "from"} ${args.targetEmail ?? args.targetUserId}.`;
  await notify(
    recipients.map((rid) => ({
      recipientId: rid,
      audience: "admin" as const,
      category: "super_admin_change",
      title,
      body,
      link: "/admin/super-admins",
      metadata: {
        action: args.action,
        actor_id: args.actorId,
        actor_email: args.actorEmail,
        target_user_id: args.targetUserId,
        target_email: args.targetEmail,
      },
    })),
  );
}

export const listSuperAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("super_admins")
      .select("user_id, granted_by, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.user_id);
    const granters = Array.from(
      new Set((rows ?? []).map((r) => r.granted_by).filter(Boolean)),
    ) as string[];
    const { loadUserEmails } = await import("@/lib/admin-directory.server");
    const emailMap = await loadUserEmails(supabaseAdmin, [...ids, ...granters]);
    return (rows ?? []).map((r) => ({
      user_id: r.user_id,
      email: emailMap.get(r.user_id) ?? null,
      granted_by: r.granted_by,
      granted_by_email: r.granted_by ? (emailMap.get(r.granted_by) ?? null) : null,
      created_at: r.created_at,
    }));
  });

const grantSchema = z.object({
  userId: z.string().uuid(),
  confirm: z.literal(true, { message: "Confirmation required" }),
  acknowledgement: z.literal("GRANT", { message: "Type GRANT to confirm" }),
});

export const grantSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; confirm: true; acknowledgement: "GRANT" }) =>
    grantSchema.parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    await assertNotRateLimited(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tu, error: tuErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (tuErr || !tu?.user) throw new Error("Target user not found");
    const { error } = await supabaseAdmin
      .from("super_admins")
      .insert({ user_id: data.userId, granted_by: context.userId });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    const { data: actor } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await notifyAdmins({
      action: "grant",
      actorId: context.userId,
      actorEmail: actor?.user?.email ?? null,
      targetUserId: data.userId,
      targetEmail: tu.user.email ?? null,
    });
    return { ok: true };
  });

const revokeSchema = z.object({
  userId: z.string().uuid(),
  confirm: z.literal(true, { message: "Confirmation required" }),
  acknowledgement: z.literal("REVOKE", { message: "Type REVOKE to confirm" }),
});

export const revokeSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; confirm: true; acknowledgement: "REVOKE" }) =>
    revokeSchema.parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    await assertNotRateLimited(context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot revoke your own Super Admin access.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("super_admins")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) {
      throw new Error("Cannot revoke the last remaining Super Admin.");
    }
    const { data: tu } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { error } = await supabaseAdmin.from("super_admins").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    const { data: actor } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await notifyAdmins({
      action: "revoke",
      actorId: context.userId,
      actorEmail: actor?.user?.email ?? null,
      targetUserId: data.userId,
      targetEmail: tu?.user?.email ?? null,
    });
    return { ok: true };
  });

// -------------------- Audit log: list + export --------------------

const auditFiltersSchema = z.object({
  actor: z.string().trim().max(200).optional().nullable(),
  targetUserId: z.string().trim().max(200).optional().nullable(),
  action: z.enum(["grant", "revoke"]).optional().nullable(),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

type AuditFilters = z.infer<typeof auditFiltersSchema>;

async function queryAuditRows(f: AuditFilters, opts: { paged: boolean }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const startedAt = new Date().toISOString();
  const build = (forExport: boolean) => {
    let q = supabaseAdmin
      .from("super_admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (f.action) q = q.eq("action", f.action);
    if (f.actor) {
      const pattern = ilikePattern(f.actor);
      const actorId = isUuid(f.actor) ? f.actor : "00000000-0000-0000-0000-000000000000";
      if (pattern) q = q.or(`actor_email.ilike.${pattern},actor_id.eq.${actorId}`);
    }
    if (f.targetUserId) {
      if (isUuid(f.targetUserId)) q = q.eq("target_user_id", f.targetUserId);
      else {
        const pattern = ilikePattern(f.targetUserId);
        if (pattern) q = q.ilike("target_email", pattern);
      }
    }
    if (f.from) q = q.gte("created_at", f.from);
    const end = forExport ? exportWindowEnd(f.to, startedAt) : f.to;
    if (end) q = q.lte("created_at", end);
    return q;
  };

  if (opts.paged) {
    const from = (f.page - 1) * f.pageSize;
    const { data, error, count } = await build(false).range(from, from + f.pageSize - 1);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count ?? 0 };
  }

  const { collectPagedRows } = await import("@/lib/admin-page");
  const rows = await collectPagedRows(async (from, to) => {
    const { data, error } = await build(true).range(from, to);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  return { rows, total: rows.length };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export const listSuperAdminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<AuditFilters>) => auditFiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    return await queryAuditRows(data, { paged: true });
  });

export const exportSuperAdminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<AuditFilters>) => auditFiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { rows } = await queryAuditRows(data, { paged: false });
    const header = [
      "created_at",
      "action",
      "actor_email",
      "actor_id",
      "target_email",
      "target_user_id",
      "source",
      "metadata",
    ];
    const lines = [header.join(",")];
    for (const r of rows as any[]) {
      lines.push(
        [
          r.created_at,
          r.action,
          r.actor_email,
          r.actor_id,
          r.target_email,
          r.target_user_id,
          r.source,
          r.metadata,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return { csv: lines.join("\n"), count: rows.length };
  });
