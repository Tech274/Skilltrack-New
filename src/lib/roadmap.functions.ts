import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type RoadmapMilestone = { title: string; week: number };

export type RoadmapStep = {
  slug: string;
  name: string;
  code: string | null;
  vendor: string | null;
  category: string | null;
  level: string | null;
  tagline: string | null;
  costUsd: number | null;
  skills: string[];
  weeks: number;
  studyHours: number;
  reason: string;
  pathTitle: string | null;
  milestones: RoadmapMilestone[];
};

export type RoadmapResult = {
  steps: RoadmapStep[];
  totalWeeks: number;
  totalCostUsd: number;
  source: "database";
};

const inputSchema = z.object({
  currentRole: z.string().min(1).max(120),
  targetRole: z.string().min(1).max(120),
  experienceYears: z.number().min(0).max(50),
  hoursPerWeek: z.number().min(1).max(60),
  interests: z.array(z.string().max(60)).max(20).default([]),
});

const LEVEL_HOURS: Record<string, number> = {
  Beginner: 40,
  Intermediate: 70,
  Advanced: 110,
  Expert: 150,
};

const LEVEL_ORDER: Record<string, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Expert: 3,
};

/** Keyword hints used to match a free-text target role to catalog categories. */
const ROLE_CATEGORY_HINTS: Array<{ match: RegExp; categories: string[] }> = [
  { match: /security|soc|ciso|grc|pentest/i, categories: ["Security", "Cloud"] },
  { match: /devops|sre|platform|reliab|kubernetes|infra/i, categories: ["DevOps", "Cloud"] },
  { match: /data engineer|analytics|data platform|warehouse|etl/i, categories: ["Data", "Cloud"] },
  { match: /\bai\b|ml|machine learning|genai|llm|scientist/i, categories: ["AI & ML", "Data"] },
  { match: /salesforce|crm/i, categories: ["CRM"] },
  { match: /architect|cloud|solution|azure|aws|gcp/i, categories: ["Cloud", "DevOps"] },
];

function categoriesForRole(targetRole: string, interests: string[]): string[] {
  const blob = [targetRole, ...interests].join(" ");
  const hits = ROLE_CATEGORY_HINTS.filter((h) => h.match.test(blob)).flatMap((h) => h.categories);
  const unique = Array.from(new Set(hits));
  return unique.length ? unique : ["Cloud", "DevOps", "Security", "Data", "AI & ML", "CRM"];
}

/**
 * Builds a certification roadmap from the real catalog + published learning paths
 * in the database. Deterministic: no AI, no invented certifications.
 */
export const buildSkillRoadmap = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<RoadmapResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: certs, error } = await supabaseAdmin
      .from("certifications_catalog")
      .select(
        "slug, name, code, vendor, category, level, tagline, description, cost_usd, skills, learning_outcomes, status, org_id",
      )
      .eq("status", "published")
      .is("org_id", null);
    if (error) throw new Error(error.message);

    const { data: paths } = await supabaseAdmin
      .from("learning_paths")
      .select("title, target_certification_slug, steps, estimated_hours, status, org_id")
      .eq("status", "published")
      .is("org_id", null);

    const pathBySlug = new Map<string, any>();
    for (const p of paths ?? []) {
      if (p.target_certification_slug && !pathBySlug.has(p.target_certification_slug)) {
        pathBySlug.set(p.target_certification_slug, p);
      }
    }

    const wanted = categoriesForRole(data.targetRole, data.interests);
    const interestBlob = data.interests.join(" ").toLowerCase();

    const scored = (certs ?? [])
      .map((c) => {
        const category = c.category ?? "";
        let score = wanted.includes(category) ? 100 - wanted.indexOf(category) * 10 : 0;
        if (interestBlob) {
          const hay = `${c.name} ${c.vendor ?? ""} ${(c.skills ?? []).join(" ")}`.toLowerCase();
          for (const term of data.interests) {
            if (term && hay.includes(term.toLowerCase())) score += 15;
          }
        }
        // Match difficulty to experience: juniors start lower, seniors skip basics.
        const lvl = LEVEL_ORDER[c.level ?? "Intermediate"] ?? 1;
        const targetLvl = data.experienceYears < 2 ? 0 : data.experienceYears < 5 ? 1 : 2;
        score -= Math.abs(lvl - targetLvl) * 8;
        return { cert: c, score, lvl };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.lvl - b.lvl);

    const chosen: typeof scored = [];
    const seenCategory = new Map<string, number>();
    for (const s of scored) {
      const cat = s.cert.category ?? "";
      const count = seenCategory.get(cat) ?? 0;
      if (count >= 2) continue;
      seenCategory.set(cat, count + 1);
      chosen.push(s);
      if (chosen.length >= 4) break;
    }
    // Study easiest first so the roadmap builds up.
    chosen.sort((a, b) => a.lvl - b.lvl);

    let weekCursor = 0;
    const steps: RoadmapStep[] = chosen.map(({ cert }) => {
      const path = pathBySlug.get(cert.slug);
      const hours =
        (path?.estimated_hours ? Number(path.estimated_hours) : null) ??
        LEVEL_HOURS[cert.level ?? "Intermediate"] ??
        70;
      const weeks = Math.max(1, Math.ceil(hours / data.hoursPerWeek));

      const pathSteps: any[] = Array.isArray(path?.steps) ? path.steps : [];
      const titles: string[] = pathSteps.length
        ? pathSteps
            .map((s: any) => String(s?.title ?? s?.name ?? "").trim())
            .filter(Boolean)
            .slice(0, 6)
        : (cert.learning_outcomes ?? []).slice(0, 6);

      const milestones: RoadmapMilestone[] = titles.map((title, i) => ({
        title,
        week: weekCursor + Math.max(1, Math.round(((i + 1) / Math.max(titles.length, 1)) * weeks)),
      }));
      if (milestones.length) {
        milestones.push({ title: `Sit the ${cert.code ?? cert.name} exam`, week: weekCursor + weeks });
      }

      weekCursor += weeks;

      return {
        slug: cert.slug,
        name: cert.name,
        code: cert.code,
        vendor: cert.vendor,
        category: cert.category,
        level: cert.level,
        tagline: cert.tagline,
        costUsd: cert.cost_usd === null ? null : Number(cert.cost_usd),
        skills: cert.skills ?? [],
        weeks,
        studyHours: Math.round(hours),
        reason: `${cert.category ?? "Core"} credential matched to "${data.targetRole}"${
          path ? ` — follows the published "${path.title}" learning path.` : "."
        }`,
        pathTitle: path?.title ?? null,
        milestones,
      };
    });

    return {
      steps,
      totalWeeks: weekCursor,
      totalCostUsd: steps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0),
      source: "database",
    };
  });
