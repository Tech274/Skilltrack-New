import { ExternalLink } from "lucide-react";

/** Exact phrase exposed to assistive tech on every off-site link. */
export const OPENS_IN_NEW_TAB = "opens in new tab";

/** Visible external-link icon plus screen-reader text. Parent should be an inline flex row. */
export function ExternalLinkMarker({ className = "size-3.5" }: { className?: string }) {
  return (
    <>
      <ExternalLink aria-hidden="true" className={`inline shrink-0 ${className}`} />
      <span className="sr-only"> {OPENS_IN_NEW_TAB}</span>
    </>
  );
}
