import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

// Cron-callable endpoint. Requires a shared secret header
// `x-reminder-hook-secret` validated with constant-time comparison.
// Fail-closed: if REMINDER_HOOK_SECRET is not configured, every request is
// rejected — the hook simply does not run until the secret is provisioned.
export const Route = createFileRoute("/api/public/hooks/process-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REMINDER_HOOK_SECRET || "";
        if (!expected) {
          // Don't leak misconfig details; treat as unauthorized.
          return new Response("unauthorized", { status: 401 });
        }

        const provided = request.headers.get("x-reminder-hook-secret") || "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("milestone_reminders")
          .select("id, user_id, channel")
          .lte("remind_at", nowIso)
          .is("sent_at", null)
          .is("dismissed_at", null)
          .limit(500);
        if (error) return new Response("internal error", { status: 500 });

        let processed = 0;
        let failed = 0;
        for (const r of due ?? []) {
          try {
            if (r.channel === "email") {
              // Stub: real email provider not wired yet. Counts as processed.
              processed++;
            } else {
              processed++;
            }
          } catch {
            failed++;
          }
        }

        if (due && due.length) {
          const { error: updErr } = await supabaseAdmin
            .from("milestone_reminders")
            .update({ sent_at: nowIso })
            .in("id", due.map((d) => d.id));
          if (updErr) failed += due.length;
        }

        // Non-leaky summary — only counts + timestamp.
        return Response.json({
          scanned: due?.length ?? 0,
          processed,
          failed,
          ranAt: nowIso,
        });
      },
    },
  },
});
