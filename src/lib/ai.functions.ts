import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { certifications, roleToCerts } from "@/lib/certifications";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL_ID = "google/gemini-3-flash-preview";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return createLovableAiGatewayProvider(key);
}

/* ---------------- Career Advisor (public) ---------------- */

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      currentRole: z.string().min(1),
      targetRole: z.string().min(1),
      experienceYears: z.number().min(0).max(50),
      hoursPerWeek: z.number().min(1).max(60),
      interests: z.string().max(500).optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const gateway = getGateway();
    const catalog = certifications
      .map((c) => `- ${c.slug} | ${c.name} (${c.vendor}, ${c.difficulty}, $${c.cost}, ROI ${c.roiScore}, +$${c.avgSalary})`)
      .join("\n");
    const slugs = certifications.map((c) => c.slug);
    const baseline = roleToCerts[data.targetRole] ?? [];

    const prompt = `You are a certification strategist for SkillTrack-365.
Build a 3-step certification roadmap for the user.

Current role: ${data.currentRole}
Target role: ${data.targetRole}
Experience: ${data.experienceYears} years
Available: ${data.hoursPerWeek} hours/week
Interests: ${data.interests || "n/a"}

Catalog (slug | name):
${catalog}

Hints for target role: ${baseline.join(", ") || "none"}

Pick exactly 3 certifications, ordered foundational → advanced. Only use slugs from the catalog.
For each: explain why it matters for this user, estimated weeks (based on hours/week), and the projected salary lift in USD.
Also write a 2-sentence overall strategy.`;

    const { experimental_output } = await generateText({
      model: gateway(MODEL_ID),
      experimental_output: Output.object({
        schema: z.object({
          strategy: z.string(),
          steps: z
            .array(
              z.object({
                slug: z.enum(slugs as [string, ...string[]]),
                reason: z.string(),
                weeks: z.number(),
                salaryLiftUsd: z.number(),
              }),
            )
            .min(1)
            .max(4),
        }),
      }),
      prompt,
    });

    return experimental_output;
  });

/* ---------------- Pass Predictor (public) ---------------- */

