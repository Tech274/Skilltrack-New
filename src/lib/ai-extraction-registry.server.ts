import { z } from "zod";

/**
 * Server-only registry mapping target entities to:
 *   - canonical Zod schema (what the AI must return),
 *   - AI system prompt,
 *   - normalizer that coerces raw payloads to platform format,
 *   - committer that inserts an approved row into the real table.
 *
 * Adding a new entity = add a key here; everything else is generic.
 */

export type TargetEntity =
  | "certifications"
  | "study_resources"
  | "mock_questions"
  | "invoices"
  | "payments"
  | "milestones"
  | "learning_paths";


type NormalizeResult = { normalized: any; errors: string[] };

export type RegistryEntry = {
  label: string;
  schema: z.ZodTypeAny;
  system: string;
  /** Coerce raw AI output into a platform-shaped object. */
  normalize: (raw: any) => NormalizeResult;
  /** Insert one normalized row into the target table. Returns inserted id. */
  commit: (supabaseAdmin: any, row: any, ctx: { actorId: string }) => Promise<string>;
};

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function need(v: any, msg: string, errs: string[]) {
  if (v === undefined || v === null || v === "") errs.push(msg);
}

const CertSchema = z.object({
  slug: z.string().optional(),
  name: z.string(),
  code: z.string().optional(),
  vendor: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  description: z.string().optional(),
  tagline: z.string().optional(),
  cost_usd: z.number().optional(),
  duration_minutes: z.number().int().optional(),
  passing_score: z.number().optional(),
  validity_years: z.number().int().optional(),
  skills: z.array(z.string()).optional(),
  learning_outcomes: z.array(z.string()).optional(),
});

const ResourceSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  certification_slug: z.string().optional(),
  module: z.string().optional(),
  topic: z.string().optional(),
  resource_type: z.string(),
  external_url: z.string().optional(),
  access_tier: z.enum(["free", "paid"]).optional(),
});

const RESOURCE_TYPES = new Set([
  "pdf", "ppt", "doc", "video", "audio", "link", "youtube",
  "practice_guide", "notes", "cheat_sheet", "lab_guide", "case_study", "assignment",
]);

