import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEnabledAdminFeatures, checkIsAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { buildHandoffUrl, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";

type NavItem =
  | { to: string; label: string }
  | { href: string; label: string; external: true };

const nav: NavItem[] = [
  { to: "/", label: "Home" },
  { to: "/certifications", label: "Certifications" },
  { to: "/marketplace", label: "Marketplace" },
  { href: SKILLHUB_BASE_URL, label: "Labs", external: true },
  { to: "/assessment", label: "Assessments" },
  { to: "/certiq", label: "CertIQ" },
];



export function SiteHeader() {
  const handoff = useHandoffContext();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const whoFn = useServerFn(checkIsAdmin);
  const featFn = useServerFn(getEnabledAdminFeatures);
  const { data: who } = useQuery({
    queryKey: ["admin", "who", userId],
    queryFn: () => whoFn(),
    enabled: !!userId,
  });
  const isAdmin = !!who?.isAdmin;
  const isSuperAdmin = !!who?.isSuperAdmin;
  const { data: feat } = useQuery({
    queryKey: ["admin", "features", userId],
    queryFn: () => featFn(),
    enabled: isAdmin,
  });
  const features = new Set<string>(feat?.features ?? []);
  const showUserMgmt = isSuperAdmin && features.has("user_management");
  const showSecurity = isSuperAdmin && features.has("security_dashboard");
  const showAudit = isSuperAdmin && features.has("audit_log");
  const showPerms = isSuperAdmin && features.has("permissions_matrix");
  const showSubMgmt = isSuperAdmin && features.has("subscription_management");


  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="SkillTrack-365 home">
          <BrandLogo className="h-11 w-auto object-contain" size={44} />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {nav.map((item) =>
            "external" in item ? (
              <a
                key={item.href}
                href={buildHandoffUrl(item.href, handoff)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-surface"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-surface"
                activeProps={{ className: "text-foreground bg-surface" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <ThemeToggle />
          {userEmail ? (
            <>
              <Link
                to="/org"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Organizations
              </Link>
              {isSuperAdmin && (
                <div className="relative group">
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-primary hover:text-foreground"
                  >
                    <ShieldCheck size={14} />
                    Admin
                  </Link>
                  <div className="invisible absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-surface p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    {showUserMgmt && (
                      <Link to="/admin/users" className="block rounded px-3 py-2 text-sm hover:bg-surface-elevated">User Management</Link>
                    )}
                    {showAudit && (
                      <Link to="/admin/audit" className="block rounded px-3 py-2 text-sm hover:bg-surface-elevated">Role Audit Log</Link>
                    )}
                    {showPerms && (
                      <Link to="/admin/permissions" className="block rounded px-3 py-2 text-sm hover:bg-surface-elevated">Permissions Matrix</Link>
                    )}
                    {showSubMgmt && (
                      <Link to="/admin/subscription" className="block rounded px-3 py-2 text-sm hover:bg-surface-elevated">Subscription</Link>
                    )}
                    {showSecurity && (
                      <Link to="/security" className="block rounded px-3 py-2 text-sm hover:bg-surface-elevated">Security Findings</Link>
                    )}
                    {!showUserMgmt && !showAudit && !showPerms && !showSubMgmt && !showSecurity && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No admin features enabled by your plan.</div>
                    )}
                  </div>
                </div>
              )}
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <LayoutDashboard size={14} />
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
                aria-label="Sign out"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/certifications"
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Browse guides
              </Link>
              <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Link
                to="/assessment"
                search={{ oem: undefined }}
                className="rounded-md bg-gradient-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
              >
                Get started
              </Link>

            </>
          )}
        </div>

        <button
          className="lg:hidden rounded-md p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {nav.map((item) =>
              "external" in item ? (
                <a
                  key={item.href}
                  href={buildHandoffUrl(item.href, handoff)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface"
                >
                  {item.label}
                </Link>
              )
            )}
            <ThemeToggle className="mt-2 justify-center" showLabel />
            {userEmail ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="mt-2 rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium">
                  Dashboard
                </Link>
                <button onClick={() => { setOpen(false); handleSignOut(); }} className="rounded-md px-4 py-2 text-sm text-muted-foreground">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/assessment"
                  search={{ oem: undefined }}
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-md bg-gradient-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
                >
                  Get started
                </Link>
                <Link to="/certifications" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-center text-sm text-muted-foreground">
                  Browse guides
                </Link>

                <Link to="/auth" onClick={() => setOpen(false)} className="rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-medium">
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-9 w-auto object-contain" size={36} />
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Track Skills. Predict Success. Accelerate Careers.
            </p>
            <p className="mt-6 font-mono text-xs text-muted-foreground/70">
              © {new Date().getFullYear()} SkillTrack-365, Inc.
            </p>
          </div>
          {[
            {
              title: "Platform",
              links: [
                { label: "Certifications", to: "/certifications" },
                { label: "Career Advisor", to: "/career-explorer" },
                { label: "Compare", to: "/compare" },
                { label: "Salary Intel", to: "/salary" },
                { label: "Pricing", to: "/pricing" },
              ],
            },
            {
              title: "Solutions",
              links: [
                { label: "Enterprise", to: "/enterprise" },
                { label: "For Teams", to: "/enterprise" },
                { label: "Book free diagnostic", to: "/book-a-call" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", to: "/about" },
                { label: "Contact", to: "/contact" },
                { label: "Privacy", to: "/privacy" },
                { label: "Terms", to: "/terms" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      onClick={(e) => {
                        if (l.to === "/enterprise" && window.location.pathname === "/enterprise") {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>
      </div>
    </footer>
  );
}

