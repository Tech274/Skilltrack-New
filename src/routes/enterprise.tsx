import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Check, Shield, Users2 } from "lucide-react";

export const Route = createFileRoute("/enterprise")({
  head: () => ({
    meta: [
      { title: "Enterprise Workforce Readiness — SkillTrack-365" },
      {
        name: "description",
        content:
          "Manage certifications, compliance, skill gaps, and renewals for your entire workforce. Executive dashboards, L&D tooling, and SSO.",
      },
      { property: "og:url", content: "https://skilltrack.co.in/enterprise" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/enterprise" }],
  }),
  component: EnterprisePage,
});

const capabilities = [
  { icon: Users2, title: "Workforce certification matrix", body: "Every employee, every credential, every renewal date — in one searchable view." },
  { icon: Shield, title: "Compliance & renewal monitoring", body: "Automated alerts before credentials expire. Audit-ready reports for SOC 2, ISO, and HIPAA contexts." },
  { icon: Building2, title: "Skill-gap analysis", body: "Map current workforce skills to your strategic initiatives. Spot gaps before they block delivery." },
];

const dashboards = ["Executive", "HR", "Manager", "L&D", "Learner"];

export default function EnterprisePage_() {}

function EnterprisePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-mesh opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24">
          <div className="max-w-3xl">
            <div className="font-mono text-xs uppercase tracking-wider text-accent">Enterprise</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
              Workforce certification, compliance, and skills — one platform.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Run your L&D org on signal, not spreadsheets. SkillTrack-365
              tracks every credential, predicts renewal risk, and surfaces the
              capability gaps blocking your roadmap.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/book-a-call"
                search={(prev) => ({ ...(prev as Record<string, string>), utm_campaign: "enterprise" })}
                className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
              >
                Book free diagnostic
              </Link>

              <Link
                to="/pricing"
                className="rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium hover:bg-surface-elevated"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="bg-surface p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                  <c.icon size={18} className="text-primary-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Five purpose-built dashboards.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Different stakeholders, different questions. Same source of truth.
          </p>
          <div className="mt-10 grid gap-3 md:grid-cols-5">
            {dashboards.map((d) => (
              <div key={d} className="rounded-xl border border-border bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Dashboard
                </div>
                <div className="mt-2 text-lg font-semibold">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="rounded-2xl border border-border bg-surface p-10">
            <h3 className="text-2xl font-semibold">Included in every Enterprise plan</h3>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                "SAML SSO + SCIM provisioning",
                "Role-based access control",
                "Audit logs + data export",
                "Dedicated customer success",
                "Custom certification catalog",
                "Quarterly business reviews",
                "99.9% uptime SLA",
                "Regional data residency",
              ].map((l) => (
                <li key={l} className="flex items-center gap-2 text-sm">
                  <Check size={14} className="text-success" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
