import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL_ID = "google/gemini-3-flash-preview";

const FORM_KEYS = [
  "certification",
  "study_resource",
  "mock_question",
  "mock_exam",
  "milestone",
  "learning_path",
  "organization",
  "org_settings",
  "invoice_email_template",
] as const;

const Input = z.object({
  formKey: z.enum(FORM_KEYS),
  prompt: z.string().min(2).max(4000),
  currentValues: z.record(z.string(), z.unknown()).optional().default({}),
  context: z.string().max(2000).optional(),
  org_id: z.string().uuid().nullable().optional(),
});

export const autofillForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(Input)
  .handler(async ({ data, context }) => {
    // Only admins / content roles can use AI autofill
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isFinance } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "finance_admin" as any,
    });
    const { data: isContent } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "content_admin" as any,
    });
    if (!isAdmin && !isFinance && !isContent) {
      throw new Error("Forbidden");
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const { AUTOFILL_REGISTRY } = await import("./ai-autofill-schemas.server");
    const entry = AUTOFILL_REGISTRY[data.formKey];
    if (!entry) throw new Error(`Unknown formKey: ${data.formKey}`);

    const { resolveActivePrompt } = await import("./ai-prompt-resolver.server");
    const { readEffectiveAiDefaults } = await import("./admin-ai-defaults.functions");
    const { resolveCallerOrgId } = await import("./ai-org-scope.server");
    const { withAiTimeout, extractUsage } = await import("./ai-call.server");
    const orgId = await resolveCallerOrgId(context, data.org_id ?? undefined, { area: "autofill", action: data.formKey });
    const defaults = await readEffectiveAiDefaults(orgId);
    const resolved = await resolveActivePrompt(data.formKey, entry.system);
    const modelId = resolved.model || defaults.default_model || MODEL_ID;

    const gateway = createLovableAiGatewayProvider(key);

    const userPrompt = [
      `Form: ${data.formKey}`,
      data.context ? `Context:\n${data.context}` : "",
      `Current values (only override when you have a better answer):`,
      "```json",
      JSON.stringify(data.currentValues ?? {}, null, 2),
      "```",
      `User instruction:\n${data.prompt}`,
      `Return ONLY fields you are confident about. Leave others out.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const startedAt = Date.now();
      const result = await withAiTimeout(async (signal) =>
        await generateText({
          model: gateway(modelId),
          system: resolved.system,
          experimental_output: Output.object({ schema: entry.schema }),
          prompt: userPrompt,
          abortSignal: signal,
          maxOutputTokens: defaults.max_output_tokens,
        }),
        defaults.llm_timeout_ms,
      );
      const durationMs = Date.now() - startedAt;
      const usage = extractUsage(result);
      const suggestions = (((result as any).experimental_output) ?? {}) as Record<string, unknown>;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ai_action_audit").insert({
        actor_id: context.userId,
        org_id: orgId,
        area: "autofill",
        action: data.formKey,
        prompt: data.prompt,
        model: modelId,
        prompt_version_id: resolved.versionId,
        payload: {
          fields: Object.keys(suggestions),
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

      return { suggestions: suggestions as Record<string, string | number | boolean | null | string[]> };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("AI rate limit exceeded. Try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI autofill failed: ${msg}`);
    }
  });
