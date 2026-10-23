import { requireLeadAccess } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Sheet Apps Script URL — same server secret the lead endpoint uses. */
function sheetEndpoint() {
  const url = process.env["SHEET_EXEC_URL"];
  if (!url) throw new Error("SHEET_EXEC_URL is not set. Add it in project secrets.");
  return url;
}

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Demo booked",
  "Won",
  "Lost",
] as const;

export type SalesLead = {
  row: number;
  timestamp: string;
  name: string;
  email: string;
  phone: string;
  certs: string;
  timing: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  hear_about: string;
  notes: string;
  status: string;
};

function sheetToken() {
  return process.env["LEAD_SYNC_TOKEN"] ?? process.env["SALES_SHEET_TOKEN"] ?? "";
}

async function callSheet(params: Record<string, string>) {
  const url = new URL(sheetEndpoint());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const token = sheetToken();
  if (token) url.searchParams.set("token", token);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  } catch (e: any) {
    throw new Error(`Could not reach the Google Sheet script: ${e?.message ?? "network error"}`);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheet script returned ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "The Google Sheet script did not return data. Add the doGet/read support to the Apps Script and re-deploy it (see the setup panel).",
    );
  }
}

/** Read all lead rows from the Sales queue Sheet. */
export const listSalesLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireLeadAccess(context.userId);
    const json: any = await callSheet({ action: "read" });
    if (json?.ok === false) throw new Error(String(json.error ?? "Sheet read failed"));
    const rows: SalesLead[] = (json?.rows ?? json ?? []).map((r: any, i: number) => ({
      row: Number(r.row ?? i + 2),
      timestamp: String(r.timestamp ?? ""),
      name: String(r.name ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
      certs: String(r.certs ?? ""),
      timing: String(r.timing ?? ""),
      utm_source: String(r.utm_source ?? ""),
      utm_medium: String(r.utm_medium ?? ""),
      utm_campaign: String(r.utm_campaign ?? ""),
      hear_about: String(r.hear_about ?? ""),
      notes: String(r.notes ?? ""),
      status: String(r.Status ?? r.status ?? "New"),
    }));
    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return { rows };
  });

/** Update a single lead's Status cell in the Sheet. */
export const updateSalesLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      row: z.number().int().min(2),
      status: z.enum(LEAD_STATUSES),
      notes: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireLeadAccess(context.userId);
    const json: any = await callSheet({
      action: "updateStatus",
      row: String(data.row),
      status: data.status,
      ...(data.notes ? { notes: data.notes } : {}),
    });
    if (json?.ok === false) throw new Error(String(json.error ?? "Sheet update failed"));
    return { ok: true };
  });
