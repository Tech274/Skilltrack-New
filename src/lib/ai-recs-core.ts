// Pure helpers for next-cert recommendations, extracted so they can be
// tested in isolation without booting the server-function runtime.

import { z } from "zod";

export const recsSchema = z.object({
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

export type RecsParsed = z.infer<typeof recsSchema>;

export type CertPick = {
  slug: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type CatalogItem = { slug: string; roiScore?: number };

/** Deterministic ROI-sorted fallback. */
export function deterministicPicks(pool: CatalogItem[]): CertPick[] {
  return pool
    .slice()
    .sort((a, b) => (b.roiScore ?? 0) - (a.roiScore ?? 0))
    .slice(0, 3)
    .map((c) => ({
      slug: c.slug,
      reason: `High ROI pick (${c.roiScore}) aligned with your goals.`,
      priority: "medium" as const,
    }));
}

/** Validate parsed model output against the allowed slug set and coerce priority. */
export function normalizeRecommendations(
  parsed: RecsParsed,
  allowedSlugs: Iterable<string>,
): CertPick[] {
  const valid = new Set(allowedSlugs);
  return (parsed.recommendations ?? [])
    .filter((r) => r && valid.has(r.slug))
    .map((r) => ({
      slug: r.slug,
      reason: r.reason ?? "",
      priority: (["high", "medium", "low"].includes(String(r.priority))
        ? r.priority
        : "medium") as "high" | "medium" | "low",
    }))
    .slice(0, 3);
}

/**
 * Final shape returned by the recommendation endpoint — guarantees a
 * user-friendly message and a non-empty picks array even when the AI fails.
 */
export type RecsResponse = {
  ok: true;
  message: string;
  source: "ai" | "ai_retry" | "deterministic";
  fallback: boolean;
  rationale: string;
  recommendations: CertPick[];
};

export function buildResponse(args: {
  parsed: RecsParsed;
  pool: CatalogItem[];
  allowedSlugs: Iterable<string>;
  source: "ai" | "ai_retry" | "deterministic";
  baseMessage: string;
  avoidCount: number;
}): RecsResponse {
  let recs = normalizeRecommendations(args.parsed, args.allowedSlugs);
  let fallback = false;
  let source = args.source;
  if (recs.length === 0) {
    recs = deterministicPicks(args.pool);
    fallback = true;
    source = "deterministic";
  }
  return {
    ok: true,
    message: args.baseMessage,
    source,
    fallback,
    rationale:
      args.parsed.rationale ||
      (args.avoidCount
        ? "Personalized picks, tuned to skip suggestions you previously flagged as unhelpful."
        : args.baseMessage),
    recommendations: recs,
  };
}
