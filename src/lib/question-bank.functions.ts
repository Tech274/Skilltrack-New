// Central question bank: CRUD + bulk CSV import.
//
// Visibility: admin / content_admin / super_admin see everything; org execs /
// managers manage their org's rows; org members read their org's rows. RLS
// enforces this on the table — server functions use service role and re-check
// the caller's role before writing/reading global rows.

import { recordAdminAudit, snapshotRow } from "@/lib/admin-audit.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const QTYPES = ["single", "multi", "true_false"] as const;

async function getCallerCaps(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isContent }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "content_admin" }),
    supabase.rpc("is_super_admin", { _uid: userId }),
  ]);
  return { isAdmin: !!isAdmin, isContent: !!isContent, isSuper: !!isSuper };
}

async function assertCanManage(supabase: any, userId: string, orgId: string | null | undefined) {
  const caps = await getCallerCaps(supabase, userId);
  if (caps.isAdmin || caps.isContent || caps.isSuper) return caps;
  if (orgId) {
    const { data: isOrgLead } = await supabase.rpc("is_org_member", {
      _org: orgId, _user: userId, _roles: ["exec", "manager"],
    });
    if (isOrgLead) return caps;
  }
  throw new Error("Forbidden: cannot manage question bank");
}

const questionInput = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid().nullable().optional(),
  certification_slug: z.string().max(120).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  question_type: z.enum(QTYPES).default("single"),
  question_text: z.string().min(2).max(4000),
  options: z.array(z.string().max(2000)).default([]),
  correct_answers: z.array(z.number().int().min(0)).default([]),
  explanation: z.string().max(4000).nullable().optional(),
  reference_url: z.string().url().nullable().optional().or(z.literal("")),
  tags: z.array(z.string().max(60)).default([]),
  active: z.boolean().default(true),
});

export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    certification_slug: z.string().optional(),
    difficulty: z.string().optional(),
    topic: z.string().optional(),
    search: z.string().optional(),
    org_id: z.string().uuid().optional(),
    only_active: z.boolean().optional(),
  }).partial().optional())
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caps = await getCallerCaps(context.supabase, context.userId);

    let q = supabaseAdmin.from("question_bank").select("*").order("created_at", { ascending: false });
    if (data?.certification_slug) q = q.eq("certification_slug", data.certification_slug);
    if (data?.difficulty && data.difficulty !== "all") q = q.eq("difficulty", data.difficulty);
    if (data?.topic) q = q.ilike("topic", `%${data.topic}%`);
    if (data?.only_active) q = q.eq("active", true);
    if (data?.search) q = q.ilike("question_text", `%${data.search}%`);

    // Non-admins: restrict to their org rows.
    if (!caps.isAdmin && !caps.isContent && !caps.isSuper) {
      const { data: memberships } = await supabaseAdmin
        .from("organization_members").select("org_id").eq("user_id", context.userId);
      const orgIds = (memberships ?? []).map((m: any) => m.org_id);
      if (orgIds.length === 0) return [];
      q = q.in("org_id", orgIds);
    } else if (data?.org_id) {
      q = q.eq("org_id", data.org_id);
    }

    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(questionInput)
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId, data.org_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    if (payload.reference_url === "") payload.reference_url = null;
    if (data.id) {
      const before = await snapshotRow(supabaseAdmin, "question_bank", data.id, "id, question_type, difficulty, active");
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("question_bank").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      await recordAdminAudit(supabaseAdmin, {
        actorId: context.userId,
        action: "question_bank.update",
        targetTable: "question_bank",
        targetId: id,
        summary: data.question_text.slice(0, 120),
        before,
        after: { question_type: data.question_type, difficulty: data.difficulty },
      });
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("question_bank").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "question_bank.create",
      targetTable: "question_bank",
      targetId: row!.id,
      summary: data.question_text.slice(0, 120),
      after: { question_type: data.question_type, difficulty: data.difficulty },
    });
    return { id: row!.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("question_bank").select("org_id").eq("id", data.id).maybeSingle();
    await assertCanManage(context.supabase, context.userId, existing?.org_id ?? null);
    const before = await snapshotRow(supabaseAdmin, "question_bank", data.id, "id, question_type, difficulty, active");
    const { error } = await supabaseAdmin.from("question_bank").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "question_bank.delete",
      targetTable: "question_bank",
      targetId: data.id,
      before,
    });
    return { ok: true };
  });

/** Bulk import — accepts an array of partial questions (already parsed from CSV on the client). */
export const importQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    org_id: z.string().uuid().nullable().optional(),
    rows: z.array(questionInput.omit({ id: true, org_id: true })).min(1).max(1000),
  }))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.supabase, context.userId, data.org_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.rows.map((r) => ({
      ...r,
      org_id: data.org_id ?? null,
      created_by: context.userId,
      reference_url: r.reference_url === "" ? null : r.reference_url,
    }));
    const { error, count } = await supabaseAdmin.from("question_bank").insert(payload, { count: "exact" });
    if (error) throw new Error(error.message);
    const inserted = count ?? payload.length;
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "question_bank.import",
      targetTable: "question_bank",
      targetId: data.org_id ?? null,
      summary: `imported ${inserted}`,
      after: { inserted },
    });
    return { inserted };
  });
