import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

const InputSchema = z.object({
  certification_slug: z.string().optional(),
  exam_id: z.string().uuid().optional(),
  syllabus: z.string().optional(),
  topics: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  style: z.string().optional(),
  org_id: z.string().uuid().nullable().optional(),
});

const QuestionSchema = z.object({
  stem: z.string(),
  options: z.array(z.object({ key: z.string(), text: z.string() })).length(4),
  correct_keys: z.array(z.string()).min(1),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Generate mock questions and stage them via ai_extraction_jobs/staged_rows
 * so they flow through the same preview-before-apply review UI.
 */
export const generateMockQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof InputSchema>) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { EXTRACTION_REGISTRY } = await import("./ai-extraction-registry.server");
    const { resolveCallerOrgId } = await import("./ai-org-scope.server");
    const { withAiTimeout, extractUsage } = await import("./ai-call.server");
    const { readEffectiveAiDefaults } = await import("./admin-ai-defaults.functions");
    const orgId = await resolveCallerOrgId(context, data.org_id ?? undefined, { area: "content_gen", action: "generate_mock_questions" });

    // Cross-tenant ownership: use the caller's user-scoped client so RLS
    // enforces what they can see. mock_exams and certifications_catalog
    // now carry an org_id column (Batch 3). When the caller pins an org_id,
    // the referenced exam / certification MUST be either global (org_id IS
    // NULL) or owned by that same org — otherwise we reject hard and record
    // a cross-tenant attempt.
    let certName = "";
    let certOrgId: string | null = null;
    if (data.certification_slug) {
      const { data: cert, error: cErr } = await context.supabase
        .from("certifications_catalog")
        .select("name, org_id")
        .eq("slug", data.certification_slug).maybeSingle();
      if (cErr || !cert) throw new Error(`certification_slug "${data.certification_slug}" not accessible to your account`);
      certName = (cert as any).name;
      certOrgId = ((cert as any).org_id as string | null) ?? null;
    }
    let examTitle = "";
    let examOrgId: string | null = null;
    if (data.exam_id) {
      const { data: ex, error: eErr } = await context.supabase
        .from("mock_exams").select("title, org_id").eq("id", data.exam_id).maybeSingle();
      if (eErr || !ex) throw new Error(`exam_id "${data.exam_id}" not accessible to your account`);
      examTitle = (ex as any).title;
      examOrgId = ((ex as any).org_id as string | null) ?? null;
    }

    if (orgId) {
      const mismatch =
        (certOrgId && certOrgId !== orgId) ||
        (examOrgId && examOrgId !== orgId);
      if (mismatch) {
        try {
          const { recordCrossTenantAccess } = await import("./ai-cross-tenant.server");
          await recordCrossTenantAccess({
            actor_id: context.userId,
            org_id: orgId,
            area: "content_gen",
            action: "generate_mock_questions",
            reason: "exam or certification belongs to a different organization",
            extra: { exam_id: data.exam_id, certification_slug: data.certification_slug, exam_org_id: examOrgId, cert_org_id: certOrgId },
          });
        } catch { /* noop */ }
        throw new Error("Forbidden: exam or certification belongs to another organization");
      }
    }
    const crossTenantWarning: string | null = null;

    // Create job
    const { data: job, error: jErr } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .insert({
        target_entity: "mock_questions",
        source: "generation",
        status: "running",
        prompt: data.syllabus ?? null,
        created_by: context.userId,
        org_id: orgId,
        summary: { certification_slug: data.certification_slug, exam_id: data.exam_id, count: data.count },
      })
      .select("*").single();
    if (jErr) throw new Error(jErr.message);

    try {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY is not configured");
      const { resolveActivePrompt } = await import("./ai-prompt-resolver.server");
      const defaults = await readEffectiveAiDefaults(orgId);
      const resolved = await resolveActivePrompt("mock_questions", EXTRACTION_REGISTRY.mock_questions.system);
      const model = resolved.model || defaults.default_model;
      const gateway = createLovableAiGatewayProvider(key);

      const userPrompt = [
        `Generate ${data.count} mock exam questions at ${data.difficulty} difficulty.`,
        certName ? `Certification: ${certName}` : "",
        examTitle ? `Exam: ${examTitle}` : "",
        data.topics?.length ? `Topics: ${data.topics.join(", ")}` : "",
        data.style ? `Style: ${data.style}` : "",
        data.syllabus ? `Syllabus / source material:\n${data.syllabus.slice(0, 50_000)}` : "",
        "Each question must have 4 options keyed A-D and at least one correct_keys entry referencing those keys. Include a 1–3 sentence explanation.",
      ].filter(Boolean).join("\n\n");

      const startedAt = Date.now();
      const result = await withAiTimeout(async (signal) =>
        await generateText({
          model: gateway(model),
          system: resolved.system,
          experimental_output: Output.object({
            schema: z.object({ questions: z.array(QuestionSchema) }),
          }),
          prompt: userPrompt,
          abortSignal: signal,
          maxOutputTokens: defaults.max_output_tokens,
        }),
        defaults.llm_timeout_ms,
      );
      const durationMs = Date.now() - startedAt;
      const usage = extractUsage(result);

      const rows = (((result as any).experimental_output as any)?.questions ?? []) as any[];
      const staged = rows.map((q, i) => {
        const payload = { ...q, exam_id: data.exam_id, exam_title: examTitle || undefined };
        const { normalized, errors } = EXTRACTION_REGISTRY.mock_questions.normalize(payload);
        return {
          job_id: job.id,
          org_id: orgId,
          position: i,
          payload,
          normalized,
          validation_errors: errors,
          status: "pending",
        };
      });

      if (staged.length > 0) {
        const { error: insErr } = await supabaseAdmin.from("ai_extraction_staged_rows").insert(staged);
        if (insErr) throw new Error(insErr.message);
      }

      await supabaseAdmin.from("ai_extraction_jobs").update({
        status: "ready",
        model,
        prompt_version_id: resolved.versionId,
        summary: { ...((job.summary as Record<string, any>) ?? {}), row_count: staged.length },
      }).eq("id", job.id);

      await supabaseAdmin.from("ai_action_audit").insert({
        actor_id: context.userId,
        org_id: orgId,
        area: "content_gen",
        action: "generate_mock_questions",
        target_table: "mock_questions",
        target_id: job.id,
        model,
        prompt_version_id: resolved.versionId,
        payload: {
          count: staged.length,
          certification_slug: data.certification_slug,
          exam_id: data.exam_id,
          usage,
          duration_ms: durationMs,
          resolved_defaults: {
            default_model: defaults.default_model,
            max_output_tokens: defaults.max_output_tokens,
            llm_timeout_ms: defaults.llm_timeout_ms,
            source: defaults.source,
          },
          ...(crossTenantWarning ? {
            cross_tenant_attempt: true,
            cross_tenant_warning: crossTenantWarning,
          } : {}),
        },
      });

      if (crossTenantWarning) {
        const { recordCrossTenantAccess } = await import("./ai-cross-tenant.server");
        await recordCrossTenantAccess({
          actor_id: context.userId,
          org_id: orgId,
          area: "content_gen",
          action: "generate_mock_questions",
          target_table: "mock_questions",
          target_id: job.id,
          reason: crossTenantWarning,
          extra: { exam_id: data.exam_id, certification_slug: data.certification_slug },
        });
      }


      return { job_id: job.id, row_count: staged.length };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      await supabaseAdmin.from("ai_extraction_jobs").update({ status: "failed", error: msg }).eq("id", job.id);
      throw new Error(msg);
    }
  });