const MockQSchema = z.object({
  stem: z.string(),
  options: z.array(z.object({ key: z.string(), text: z.string() })).min(2),
  correct_keys: z.array(z.string()).min(1),
  explanation: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  marks: z.number().optional(),
  exam_id: z.string().uuid().optional(),
  exam_title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const EXTRACTION_REGISTRY: Record<TargetEntity, RegistryEntry> = {
  certifications: {
    label: "Certifications",
    schema: CertSchema,
    system:
      "Extract certification catalog entries. Use the vendor's official naming. Slug must be lowercase, hyphenated. Description: 2–3 sentences. Skills and learning_outcomes are arrays of short strings.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.name, "name is required", errors);
      if (!out.slug && out.name) out.slug = slugify(out.name);
      if (out.slug) out.slug = slugify(out.slug);
      if (out.level) {
        const lv = String(out.level).toLowerCase();
        out.level = ["beginner", "intermediate", "advanced", "expert"].includes(lv) ? lv[0].toUpperCase() + lv.slice(1) : null;
      }
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row) => {
      const { data, error } = await supabaseAdmin
        .from("certifications_catalog")
        .insert({
          slug: row.slug,
          name: row.name,
          code: row.code ?? null,
          vendor: row.vendor ?? null,
          category: row.category ?? null,
          level: row.level ?? null,
          description: row.description ?? null,
          tagline: row.tagline ?? null,
          cost_usd: row.cost_usd ?? null,
          duration_minutes: row.duration_minutes ?? null,
          passing_score: row.passing_score ?? null,
          validity_years: row.validity_years ?? null,
          skills: row.skills ?? [],
          learning_outcomes: row.learning_outcomes ?? [],
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },

  study_resources: {
    label: "Study Resources",
    schema: ResourceSchema,
    system:
      "Extract study resource entries. resource_type MUST be one of: pdf, ppt, doc, video, audio, link, youtube, practice_guide, notes, cheat_sheet, lab_guide, case_study, assignment. access_tier is 'free' or 'paid'.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.title, "title is required", errors);
      if (out.resource_type) out.resource_type = String(out.resource_type).toLowerCase();
      if (!RESOURCE_TYPES.has(out.resource_type)) {
        errors.push(`resource_type "${out.resource_type}" invalid; defaulting to "link"`);
        out.resource_type = "link";
      }
      if (out.access_tier) out.access_tier = String(out.access_tier).toLowerCase();
      if (out.access_tier && !["free", "paid"].includes(out.access_tier)) {
        out.access_tier = "free";
      }
      if (out.certification_slug) out.certification_slug = slugify(out.certification_slug);
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row, ctx) => {
      const { data, error } = await supabaseAdmin
        .from("study_resources")
        .insert({
          title: row.title,
          description: row.description ?? null,
          certification_slug: row.certification_slug ?? null,
          module: row.module ?? null,
          topic: row.topic ?? null,
          resource_type: row.resource_type,
          external_url: row.external_url ?? null,
          access_tier: row.access_tier ?? "free",
          status: "draft",
          created_by: ctx.actorId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },

  mock_questions: {
    label: "Mock Exam Questions",
    schema: MockQSchema,
    system:
      "Extract or generate mock exam questions. Each question has a stem, 4 options (keys A,B,C,D), 1+ correct_keys referencing those keys, and a short explanation. difficulty: easy|medium|hard.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.stem, "stem is required", errors);
      if (!Array.isArray(out.options) || out.options.length < 2) errors.push("at least 2 options required");
      else {
        out.options = out.options.map((o: any, i: number) => ({
          key: o.key ?? String.fromCharCode(65 + i),
          text: String(o.text ?? ""),
        }));
      }
      if (!Array.isArray(out.correct_keys) || out.correct_keys.length === 0) errors.push("correct_keys required");
      else {
        const keys = new Set((out.options ?? []).map((o: any) => o.key));
        out.correct_keys = out.correct_keys.filter((k: string) => keys.has(k));
        if (out.correct_keys.length === 0) errors.push("correct_keys do not match any option key");
      }
      if (out.difficulty) out.difficulty = String(out.difficulty).toLowerCase();
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row) => {
      // Resolve exam_id by title if not provided
      let examId = row.exam_id as string | undefined;
      if (!examId && row.exam_title) {
        const { data: exam } = await supabaseAdmin
          .from("mock_exams")
          .select("id")
          .eq("title", row.exam_title)
          .maybeSingle();
        examId = exam?.id;
      }
      if (!examId) throw new Error("exam_id or exam_title required to commit mock question");

      const { data, error } = await supabaseAdmin
        .from("mock_exam_questions")
        .insert({
          exam_id: examId,
          question_text: row.stem,
          question_type: (row.correct_keys?.length ?? 1) > 1 ? "multi" : "single",
          options: row.options,
          correct_answers: row.correct_keys,
          explanation: row.explanation ?? null,
          marks: row.marks ?? 1,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },

  invoices: {
    label: "Invoices",
    schema: z.object({
      learner_email: z.string().email().optional(),
      learner_name: z.string().optional(),
      learner_id: z.string().uuid().optional(),
      description: z.string().optional(),
      plan_key: z.string().optional(),
      certification_slug: z.string().optional(),
      amount: z.number(),
      discount: z.number().optional(),
      tax: z.number().optional(),
      total: z.number().optional(),
      currency: z.string().optional(),
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
      issue_date: z.string().optional(),
      due_date: z.string().optional(),
      billing_address: z.string().optional(),
      tax_number: z.string().optional(),
    }),
    system:
      "Extract invoice rows. amount is required. status one of draft|sent|paid|overdue|cancelled. currency is ISO-4217 (default INR). Dates as YYYY-MM-DD. Resolve learner by email when learner_id is unknown.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.amount, "amount is required", errors);
      if (out.currency) out.currency = String(out.currency).toUpperCase();
      else out.currency = "INR";
      if (out.status) out.status = String(out.status).toLowerCase();
      out.discount = Number(out.discount ?? 0);
      out.tax = Number(out.tax ?? 0);
      out.amount = Number(out.amount ?? 0);
      if (out.total == null) out.total = Math.max(0, out.amount - out.discount + out.tax);
      if (!out.learner_id && !out.learner_email) errors.push("learner_id or learner_email required");
      if (out.certification_slug) out.certification_slug = slugify(out.certification_slug);
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row, ctx) => {
      let learnerId = row.learner_id as string | undefined;
      if (!learnerId && row.learner_email) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", row.learner_email)
          .maybeSingle();
        learnerId = prof?.id;
      }
      if (!learnerId) throw new Error("Cannot resolve learner_id from email");
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .insert({
          learner_id: learnerId,
          learner_email: row.learner_email ?? null,
          learner_name: row.learner_name ?? null,
          description: row.description ?? null,
          plan_key: row.plan_key ?? null,
          certification_slug: row.certification_slug ?? null,
          amount: row.amount,
          discount: row.discount ?? 0,
          tax: row.tax ?? 0,
          total: row.total ?? row.amount,
          currency: row.currency ?? "INR",
          status: row.status ?? "draft",
          issue_date: row.issue_date ?? new Date().toISOString().slice(0, 10),
          due_date: row.due_date ?? null,
          billing_address: row.billing_address ?? null,
          tax_number: row.tax_number ?? null,
          created_by: ctx.actorId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },

  payments: {
    label: "Payments",
    schema: z.object({
      invoice_number: z.string().optional(),
      invoice_id: z.string().uuid().optional(),
      learner_email: z.string().email().optional(),
      learner_id: z.string().uuid().optional(),
      amount: z.number(),
      currency: z.string().optional(),
      mode: z.enum(["upi", "bank_transfer", "card", "cash", "gateway"]).optional(),
      status: z.enum(["pending", "success", "failed", "refunded"]).optional(),
      transaction_id: z.string().optional(),
      paid_at: z.string().optional(),
      remarks: z.string().optional(),
    }),
    system:
      "Extract payment rows. amount required. mode one of upi|bank_transfer|card|cash|gateway. Link to invoice via invoice_number when invoice_id unknown.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.amount, "amount is required", errors);
      out.amount = Number(out.amount ?? 0);
      if (out.currency) out.currency = String(out.currency).toUpperCase();
      else out.currency = "INR";
      if (out.mode) out.mode = String(out.mode).toLowerCase();
      if (out.status) out.status = String(out.status).toLowerCase();
      if (!out.learner_id && !out.learner_email && !out.invoice_number && !out.invoice_id) {
        errors.push("learner_id, learner_email, invoice_id, or invoice_number required");
      }
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row) => {
      let invoiceId = row.invoice_id as string | undefined;
      let learnerId = row.learner_id as string | undefined;
      if (!invoiceId && row.invoice_number) {
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("id, learner_id")
          .eq("invoice_number", row.invoice_number)
          .maybeSingle();
        invoiceId = inv?.id;
        if (!learnerId) learnerId = inv?.learner_id;
      }
      if (!learnerId && row.learner_email) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", row.learner_email)
          .maybeSingle();
        learnerId = prof?.id;
      }
      if (!learnerId) throw new Error("Cannot resolve learner_id");
      const { data, error } = await supabaseAdmin
        .from("payments")
        .insert({
          invoice_id: invoiceId ?? null,
          learner_id: learnerId,
          amount: row.amount,
          currency: row.currency ?? "INR",
          mode: row.mode ?? "gateway",
          status: row.status ?? "success",
          transaction_id: row.transaction_id ?? null,
          paid_at: row.paid_at ?? new Date().toISOString(),
          remarks: row.remarks ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },


  milestones: {
    label: "Study Milestones",
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      due_date: z.string().optional(),
      order_index: z.number().int().optional(),
      milestone_type: z.enum(["study", "practice", "exam", "assessment", "review"]).optional(),
      success_criteria: z.string().optional(),
      estimated_hours: z.number().optional(),
      certification_slug: z.string().optional(),
      user_certification_id: z.string().uuid().optional(),
      user_id: z.string().uuid().optional(),
    }),
    system:
      "Extract or generate study milestones. Each milestone has a title, optional due_date (YYYY-MM-DD), milestone_type (study|practice|exam|assessment|review), and a short success_criteria sentence describing what 'done' looks like.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.title, "title is required", errors);
      if (out.milestone_type) out.milestone_type = String(out.milestone_type).toLowerCase();
      if (out.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(out.due_date))) {
        errors.push(`due_date "${out.due_date}" must be YYYY-MM-DD`);
      }
      if (out.certification_slug) out.certification_slug = slugify(out.certification_slug);
      if (!out.user_certification_id) errors.push("user_certification_id required to commit milestone");
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row, ctx) => {
      let userId = row.user_id as string | undefined;
      let slug = row.certification_slug as string | undefined;
      if (!userId || !slug) {
        const { data: uc } = await supabaseAdmin
          .from("user_certifications")
          .select("user_id, certification_slug")
          .eq("id", row.user_certification_id)
          .maybeSingle();
        userId = userId ?? uc?.user_id;
        slug = slug ?? uc?.certification_slug;
      }
      if (!userId || !slug) throw new Error("Cannot resolve user_id / certification_slug for milestone");
      const desc = [row.description, row.success_criteria ? `Success: ${row.success_criteria}` : null]
        .filter(Boolean).join("\n\n") || null;
      const { data, error } = await supabaseAdmin
        .from("study_milestones")
        .insert({
          user_id: userId,
          user_certification_id: row.user_certification_id,
          certification_slug: slug,
          title: row.title,
          description: desc,
          due_date: row.due_date ?? null,
          order_index: row.order_index ?? 0,
          milestone_type: row.milestone_type ?? "study",
          source: "ai",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      void ctx;
      return data.id as string;
    },
  },

  learning_paths: {
    label: "Learning Paths",
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      target_certification_slug: z.string().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      estimated_hours: z.number().optional(),
      steps: z.array(z.object({
        title: z.string(),
        topics: z.array(z.string()).optional(),
        estimated_hours: z.number().optional(),
        resource_hints: z.array(z.string()).optional(),
      })).optional(),
      prerequisites: z.array(z.string()).optional(),
      assessments: z.array(z.object({
        title: z.string(),
        kind: z.string().optional(),
        passing_score: z.number().optional(),
      })).optional(),
      org_id: z.string().uuid().optional(),
    }),
    system:
      "Extract or design a learning path. Order steps from foundational to advanced. Each step has a title and 3-7 topics. Prerequisites are short capability statements. Assessments describe checkpoints (quiz, lab, mock exam) with optional passing_score.",
    normalize: (raw) => {
      const errors: string[] = [];
      const out: any = { ...raw };
      need(out.title, "title is required", errors);
      if (out.target_certification_slug) out.target_certification_slug = slugify(out.target_certification_slug);
      if (out.difficulty) out.difficulty = String(out.difficulty).toLowerCase();
      out.steps = Array.isArray(out.steps) ? out.steps : [];
      out.prerequisites = Array.isArray(out.prerequisites) ? out.prerequisites : [];
      out.assessments = Array.isArray(out.assessments) ? out.assessments : [];
      return { normalized: out, errors };
    },
    commit: async (supabaseAdmin, row, ctx) => {
      const { data, error } = await supabaseAdmin
        .from("learning_paths")
        .insert({
          org_id: row.org_id ?? null,
          title: row.title,
          description: row.description ?? null,
          target_certification_slug: row.target_certification_slug ?? null,
          difficulty: row.difficulty ?? null,
          estimated_hours: row.estimated_hours ?? null,
          steps: row.steps ?? [],
          prerequisites: row.prerequisites ?? [],
          assessments: row.assessments ?? [],
          status: "draft",
          created_by: ctx.actorId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
  },
};


export function isTargetEntity(s: string): s is TargetEntity {
  return s in EXTRACTION_REGISTRY;
}
