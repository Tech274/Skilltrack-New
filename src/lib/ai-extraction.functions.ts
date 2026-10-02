import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const TARGETS = ["certifications", "study_resources", "mock_questions", "invoices", "payments"] as const;

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

// ---------- Upload signed URL ----------
export const getAiUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filename: string; size_bytes: number; mime?: string }) =>
    z.object({
      filename: z.string().min(1),
      size_bytes: z.number().int().nonnegative(),
      mime: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { MAX_UPLOAD_BYTES, ALLOWED_EXT, ALLOWED_MIME_PREFIXES } = await import("./ai-extraction.server");
    if (data.size_bytes <= 0) throw new Error("Empty file");
    if (data.size_bytes > MAX_UPLOAD_BYTES) {
      throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`);
    }
    const ext = (data.filename.toLowerCase().split(".").pop() ?? "");
    if (!ALLOWED_EXT.includes(ext as any)) {
      throw new Error(`File type "${ext}" not allowed. Use PDF, DOCX, XLS/XLSX, CSV, or TXT.`);
    }
    const m = (data.mime ?? "").toLowerCase();
    if (m && !ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p))) {
      throw new Error(`MIME type "${data.mime}" not allowed.`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.userId}/${Date.now()}_${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("ai-uploads")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ---------- Create job ----------
export const createExtractionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    target_entity: string;
    source?: "upload" | "generation";
    file_path?: string;
    file_name?: string;
    file_mime?: string;
    file_size_bytes?: number;
    prompt?: string;
    org_id?: string | null;
  }) =>
    z.object({
      target_entity: z.enum(TARGETS),
      source: z.enum(["upload", "generation"]).default("upload"),
      file_path: z.string().optional(),
      file_name: z.string().optional(),
      file_mime: z.string().optional(),
      file_size_bytes: z.number().int().nonnegative().optional(),
      prompt: z.string().optional(),
      org_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { resolveCallerOrgId } = await import("./ai-org-scope.server");
    const orgId = await resolveCallerOrgId(context, data.org_id ?? undefined, { area: "extraction", action: "create_extraction_job" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .insert({
        target_entity: data.target_entity,
        source: data.source,
        file_path: data.file_path ?? null,
        file_name: data.file_name ?? null,
        file_mime: data.file_mime ?? null,
        prompt: data.prompt ?? null,
        status: "queued",
        created_by: context.userId,
        org_id: orgId,
        summary: data.file_size_bytes ? ({ declared_size_bytes: data.file_size_bytes } as any) : ({} as any),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { job };
  });

// ---------- Run extraction ----------
export const runExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { EXTRACTION_REGISTRY, isTargetEntity } = await import("./ai-extraction-registry.server");
    const { parseAiUpload } = await import("./ai-extraction.server");

    const { data: job, error: jErr } = await supabaseAdmin
      .from("ai_extraction_jobs").select("*").eq("id", data.job_id).single();
    if (jErr || !job) throw new Error(jErr?.message ?? "Job not found");
    if (!isTargetEntity(job.target_entity)) throw new Error("Unsupported target_entity");
    const entry = EXTRACTION_REGISTRY[job.target_entity];

    await supabaseAdmin.from("ai_extraction_jobs").update({ status: "running" }).eq("id", job.id);

    let sourceText = job.prompt ?? "";
    let tabularHeaders: string[] | null = null;
    let tabularRows: Record<string, any>[] | null = null;
    let parseSummary: Record<string, any> = {};

    try {
      if (job.file_path) {
        const { MAX_UPLOAD_BYTES } = await import("./ai-extraction.server");
        const { data: file, error: dlErr } = await supabaseAdmin.storage
          .from("ai-uploads").download(job.file_path);
        if (dlErr || !file) throw new Error(dlErr?.message ?? "Download failed");
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`);
        }
        const buf = await file.arrayBuffer();
        const parsed = await parseAiUpload(buf, job.file_mime ?? "", job.file_name ?? "");
        if (parsed.kind === "text") {
          sourceText = `${job.prompt ?? ""}\n\nDocument text:\n${parsed.text}`;
          parseSummary = { kind: "text", chars: parsed.chars, truncated: parsed.truncated };
        } else {
          tabularHeaders = parsed.headers;
          tabularRows = parsed.rows;
          sourceText = `${job.prompt ?? ""}\n\nSpreadsheet headers: ${parsed.headers.join(", ")}\nFirst 50 rows (JSON):\n${JSON.stringify(parsed.rows.slice(0, 50), null, 2)}`;
          parseSummary = { kind: "tabular", total_rows: parsed.totalRows, truncated: parsed.truncated, headers: parsed.headers };
        }
      }

      // Persist headers early so the mapping editor can render even on failure
      if (tabularHeaders) {
        await supabaseAdmin.from("ai_extraction_jobs")
          .update({ tabular_headers: tabularHeaders })
          .eq("id", job.id);
      }

      // ---- Deterministic column-map path (tabular only, skip LLM) ----
      const columnMap = (job.column_map ?? null) as Record<string, string> | null;
      let rows: any[] = [];
      let usedModel: string | null = null;

      let usage: any = null;
      let durationMs = 0;
      if (tabularRows && columnMap && Object.keys(columnMap).length > 0) {
        rows = tabularRows.map((src) => {
          const out: Record<string, any> = {};
          for (const [header, field] of Object.entries(columnMap)) {
            if (!field) continue;
            const v = src[header];
            if (v === undefined || v === null || v === "") continue;
            if (["skills", "learning_outcomes", "correct_keys", "tags"].includes(field)) {
              out[field] = String(v).split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
            } else if (["amount", "discount", "tax", "total", "cost_usd", "passing_score", "marks", "duration_minutes", "validity_years"].includes(field)) {
              const n = Number(String(v).replace(/[, ]/g, ""));
              out[field] = Number.isFinite(n) ? n : v;
            } else {
              out[field] = v;
            }
          }
          return out;
        });
      } else {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) throw new Error("LOVABLE_API_KEY is not configured");
        const { readEffectiveAiDefaults } = await import("./admin-ai-defaults.functions");
        const defaults = await readEffectiveAiDefaults((job as any).org_id ?? null);
        usedModel = defaults.default_model;
        const gateway = createLovableAiGatewayProvider(key);
        const { withAiTimeout, extractUsage } = await import("./ai-call.server");
        var resolvedDefaultsSummary: any = {
          default_model: defaults.default_model,
          max_output_tokens: defaults.max_output_tokens,
          llm_timeout_ms: defaults.llm_timeout_ms,
          source: defaults.source,
        };

        const userPrompt = [
          `Target entity: ${job.target_entity}`,
          tabularHeaders ? `Map spreadsheet columns to the schema. Available columns: ${tabularHeaders.join(", ")}` : "",
          `Return a JSON array of extracted ${entry.label} rows. Skip rows you cannot map confidently.`,
          sourceText,
        ].filter(Boolean).join("\n\n");

        const startedAt = Date.now();
        const result = await withAiTimeout(async (signal) =>
          await generateText({
            model: gateway(usedModel!),
            system: entry.system,
            experimental_output: Output.object({
              schema: z.object({ rows: z.array(entry.schema) }),
            }),
            prompt: userPrompt,
            abortSignal: signal,
            maxOutputTokens: defaults.max_output_tokens,
          }),
          defaults.llm_timeout_ms,
        );
        durationMs = Date.now() - startedAt;
        usage = extractUsage(result);
        rows = (((result as any).experimental_output as any)?.rows ?? []);
      }

      // Normalize + stage
      const staged = rows.map((raw, i) => {
        const { normalized, errors } = entry.normalize(raw);
        return {
          job_id: job.id,
          org_id: job.org_id ?? null,
          position: i,
          payload: raw,
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
        model: usedModel,
        summary: {
          row_count: staged.length,
          with_errors: staged.filter((s) => (s.validation_errors as string[]).length).length,
          parse: parseSummary,
          mapped: !!(columnMap && Object.keys(columnMap).length > 0),
        },
      }).eq("id", job.id);


      await supabaseAdmin.from("ai_action_audit").insert({
        actor_id: context.userId,
        org_id: job.org_id ?? null,
        area: "extraction",
        action: "run",
        target_table: job.target_entity,
        target_id: job.id,
        prompt: job.prompt,
        model: usedModel,
        payload: {
          rows: staged.length,
          parse: parseSummary,
          usage,
          duration_ms: durationMs,
          resolved_defaults: typeof resolvedDefaultsSummary !== "undefined" ? resolvedDefaultsSummary : null,
        },
      });

      return { ok: true, row_count: staged.length };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      await supabaseAdmin.from("ai_extraction_jobs").update({ status: "failed", error: msg }).eq("id", job.id);
      throw new Error(msg);
    }
  });