export const predictPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      certificationSlug: z.string().min(1),
      studyHours: z.number().min(0).max(1000),
      mockScore: z.number().min(0).max(100),
      courseCompletion: z.number().min(0).max(100),
      practiceCount: z.number().min(0).max(200).default(0),
      daysToExam: z.number().min(0).max(720).default(30),
    }),
  )
  .handler(async ({ data }) => {
    const cert = certifications.find((c) => c.slug === data.certificationSlug);
    if (!cert) throw new Error("Unknown certification");

    // Deterministic baseline score (so result is meaningful even without AI judgement).
    const difficultyFactor: Record<string, number> = {
      Beginner: 1.1,
      Intermediate: 1.0,
      Advanced: 0.9,
      Expert: 0.82,
    };
    const f = difficultyFactor[cert.difficulty] ?? 1;
    const hoursTerm = Math.min(data.studyHours / Math.max(40, cert.durationMin / 2), 1) * 25;
    const mockTerm = (data.mockScore / 100) * 45;
    const completionTerm = (data.courseCompletion / 100) * 20;
    const practiceTerm = Math.min(data.practiceCount, 50) * 0.2;
    const raw = (hoursTerm + mockTerm + completionTerm + practiceTerm) * f;
    let probability = Math.max(5, Math.min(98, Math.round(raw)));

    // Calibration: nudge probability by aggregated user feedback on this cert.
    // Thumbs-down on past predictions for this slug → predictor was too optimistic; trim it back.
    // Thumbs-up → keep as-is. We also pull global accuracy as a smaller nudge.
    let calibrationNote = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
      const { data: fb } = await supabaseAdmin
        .from("ai_feedback")
        .select("rating, target_payload")
        .eq("feature", "pass_predictor")
        .gte("created_at", since)
        .limit(500);
      if (fb && fb.length) {
        const forSlug = fb.filter((r) => {
          const p = (r.target_payload ?? {}) as { slug?: string };
          return p.slug === data.certificationSlug;
        });
        const pool = forSlug.length >= 5 ? forSlug : fb;
        const avg = pool.reduce((s, r) => s + (r.rating ?? 0), 0) / pool.length;
        // avg in [-1, 1]; convert to ±6pp swing.
        const delta = Math.round(avg * 6);
        if (delta !== 0) {
          probability = Math.max(5, Math.min(98, probability + delta));
          calibrationNote =
            delta < 0
              ? ` Adjusted ${Math.abs(delta)}pp lower based on past learner feedback.`
              : ` Adjusted ${delta}pp higher based on past learner feedback.`;
        }
      }
    } catch {
      /* feedback recalibration is best-effort */
    }

    // Deterministic fallback when the AI response doesn't match the schema
    // (Gemini occasionally returns truncated/non-conforming JSON).
    const fallback = {
      summary: `Estimated pass probability is ${probability}% for ${cert.name}.`,
      risks: [
        data.mockScore < 70 ? "Mock scores below the 70% safety zone." : "Limited recent mock attempts.",
        data.courseCompletion < 80 ? "Course completion under 80%." : "Advanced topics may need review.",
        data.daysToExam < 14 ? "Tight runway to exam day." : "Retention risk without spaced practice.",
      ].slice(0, 4),
      nextActions: [
        "Take a full-length timed mock and review every miss.",
        "Build a daily 45–60 min focused study block on the weakest domain.",
        data.practiceCount < 50
          ? "Complete at least 50 practice questions this week."
          : "Drill scenario-based questions on weak domains.",
      ],
    };

    let out: { summary: string; risks: string[]; nextActions: string[] } = fallback;
    try {
      const gateway = getGateway();
      const { experimental_output } = await generateText({
        model: gateway(MODEL_ID),
        experimental_output: Output.object({
          schema: z.object({
            summary: z.string(),
            risks: z.array(z.string()).min(1).max(4),
            nextActions: z.array(z.string()).min(2).max(5),
          }),
        }),
        prompt: `You are an exam coach. The pass probability for ${cert.name} (${cert.code}) is ${probability}%.
Inputs: studyHours=${data.studyHours}, mockScore=${data.mockScore}%, completion=${data.courseCompletion}%, practiceQs=${data.practiceCount}, daysToExam=${data.daysToExam}, difficulty=${cert.difficulty}.
Return STRICT JSON matching the schema: a 1-sentence summary, 1-4 concrete risks, and 2-5 actionable next steps. Be specific and quantitative. No prose outside JSON.`,
      });
      out = experimental_output;
    } catch (err) {
      console.warn("[predictPass] AI schema parse failed, using deterministic fallback:", (err as Error)?.message);
    }

    return {
      probability,
      ...out,
      summary: out.summary + calibrationNote,
    };
  });


/* ---------------- Milestone Generator (authenticated) ---------------- */

export const generateMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userCertificationId: z.string().uuid(),
      certificationSlug: z.string().min(1),
      targetDate: z.string().optional(),
      hoursPerWeek: z.number().min(1).max(60).default(8),
    }),
  )
  .handler(async ({ data, context }) => {
    const cert = certifications.find((c) => c.slug === data.certificationSlug);
    if (!cert) throw new Error("Unknown certification");

    const gateway = getGateway();
    const exam = data.targetDate
      ? new Date(data.targetDate)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 56);
    const weeks = Math.max(2, Math.ceil((exam.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)));

    const { experimental_output } = await generateText({
      model: gateway(MODEL_ID),
      experimental_output: Output.object({
        schema: z.object({
          milestones: z
            .array(
              z.object({
                title: z.string(),
                description: z.string(),
                week: z.number().min(1),
                type: z.enum(["study", "practice", "mock", "review", "exam"]),
              }),
            )
            .min(4)
            .max(10),
        }),
      }),
      prompt: `Build a week-by-week study roadmap for ${cert.name} (${cert.code}).
Total weeks available: ${weeks}. Hours/week: ${data.hoursPerWeek}.
Exam domains: ${cert.domains.map((d) => `${d.name} (${d.weight}%)`).join("; ")}.
Output 4-10 ordered milestones. Front-load study, then practice questions, at least 2 mock exams, a review week, and a final exam milestone in the last week. Each title <= 60 chars.`,
    });

    const { supabase, userId } = context;
    // Clear existing AI milestones for a clean regeneration
    await supabase
      .from("study_milestones")
      .delete()
      .eq("user_certification_id", data.userCertificationId)
      .eq("source", "ai");

    const startMs = Date.now();
    const rows = experimental_output.milestones.map((m, i) => {
      const due = new Date(startMs + m.week * 7 * 24 * 60 * 60 * 1000);
      return {
        user_id: userId,
        user_certification_id: data.userCertificationId,
        certification_slug: data.certificationSlug,
        title: m.title,
        description: m.description,
        due_date: due.toISOString().slice(0, 10),
        order_index: i,
        milestone_type: m.type,
        source: "ai",
      };
    });

    const { error } = await supabase.from("study_milestones").insert(rows);
    if (error) throw error;
    return { inserted: rows.length };
  });

