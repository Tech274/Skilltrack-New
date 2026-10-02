import { z } from "zod";

/** Server-side lead schema — shared shape for /api/public/lead. */
export const LEAD_SOURCES = ["book_a_call", "results_gate", "org_seats", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

const opt = (max: number) => z.string().trim().max(max).optional().default("");

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100, "Name is too long"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Email is too long"),
  phone: z.string().trim().min(1, "Please enter a phone number").max(30, "Phone number is too long"),
  certs: opt(200),
  timing: opt(200),
  hear_about: opt(200),
  utm_source: opt(200),
  utm_medium: opt(200),
  utm_campaign: opt(200),
  page_path: opt(200),
  notes: z.string().trim().max(1000, "Notes are too long").optional().default(""),
  submission_id: z.string().trim().min(8, "Invalid submission").max(64, "Invalid submission"),
  source: z.enum(LEAD_SOURCES, { message: "Invalid lead source" }),
  company_website: z.string().max(200).optional().default(""),
});

export type LeadInput = z.input<typeof leadSchema>;
export type SubmitLeadResult = { ok: true; id: string } | { ok: false; error: string };

export function newSubmissionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Posts a lead as JSON. Never throws; success only on a confirmed insert id. */
export async function submitLead(input: LeadInput): Promise<SubmitLeadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/api/public/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    let body: { ok?: unknown; id?: unknown; error?: unknown } | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.ok && body?.ok === true && typeof body.id === "string") {
      return { ok: true, id: body.id };
    }
    const error =
      typeof body?.error === "string" && body.error
        ? body.error
        : "We could not send your request. Please try again.";
    return { ok: false, error };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      return { ok: false, error: "Request timed out. Please try again." };
    }
    return { ok: false, error: "Network problem. Please try again." };
  } finally {
    clearTimeout(timer);
  }
}
