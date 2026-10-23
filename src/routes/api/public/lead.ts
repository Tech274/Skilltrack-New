import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import {
  buildLeadInsertRow,
  isMissingLeadColumn,
  leadInsertFallback,
  parseLead,
} from "@/lib/leads";

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
async function syncToSheet(supabaseAdmin: any, id: string, row: LeadRow, targetExamDate: string) {
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
      target_exam_date: targetExamDate,
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

const presentLeadColumns = new Set<string>();

type LeadColumnName = "target_exam_date" | "messaging_consent";

async function hasLeadColumn(
  supabaseAdmin: {
    from(table: "leads"): {
      select(columns: LeadColumnName): {
        limit(count: number): PromiseLike<{ error: { code?: string; message?: string } | null }>;
      };
    };
  },
  column: LeadColumnName,
): Promise<boolean> {
  if (presentLeadColumns.has(column)) return true;
  const { error } = await supabaseAdmin.from("leads").select(column).limit(1);
  if (!error) {
    presentLeadColumns.add(column);
    return true;
  }
  if (isMissingLeadColumn(error, column)) return false;
  throw error;
}

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

        const parsed = parseLead(payload);
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." },
            400,
          );
        }
        const d = parsed.data;

        // Honeypot tripped — pretend success, write nothing.
        if (d.company_website.trim() !== "") return json({ ok: true });

        try {
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

          const hasExamDateColumn =
            d.source === "exam_date"
              ? await hasLeadColumn(supabaseAdmin, "target_exam_date")
              : false;
          const hasMessagingConsentColumn =
            d.messaging_consent === true
              ? await hasLeadColumn(supabaseAdmin, "messaging_consent")
              : false;
          let row = buildLeadInsertRow(d, ipHash, {
            hasTargetExamDateColumn: hasExamDateColumn,
            hasMessagingConsentColumn,
            consentAt: new Date().toISOString(),
          });

          let { data: inserted, error: insertError } = await supabaseAdmin
            .from("leads")
            .insert(row)
            .select("id")
            .single();

          if (insertError) {
            const fallback = leadInsertFallback(row, insertError);
            if (fallback) {
              row = fallback;
              const retried = await supabaseAdmin.from("leads").insert(row).select("id").single();
              inserted = retried.data;
              insertError = retried.error;
            }
          }

          if (insertError || !inserted) {
            if (insertError?.code === "23505") {
              const { data: existing } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("submission_id", d.submission_id)
                .maybeSingle();
              if (existing?.id) return json({ ok: true, id: existing.id, duplicate: true });
            }
            console.error("[lead] insert failed", insertError?.code, insertError?.message);
            return json(
              { ok: false, error: "We could not save your request. Please try again." },
              500,
            );
          }

          await syncToSheet(
            supabaseAdmin,
            inserted.id,
            row,
            d.source === "exam_date" ? d.target_exam_date : "",
          );
          return json({ ok: true, id: inserted.id });
        } catch (error) {
          console.error("[lead] save failed", error);
          return json(
            { ok: false, error: "We could not save your request. Please try again." },
            500,
          );
        }
      },
    },
  },
});
