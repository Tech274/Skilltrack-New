import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscriptions, createPortalSession } from "@/lib/billing.functions";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — SkillTrack-365" }] }),
  component: BillingPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-destructive">Failed to load billing: {(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function BillingPage() {
  const fetchSubs = useServerFn(getMySubscriptions);
  const portal = useServerFn(createPortalSession);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: () => fetchSubs(),
  });

  const portalMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const env = getStripeEnvironment();
      const result = await portal({
        data: { subscriptionId, environment: env, returnUrl: `${window.location.origin}/billing` },
      });
      if ("error" in result) throw new Error(result.error);
      return result.url;
    },
    onSuccess: (url) => window.open(url, "_blank"),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <Link to="/pricing" className="text-sm text-muted-foreground hover:underline">
          View plans →
        </Link>
      </div>

      {!paymentsConfigured() && (
        <div className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          Payments are not yet configured for this build.
        </div>
      )}

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted-foreground">No active subscriptions.</p>
          <Link to="/pricing" className="mt-3 inline-block rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Choose a plan
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {data?.map((s: any) => (
          <div key={s.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.plan_code} · {s.billing_interval}ly · {s.scope}
                </div>
                <div className="mt-1 text-lg font-medium capitalize">{s.status.replace("_", " ")}</div>
                {s.seats > 1 && <div className="text-sm text-muted-foreground">{s.seats} seats</div>}
                {s.trial_end && new Date(s.trial_end) > new Date() && (
                  <div className="mt-1 text-sm text-success">Trial ends {new Date(s.trial_end).toLocaleDateString()}</div>
                )}
                {s.current_period_end && (
                  <div className="text-sm text-muted-foreground">
                    {s.cancel_at_period_end ? "Ends" : "Renews"} {new Date(s.current_period_end).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => portalMutation.mutate(s.id)}
                disabled={portalMutation.isPending}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-50"
              >
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => refetch()} className="mt-6 text-xs text-muted-foreground hover:underline">
        Refresh
      </button>
    </div>
  );
}
