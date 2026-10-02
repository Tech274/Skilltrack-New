import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listMyNotifications, markNotificationRead, runReminderScan } from "@/lib/admin-notifications.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Admin — SkillTrack-365" }] }),
  component: NotificationsPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  invoice_generated: "Invoice generated",
  payment_recorded: "Payment received",
  payment_reminder: "Payment reminder",
  subscription_expiring: "Subscription expiring",
  assignment_created: "Assignment created",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const fnList = useServerFn(listMyNotifications);
  const fnMark = useServerFn(markNotificationRead);
  const fnScan = useServerFn(runReminderScan);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", filter],
    queryFn: () => fnList({ data: { only_unread: filter === "unread", limit: 100 } }),
    refetchInterval: 60_000,
  });

  const mark = useMutation({
    mutationFn: (v: { id?: string; all?: boolean }) => fnMark({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  const scan = useMutation({
    mutationFn: () => fnScan(),
    onSuccess: (r: any) => {
      toast.success(`Scan complete`, { description: `${r.queued} notifications queued (${r.scanned_invoices} invoices, ${r.scanned_subscriptions} subs).` });
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">In-app alerts for billing, payments, subscriptions, and assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw size={14} className={`mr-2 ${scan.isPending ? "animate-spin" : ""}`} />
            Run reminder scan
          </Button>
          <Button variant="outline" onClick={() => mark.mutate({ all: true })} disabled={!data || data.unread === 0}>
            <CheckCheck size={14} className="mr-2" /> Mark all read
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread{data && data.unread > 0 ? ` · ${data.unread}` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <div className="rounded-lg border border-border/60 bg-surface/40 p-8 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.rows.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 p-10 text-center">
            <Bell size={24} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">You're all caught up.</p>
          </div>
        )}
        {(data?.rows ?? []).map((n: any) => {
          const unread = !n.read_at;
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${unread ? "border-primary/40 bg-primary/5" : "border-border/60 bg-surface/40"}`}
            >
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[n.category] ?? n.category}</Badge>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.link && (
                    <a href={n.link} className="inline-flex items-center gap-1 text-primary hover:underline">
                      Open <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
              {unread && (
                <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: n.id })}>Mark read</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
