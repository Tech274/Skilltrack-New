import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { guardLeadAccess } from "@/lib/admin-leads.functions";

/** Old duplicate of Sales Leads. Canonical page is /admin/sales-leads. */
export const Route = createFileRoute("/_authenticated/admin/leads")({
  beforeLoad: async () => {
    try {
      await guardLeadAccess();
    } catch {
      throw redirect({ to: "/admin" });
    }
    throw redirect({ to: "/admin/sales-leads" });
  },
  component: LeadsRedirectFallback,
});

function LeadsRedirectFallback() {
  return (
    <div className="p-8 text-sm text-muted-foreground">
      Leads moved to the sales pipeline.{" "}
      <Link to="/admin/sales-leads" className="text-primary underline">
        Continue
      </Link>
    </div>
  );
}