// ---------- Job listings ----------
export const listExtractionJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });

export const getExtractionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin
      .from("ai_extraction_jobs").select("*").eq("id", data.job_id).single();
    if (error) throw new Error(error.message);
    const { data: rows, error: rErr } = await supabaseAdmin
      .from("ai_extraction_staged_rows").select("*").eq("job_id", data.job_id).order("position");
    if (rErr) throw new Error(rErr.message);

    // Conflict & relationship detection per row (in-memory, not persisted)
    const conflicts: Record<string, Array<{ field: string; level: "error" | "warn"; message: string }>> = {};
    const safeRows = (rows ?? []) as any[];
    const norm = (r: any) => (r.normalized ?? r.payload ?? {}) as any;

    if (job.target_entity === "certifications") {
      const slugs = safeRows.map((r) => norm(r).slug).filter(Boolean);
      const existing = slugs.length
        ? (await supabaseAdmin.from("certifications_catalog").select("slug").in("slug", slugs)).data ?? []
        : [];
      const taken = new Set(existing.map((c: any) => c.slug));
      const stagedSlugCount: Record<string, number> = {};
      for (const r of safeRows) {
        const s = norm(r).slug;
        if (s) stagedSlugCount[s] = (stagedSlugCount[s] ?? 0) + 1;
      }
      for (const r of safeRows) {
        if (r.status === "committed") continue;
        const slug = norm(r).slug;
        const list: any[] = [];
        if (slug && taken.has(slug)) list.push({ field: "slug", level: "error", message: `Slug "${slug}" already exists in certifications catalog.` });
        if (slug && stagedSlugCount[slug] > 1) list.push({ field: "slug", level: "error", message: `Slug "${slug}" is duplicated in ${stagedSlugCount[slug]} staged rows.` });
        if (list.length) conflicts[r.id] = list;
      }
    } else if (job.target_entity === "study_resources") {
      const slugs = Array.from(new Set(safeRows.map((r) => norm(r).certification_slug).filter(Boolean)));
      const existing = slugs.length
        ? (await supabaseAdmin.from("certifications_catalog").select("slug").in("slug", slugs)).data ?? []
        : [];
      const known = new Set(existing.map((c: any) => c.slug));
      for (const r of safeRows) {
        if (r.status === "committed") continue;
        const cs = norm(r).certification_slug;
        const list: any[] = [];
        if (cs && !known.has(cs)) list.push({ field: "certification_slug", level: "warn", message: `Certification "${cs}" not found in catalog. Resource will not link to a cert.` });
        if (list.length) conflicts[r.id] = list;
      }
    } else if (job.target_entity === "mock_questions") {
      const titles = Array.from(new Set(safeRows.map((r) => norm(r).exam_title).filter(Boolean)));
      const existing = titles.length
        ? (await supabaseAdmin.from("mock_exams").select("title").in("title", titles)).data ?? []
        : [];
      const known = new Set(existing.map((e: any) => e.title));
      for (const r of safeRows) {
        if (r.status === "committed") continue;
        const n = norm(r);
        const list: any[] = [];
        if (!n.exam_id && n.exam_title && !known.has(n.exam_title)) {
          list.push({ field: "exam_title", level: "error", message: `Mock exam "${n.exam_title}" not found. Create the exam or set exam_id before committing.` });
        }
        if (!n.exam_id && !n.exam_title) {
          list.push({ field: "exam_title", level: "error", message: "exam_id or exam_title required." });
        }
        if (list.length) conflicts[r.id] = list;
      }
    }

    return { job, rows: safeRows, conflicts };
  });


