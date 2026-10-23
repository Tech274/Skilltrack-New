import { createFileRoute, Link, redirect } from "@tanstack/react-router";

/** Parked SaaS module (My Plan). Direct URLs go back to the admin home. */
export const Route = createFileRoute("/_authenticated/admin/subscription")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: SubscriptionRedirectFallback,
});

function SubscriptionRedirectFallback() {
  return (
    <div className="p-8 text-sm text-muted-foreground">
      My Plan is parked.{" "}
      <Link to="/admin" className="text-primary underline">
        Back to admin
      </Link>
    </div>
  );
}
