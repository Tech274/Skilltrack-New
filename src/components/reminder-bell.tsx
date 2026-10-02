import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X, Clock } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dismissReminder, snoozeReminder } from "@/lib/reminders.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ReminderBell({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["reminders", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_reminders")
        .select("id, title, body, remind_at, dismissed_at, sent_at, user_certification_id")
        .is("dismissed_at", null)
        .lte("remind_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("remind_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dismissFn = useServerFn(dismissReminder);
  const snoozeFn = useServerFn(snoozeReminder);
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });
  const snooze = useMutation({
    mutationFn: (id: string) => snoozeFn({ data: { id, days: 1 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const items = q.data ?? [];
  const due = items.filter((r) => new Date(r.remind_at) <= new Date());
  const count = due.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex items-center gap-1.5 rounded-md border border-border bg-card/70 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-card"
          aria-label="Reminders"
        >
          <Bell size={14} />
          Reminders
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider">Reminders</div>
          <div className="text-[11px] text-muted-foreground">
            {count} due now · {items.length - count} upcoming
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            items.map((r) => {
              const overdue = new Date(r.remind_at) <= new Date();
              return (
                <div
                  key={r.id}
                  className={`border-b border-border/60 px-4 py-3 ${overdue ? "bg-warning/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${overdue ? "bg-warning" : "bg-muted-foreground"}`} />
                        <p className="truncate text-xs font-semibold">{r.title}</p>
                      </div>
                      {r.body && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.body}</p>}
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock size={9} />
                        {new Date(r.remind_at).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => dismiss.mutate(r.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => snooze.mutate(r.id)}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      Snooze 1 day
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-border bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground">
          Email delivery activates after domain setup.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
