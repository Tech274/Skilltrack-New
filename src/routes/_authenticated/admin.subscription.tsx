import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Check } from "lucide-react";
import { listPlans, getSuperSubscription, updateSuperSubscription, checkIsAdmin } from "@/lib/admin.functions";
import { AdminErrorScreen } from "@/components/admin/admin-error";

export const Route = createFileRoute("/_authenticated/admin/subscription")({
  head: () => ({ meta: [{ title: "Admin Subscription — SkillTrack-365" }] }),
  component: SubscriptionPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AdminErrorScreen
        title="My Plan"
        error={error}
        onRetry={() => { reset(); router.invalidate(); }}
      />
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function SubscriptionPage() {
  const plansFn = useServerFn(listPlans);
  const subFn = useServerFn(getSuperSubscription);
  const updFn = useServerFn(updateSuperSubscription);
  const whoFn = useServerFn(checkIsAdmin);
  const qc = useQueryClient();

  const { data: who } = useQuery({ queryKey: ["admin", "who"], queryFn: () => whoFn() });
  const { data: plans = [] } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => plansFn() });
  const { data: sub } = useQuery({ queryKey: ["admin", "sub"], queryFn: () => subFn() });

  const canEdit = !!who?.isSuperAdmin;

  const mut = useMutation({
    mutationFn: (plan_key: string) => updFn({ data: { plan_key, status: "active" } }),
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin", "sub"] });
      qc.invalidateQueries({ queryKey: ["admin", "features"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <Link to="/admin/users" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <span>Subscription</span>
      </div>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <CreditCard size={22} className="text-primary" /> Admin Subscription
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your plan controls which admin features are visible to all admins in this workspace.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((p: any) => {
          const active = sub?.plan_key === p.plan_key && sub?.status === "active";
          return (
            <div key={p.plan_key} className={`rounded-lg border p-5 ${active ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{p.label}</h3>
                {active && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Current
                  </span>
                )}
              </div>
              {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
              <ul className="mt-4 space-y-1.5 text-sm">
                {(p.features as string[]).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={14} className="text-primary" />
                    <span className="font-mono text-xs">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={!canEdit || active || mut.isPending}
                onClick={() => mut.mutate(p.plan_key)}
                className="mt-5 w-full rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {active ? "Active" : canEdit ? "Switch to this plan" : "Super Admin only"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
