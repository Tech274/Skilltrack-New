import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STALE_MS = 12 * 60 * 60 * 1000; // refresh at most every 12h
const CODES = ["INR", "USD", "CAD", "EUR"] as const;

export type FxSnapshot = {
  base: "INR";
  /** 1 INR = rates[code] units of code */
  rates: Record<string, number>;
  fetchedAt: string;
  source: string;
};

/** Returns INR-based rates, auto-refreshing from the public feed when stale. */
export const getFxRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<FxSnapshot | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("fx_rates").select("*").eq("base", "INR").maybeSingle();
    const fresh = row && Date.now() - new Date(row.fetched_at).getTime() < STALE_MS;
    if (fresh) {
      return { base: "INR", rates: row.rates as any, fetchedAt: row.fetched_at, source: row.source ?? "" };
    }
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/INR");
      const json: any = await res.json();
      if (json?.result !== "success") throw new Error("FX feed error");
      const rates: Record<string, number> = {};
      for (const c of CODES) rates[c] = Number(json.rates?.[c]);
      const fetchedAt = new Date().toISOString();
      await supabaseAdmin
        .from("fx_rates")
        .upsert({ base: "INR", rates, source: "open.er-api.com", fetched_at: fetchedAt });
      return { base: "INR", rates, fetchedAt, source: "open.er-api.com" };
    } catch {
      // Fall back to last known rates if the feed is down.
      return row
        ? { base: "INR", rates: row.rates as any, fetchedAt: row.fetched_at, source: row.source ?? "" }
        : null;
    }
  });
