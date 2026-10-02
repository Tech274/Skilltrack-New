import { Link } from "@tanstack/react-router";
import { buildHandoffUrl, SKILLBRIDGE_BASE_URL } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";

type Tab =
  | { to: string; label: string }
  | { href: string; label: string; external: true };

/**
 * Shared sub-navigation for the bundled "CertIQ" section:
 * Compare + Career Advisor + Salary Intel + Resume Builder live under one header item.
 * Resume Builder is a deep-link handoff to SkillBridge (query context only; no SSO).
 */
const tabs: Tab[] = [
  { to: "/certiq", label: "Overview" },
  { to: "/compare", label: "Compare" },
  { to: "/career-explorer", label: "Career Advisor" },
  { to: "/salary", label: "Salary Intel" },
  { href: SKILLBRIDGE_BASE_URL, label: "Resume Builder", external: true },
];

export function CertIqTabs() {
  const handoff = useHandoffContext();

  return (
    <div className="mb-8">
      <div className="font-mono text-[11px] uppercase tracking-wider text-accent">CertIQ</div>
      <nav className="mt-2 flex flex-wrap gap-1 border-b border-border/60 pb-2">
        {tabs.map((t) =>
          "external" in t ? (
            <a
              key={t.href}
              href={buildHandoffUrl(t.href, handoff)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              {t.label}
            </a>
          ) : (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              activeProps={{ className: "bg-surface text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {t.label}
            </Link>
          )
        )}
      </nav>
    </div>
  );
}

