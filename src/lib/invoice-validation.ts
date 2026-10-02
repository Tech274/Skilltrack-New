// Pure helpers for invoice voucher validation. Used by both the server
// (createInvoice) and the client form so the same rules apply everywhere.

export type CatalogVoucher = {
  slug: string;
  name: string | null;
  code?: string | null;
  status: string | null;
  cost_usd: number | null;
  vendor?: string | null;
};

export type VoucherValidation =
  | { ok: true }
  | { ok: false; code:
      | "unknown_slug"
      | "not_published"
      | "missing_name"
      | "no_cost"
      | "amount_mismatch"
      | "invalid_amount"
      ; message: string };

/**
 * Validate that the given amount is acceptable for the voucher described by
 * `cat`. Returns `{ ok: true }` on success, otherwise a tagged error code +
 * user-friendly message. Pure — does NO I/O.
 */
export function validateVoucher(
  cat: CatalogVoucher | null | undefined,
  amount: number,
): VoucherValidation {
  if (!cat) {
    return { ok: false, code: "unknown_slug", message: "Unknown certification voucher." };
  }
  if (cat.status !== "published") {
    return { ok: false, code: "not_published", message: `Certification "${cat.name ?? cat.slug}" is not published and cannot be invoiced.` };
  }
  if (!cat.name) {
    return { ok: false, code: "missing_name", message: "Certification voucher is missing an exam name in the catalog." };
  }
  const cost = Number(cat.cost_usd ?? 0);
  if (!(cost > 0)) {
    return { ok: false, code: "no_cost", message: `Certification "${cat.name}" has no voucher cost configured.` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, code: "invalid_amount", message: "Amount must be a positive number." };
  }
  if (Math.abs(amt - cost) > 0.01) {
    return {
      ok: false,
      code: "amount_mismatch",
      message: `Amount (${amt}) does not match the configured voucher cost (${cost}) for ${cat.name}.`,
    };
  }
  return { ok: true };
}
