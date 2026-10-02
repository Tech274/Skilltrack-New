import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { certifications } from "@/lib/certifications";
import { CertIqTabs } from "@/components/certiq-tabs";
import { AdvisorCard } from "@/components/advisor-card";
import { ResultsAuthGate, useResultsUnlock } from "@/components/results-auth-gate";
import { RegionSelect } from "@/components/region-select";
import { REGION_DISCLAIMER, convertIndicative, formatMoney, useRegion } from "@/lib/region-currency";


export const Route = createFileRoute("/salary")({
  head: () => ({
    meta: [
      { title: "Salary & Demand Intelligence — SkillTrack-365" },
      {
        name: "description",
        content:
          "Live salary, hiring velocity, and market demand intelligence for every major certification — filterable by role, country, and industry.",
      },
      { property: "og:url", content: "/salary" },
    ],
    links: [{ rel: "canonical", href: "/salary" }],
  }),
  component: SalaryPage,
});

function SalaryPage() {
  const [exp, setExp] = useState("Mid (3-6 yrs)");
  const { unlocked, unlock } = useResultsUnlock("salary");
  const { regionCode, region, setRegion } = useRegion();


  const expMult = exp.startsWith("Junior") ? 0.72 : exp.startsWith("Mid") ? 1 : 1.32;
  const ctryMult = region.marketRatio;

  const ranked = [...certifications].sort((a, b) => b.avgSalary * expMult - a.avgSalary * expMult);
  const max = convertIndicative(ranked[0].avgSalary * expMult, region, "salary");

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CertIqTabs />

      <div className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">
          Salary & demand intel
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          What does each certification actually pay?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Live market signals across role, country, experience, and industry —
          updated weekly from job-board telemetry and salary surveys.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <RegionSelect value={regionCode} onChange={setRegion} className="rounded-lg border border-border bg-surface px-3 py-2" />
        <Select
          label="Experience"
          value={exp}
          onChange={setExp}
          options={["Junior (0-2 yrs)", "Mid (3-6 yrs)", "Senior (7+ yrs)"]}
        />
      </div>

      {!unlocked && (
        <div className="mt-10">
          <ResultsAuthGate
            feature="salary"
            campaign="certiq-salary"
            title="Create your free account to see salary numbers"
            description="Unlock the full salary, demand and openings table for every certification. No payment, no password."
            notes={() => `Filters: ${region.label} · ${exp}`}
            onUnlocked={unlock}
            preview={
              <div className="space-y-2">
                <div className="text-sm font-medium">Avg salary by certification</div>
                <div className="font-mono text-2xl font-semibold">{formatMoney(0, region).replace(/[\d]/g, "0")}</div>
                <div className="text-xs text-muted-foreground">Demand score · open roles</div>
              </div>
            }
          />
        </div>
      )}

      {unlocked && (
      <div className="mt-10 overflow-hidden rounded-xl border border-border bg-surface">

        <div className="grid grid-cols-12 gap-2 border-b border-border bg-surface-elevated px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">Certification</div>
          <div className="col-span-5">Avg salary</div>
          <div className="col-span-1 text-right">Demand</div>
          <div className="col-span-1 text-right">Openings</div>
        </div>
        {ranked.map((c) => {
          const salary = convertIndicative(c.avgSalary * expMult, region, "salary");
          const w = (salary / max) * 100;
          return (
            <div
              key={c.slug}
              className="grid grid-cols-12 items-center gap-2 border-b border-border/60 px-5 py-4 text-sm last:border-0 hover:bg-surface-elevated/50"
            >
              <div className="col-span-5">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.vendor}</div>
              </div>
              <div className="col-span-5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gradient-primary" style={{ width: `${w}%` }} />
                </div>
                <div className="font-mono w-28 text-right">{formatMoney(salary, region)}</div>
              </div>
              <div className="col-span-1 text-right font-mono">{c.demandScore}</div>
              <div className="col-span-1 text-right font-mono text-muted-foreground">
                {(c.jobOpenings * ctryMult).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {unlocked && (
        <AdvisorCard page="salary" cert={ranked[0]?.slug} context={`${exp} · ${region.label}`} />
      )}

      <p className="mt-6 text-[11px] text-muted-foreground">{REGION_DISCLAIMER}</p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-background">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
