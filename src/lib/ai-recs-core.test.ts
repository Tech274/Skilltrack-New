// Run with:  bunx vitest run src/lib/ai-recs-core.test.ts
//        or: bun test src/lib/ai-recs-core.test.ts
// These tests simulate mocked AI gateway responses and assert that the
// recommendation pipeline always returns a safe, schema-valid shape.

import { describe, it, expect } from "vitest";
import {
  buildResponse,
  deterministicPicks,
  normalizeRecommendations,
  recsSchema,
} from "./ai-recs-core";

const POOL = [
  { slug: "aws-saa", roiScore: 92 },
  { slug: "az-104", roiScore: 88 },
  { slug: "gcp-ace", roiScore: 81 },
  { slug: "ckad", roiScore: 75 },
];
const ALLOWED = POOL.map((c) => c.slug);

describe("recommendation core", () => {
  it("returns 3 deterministic ROI-sorted picks when AI output is empty", () => {
    const out = buildResponse({
      parsed: {},
      pool: POOL,
      allowedSlugs: ALLOWED,
      source: "ai",
      baseMessage: "default",
      avoidCount: 0,
    });
    expect(out.ok).toBe(true);
    expect(out.fallback).toBe(true);
    expect(out.source).toBe("deterministic");
    expect(out.recommendations).toHaveLength(3);
    expect(out.recommendations[0].slug).toBe("aws-saa");
    expect(out.recommendations.every((r) => ["high", "medium", "low"].includes(r.priority))).toBe(true);
  });

  it("filters hallucinated slugs from a mocked AI response", () => {
    const mockedAi = {
      rationale: "Stretch picks based on your roadmap.",
      recommendations: [
        { slug: "az-104", reason: "Cloud breadth", priority: "high" },
        { slug: "NOT-A-REAL-SLUG", reason: "bogus", priority: "low" },
        { slug: "ckad", reason: "Container depth", priority: "medium" },
      ],
    };
    const recs = normalizeRecommendations(mockedAi, ALLOWED);
    expect(recs.map((r) => r.slug)).toEqual(["az-104", "ckad"]);
    expect(recs[0].priority).toBe("high");
  });

  it("coerces invalid priority strings to 'medium'", () => {
    const recs = normalizeRecommendations(
      { recommendations: [{ slug: "aws-saa", priority: "URGENT" }] },
      ALLOWED,
    );
    expect(recs[0].priority).toBe("medium");
  });

  it("trims to a maximum of 3 recommendations", () => {
    const recs = normalizeRecommendations(
      {
        recommendations: ALLOWED.map((slug) => ({ slug, priority: "low" })),
      },
      ALLOWED,
    );
    expect(recs).toHaveLength(3);
  });

  it("returns deterministic ranking helper independently", () => {
    const picks = deterministicPicks(POOL);
    expect(picks.map((p) => p.slug)).toEqual(["aws-saa", "az-104", "gcp-ace"]);
  });

  it("validates schema accepts partial/missing fields without throwing", () => {
    expect(() => recsSchema.parse({})).not.toThrow();
    expect(() =>
      recsSchema.parse({ recommendations: [{ slug: "x" }] }),
    ).not.toThrow();
  });

  it("never throws on malformed AI payloads — always returns a safe response", () => {
    const malformedSamples: any[] = [
      null,
      undefined,
      { recommendations: "not-an-array" },
      { recommendations: [{ slug: 123 }] },
      "completely wrong type",
    ];
    for (const sample of malformedSamples) {
      const safe = recsSchema.safeParse(sample);
      const parsed = safe.success ? safe.data : {};
      const out = buildResponse({
        parsed,
        pool: POOL,
        allowedSlugs: ALLOWED,
        source: "ai",
        baseMessage: "fallback",
        avoidCount: 0,
      });
      expect(out.ok).toBe(true);
      expect(out.recommendations.length).toBeGreaterThan(0);
    }
  });
});
