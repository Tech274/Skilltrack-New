/**
 * Deep-link handoff from SkillTrack → SkillHub / SkillBridge.
 *
 * Passes simple query context only (no SSO, no silent account creation).
 * Never invent PII — callers must supply email/phone only when already known
 * from session, profile, or the current form.
 */

export const HANDOFF_SOURCE = "skilltrack" as const;

export const SKILLHUB_BASE_URL = "https://skillhub365.co.in";
export const SKILLBRIDGE_BASE_URL = "https://skillbridge365.co.in";

export type HandoffParams = {
  /** Signed-in email or form email — omit when unknown */
  email?: string | null;
  /** Profile/form phone — omit when unknown; never invent */
  phone?: string | null;
  /** Marketplace / prep SKU type (e.g. labs, mocks) — omit when unknown */
  sku?: string | null;
  /** Cert key (e.g. saa-c03) — omit when unknown */
  cert?: string | null;
  /** Optional lead / invoice ids for later Ops correlation */
  lead?: string | null;
  invoice?: string | null;
  /** Defaults to `skilltrack` */
  source?: string;
};

function setIfPresent(url: URL, key: string, value?: string | null) {
  const v = typeof value === "string" ? value.trim() : "";
  if (v) url.searchParams.set(key, v);
}

/**
 * Build a Hub/Bridge URL with `?handoff=…&email=…&phone=…&sku=…&cert=…`
 * (URL-encoded). Only includes params that are non-empty after trim.
 */
export function buildHandoffUrl(
  base: string,
  { email, phone, sku, cert, lead, invoice, source = HANDOFF_SOURCE }: HandoffParams = {},
): string {
  const url = new URL(base);
  url.searchParams.set("handoff", source);

  setIfPresent(url, "email", email);
  setIfPresent(url, "phone", phone);
  setIfPresent(url, "sku", sku);
  setIfPresent(url, "cert", cert);
  setIfPresent(url, "lead", lead);
  setIfPresent(url, "invoice", invoice);

  return url.toString();
}