// ============================================================================
// Generic generator helper used by milestones & study resources
// ============================================================================

async function runGeneratorJob(opts: {
  ctx: any;
  targetEntity: "milestones" | "study_resources";
  prompt: string;
  summary: Record<string, unknown>;
  itemsKey: string;
  itemSchema: z.ZodTypeAny;
  extraPayloadFields?: Record<string, unknown>;
  auditAction: string;
  orgId?: string | null;
}) {
  const { ctx, targetEntity, prompt, summary, itemsKey, itemSchema, extraPayloadFields, auditAction, orgId = null } = opts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { EXTRACTION_REGISTRY } = await import("./ai-extraction-registry.server");
  const { withAiTimeout, extractUsage } = await import("./ai-call.server");
  const { readEffectiveAiDefaults } = await import("./admin-ai-defaults.functions");
  const entry = EXTRACTION_REGISTRY[targetEntity];

  const { data: job, error: jErr } = await supabaseAdmin
    .from("ai_extraction_jobs")
    .insert({
      target_entity: targetEntity,
      source: "generation",
      status: "running",
      prompt,
      created_by: ctx.userId,
      org_id: orgId,
      summary: summary as any,
    })
    .select("*").single();
  if (jErr) throw new Error(jErr.message);

  try {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const { resolveActivePrompt } = await import("./ai-prompt-resolver.server");
    const defaults = await readEffectiveAiDefaults(orgId);
    const resolved = await resolveActivePrompt(targetEntity, entry.system);
    const model = resolved.model || defaults.default_model;
    const gateway = createLovableAiGatewayProvider(key);

    const startedAt = Date.now();
    const result = await withAiTimeout(async (signal) =>
      await generateText({
        model: gateway(model),
        system: resolved.system,
        experimental_output: Output.object({
          schema: z.object({ [itemsKey]: z.array(itemSchema) } as any),
        }),
        prompt,
        abortSignal: signal,
        maxOutputTokens: defaults.max_output_tokens,
      }),
      defaults.llm_timeout_ms,
    );
    const durationMs = Date.now() - startedAt;
    const usage = extractUsage(result);

    const rows = (((result as any).experimental_output as any)?.[itemsKey] ?? []) as any[];
    const staged = rows.map((r, i) => {
      const payload = { ...r, ...(extraPayloadFields ?? {}) };
      const { normalized, errors } = entry.normalize(payload);
      return {
        job_id: job.id,
        org_id: orgId,
        position: i,
        payload,
        normalized,
        validation_errors: errors,
        status: "pending",
      };
    });

    if (staged.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("ai_extraction_staged_rows").insert(staged);
      if (insErr) throw new Error(insErr.message);
    }

    await supabaseAdmin.from("ai_extraction_jobs").update({
      status: "ready",
      model,
      prompt_version_id: resolved.versionId,
      summary: { ...summary, row_count: staged.length },
    }).eq("id", job.id);

    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: ctx.userId,
      org_id: orgId,
      area: "content_gen",
      action: auditAction,
      target_table: targetEntity,
      target_id: job.id,
      model,
      prompt_version_id: resolved.versionId,
      payload: {
        count: staged.length,
        ...summary,
        usage,
        duration_ms: durationMs,
        resolved_defaults: {
          default_model: defaults.default_model,
          max_output_tokens: defaults.max_output_tokens,
          llm_timeout_ms: defaults.llm_timeout_ms,
          source: defaults.source,
        },
      },
    });

    return { job_id: job.id, row_count: staged.length };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    await supabaseAdmin.from("ai_extraction_jobs").update({ status: "failed", error: msg }).eq("id", job.id);
    throw new Error(msg);
  }
}

// ============================================================================
// generateMilestones — convert extracted records / source text into timed
// milestones for a specific user_certification.
// ============================================================================

const MilestoneInput = z.object({
  user_certification_id: z.string().uuid(),
  source_text: z.string().max(50_000).optional(),
  source_job_id: z.string().uuid().optional(),
  count: z.number().int().min(1).max(40).default(8),
  target_exam_date: z.string().optional(),
  style: z.string().optional(),
  org_id: z.string().uuid().nullable().optional(),
});

const MilestoneItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  order_index: z.number().int().optional(),
  milestone_type: z.enum(["study", "practice", "exam", "assessment", "review"]).optional(),
  success_criteria: z.string().optional(),
  estimated_hours: z.number().optional(),
});

export const generateMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof MilestoneInput>) => MilestoneInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { resolveCallerOrgId } = await import("./ai-org-scope.server");
    const orgId = await resolveCallerOrgId(context, data.org_id ?? undefined, { area: "content_gen", action: "generate_milestones" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve user_certification + cert info
    const { data: uc, error: ucErr } = await supabaseAdmin
      .from("user_certifications")
      .select("id, user_id, certification_slug")
      .eq("id", data.user_certification_id)
      .maybeSingle();
    if (ucErr || !uc) throw new Error("user_certification not found");

    let certName = uc.certification_slug;
    const { data: cert } = await supabaseAdmin
      .from("certifications_catalog")
      .select("name, description, skills, learning_outcomes")
      .eq("slug", uc.certification_slug).maybeSingle();
    if (cert?.name) certName = cert.name;

    // If a source extraction job was passed, pull its approved/staged normalized rows for context
    let sourceContext = data.source_text ?? "";
    if (data.source_job_id) {
      const { data: rows } = await supabaseAdmin
        .from("ai_extraction_staged_rows")
        .select("normalized")
        .eq("job_id", data.source_job_id)
        .limit(200);
      if (rows?.length) {
        sourceContext += "\n\nRelated records:\n" + JSON.stringify(rows.map((r) => r.normalized), null, 2).slice(0, 30_000);
      }
    }

    const prompt = [
      `Generate ${data.count} study milestones for "${certName}".`,
      data.target_exam_date ? `Target exam date: ${data.target_exam_date}. Schedule due_dates so the learner finishes ~5 days before that.` : "Spread due_dates evenly over the next 60 days.",
      data.style ? `Style: ${data.style}` : "",
      sourceContext ? `Reference material:\n${sourceContext.slice(0, 40_000)}` : "",
      `Each milestone MUST include: title, due_date (YYYY-MM-DD), milestone_type, success_criteria (one sentence describing 'done'), and an order_index starting at 0.`,
    ].filter(Boolean).join("\n\n");

    return runGeneratorJob({
      ctx: context,
      targetEntity: "milestones",
      prompt,
      summary: {
        user_certification_id: uc.id,
        certification_slug: uc.certification_slug,
        target_exam_date: data.target_exam_date,
        source_job_id: data.source_job_id,
        count: data.count,
      },
      itemsKey: "milestones",
      itemSchema: MilestoneItemSchema,
      extraPayloadFields: {
        user_certification_id: uc.id,
        user_id: uc.user_id,
        certification_slug: uc.certification_slug,
      },
      auditAction: "generate_milestones",
      orgId,
    });
  });

