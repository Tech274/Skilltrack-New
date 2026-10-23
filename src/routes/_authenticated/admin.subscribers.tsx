import { createFileRoute, Link, redirect } from "@tanstack/react-router";

/** Parked SaaS module. Direct URLs go back to the admin home. */
export const Route = createFileRoute("/_authenticated/admin/subscribers")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: SubscribersRedirectFallback,
});

function SubscribersRedirectFallback() {
  return (
    <div className="p-8 text-sm text-muted-foreground">
      Subscribers is parked.{" "}
      <Link to="/admin" className="text-primary underline">
        Back to admin
      </Link>
    </div>
  );
}
