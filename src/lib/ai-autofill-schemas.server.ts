import { z } from "zod";

/**
 * Server-only registry of Zod schemas + system prompts for AI form auto-fill.
 * Each entry defines the shape AI must return and the domain prompt.
 * Adding a new form = add a new key here, no other server changes needed.
 */
export type AutofillFormKey =
  | "certification"
  | "study_resource"
  | "mock_question"
  | "mock_exam"
  | "milestone"
  | "learning_path"
  | "organization"
  | "org_settings"
  | "invoice_email_template";

type Entry = {
  schema: z.ZodTypeAny;
  system: string;
};

export const AUTOFILL_REGISTRY: Record<AutofillFormKey, Entry> = {
  certification: {
    schema: z.object({
      slug: z.string().optional(),
      name: z.string().optional(),
      code: z.string().optional(),
      vendor: z.string().optional(),
      category: z.string().optional(),
      level: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
      tagline: z.string().optional(),
      description: z.string().optional(),
      cost_usd: z.number().optional(),
      duration_minutes: z.number().int().optional(),
      passing_score: z.number().optional(),
      validity_years: z.number().int().optional(),
      skills: z.array(z.string()).optional(),
      learning_outcomes: z.array(z.string()).optional(),
    }),
    system:
      "You fill in fields for a certification catalog entry. Use accurate, vendor-published data when known. Slug: lowercase, hyphenated. Tagline: <=140 chars. Description: 2-3 sentences. Return only fields you can fill confidently; leave others undefined.",
  },
  study_resource: {
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      certification_slug: z.string().optional(),
      module: z.string().optional(),
      topic: z.string().optional(),
      resource_type: z
        .enum([
          "pdf", "ppt", "doc", "video", "audio", "link", "youtube",
          "practice_guide", "notes", "cheat_sheet", "lab_guide", "case_study", "assignment",
        ])
        .optional(),
      external_url: z.string().url().optional(),
      access_tier: z.enum(["free", "paid"]).optional(),
    }),
    system:
      "You fill fields for a study resource. Pick the best resource_type from the enum. Keep title concise.",
  },
  mock_question: {
    schema: z.object({
      stem: z.string().optional(),
      options: z
        .array(z.object({ key: z.string(), text: z.string() }))
        .optional(),
      correct_keys: z.array(z.string()).optional(),
      explanation: z.string().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.array(z.string()).optional(),
    }),
    system:
      "You draft a single mock exam question. Provide 4 plausible options with keys A,B,C,D. correct_keys must reference option keys. Explanation 1-3 sentences.",
  },
  mock_exam: {
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      certification_slug: z.string().optional(),
      time_limit_minutes: z.number().int().optional(),
      passing_score: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    }),
    system: "You fill metadata for a mock exam. Be specific to the certification.",
  },
  milestone: {
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      due_date: z.string().optional(),
      estimated_hours: z.number().optional(),
    }),
    system:
      "You draft a study milestone. due_date in YYYY-MM-DD if a target date is implied.",
  },
  learning_path: {
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      target_certification_slug: z.string().optional(),
      estimated_hours: z.number().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      modules: z
        .array(
          z.object({
            title: z.string(),
            topics: z.array(z.string()).optional(),
            estimated_hours: z.number().optional(),
          }),
        )
        .optional(),
    }),
    system:
      "You design a learning path for a certification. Order modules from foundational to advanced. Each module has a clear title and 3-7 topics. Total estimated_hours = sum of module hours when known.",
  },
  organization: {
    schema: z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      industry: z.string().optional(),
      size_band: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).optional(),
      website: z.string().optional(),
      description: z.string().optional(),
    }),
    system: "You fill an organization profile. Slug: lowercase, hyphenated.",
  },
  org_settings: {
    schema: z.object({
      industry: z.string().optional(),
      size_band: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).optional(),
      website: z.string().optional(),
      description: z.string().optional(),
      program_template: z
        .object({
          default_certifications: z.array(z.string()).optional(),
          onboarding_weeks: z.number().optional(),
          required_assessments: z.array(z.string()).optional(),
          mentorship: z.enum(["none", "buddy", "coach"]).optional(),
          completion_criteria: z.string().optional(),
        })
        .optional(),
      settings: z
        .object({
          invoice_currency: z.string().optional(),
          invoice_terms_days: z.number().optional(),
          reminder_cadence_days: z.number().optional(),
          default_learner_role: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
    }),
    system:
      "You configure tenant-specific organization settings and a learner program template. Use the org's industry context. program_template.onboarding_weeks: integer 2-12. settings.invoice_currency: ISO-4217. Return only fields you can fill confidently.",
  },
  invoice_email_template: {
    schema: z.object({
      name: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      tone: z.enum(["friendly", "neutral", "firm"]).optional(),
    }),
    system:
      "You draft an invoice email template. Use {{invoice_number}}, {{amount}}, {{due_date}}, {{enterprise_name}} as merge tags where appropriate.",
  },
};
