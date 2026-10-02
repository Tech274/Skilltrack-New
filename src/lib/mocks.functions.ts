import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const logMockResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userCertificationId: z.string().uuid(),
      certificationSlug: z.string().min(1),
      score: z.number().min(0).max(100),
      passingScore: z.number().min(0).max(100).default(70),
      provider: z.string().max(120).optional(),
      durationMinutes: z.number().min(0).max(600).optional(),
      notes: z.string().max(1500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: insErr } = await supabase.from("mock_exam_results").insert({
      user_id: userId,
      user_certification_id: data.userCertificationId,
      certification_slug: data.certificationSlug,
      score: data.score,
      passing_score: data.passingScore,
      provider: data.provider ?? null,
      duration_minutes: data.durationMinutes ?? null,
      notes: data.notes ?? null,
    });
    if (insErr) throw insErr;

    // Update rolling mock_score (avg of last 3)
    const { data: recent } = await supabase
      .from("mock_exam_results")
      .select("score")
      .eq("user_certification_id", data.userCertificationId)
      .order("taken_at", { ascending: false })
      .limit(3);
    const avg =
      (recent ?? []).reduce((s, r) => s + Number(r.score), 0) / Math.max(1, (recent ?? []).length);
    await supabase
      .from("user_certifications")
      .update({ mock_score: Math.round(avg * 10) / 10 })
      .eq("id", data.userCertificationId);

    // Auto-complete next pending "mock" milestone
    const { data: ms } = await supabase
      .from("study_milestones")
      .select("id")
      .eq("user_certification_id", data.userCertificationId)
      .eq("milestone_type", "mock")
      .is("completed_at", null)
      .order("order_index", { ascending: true })
      .limit(1);
    if (ms && ms[0]) {
      await supabase
        .from("study_milestones")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", ms[0].id);
    }

    return { ok: true, averageMockScore: avg };
  });

export const listMockResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userCertificationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("mock_exam_results")
      .select("id, score, passing_score, taken_at, provider, notes")
      .eq("user_certification_id", data.userCertificationId)
      .order("taken_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return rows ?? [];
  });