// ---------- Edit/Reject/Commit staged rows ----------
export const editStagedRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { row_id: string; patch: Record<string, any> }) =>
    z.object({ row_id: z.string().uuid(), patch: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { EXTRACTION_REGISTRY, isTargetEntity } = await import("./ai-extraction-registry.server");
    const { data: row, error } = await supabaseAdmin
      .from("ai_extraction_staged_rows").select("*, ai_extraction_jobs!inner(target_entity)").eq("id", data.row_id).single();
    if (error) throw new Error(error.message);
    const target = (row as any).ai_extraction_jobs.target_entity;
    if (!isTargetEntity(target)) throw new Error("Bad target");
    const entry = EXTRACTION_REGISTRY[target];
    const base = (row.normalized ?? row.payload ?? {}) as Record<string, any>;
    const next = { ...base, ...data.patch };
    const { normalized, errors } = entry.normalize(next);
    const { error: uErr } = await supabaseAdmin
      .from("ai_extraction_staged_rows")
      .update({ normalized, validation_errors: errors })
      .eq("id", data.row_id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, errors };
  });

export const setStagedRowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { row_ids: string[]; status: "approved" | "rejected" | "pending" }) =>
    z.object({
      row_ids: z.array(z.string().uuid()).min(1),
      status: z.enum(["approved", "rejected", "pending"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_extraction_staged_rows")
      .update({ status: data.status })
      .in("id", data.row_ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const commitStagedRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { row_ids: string[] }) =>
    z.object({ row_ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { EXTRACTION_REGISTRY, isTargetEntity } = await import("./ai-extraction-registry.server");

    const { data: rows, error } = await supabaseAdmin
      .from("ai_extraction_staged_rows")
      .select("*, ai_extraction_jobs!inner(target_entity, id)")
      .in("id", data.row_ids);
    if (error) throw new Error(error.message);

    const results: Array<{ row_id: string; ok: boolean; error?: string; inserted_id?: string }> = [];
    for (const r of rows ?? []) {
      try {
        const target = (r as any).ai_extraction_jobs.target_entity;
        if (!isTargetEntity(target)) throw new Error("Bad target");
        const entry = EXTRACTION_REGISTRY[target];
        const data2 = r.normalized ?? r.payload;
        const { normalized, errors } = entry.normalize(data2);
        if (errors.length) throw new Error(errors.join("; "));
        const insertedId = await entry.commit(supabaseAdmin, normalized, { actorId: context.userId });
        await supabaseAdmin.from("ai_extraction_staged_rows")
          .update({ status: "committed", target_row_id: insertedId })
          .eq("id", r.id);
        await supabaseAdmin.from("ai_action_audit").insert({
          actor_id: context.userId,
          area: "extraction",
          action: "commit",
          target_table: target,
          target_id: insertedId,
          payload: { staged_row: r.id },
        });
        results.push({ row_id: r.id, ok: true, inserted_id: insertedId });
      } catch (e: any) {
        results.push({ row_id: r.id, ok: false, error: String(e?.message ?? e) });
      }
    }
    return { results };
  });

// ---------- Lifecycle controls (cancel / rerun / purge) ----------

async function assertSuperOrAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

export const cancelExtractionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .update({ status: "cancelled", error: "Cancelled by admin" })
      .eq("id", data.job_id)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId, area: "extraction", action: "cancel", target_id: data.job_id,
    });
    return { ok: true };
  });

export const rerunExtractionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperOrAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe prior staged rows and reset status, then call runExtraction
    await supabaseAdmin.from("ai_extraction_staged_rows").delete().eq("job_id", data.job_id);
    await supabaseAdmin.from("ai_extraction_jobs")
      .update({ status: "queued", error: null, summary: {} }).eq("id", data.job_id);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId, area: "extraction", action: "rerun", target_id: data.job_id,
    });
    return { ok: true };
  });

export const purgeExtractionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Purge is destructive — super admin only
    const { data: sa } = await context.supabase.rpc("is_super_admin", { _uid: context.userId });
    if (!sa) throw new Error("Forbidden (super admin only)");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("ai_extraction_jobs").select("file_path").eq("id", data.job_id).maybeSingle();
    if (job?.file_path) {
      await supabaseAdmin.storage.from("ai-uploads").remove([job.file_path]).catch(() => {});
    }
    const { error } = await supabaseAdmin.from("ai_extraction_jobs").delete().eq("id", data.job_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId, area: "extraction", action: "purge", target_id: data.job_id,
    });
    return { ok: true };
  });

// ---------- Column mapping (CSV/XLS) ----------
export const saveColumnMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { job_id: string; column_map: Record<string, string> }) =>
    z.object({
      job_id: z.string().uuid(),
      column_map: z.record(z.string(), z.string()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_extraction_jobs")
      .update({ column_map: data.column_map })
      .eq("id", data.job_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      area: "extraction",
      action: "save_column_map",
      target_id: data.job_id,
      payload: { fields: Object.values(data.column_map).filter(Boolean).length },
    });
    return { ok: true };
  });

/**
 * Returns the schema field list for a target entity so the UI can render a
 * column-mapper without hardcoding field names.
 */
export const getTargetSchemaFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { target_entity: string }) =>
    z.object({ target_entity: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { EXTRACTION_REGISTRY, isTargetEntity } = await import("./ai-extraction-registry.server");
    if (!isTargetEntity(data.target_entity)) throw new Error("Unsupported target");
    const entry = EXTRACTION_REGISTRY[data.target_entity];
    const shape = (entry.schema as any)?._def?.shape?.() ?? (entry.schema as any)?.shape ?? {};
    const fields = Object.keys(shape);
    return { fields };
  });
