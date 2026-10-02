import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WRITE_ROLES = ["admin", "content_admin"] as const;
const READ_ROLES = ["admin", "content_admin", "support_admin"] as const;

async function assertRead(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
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

/* ============================================================ */
/* CERTIFICATIONS                                                */
/* ============================================================ */

export const listCertifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.string().optional(), search: z.string().optional() }).partial().optional())
  .handler(async ({ data, context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("certifications_catalog").select("*").order("created_at", { ascending: false });
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},code.ilike.${s},vendor.ilike.${s},slug.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const certInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(200),
  code: z.string().max(60).optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  level: z.string().max(40).optional().nullable(),
  tagline: z.string().max(280).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable().or(z.literal("")),
  cost_usd: z.number().min(0).max(100000).optional().nullable(),
  duration_minutes: z.number().int().min(0).max(1000).optional().nullable(),
  passing_score: z.number().min(0).max(100).optional().nullable(),
  validity_years: z.number().int().min(0).max(50).optional().nullable(),
  skills: z.array(z.string()).default([]),
  learning_outcomes: z.array(z.string()).default([]),
});

export const upsertCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(certInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    if (payload.thumbnail_url === "") payload.thumbnail_url = null;
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("certifications_catalog").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("certifications_catalog").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setCertificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("certifications_catalog").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("certifications_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================ */
/* STUDY RESOURCES                                               */
/* ============================================================ */

export const listResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    status: z.string().optional(), tier: z.string().optional(),
    certification_slug: z.string().optional(), search: z.string().optional(),
  }).partial().optional())
  .handler(async ({ data, context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("study_resources").select("*").order("created_at", { ascending: false });
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.tier && data.tier !== "all") q = q.eq("access_tier", data.tier);
    if (data?.certification_slug) q = q.eq("certification_slug", data.certification_slug);
    if (data?.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},description.ilike.${s},module.ilike.${s},topic.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const resourceInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional().nullable(),
  certification_slug: z.string().max(120).optional().nullable(),
  module: z.string().max(120).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  resource_type: z.enum(["pdf","ppt","doc","video","audio","link","youtube","practice_guide","notes","cheat_sheet","lab_guide","case_study","assignment"]),
  external_url: z.string().url().optional().nullable().or(z.literal("")),
  storage_path: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
  file_size_bytes: z.number().int().optional().nullable(),
  file_mime: z.string().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable().or(z.literal("")),
  access_tier: z.enum(["free","paid"]).default("free"),
  required_plan: z.string().max(60).optional().nullable(),
  download_allowed: z.boolean().default(true),
});

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(resourceInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    if (payload.external_url === "") payload.external_url = null;
    if (payload.thumbnail_url === "") payload.thumbnail_url = null;
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("study_resources").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("study_resources").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setResourceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["draft","published"]) }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("study_resources").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("study_resources").select("storage_path").eq("id", data.id).maybeSingle();
    if (existing?.storage_path) {
      await supabaseAdmin.storage.from("content-files").remove([existing.storage_path]);
    }
    const { error } = await supabaseAdmin.from("study_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---- File upload: create signed upload URL + finalize ---- */

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    filename: z.string().min(1).max(200),
    mime: z.string().max(120),
    size_bytes: z.number().int().min(1).max(2 * 1024 * 1024 * 1024), // 2GB
    folder: z.enum(["resources","thumbnails","exam-assets"]).default("resources"),
  }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${data.folder}/${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("content-files").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getSignedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ path: z.string().min(1), expires_in: z.number().int().min(60).max(3600).default(600) }))
  .handler(async ({ data, context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("content-files").createSignedUrl(data.path, data.expires_in);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/* ============================================================ */
/* MOCK EXAMS                                                    */
/* ============================================================ */

export const listMockExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.string().optional(), search: z.string().optional() }).partial().optional())
  .handler(async ({ data, context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("mock_exams").select("*").order("created_at", { ascending: false });
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.search) {
      const s = `%${data.search}%`;
      q = q.or(`title.ilike.${s},description.ilike.${s},certification_slug.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMockExam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error } = await supabaseAdmin.from("mock_exams").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!exam) throw new Error("Mock exam not found");
    const { data: questions } = await supabaseAdmin.from("mock_exam_questions").select("*").eq("exam_id", data.id).order("order_index", { ascending: true });
    return { exam, questions: questions ?? [] };
  });

const examInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(3000).optional().nullable(),
  certification_slug: z.string().max(120).optional().nullable(),
  duration_minutes: z.number().int().min(1).max(600).default(60),
  passing_score: z.number().min(0).max(100).default(70),
  attempts_allowed: z.number().int().min(1).max(50).default(3),
  randomize_questions: z.boolean().default(true),
  negative_marking: z.boolean().default(false),
  access_tier: z.enum(["free","paid"]).default("free"),
  required_plan: z.string().max(60).optional().nullable(),
});

export const upsertMockExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(examInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("mock_exams").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("mock_exams").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setMockExamStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["draft","published"]) }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Refuse to publish empty exams
    if (data.status === "published") {
      const { count } = await supabaseAdmin.from("mock_exam_questions").select("id", { count: "exact", head: true }).eq("exam_id", data.id);
      if (!count || count === 0) throw new Error("Add at least one question before publishing.");
    }
    const { error } = await supabaseAdmin.from("mock_exams").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMockExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mock_exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---- Questions ---- */

const questionInput = z.object({
  id: z.string().uuid().optional(),
  exam_id: z.string().uuid(),
  question_text: z.string().min(2).max(4000),
  question_type: z.enum(["single","multi","true_false","scenario","case_study"]).default("single"),
  options: z.array(z.object({ key: z.string(), text: z.string() })).default([]),
  correct_answers: z.array(z.string()).default([]),
  marks: z.number().min(0).max(100).default(1),
  negative_marks: z.number().min(0).max(100).default(0),
  explanation: z.string().max(3000).optional().nullable(),
  order_index: z.number().int().min(0).default(0),
});

async function recomputeExamTotals(supabaseAdmin: any, examId: string) {
  const { data: rows } = await supabaseAdmin.from("mock_exam_questions").select("marks").eq("exam_id", examId);
  const total_questions = (rows ?? []).length;
  const total_marks = (rows ?? []).reduce((s: number, r: any) => s + Number(r.marks || 0), 0);
  await supabaseAdmin.from("mock_exams").update({ total_questions, total_marks }).eq("id", examId);
}

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(questionInput)
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("mock_exam_questions").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("mock_exam_questions").insert(payload);
      if (error) throw new Error(error.message);
    }
    await recomputeExamTotals(supabaseAdmin, data.exam_id);
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), exam_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("mock_exam_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recomputeExamTotals(supabaseAdmin, data.exam_id);
    return { ok: true };
  });