/* ---------------- Personalized next-cert recommendations (authenticated) ---------------- */

export const recommendNextCerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({}).optional())
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: userCerts }, { data: bookmarks }, { data: feedback }] = await Promise.all([
      supabase.from("profiles").select("display_name, headline, target_role, country").eq("id", userId).maybeSingle(),
      supabase.from("user_certifications").select("certification_slug, status, mock_score, study_hours"),
      supabase.from("user_bookmarks").select("certification_slug"),
      supabase
        .from("ai_feedback")
        .select("feature, rating, target_id, created_at")
        .eq("user_id", userId)
        .in("feature", ["next_cert", "career_advisor"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const ownedSlugs = new Set((userCerts ?? []).map((c) => c.certification_slug));
    const available = certifications.filter((c) => !ownedSlugs.has(c.slug));
    const slugs = available.map((c) => c.slug);
    if (slugs.length === 0) {
      return { recommendations: [], rationale: "You already track every certification in the catalog." };
    }

    // Aggregate per-slug feedback: avoid slugs the learner repeatedly rated down,
    // and boost slugs adjacent to ones they rated up.
    const slugScore = new Map<string, number>();
    for (const f of feedback ?? []) {
      if (f.feature !== "next_cert" || !f.target_id) continue;
      slugScore.set(f.target_id, (slugScore.get(f.target_id) ?? 0) + (f.rating ?? 0));
    }
    const avoid = [...slugScore.entries()].filter(([, s]) => s <= -1).map(([s]) => s);
    const liked = [...slugScore.entries()].filter(([, s]) => s >= 1).map(([s]) => s);
    const trimmed = available.filter((c) => !avoid.includes(c.slug));
    const finalPool = trimmed.length >= 3 ? trimmed : available;
    const finalSlugs = finalPool.map((c) => c.slug);

    const gateway = getGateway();

    // Configurable fallback strategy: admin DB setting wins over env var.
    //   "deterministic" → skip the model entirely, return ROI-sorted picks.
    //   "ai" (default)  → try the model with a single retry, fall back deterministically.
    let strategy = (process.env.AI_RECS_STRATEGY || "ai").toLowerCase();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: setting } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "ai_recs_strategy")
        .maybeSingle();
      const dbVal = setting?.value;
      if (typeof dbVal === "string" && (dbVal === "ai" || dbVal === "deterministic")) strategy = dbVal;
    } catch (e) {
      console.warn("[recommendNextCerts] could not read ai_recs_strategy from app_settings", e);
    }
    console.info("[recommendNextCerts] strategy resolved", { userId, strategy });

    const deterministicPicks = () =>
      finalPool
        .slice()
        .sort((a, b) => (b.roiScore ?? 0) - (a.roiScore ?? 0))
        .slice(0, 3)
        .map((c) => ({
          slug: c.slug,
          reason: `High ROI pick (${c.roiScore}) aligned with your goals.`,
          priority: "medium" as const,
        }));

    const schema = z.object({
      rationale: z.string().optional(),
      recommendations: z
        .array(
          z.object({
            slug: z.string(),
            reason: z.string().optional(),
            priority: z.string().optional(),
          }),
        )
        .optional(),
    });

    const buildPrompt = (strict: boolean) => `Recommend up to 3 next certifications for this learner.
Profile: target role = ${profile?.target_role ?? "unspecified"}, headline = ${profile?.headline ?? "n/a"}, country = ${profile?.country ?? "n/a"}.
Already tracking: ${[...ownedSlugs].join(", ") || "none"}.
Bookmarked: ${(bookmarks ?? []).map((b) => b.certification_slug).join(", ") || "none"}.
Previously DISLIKED (avoid recommending these): ${avoid.join(", ") || "none"}.
Previously LIKED (favor similar): ${liked.join(", ") || "none"}.

Available slugs to choose from (you MUST use these exact slugs):
${finalPool.map((c) => `- ${c.slug} | ${c.name} (${c.vendor}, ${c.difficulty}, ROI ${c.roiScore}, +$${c.avgSalary})`).join("\n")}

Pick complementary certs that grow earning potential and match the target role. Strongly avoid slugs in the DISLIKED list.
${strict ? `\nSTRICT OUTPUT RULES — your previous response failed schema validation:
- Respond with JSON only matching the schema exactly.
- "priority" MUST be exactly one of: "high", "medium", "low" (lowercase string).
- "slug" MUST match one of the allowed slugs verbatim.
- Do NOT add commentary, markdown, or extra fields.` : `\nPriority must be one of: high, medium, low.`}`;

    const callModel = async (strict: boolean) => {
      const { experimental_output, text } = await generateText({
        model: gateway(MODEL_ID),
        experimental_output: Output.object({ schema }),
        prompt: buildPrompt(strict),
      });
      console.info("[recommendNextCerts] raw model response", {
        userId,
        strict,
        rawLength: text?.length ?? 0,
        rawPreview: (text ?? "").slice(0, 400),
      });
      return experimental_output ?? {};
    };

    type Parsed = z.infer<typeof schema>;
    let parsed: Parsed = {};
    let source: "ai" | "ai_retry" | "deterministic" = "deterministic";
    let userMessage = "Personalized picks based on your goals and current plan.";

    if (strategy === "deterministic") {
      userMessage = "Showing ROI-ranked picks (AI recommendations disabled by configuration).";
    } else {
      try {
        parsed = await callModel(false);
        source = "ai";
      } catch (err: any) {
        console.warn("[recommendNextCerts] first attempt failed schema validation", {
          userId,
          error: err?.message ?? String(err),
        });
        try {
          parsed = await callModel(true);
          source = "ai_retry";
        } catch (err2: any) {
          console.error("[recommendNextCerts] retry also failed; falling back to deterministic", {
            userId,
            error: err2?.message ?? String(err2),
          });
          userMessage =
            "We couldn't generate fresh AI recommendations right now — showing high-ROI picks from our catalog instead.";
        }
      }
    }

    const valid = new Set(finalSlugs);
    let recommendations = (parsed.recommendations ?? [])
      .filter((r) => r && valid.has(r.slug))
      .map((r) => ({
        slug: r.slug,
        reason: r.reason ?? "",
        priority: (["high", "medium", "low"].includes(String(r.priority)) ? r.priority : "medium") as
          | "high"
          | "medium"
          | "low",
      }))
      .slice(0, 3);

    let fallback = false;
    if (recommendations.length === 0) {
      recommendations = deterministicPicks();
      fallback = true;
      source = "deterministic";
    }

    // Best-effort audit trail (never blocks the response).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin.from("ai_recs_audit" as any) as any).insert({
        user_id: userId,
        strategy,
        source,
        fallback,
        message: userMessage,
        error: null,
        recommendation_count: recommendations.length,
      });
    } catch (e) {
      console.warn("[recommendNextCerts] audit insert failed", e);
    }

    return {
      ok: true,
      message: userMessage,
      source,
      fallback,
      rationale:
        parsed.rationale ||
        (avoid.length
          ? "Personalized picks, tuned to skip suggestions you previously flagged as unhelpful."
          : userMessage),
      recommendations,
    };
  });

