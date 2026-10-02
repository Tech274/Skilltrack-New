import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOrgManager(ctx: any, orgId: string) {
  const { data: ok } = await ctx.supabase.rpc("is_org_member", {
    _org: orgId, _user: ctx.userId, _roles: ["exec", "hr"],
  });
  if (ok) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

export const getOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, name, slug, industry, size_band, website, description, settings, program_template")
      .eq("id", data.orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Not found");
    return { org };
  });

const PatchInput = z.object({
  orgId: z.string().uuid(),
  patch: z.object({
    industry: z.string().nullable().optional(),
    size_band: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    program_template: z.record(z.string(), z.unknown()).optional(),
  }),
  prompt_version_id: z.string().uuid().nullable().optional(),
});

export const updateOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof PatchInput>) => PatchInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Merge JSONB fields so partial autofill patches don't blow away existing keys
    const { data: cur } = await supabaseAdmin
      .from("organizations")
      .select("settings, program_template")
      .eq("id", data.orgId).single();

    const mergedSettings = { ...((cur?.settings as any) ?? {}), ...(data.patch.settings ?? {}) };
    const mergedTemplate = { ...((cur?.program_template as any) ?? {}), ...(data.patch.program_template ?? {}) };

    const update: any = {
      ...(data.patch.industry !== undefined ? { industry: data.patch.industry } : {}),
      ...(data.patch.size_band !== undefined ? { size_band: data.patch.size_band } : {}),
      ...(data.patch.website !== undefined ? { website: data.patch.website } : {}),
      ...(data.patch.description !== undefined ? { description: data.patch.description } : {}),
      ...(data.patch.settings ? { settings: mergedSettings } : {}),
      ...(data.patch.program_template ? { program_template: mergedTemplate } : {}),
    };

    const { error } = await supabaseAdmin.from("organizations").update(update).eq("id", data.orgId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      org_id: data.orgId,
      area: "org_settings",
      action: "update",
      target_table: "organizations",
      target_id: data.orgId,
      prompt_version_id: data.prompt_version_id ?? null,
      payload: { fields: Object.keys(update) },
    });

    return { ok: true };
  });

/**
 * Pre-fill org settings from a column-mapping job. Reads the job's column_map
 * + first normalized rows and proposes a patch (does NOT persist).
 */
export const proposeOrgSettingsFromJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; jobId: string }) =>
    z.object({ orgId: z.string().uuid(), jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .select("id, target_entity, column_map, summary")
      .eq("id", data.jobId).maybeSingle();
    if (!job) throw new Error("Job not found");

    const { data: rows } = await supabaseAdmin
      .from("ai_extraction_staged_rows")
      .select("normalized").eq("job_id", data.jobId).limit(20);

    const sample = (rows ?? []).map((r) => r.normalized).filter(Boolean);

    const patch: Record<string, unknown> = {};
    const settings: Record<string, unknown> = {};
    const program_template: Record<string, unknown> = {};
    // Per-field reasoning: { "settings.invoice_currency": { source, columns, sample_count, note } }
    const reasoning: Record<string, { source: string; entity: string; columns: string[]; sample_count: number; note: string }> = {};
    const colMap = (job.column_map as any) ?? {};
    const cols = (target: string) =>
      Object.entries(colMap).filter(([, v]) => v === target).map(([k]) => k);

    // Derive sensible defaults from extracted records
    if (job.target_entity === "invoices") {
      const currencies = new Set(sample.map((r: any) => r?.currency).filter(Boolean));
      if (currencies.size === 1) {
        settings.invoice_currency = [...currencies][0];
        reasoning["settings.invoice_currency"] = {
          source: `job:${job.id}`, entity: "invoices",
          columns: cols("currency"), sample_count: sample.length,
          note: `All ${sample.length} sampled invoices use the same currency.`,
        };
      }
      const dueDays: number[] = [];
      for (const r of sample as any[]) {
        if (r?.issue_date && r?.due_date) {
          const d = (new Date(r.due_date).getTime() - new Date(r.issue_date).getTime()) / 86400000;
          if (Number.isFinite(d) && d > 0) dueDays.push(d);
        }
      }
      if (dueDays.length) {
        const avg = Math.round(dueDays.reduce((a, b) => a + b, 0) / dueDays.length);
        settings.invoice_terms_days = avg;
        reasoning["settings.invoice_terms_days"] = {
          source: `job:${job.id}`, entity: "invoices",
          columns: [...cols("issue_date"), ...cols("due_date")],
          sample_count: dueDays.length,
          note: `Mean of (due_date − issue_date) across ${dueDays.length} invoices = ${avg} days.`,
        };
      }
    }
    if (job.target_entity === "learning_paths" || job.target_entity === "certifications") {
      const slugs = sample.map((r: any) => r?.target_certification_slug ?? r?.slug).filter(Boolean);
      if (slugs.length) {
        const list = Array.from(new Set(slugs)).slice(0, 8);
        program_template.default_certifications = list;
        reasoning["program_template.default_certifications"] = {
          source: `job:${job.id}`, entity: job.target_entity,
          columns: [...cols("target_certification_slug"), ...cols("slug")],
          sample_count: slugs.length,
          note: `Distinct certification slugs found in extracted rows (top ${list.length}).`,
        };
      }
    }
    if (job.target_entity === "mock_questions") {
      const titles = sample.map((r: any) => r?.exam_title).filter(Boolean);
      if (titles.length) {
        const list = Array.from(new Set(titles)).slice(0, 8);
        program_template.required_assessments = list;
        reasoning["program_template.required_assessments"] = {
          source: `job:${job.id}`, entity: "mock_questions",
          columns: cols("exam_title"), sample_count: titles.length,
          note: `Distinct exam titles referenced by extracted questions.`,
        };
      }
    }

    if (Object.keys(settings).length) patch.settings = settings;
    if (Object.keys(program_template).length) patch.program_template = program_template;
    return {
      patch: JSON.parse(JSON.stringify(patch)) as Record<string, any>,
      reasoning,
      fromJob: { id: job.id as string, target_entity: job.target_entity as string, mapped_columns: Object.keys(colMap) },
    };
  });
