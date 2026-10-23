import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Check, X, Plus, RotateCcw } from "lucide-react";
import { PASS_OUTLOOK, certifications } from "@/lib/certifications";
import { CertIqTabs } from "@/components/certiq-tabs";
import { ResultsAuthGate, useResultsUnlock } from "@/components/results-auth-gate";
import { AdvisorCard } from "@/components/advisor-card";
import { RegionSelect } from "@/components/region-select";
import { REGION_DISCLAIMER, formatExamCost, formatSalary, useRegion } from "@/lib/region-currency";

const DEFAULT_PICKS = [
  "aws-solutions-architect-associate",
  "azure-administrator-az-104",
  "gcp-professional-cloud-architect",
];

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): { add?: string } =>
    typeof search.add === "string" ? { add: search.add } : {},
  head: () => ({
    meta: [
      { title: "Certification Comparison Engine — SkillTrack-365" },
      {
        name: "description",
        content:
          "Compare professional certifications side-by-side: cost, difficulty, salary, demand, and ROI. Auto-highlight the best fit for your goal.",
      },
      { property: "og:url", content: "/compare" },
    ],
    links: [{ rel: "canonical", href: "/compare" }],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { add } = Route.useSearch();
  const [picked, setPicked] = useState<string[]>(() => {
    const valid = add && certifications.some((c) => c.slug === add) ? add : null;
    if (!valid) return DEFAULT_PICKS;
    return [valid, ...DEFAULT_PICKS.filter((s) => s !== valid)].slice(0, 4);
  });

  const { unlocked, unlock } = useResultsUnlock("compare");
  const { regionCode, setRegion } = useRegion();

  const items = picked
    .map((s) => certifications.find((c) => c.slug === s))
    .filter((c): c is (typeof certifications)[number] => Boolean(c));

  function toggle(slug: string) {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 4) return prev;
      return [...prev, slug];
    });
  }

  // Winners
  const winners =
    items.length > 0
      ? {
          cheapest: minBy(items, (c) => c.cost),
          fastestExam: minBy(items, (c) => c.durationMin),
          highestSalary: maxBy(items, (c) => c.avgSalary),
          highestDemand: maxBy(items, (c) => c.demandScore),
          bestROI: maxBy(items, (c) => c.roiScore),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CertIqTabs />

      <div className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-accent">Comparison engine</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Compare certifications side-by-side.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Pick up to 4 certifications. We'll auto-highlight the best by cost,
          salary, demand, and overall ROI.
        </p>
      </div>

      {/* Picker */}
      <div className="mt-10 rounded-xl border border-border bg-surface p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Select certifications
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {certifications.map((c) => {
            const on = picked.includes(c.slug);
            const capped = !on && picked.length >= 4;
            return (
              <button
                key={c.slug}
                onClick={() => toggle(c.slug)}
                disabled={capped}
                title={capped ? "Max 4 — remove one to add another" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                  on
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground"
                }`}
              >
                {on ? <Check size={12} /> : <X size={12} className="opacity-40" />}
                {c.code}
              </button>
            );
          })}
        </div>
        {picked.length >= 4 && (
          <p className="mt-3 text-xs text-muted-foreground">Max 4 — remove one to add another</p>
        )}
      </div>

      {!unlocked && (
        <div className="mt-8">
          <ResultsAuthGate
            feature="compare"
            campaign="certiq-compare"
            title="Create your free account to see the comparison"
            description="Unlock the side-by-side cost, salary, demand and ROI comparison for your picks. No payment, no password."
            notes={() => `Comparing: ${items.map((c) => c.code).join(", ")}`}
            onUnlocked={unlock}
            preview={
              <div className="space-y-2">
                <div className="text-sm font-medium">Side-by-side comparison</div>
                <div className="font-mono text-2xl font-semibold">$000 · ROI 00</div>
                <div className="text-xs text-muted-foreground">Best cost, salary, demand and ROI</div>
              </div>
            }
          />
        </div>
      )}

      {/* Winners */}
      {unlocked && winners && items.length >= 2 && (
        <div className="mt-8 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Lowest cost", c: winners.cheapest },
            { label: "Shortest exam", c: winners.fastestExam },
            { label: "Highest salary", c: winners.highestSalary },
            { label: "Highest demand", c: winners.highestDemand },
            { label: "Best ROI", c: winners.bestROI },
          ].map((w) => (
            <div key={w.label} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-1.5 text-xs text-accent">
                <Award size={12} /> {w.label}
              </div>
              <div className="mt-2 text-sm font-semibold leading-tight">{w.c?.code}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!unlocked ? null : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <h2 className="text-lg font-semibold">No certifications selected</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Pick up to 4 certifications above to see cost, salary, demand, and ROI side-by-side.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setPicked([certifications[0].slug])}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card"
            >
              <Plus size={14} /> Add certification
            </button>
            <button
              onClick={() => setPicked(DEFAULT_PICKS)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface-elevated"
            >
              <RotateCcw size={14} /> Reset to defaults
            </button>
          </div>
        </div>
      ) : (
      <div className="mt-8">
      <div className="mb-3 flex justify-end">
        <RegionSelect value={regionCode} onChange={setRegion} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">

        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-44 p-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Attribute
              </th>
              {items.map((c) => (
                <th key={c.slug} className="p-4 text-left">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {c.vendor}
                  </div>
                  <div className="mt-1 font-semibold">{c.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row label="Code" items={items.map((c) => c.code)} mono />
            <Row label="Difficulty" items={items.map((c) => c.difficulty)} />
            <Row label="Exam cost" items={items.map((c) => formatExamCost(c.cost, regionCode))} mono highlightIdx={idxOf(items, winners?.cheapest)} />
            <Row label="Duration" items={items.map((c) => `${c.durationMin} min`)} mono />
            <Row label="Passing score" items={items.map((c) => String(c.passingScore))} mono />
            <Row label="Validity" items={items.map((c) => `${c.validityYears} yr`)} mono />
            <Row label="Pass outlook" items={items.map(() => PASS_OUTLOOK)} />
            <Row label="Avg salary" items={items.map((c) => formatSalary(c.avgSalary, regionCode))} mono highlightIdx={idxOf(items, winners?.highestSalary)} />
            <Row label="Demand score" items={items.map((c) => String(c.demandScore))} mono highlightIdx={idxOf(items, winners?.highestDemand)} />
            <Row label="Open roles" items={items.map((c) => c.jobOpenings.toLocaleString())} mono />
            <Row label="ROI score" items={items.map((c) => `${c.roiScore} / 100`)} mono highlightIdx={idxOf(items, winners?.bestROI)} />
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">{REGION_DISCLAIMER}</p>
      <AdvisorCard
        page="compare"
        cert={winners?.bestROI?.slug ?? items[0]?.slug}
        context={`Comparing ${items.map((c) => c.code).join(", ")}`}
      />
      </div>
      )}

    </div>
  );
}

function Row({
  label,
  items,
  mono,
  highlightIdx,
}: {
  label: string;
  items: string[];
  mono?: boolean;
  highlightIdx?: number;
}) {
  return (
    <tr>
      <td className="bg-surface/40 p-4 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
      {items.map((v, i) => (
        <td
          key={i}
          className={`p-4 ${mono ? "font-mono" : ""} ${
            highlightIdx === i ? "bg-success/10 text-success font-semibold" : ""
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}

function minBy<T>(arr: T[], fn: (v: T) => number) {
  return arr.reduce((a, b) => (fn(a) <= fn(b) ? a : b));
}
function maxBy<T>(arr: T[], fn: (v: T) => number) {
  return arr.reduce((a, b) => (fn(a) >= fn(b) ? a : b));
}
function idxOf<T>(arr: T[], el: T | undefined) {
  return el ? arr.indexOf(el) : -1;
}
