import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";

/** "Talk to an advisor" card — render only when results are visible. */
export function AdvisorCard({
  page,
  cert,
  context,
}: {
  page: string;
  cert?: string;
  context?: string;
}) {
  const search: Record<string, string> = {
    utm_source: "site",
    utm_medium: page,
    utm_campaign: page,
  };
  if (cert) search.cert = cert;
  if (context) search.context = context.slice(0, 200);
  return (
    <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">
        Want a human to sanity-check this? Book a free 20-minute diagnostic.
      </p>
      <Link
        to="/book-a-call"
        search={search as never}
        className="inline-flex shrink-0 items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card"
      >
        <CalendarCheck size={14} /> Talk to an advisor
      </Link>
    </div>
  );
}