// ============================================================================
// generateStudyResources — build structured study plan (as resource entries)
// from extracted invoices, learning paths, and exam data.
// ============================================================================

const ResourcesInput = z.object({
  certification_slug: z.string().optional(),
  source_job_ids: z.array(z.string().uuid()).max(10).optional(),
  focus_topics: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(30).default(10),
  audience: z.string().optional(),
  org_id: z.string().uuid().nullable().optional(),
});

const ResourceItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  module: z.string().optional(),
  topic: z.string().optional(),
  resource_type: z.enum([
    "pdf", "ppt", "doc", "video", "audio", "link", "youtube",
    "practice_guide", "notes", "cheat_sheet", "lab_guide", "case_study", "assignment",
  ]),
  external_url: z.string().optional(),
  access_tier: z.enum(["free", "paid"]).optional(),
});

export const generateStudyResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ResourcesInput>) => ResourcesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { resolveCallerOrgId } = await import("./ai-org-scope.server");
    const orgId = await resolveCallerOrgId(context, data.org_id ?? undefined, { area: "content_gen", action: "generate_study_resources" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let certName = data.certification_slug ?? "";
    if (data.certification_slug) {
      const { data: cert } = await supabaseAdmin
        .from("certifications_catalog")
        .select("name, description, skills, learning_outcomes")
        .eq("slug", data.certification_slug).maybeSingle();
      if (cert?.name) certName = cert.name;
    }

    // Gather extracted context from referenced jobs (invoices, paths, exams etc.)
    let contextBlocks: string[] = [];
    if (data.source_job_ids?.length) {
      const { data: jobs } = await supabaseAdmin
        .from("ai_extraction_jobs")
        .select("id, target_entity")
        .in("id", data.source_job_ids);
      const { data: rows } = await supabaseAdmin
        .from("ai_extraction_staged_rows")
        .select("job_id, normalized")
        .in("job_id", data.source_job_ids)
        .limit(500);
      const grouped: Record<string, any[]> = {};
      for (const r of rows ?? []) {
        const j = jobs?.find((x) => x.id === r.job_id);
        const k = j?.target_entity ?? "unknown";
        (grouped[k] ??= []).push(r.normalized);
      }
      for (const [k, arr] of Object.entries(grouped)) {
        contextBlocks.push(`### From ${k} (${arr.length})\n${JSON.stringify(arr, null, 2).slice(0, 15_000)}`);
      }
    }

    const prompt = [
      `Design a structured study plan as ${data.count} study resource entries${certName ? ` for ${certName}` : ""}.`,
      data.audience ? `Audience: ${data.audience}` : "",
      data.focus_topics?.length ? `Focus topics: ${data.focus_topics.join(", ")}` : "",
      "Cover prerequisite recap, core concepts, hands-on labs, and exam-style practice. Group by module.",
      contextBlocks.length ? `Reference extracted data:\n${contextBlocks.join("\n\n").slice(0, 40_000)}` : "",
      "Each entry: title, description, module, topic, resource_type from the enum, optional external_url, access_tier (free|paid).",
    ].filter(Boolean).join("\n\n");

    return runGeneratorJob({
      ctx: context,
      targetEntity: "study_resources",
      prompt,
      summary: {
        certification_slug: data.certification_slug,
        source_job_ids: data.source_job_ids,
        count: data.count,
      },
      itemsKey: "resources",
      itemSchema: ResourceItemSchema,
      extraPayloadFields: data.certification_slug ? { certification_slug: data.certification_slug } : {},
      auditAction: "generate_study_resources",
      orgId,
    });
  });

