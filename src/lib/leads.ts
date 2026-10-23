import { z } from "zod";

/** Server-side lead schema — shared shape for /api/public/lead. */
export const LEAD_SOURCES = [
  "book_a_call",
  "results_gate",
  "org_seats",
  "other",
  "exam_date",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** SkillTrack's home calendar. "A future exam date" is after this zone's today. */
export const EXAM_DATE_TIME_ZONE = "Asia/Kolkata";

const opt = (max: number) => z.string().trim().max(max).optional().default("");

const emailField = z
  .string()
  .trim()
  .email("Please enter a valid email")
  .max(255, "Email is too long");

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

/** YYYY-MM-DD in an IANA time zone. `en-CA` formats the calendar date as ISO. */
export function formatDateInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function indiaToday(now = new Date()): string {
  return formatDateInTimeZone(now, EXAM_DATE_TIME_ZONE);
}

export function localToday(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Later of the visitor's local date and the India business date.
 * The form uses this so a date the browser accepts is also in the future in India.
 */
export function examFormToday(now = new Date()): string {
  const local = localToday(now);
  const india = indiaToday(now);
  return local > india ? local : india;
}

/** The day after an ISO date. Used as the date picker's minimum. */
export function nextIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function validateExamDate(value: string, today: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Choose a target exam date.";
  if (!isIsoDate(trimmed) || !isIsoDate(today)) return "Enter a valid exam date.";
  if (trimmed <= today) return "Exam date must be in the future.";
  return null;
}

/** Text stored on `leads.certs` for the certification page the visitor was on. */
export function certificationInterest(cert?: { slug: string; name: string } | null): string {
  const slug = cert?.slug?.trim() ?? "";
  if (!slug) return "";
  const name = cert?.name?.trim() || slug;
  return `${name} (${slug})`.slice(0, 200);
}

export const CONSENT_REQUIRED_MESSAGE = "Please agree to be contacted before submitting.";

export function examDateFieldErrors(
  email: string,
  targetExamDate: string,
  today: string,
  messagingConsent: boolean,
): { email: string | null; date: string | null; consent: string | null } {
  const parsedEmail = emailField.safeParse(email);
  return {
    email: parsedEmail.success
      ? null
      : (parsedEmail.error.issues[0]?.message ?? "Please enter a valid email"),
    date: validateExamDate(targetExamDate, today),
    consent: messagingConsent ? null : CONSENT_REQUIRED_MESSAGE,
  };
}

const CONSENT_PREFIX = "[dpdp] messaging_consent=true consent_at=";
const EXAM_DATE_PREFIX = "[exam_date] target_exam_date=";

/** Keep a consent record inside notes when the dedicated columns are not migrated yet. */
export function notesWithConsent(notes: string | null | undefined, consentAt: string): string {
  const marker = `${CONSENT_PREFIX}${consentAt}`;
  const base = (notes ?? "").trim();
  if (base.includes(CONSENT_PREFIX)) return base.slice(0, 1000);
  const room = 1000 - marker.length - (base ? 1 : 0);
  const clipped = base.slice(0, Math.max(0, room)).trimEnd();
  return (clipped ? `${clipped}\n${marker}` : marker).slice(0, 1000);
}

/** Keep the exam date in notes when `target_exam_date` is not in the database yet. */
export function notesWithExamDate(notes: string | null | undefined, examDate: string): string {
  const marker = `${EXAM_DATE_PREFIX}${examDate}`;
  const base = (notes ?? "").trim();
  if (base.includes(EXAM_DATE_PREFIX)) return base.slice(0, 1000);
  const room = 1000 - marker.length - (base ? 1 : 0);
  const clipped = base.slice(0, Math.max(0, room)).trimEnd();
  return (clipped ? `${clipped}\n${marker}` : marker).slice(0, 1000);
}

export function isMissingLeadColumn(
  error: { code?: string; message?: string } | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  if (!message.includes(column)) return false;
  return (
    error.code === "42703" || error.code === "PGRST204" || /column|schema cache/i.test(message)
  );
}

export function buildLeadSchema(today: string) {
  return z
    .object({
      name: z.string().trim().max(100, "Name is too long").optional().default(""),
      email: emailField,
      phone: z.string().trim().max(30, "Phone number is too long").optional().default(""),
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
      target_exam_date: z.string().trim().max(10).optional().default(""),
      messaging_consent: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.source !== "exam_date") {
        if (!data.name) {
          ctx.addIssue({ code: "custom", message: "Please enter your name", path: ["name"] });
        }
        if (!data.phone) {
          ctx.addIssue({
            code: "custom",
            message: "Please enter a phone number",
            path: ["phone"],
          });
        }
        return;
      }
      const dateError = validateExamDate(data.target_exam_date, today);
      if (dateError) {
        ctx.addIssue({ code: "custom", message: dateError, path: ["target_exam_date"] });
      }
      if (data.messaging_consent !== true) {
        ctx.addIssue({
          code: "custom",
          message: CONSENT_REQUIRED_MESSAGE,
          path: ["messaging_consent"],
        });
      }
    });
}

export function parseLead(payload: unknown, today = indiaToday()) {
  return buildLeadSchema(today).safeParse(payload);
}

/** Schema evaluated against today's date in India. Prefer parseLead in request handlers. */
export const leadSchema = buildLeadSchema(indiaToday());

export type LeadInput = z.input<ReturnType<typeof buildLeadSchema>>;
export type SubmitLeadResult = { ok: true; id: string } | { ok: false; error: string };

export function newSubmissionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export type ExamDateLeadDraft = {
  email: string;
  targetExamDate: string;
  certification?: { slug: string; name: string } | null;
  pagePath: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  submissionId: string;
  companyWebsite: string;
};

export function examDateLeadInput(draft: ExamDateLeadDraft): LeadInput {
  return {
    source: "exam_date",
    name: "",
    email: draft.email,
    phone: "",
    certs: certificationInterest(draft.certification),
    timing: "",
    hear_about: "",
    utm_source: draft.utmSource,
    utm_medium: draft.utmMedium,
    utm_campaign: draft.utmCampaign,
    page_path: draft.pagePath.slice(0, 200),
    notes: "",
    submission_id: draft.submissionId,
    company_website: draft.companyWebsite,
    target_exam_date: draft.targetExamDate,
    messaging_consent: true,
  };
}

export type LeadInsertRow = {
  source: string;
  name: string;
  email: string;
  phone: string;
  certs: string | null;
  timing: string | null;
  hear_about: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  page_path: string | null;
  submission_id: string;
  ip_hash: string | null;
  target_exam_date?: string;
};

const emptyToNull = (value: string) => (value ? value : null);

/**
 * Row for the service-role insert. `target_exam_date` is included only when that
 * column already exists. Otherwise the date is kept in timing and notes, and the
 * source stays one the current check constraint allows.
 */
export function buildLeadInsertRow(
  data: {
    source: string;
    name: string;
    email: string;
    phone: string;
    certs: string;
    timing: string;
    hear_about: string;
    notes: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    page_path: string;
    submission_id: string;
    target_exam_date: string;
  },
  ipHash: string | null,
  options: { hasTargetExamDateColumn: boolean; consentAt?: string },
): LeadInsertRow {
  const consentAt = options.consentAt ?? new Date().toISOString();
  const notes = data.source === "exam_date" ? notesWithConsent(data.notes, consentAt) : data.notes;
  const row: LeadInsertRow = {
    source: data.source,
    name: data.name,
    email: data.email,
    phone: data.phone,
    certs: emptyToNull(data.certs),
    timing: emptyToNull(data.timing),
    hear_about: emptyToNull(data.hear_about),
    notes: emptyToNull(notes),
    utm_source: emptyToNull(data.utm_source),
    utm_medium: emptyToNull(data.utm_medium),
    utm_campaign: emptyToNull(data.utm_campaign),
    page_path: emptyToNull(data.page_path),
    submission_id: data.submission_id,
    ip_hash: ipHash,
  };
  if (data.source !== "exam_date") return row;
  if (options.hasTargetExamDateColumn) {
    row.target_exam_date = data.target_exam_date;
    return row;
  }
  row.source = "other";
  row.timing = data.target_exam_date;
  row.notes = notesWithExamDate(notes, data.target_exam_date);
  return row;
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
