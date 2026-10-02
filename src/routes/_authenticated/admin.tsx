import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Wallet,
  Shield,
  Bell,
  BarChart3,
  ScrollText,
  KeyRound,
  Package,
  FolderTree,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  FlaskConical,
  Store,
} from "lucide-react";
import { getAdminRoles } from "@/lib/admin-dashboard.functions";
import { AdminErrorScreen } from "@/components/admin/admin-error";
import { ParkedModuleBanner } from "@/components/admin/parked-module-banner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Portal — SkillTrack-365" }] }),
  component: AdminLayout,
  errorComponent: ({ error, reset }) => (
    <AdminErrorScreen title="Admin Portal" error={error} onRetry={reset} />
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

// Each nav item declares ONE of:
//   permission: string  — visible if user holds that permission (Super Admin holds all)
//   superOnly: true     — visible to Super Admin only
//   anyAdmin: true      — visible to any admin-flavor role or Super Admin
// Optional:
//   parked: true        — hidden from default sidebar; route kept; banner on direct hit
type NavItem = {
  to: string;
  label: string;
  icon: any;
  permission?: string;
  superOnly?: boolean;
  anyAdmin?: boolean;
  /** Unused SaaS chrome — hide from nav, keep route + show parked banner. */
  parked?: boolean;
};

const sections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, anyAdmin: true },
      // P2b: pin Sales Leads for Ops-first (Vivek, no Sales hire)
      { to: "/admin/sales-leads", label: "Sales Leads", icon: Users, anyAdmin: true },
      { to: "/admin/leads", label: "Leads", icon: ClipboardList, anyAdmin: true },
      { to: "/admin/marketplace", label: "Marketplace", icon: Store, anyAdmin: true },
      { to: "/admin/campaigns", label: "Homepage Campaigns", icon: Sparkles, anyAdmin: true },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users", label: "User Management", icon: Users, superOnly: true },
      { to: "/admin/learners", label: "Learners", icon: GraduationCap, anyAdmin: true },
      {
        to: "/admin/subscribers",
        label: "Subscribers",
        icon: Wallet,
        permission: "subscribers.view",
        parked: true,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        to: "/admin/certifications",
        label: "Certifications",
        icon: Package,
        permission: "certifications.manage",
      },
      {
        to: "/admin/resources",
        label: "Study Resources",
        icon: BookOpen,
        permission: "assessments.manage",
      },
      {
        to: "/admin/mock-exams",
        label: "Mock Exams",
        icon: ClipboardList,
        permission: "assessments.manage",
      },
      {
        to: "/admin/question-bank",
        label: "Question Bank",
        icon: FolderTree,
        permission: "assessments.manage",
      },
      {
        to: "/admin/learning-paths",
        label: "Learning Paths",
        icon: FolderTree,
        permission: "learning_paths.manage",
      },
      {
        to: "/admin/ai-imports",
        label: "AI Imports",
        icon: Sparkles,
        permission: "assessments.manage",
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/invoices", label: "Invoices", icon: FileText, anyAdmin: true },
      { to: "/admin/payments", label: "Payments", icon: CreditCard, anyAdmin: true },
      {
        to: "/admin/reconciliation",
        label: "AI Reconciliation",
        icon: Sparkles,
        permission: "reconciliation.manage",
      },
      { to: "/admin/subscription", label: "My Plan", icon: Wallet, superOnly: true, parked: true },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/admin/access",
        label: "Access Control",
        icon: KeyRound,
        permission: "access_rules.manage",
      },
      {
        to: "/admin/reports",
        label: "Reports & Analytics",
        icon: BarChart3,
        permission: "reports.view",
        parked: true,
      },
      {
        to: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
        permission: "notifications.manage",
      },
    ],
  },
  {
    label: "Security",
    items: [
      { to: "/admin/super-admins", label: "Super Admins", icon: ShieldAlert, superOnly: true },
      { to: "/admin/super-ai", label: "Super Admin AI", icon: Sparkles, superOnly: true },
      { to: "/admin/org-ai-defaults", label: "Org AI Defaults", icon: Sparkles, anyAdmin: true },
      { to: "/admin/permissions", label: "Permissions Matrix", icon: Shield, superOnly: true },
      { to: "/admin/audit", label: "Role Audit Log", icon: ScrollText, superOnly: true },
      { to: "/security", label: "Security Findings", icon: ShieldCheck, superOnly: true },
    ],
  },
];

/** Match a parked nav item for the current path (direct URL hits). */
function findParkedAdminNavItem(pathname: string): NavItem | undefined {
  for (const s of sections) {
    for (const it of s.items) {
      if (!it.parked) continue;
      if (pathname === it.to || pathname.startsWith(`${it.to}/`)) return it;
    }
  }
  return undefined;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  content_admin: "Content Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
  certification_admin: "Certification Admin",
  lab_admin: "Lab Admin",
  operations_admin: "Operations Admin",
  manager: "Manager",
  learner: "Learner",
};

function AdminLayout() {
  const fn = useServerFn(getAdminRoles);
  const {
    data: who,
    isLoading,
    error,
  } = useQuery({ queryKey: ["admin", "who"], queryFn: () => fn() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading admin portal…</div>;
  }
  if (error || !who?.isAnyAdmin) {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <ShieldCheck size={40} className="mx-auto text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn’t have any admin role. Contact your Super Admin to be granted access.
        </p>
        <Link
          to="/dashboard"
          className="mt-5 inline-block rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-elevated"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const permSet = new Set<string>(who.permissions ?? []);
  const can = (it: NavItem): boolean => {
    if (who.isSuperAdmin) return true; // super-admin sees everything
    if (it.superOnly) return false;
    if (it.permission) return permSet.has(it.permission);
    if (it.anyAdmin) return who.isAnyAdmin;
    return false;
  };

  const badges: string[] = [];
  if (who.isSuperAdmin) badges.push("Super Admin");
  for (const r of who.roles) {
    if (ROLE_LABEL[r] && !badges.includes(ROLE_LABEL[r])) badges.push(ROLE_LABEL[r]);
  }

  const parkedHit = findParkedAdminNavItem(pathname);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-surface/40 px-3 py-6">
        <div className="px-3 pb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Admin Portal
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{who.email}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto">
          {sections.map((s) => {
            // Parked SaaS chrome stays out of the default sidebar (routes kept).
            const visible = s.items.filter((it) => can(it) && !it.parked);
            if (visible.length === 0) return null;
            return (
              <div key={s.label}>
                <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <ul className="space-y-0.5">
                  {visible.map((it) => {
                    const active =
                      pathname === it.to || (it.to !== "/admin" && pathname.startsWith(it.to));
                    const Icon = it.icon;
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}
                        >
                          <Icon size={14} />
                          {it.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        {parkedHit ? <ParkedModuleBanner label={parkedHit.label} /> : null}
        <Outlet />
      </div>
    </div>
  );
}

// Keep import referenced so tree-shaking doesn't drop the icon set when nav grows.
void FlaskConical;
