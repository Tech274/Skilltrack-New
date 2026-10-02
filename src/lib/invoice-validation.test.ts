// Run with: bunx vitest run src/lib/invoice-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateVoucher, type CatalogVoucher } from "./invoice-validation";

const base: CatalogVoucher = {
  slug: "aws-saa",
  name: "AWS Solutions Architect Associate",
  code: "SAA-C03",
  status: "published",
  cost_usd: 150,
};

describe("validateVoucher", () => {
  it("accepts a matching published voucher + amount", () => {
    expect(validateVoucher(base, 150)).toEqual({ ok: true });
  });

  it("tolerates floating-point noise within 1 cent", () => {
    expect(validateVoucher(base, 150.005).ok).toBe(true);
  });

  it("rejects null/undefined catalog row as unknown_slug", () => {
    expect(validateVoucher(null, 150)).toMatchObject({ ok: false, code: "unknown_slug" });
    expect(validateVoucher(undefined, 150)).toMatchObject({ ok: false, code: "unknown_slug" });
  });

  it("rejects unpublished entries", () => {
    expect(validateVoucher({ ...base, status: "draft" }, 150)).toMatchObject({
      ok: false, code: "not_published",
    });
  });

  it("rejects missing exam name", () => {
    expect(validateVoucher({ ...base, name: null }, 150)).toMatchObject({
      ok: false, code: "missing_name",
    });
  });

  it("rejects zero or negative voucher cost", () => {
    expect(validateVoucher({ ...base, cost_usd: 0 }, 150)).toMatchObject({ ok: false, code: "no_cost" });
    expect(validateVoucher({ ...base, cost_usd: -10 }, 150)).toMatchObject({ ok: false, code: "no_cost" });
    expect(validateVoucher({ ...base, cost_usd: null }, 150)).toMatchObject({ ok: false, code: "no_cost" });
  });

  it("rejects invalid (non-positive / NaN) amount", () => {
    expect(validateVoucher(base, 0)).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(validateVoucher(base, -5)).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(validateVoucher(base, NaN)).toMatchObject({ ok: false, code: "invalid_amount" });
  });

  it("rejects amount that does not match the voucher cost", () => {
    const r = validateVoucher(base, 99);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("amount_mismatch");
      expect(r.message).toContain("150");
      expect(r.message).toContain("AWS Solutions Architect Associate");
    }
  });

  it("never throws — always returns a tagged result", () => {
    const samples: any[] = [
      {},
      { slug: "x", status: "published", name: "X", cost_usd: "150" },
      { slug: "x", status: "published", name: "X", cost_usd: 150 },
    ];
    for (const s of samples) {
      expect(() => validateVoucher(s, 150)).not.toThrow();
    }
    // numeric coercion of cost_usd as string
    expect(validateVoucher({ slug: "x", status: "published", name: "X", cost_usd: 150 as any }, 150).ok).toBe(true);
  });
});
