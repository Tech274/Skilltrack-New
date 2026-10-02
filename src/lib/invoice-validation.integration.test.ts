// Integration test: run validateVoucher across many concurrent payloads with
// mixed valid/invalid mixes and confirm the rules are applied consistently.
// validateVoucher is the single source of truth used by createInvoice
// (server-side, before any DB write or PDF generation) and by the invoice
// form (client-side, to disable submit). Running it concurrently against a
// large batch protects against accidental shared-state / closure bugs that
// would let an invalid voucher slip past on a busy admin worker.
//
// Run with:  bunx vitest run src/lib/invoice-validation.integration.test.ts

import { describe, it, expect } from "vitest";
import { validateVoucher, type CatalogVoucher } from "./invoice-validation";

const CATALOG: Record<string, CatalogVoucher> = {
  "aws-saa":  { slug: "aws-saa",  name: "AWS Solutions Architect Associate", code: "SAA-C03", status: "published", cost_usd: 150 },
  "az-104":   { slug: "az-104",   name: "Microsoft Azure Administrator",     code: "AZ-104",  status: "published", cost_usd: 165 },
  "gcp-ace":  { slug: "gcp-ace",  name: "Google Cloud Associate Cloud Eng.", code: "ACE",     status: "published", cost_usd: 125 },
  "draft-x":  { slug: "draft-x",  name: "Draft Cert",                        code: "DX",      status: "draft",     cost_usd: 200 },
  "noprice":  { slug: "noprice",  name: "No-Cost Cert",                      code: "NC",      status: "published", cost_usd: 0   },
  "noname":   { slug: "noname",   name: null,                                code: "NN",      status: "published", cost_usd: 99  },
};

type Case = { label: string; slug: string | null; amount: number; expectOk: boolean; expectCode?: string };

function buildCases(n: number): Case[] {
  const cases: Case[] = [];
  for (let i = 0; i < n; i++) {
    const pick = i % 8;
    switch (pick) {
      case 0: cases.push({ label: "valid aws-saa",    slug: "aws-saa", amount: 150, expectOk: true }); break;
      case 1: cases.push({ label: "valid az-104",     slug: "az-104",  amount: 165, expectOk: true }); break;
      case 2: cases.push({ label: "valid gcp-ace",    slug: "gcp-ace", amount: 125, expectOk: true }); break;
      case 3: cases.push({ label: "mismatch aws-saa", slug: "aws-saa", amount: 1,   expectOk: false, expectCode: "amount_mismatch" }); break;
      case 4: cases.push({ label: "draft rejected",   slug: "draft-x", amount: 200, expectOk: false, expectCode: "not_published" }); break;
      case 5: cases.push({ label: "no cost rejected", slug: "noprice", amount: 1,   expectOk: false, expectCode: "no_cost" }); break;
      case 6: cases.push({ label: "missing name",     slug: "noname",  amount: 99,  expectOk: false, expectCode: "missing_name" }); break;
      case 7: cases.push({ label: "unknown slug",     slug: "unknown", amount: 50,  expectOk: false, expectCode: "unknown_slug" }); break;
    }
  }
  return cases;
}

/**
 * Mirror of the server-side createInvoice voucher gate. The handler does:
 *   1. fetch catalog row by slug
 *   2. validateVoucher(row, amount)
 *   3. throw on failure (no insert, no PDF).
 * We simulate steps 1+2 so the integration test runs without booting Supabase.
 */
async function simulateCreateInvoice(slug: string | null, amount: number) {
  if (!slug) return { ok: true as const };
  // Simulate non-zero async latency to surface ordering bugs.
  await new Promise((r) => setTimeout(r, Math.random() * 5));
  const row = CATALOG[slug] ?? null;
  const result = validateVoucher(row, amount);
  if (!result.ok) {
    throw Object.assign(new Error(result.message), { code: result.code });
  }
  return { ok: true as const };
}

describe("createInvoice voucher gate (integration)", () => {
  it("rejects every invalid payload and accepts every valid one across 200 concurrent calls", async () => {
    const cases = buildCases(200);

    const settled = await Promise.allSettled(
      cases.map((c) => simulateCreateInvoice(c.slug, c.amount).then((r) => ({ c, r }))),
    );

    let validInvoicesCreated = 0;
    settled.forEach((s, i) => {
      const c = cases[i];
      if (c.expectOk) {
        expect(s.status, `case ${c.label} should resolve`).toBe("fulfilled");
        if (s.status === "fulfilled") validInvoicesCreated++;
      } else {
        expect(s.status, `case ${c.label} should reject`).toBe("rejected");
        if (s.status === "rejected") {
          expect((s.reason as any).code).toBe(c.expectCode);
        }
      }
    });

    const expectedValid = cases.filter((c) => c.expectOk).length;
    expect(validInvoicesCreated).toBe(expectedValid);
  });

  it("never lets a mismatched-amount payload through, even under contention", async () => {
    const slug = "aws-saa";
    const cost = CATALOG[slug].cost_usd!;
    const amounts = Array.from({ length: 100 }, (_, i) => (i === 42 ? cost : i + 1));
    // Exactly one of the 100 amounts equals the voucher cost; the rest must reject.
    const settled = await Promise.allSettled(amounts.map((a) => simulateCreateInvoice(slug, a)));
    const okCount = settled.filter((s) => s.status === "fulfilled").length;
    expect(okCount).toBe(1);
    settled.forEach((s, i) => {
      if (amounts[i] !== cost) {
        expect(s.status).toBe("rejected");
        if (s.status === "rejected") expect((s.reason as any).code).toBe("amount_mismatch");
      }
    });
  });
});
