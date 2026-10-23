import { createFileRoute, Link, redirect } from "@tanstack/react-router";

/** Parked SaaS module. Direct URLs go back to the admin home. */
export const Route = createFileRoute("/_authenticated/admin/reports")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  component: ReportsRedirectFallback,
});

function ReportsRedirectFallback() {
  return (
    <div className="p-8 text-sm text-muted-foreground">
      Reports is parked.{" "}
      <Link to="/admin" className="text-primary underline">
        Back to admin
      </Link>
    </div>
  );
}
