import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { isMissingConsentColumn, leadSchema, notesWithConsent } from "@/lib/leads";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function clientIp(request: Request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  return xff ? (xff.split(",")[0] ?? "").trim() : "";
}

type LeadRow = {
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
};

/** Mirror a saved lead to the Sales Sheet. Never throws; result only updates the row. */
async function syncToSheet(supabaseAdmin: any, id: string, row: LeadRow, consentAt: string) {
  let sheetError: string | null = null;
  try {
    const url = process.env["SHEET_EXEC_URL"];
    const token = process.env["LEAD_SYNC_TOKEN"] ?? "";
    if (!url) throw new Error("SHEET_EXEC_URL is not set");
    // Google Sheets treats a leading + as a formula — force text.
    const phone = row.phone.startsWith("+") ? `'${row.phone}` : row.phone;
    const body = new URLSearchParams({
      id,
      timestamp: new Date().toISOString(),
      source: row.source,
      name: row.name,
      email: row.email,
      phone,
      certs: row.certs ?? "",
      timing: row.timing ?? "",
      hear_about: row.hear_about ?? "",
      notes: row.notes ?? "",
      utm_source: row.utm_source ?? "",
      utm_medium: row.utm_medium ?? "",
      utm_campaign: row.utm_campaign ?? "",
      page_path: row.page_path ?? "",
      submission_id: row.submission_id,
      messaging_consent: "true",
      messaging_consent_at: consentAt,
      Status: "New",
      token,
    });
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Lead-Token": token },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let out: any = null;
    try {
      out = JSON.parse(text);
    } catch {
      throw new Error(`Sheet returned non-JSON (HTTP ${res.status})`);
    }
    if (out?.ok !== true)
      throw new Error(`Sheet rejected: ${String(out?.error ?? `HTTP ${res.status}`)}`);
  } catch (e: any) {
    sheetError = String(e?.message ?? e ?? "Sheet sync failed").slice(0, 500);
  }
  const patch = sheetError
    ? { sheet_error: sheetError }
    : { sheet_synced_at: new Date().toISOString(), sheet_error: null };
  const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", id);
  if (error) console.error("[lead] sheet status update failed", error.message);
  if (sheetError) console.error("[lead] sheet sync failed", sheetError);
}

const nz = (s: string) => (s ? s : null);

export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          const ct = request.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) payload = await request.json();
          else payload = Object.fromEntries(new URLSearchParams(await request.text()));
        } catch {
          return json({ ok: false, error: "Could not read your submission." }, 400);
        }

        const parsed = leadSchema.safeParse(payload);
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." },
            400,
          );
        }
        const d = parsed.data;

        // Honeypot tripped — pretend success, write nothing.
        if (d.company_website.trim() !== "") return json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const ip = clientIp(request);
        const ipHash = ip
          ? createHash("sha256")
              .update(ip + (process.env["LEAD_IP_SALT"] ?? ""))
              .digest("hex")
          : null;

        if (ipHash) {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { count, error } = await supabaseAdmin
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since);
          if (error) console.error("[lead] rate-limit query failed", error.message);
          else if ((count ?? 0) >= 5) {
            return json(
              { ok: false, error: "Too many requests. Please try again in a few minutes." },
              429,
            );
          }
        }

        const consentAt = new Date().toISOString();
        const row: LeadRow = {
          source: d.source,
          name: d.name,
          email: d.email,
          phone: d.phone,
          certs: nz(d.certs),
          timing: nz(d.timing),
          hear_about: nz(d.hear_about),
          notes: nz(d.notes),
          utm_source: nz(d.utm_source),
          utm_medium: nz(d.utm_medium),
          utm_campaign: nz(d.utm_campaign),
          page_path: nz(d.page_path),
          submission_id: d.submission_id,
          ip_hash: ipHash,
        };

        const withConsent = {
          ...row,
          messaging_consent: true,
          messaging_consent_at: consentAt,
        };

        let insertedId: string | undefined;
        let insertError: { code?: string; message?: string } | null = null;
        const first = await supabaseAdmin.from("leads").insert(withConsent).select("id").single();
        if (first.error && isMissingConsentColumn(first.error)) {
          // Columns are not in the live database until drizzle/migrations/0004_leads_messaging_consent.sql is applied.
          const fallback = await supabaseAdmin
            .from("leads")
            .insert({ ...row, notes: notesWithConsent(row.notes, consentAt) })
            .select("id")
            .single();
          insertedId = fallback.data?.id;
          insertError = fallback.error;
        } else {
          insertedId = first.data?.id;
          insertError = first.error;
        }

        if (insertError) {
          if (insertError.code === "23505") {
            const { data: existing } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("submission_id", d.submission_id)
              .maybeSingle();
            if (existing?.id) return json({ ok: true, id: existing.id, duplicate: true });
          }
          console.error("[lead] insert failed", insertError.code, insertError.message);
          return json(
            { ok: false, error: "We could not save your request. Please try again." },
            500,
          );
        }

        if (!insertedId) {
          return json(
            { ok: false, error: "We could not save your request. Please try again." },
            500,
          );
        }

        await syncToSheet(supabaseAdmin, insertedId, row, consentAt);
        return json({ ok: true, id: insertedId });
      },
    },
  },
});
