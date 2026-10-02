import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      feature: z.enum(["career_advisor", "pass_predictor", "milestone", "next_cert"]),
      rating: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      targetId: z.string().max(200).optional(),
      targetPayload: z.record(z.string(), z.unknown()).optional(),
      comment: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ai_feedback").insert({
      user_id: userId,
      feature: data.feature,
      rating: data.rating,
      target_id: data.targetId ?? null,
      target_payload: (data.targetPayload as never) ?? null,
      comment: data.comment ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });
