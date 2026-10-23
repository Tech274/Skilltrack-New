import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Sparkles, TrendingUp, Clock, DollarSign, Loader2, AlertTriangle, Database } from "lucide-react";
import { certifications, roles } from "@/lib/certifications";
import { AdvisorCard } from "@/components/advisor-card";
import { predictPass } from "@/lib/ai.functions";
import { buildSkillRoadmap } from "@/lib/roadmap.functions";
import { ResultsAuthGate, useResultsUnlock } from "@/components/results-auth-gate";
import { toast } from "sonner";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { CertIqTabs } from "@/components/certiq-tabs";


const OEM_NAMES: Record<string, string> = {
  aws: "AWS",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
  salesforce: "Salesforce",
  servicenow: "ServiceNow",
  pmi: "PMI",
  comptia: "CompTIA",
  hashicorp: "HashiCorp",
  snowflake: "Snowflake",
  databricks: "Databricks",
  cisco: "Cisco",
  kubernetes: "CNCF / Kubernetes",
};

export const Route = createFileRoute("/career-explorer")({
  validateSearch: (search: Record<string, unknown>) => ({
    oem: typeof search.oem === "string" && OEM_NAMES[search.oem] ? search.oem : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Career Advisor — SkillTrack-365" },
      {
        name: "description",
        content:
          "Tell our AI your role, skills, and goals. Get a ranked certification roadmap with ROI, timelines, and projected salary lift.",
      },
      { property: "og:url", content: "https://skilltrack.co.in/career-explorer" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/career-explorer" }],
  }),
  component: CareerExplorer,
});

type Roadmap = Awaited<ReturnType<typeof buildSkillRoadmap>>;
type Prediction = Awaited<ReturnType<typeof predictPass>>;

function CareerExplorer() {
  const { oem } = Route.useSearch();
  const oemName = oem ? OEM_NAMES[oem] : null;
  const [current, setCurrent] = usePersistedState("advisor.current", "Cloud Engineer");
  const [target, setTarget] = usePersistedState("advisor.target", "Cloud Architect");
  const [experience, setExperience] = usePersistedState("advisor.experience", 3);
  const [hours, setHours] = usePersistedState("advisor.hours", 8);
  const [interests, setInterests] = usePersistedState("advisor.interests", "");

  // Arriving from an OEM doorway tile: pre-scope the assessment to that vendor.
  useEffect(() => {
    if (oemName && !interests.toLowerCase().includes(oemName.toLowerCase())) {
      setInterests((prev) => (prev.trim() ? `${oemName}, ${prev}` : oemName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oemName]);
  const { unlocked, unlock } = useResultsUnlock("career-explorer");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapSubmitted, setRoadmapSubmitted] = useState(false);

  const roadmapFn = useServerFn(buildSkillRoadmap);

  async function runAdvisor() {
    setLoadingRoadmap(true);
    setRoadmapError(null);
    setRoadmapSubmitted(true);
    try {
      const result = await roadmapFn({
        data: {
          currentRole: current,
          targetRole: target,
          experienceYears: experience,
          hoursPerWeek: hours,
          interests: interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setRoadmap(result);
    } catch (e) {
      setRoadmap(null);
      setRoadmapError((e as Error).message || "Could not load the skills database");
    } finally {
      setLoadingRoadmap(false);
    }
  }


  // Predictor state
  const [certSlug, setCertSlug] = useState(certifications[0].slug);
  const [studyHours, setStudyHours] = useState(80);
  const [mockScore, setMockScore] = useState(72);
  const [completion, setCompletion] = useState(60);
  const [practiceCount, setPracticeCount] = useState(50);
  const [daysToExam, setDaysToExam] = useState(30);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loadingPred, setLoadingPred] = useState(false);
  const [predError, setPredError] = useState<string | null>(null);
  const [predSubmitted, setPredSubmitted] = useState(false);

  const predictFn = useServerFn(predictPass);

  async function runPredictor() {
    setLoadingPred(true);
    setPredSubmitted(true);
    setPredError(null);
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Taking too long — please try again")), 20000);
      });
      const result = await Promise.race([
        predictFn({
          data: {
            certificationSlug: certSlug,
            studyHours,
            mockScore,
            courseCompletion: completion,
            practiceCount,
            daysToExam,
          },
        }),
        timeout,
      ]).finally(() => clearTimeout(timer));
      setPrediction(result && typeof result.probability === "number" ? result : null);
    } catch (e) {
      setPrediction(null);
      const msg = (e as Error).message || "Prediction failed";
      setPredError(msg);
      toast.error(msg);
    } finally {
      setLoadingPred(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CertIqTabs />

      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-accent">
          <Sparkles size={12} /> AI-powered
        </div>
        {oemName && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
            Assessment scoped to {oemName}
          </div>
        )}
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Career Advisor + Pass Predictor.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Two AI modules in one workspace. Build your certification roadmap, then stress-test your
          readiness before booking the exam.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {/* Career Advisor */}
        <section className="rounded-2xl border border-border bg-surface p-7 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Career Advisor</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">01</span>
          </div>

          <div className="mt-6 space-y-5" id="career-advisor-form">
            <Field label="Current role">
              <Select value={current} onChange={setCurrent} options={roles} />
            </Field>
            <Field label="Target role">
              <Select value={target} onChange={setTarget} options={roles} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Experience: ${experience} yrs`}>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={experience}
                  onChange={(e) => setExperience(+e.target.value)}
                  className="w-full accent-[oklch(0.65_0.14_250)]"
                />
              </Field>
              <Field label={`Study hours/week: ${hours}`}>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={hours}
                  onChange={(e) => setHours(+e.target.value)}
                  className="w-full accent-[oklch(0.65_0.14_250)]"
                />
              </Field>
            </div>
            <Field label="Interests (optional)">
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. generative AI, multi-cloud, FinOps"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>

            <button
              onClick={runAdvisor}
              disabled={loadingRoadmap}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card disabled:opacity-60"
            >
              {loadingRoadmap ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loadingRoadmap ? "Building…" : "Build my roadmap"}
            </button>
          </div>

          {loadingRoadmap && (
            <div className="mt-7 border-t border-border pt-6" role="status" aria-live="polite">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                <Loader2 size={18} className="shrink-0 animate-spin text-accent" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Building your roadmap…</div>
                  <div className="text-xs text-muted-foreground">
                    Matching certifications and learning paths in the skills database to your profile.
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-primary" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loadingRoadmap && roadmapError && (
            <div className="mt-7 border-t border-border pt-6" role="alert">
              <div className="rounded-lg border border-warning/40 bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertTriangle size={14} /> Couldn't build your roadmap
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{roadmapError}</p>
                <button
                  onClick={runAdvisor}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-card"
                >
                  <Sparkles size={12} /> Try again
                </button>
              </div>
            </div>
          )}

          {!unlocked && roadmapSubmitted && !loadingRoadmap && !loadingPred && (
            <div className="mt-7 border-t border-border pt-6">
              <ResultsAuthGate
                feature="career-explorer"
                campaign="certiq-career-advisor"
                title="Create your free account to see your results"
                description="Unlock your certification roadmap and pass-probability results. No payment, no password."
                onUnlocked={unlock}
                preview={
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Your personalised roadmap</div>
                    <div className="font-mono text-2xl font-semibold">00% pass probability</div>
                    <div className="text-xs text-muted-foreground">Steps, timeline and exam costs</div>
                  </div>
                }
              />
            </div>
          )}

          {unlocked && !loadingRoadmap && !roadmapError && roadmapSubmitted && roadmap && roadmap.steps.length === 0 && (
            <div className="mt-7 border-t border-border pt-6">
              <div className="rounded-lg border border-border bg-background p-4 text-center">
                <Sparkles size={18} className="mx-auto text-muted-foreground" />
                <div className="mt-2 text-sm font-medium">No roadmap matched those inputs</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different target role or add interests so we can match more certifications.
                </p>
                <button
                  onClick={() =>
                    document.getElementById("career-advisor-form")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated"
                >
                  Adjust my inputs
                </button>
              </div>
            </div>
          )}

          {unlocked && !loadingRoadmap && !roadmapError && roadmap && roadmap.steps.length > 0 && (
            <div className="mt-7 border-t border-border pt-6">
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent">
                <Database size={11} /> From the skills catalog
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {roadmap.steps.length} certification{roadmap.steps.length > 1 ? "s" : ""} from the
                SkillTrack-365 catalog, sequenced for {target} at {hours} study hours a week.
              </p>
              <div className="mt-4 space-y-3">
                {roadmap.steps.map((step, i) => (
                  <Link
                    key={step.slug}
                    to="/certifications/$slug"
                    params={{ slug: step.slug }}
                    className="group flex items-start gap-4 rounded-lg border border-border bg-background p-4 hover:border-primary/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-primary font-mono text-sm font-semibold text-primary-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ~{step.weeks} weeks · {step.studyHours} hrs
                        {step.costUsd !== null ? ` · $${step.costUsd}` : ""}
                        {step.level ? ` · ${step.level}` : ""}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{step.reason}</p>
                      {step.milestones.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {step.milestones.map((m, mi) => (
                            <li key={mi} className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono text-accent">W{m.week}</span>
                              <span className="truncate">{m.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <ArrowRight size={14} className="mt-1 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Outcome icon={Clock} label="Timeline" value={`${roadmap.totalWeeks} wk`} />
                <Outcome icon={DollarSign} label="Exam cost" value={`$${roadmap.totalCostUsd}`} />
                <Outcome icon={TrendingUp} label="Steps" value={String(roadmap.steps.length)} />
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[11px] text-muted-foreground">Was this roadmap useful?</span>
                <FeedbackButtons
                  feature="career_advisor"
                  payload={{ currentRole: current, targetRole: target, steps: roadmap.steps.map((s) => s.slug) }}
                  compact
                />
              </div>
              <AdvisorCard
                page="career-explorer"
                cert={certSlug}
                context={target ? `Target role: ${target}` : undefined}
              />
            </div>
          )}
        </section>


        {/* Pass Predictor */}
        <section className="rounded-2xl border border-border bg-surface p-7 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Pass Probability Predictor</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">02</span>
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Certification">
              <select
                value={certSlug}
                onChange={(e) => setCertSlug(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {certifications.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Study hours logged: ${studyHours}`}>
              <input
                type="range"
                min={0}
                max={250}
                value={studyHours}
                onChange={(e) => setStudyHours(+e.target.value)}
                className="w-full accent-[oklch(0.65_0.14_250)]"
              />
            </Field>
            <Field label={`Mock exam avg: ${mockScore}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={mockScore}
                onChange={(e) => setMockScore(+e.target.value)}
                className="w-full accent-[oklch(0.65_0.14_250)]"
              />
            </Field>
            <Field label={`Course completion: ${completion}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={completion}
                onChange={(e) => setCompletion(+e.target.value)}
                className="w-full accent-[oklch(0.65_0.14_250)]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Practice qs: ${practiceCount}`}>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={practiceCount}
                  onChange={(e) => setPracticeCount(+e.target.value)}
                  className="w-full accent-[oklch(0.65_0.14_250)]"
                />
              </Field>
              <Field label={`Days to exam: ${daysToExam}`}>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={daysToExam}
                  onChange={(e) => setDaysToExam(+e.target.value)}
                  className="w-full accent-[oklch(0.65_0.14_250)]"
                />
              </Field>
            </div>

            <button
              onClick={runPredictor}
              disabled={loadingPred}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated disabled:opacity-60"
            >
              {loadingPred ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
              {loadingPred ? "Calculating…" : prediction ? "Re-run prediction" : "Predict my pass probability"}
            </button>
          </div>

          {loadingPred && (
            <div className="mt-7 flex items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Calculating your pass probability…
            </div>
          )}

          {!loadingPred && predError && (
            <div className="mt-7 border-t border-border pt-6">
              <div className="flex items-start gap-2 text-sm text-warning">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>We couldn’t calculate your prediction. {predError}</span>
              </div>
              <button
                onClick={runPredictor}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-elevated"
              >
                <TrendingUp size={14} /> Try again
              </button>
            </div>
          )}

          {!unlocked && predSubmitted && !loadingRoadmap && !loadingPred && (
            <div className="mt-7 border-t border-border pt-6">
              <ResultsAuthGate
                feature="career-explorer"
                campaign="certiq-career-advisor"
                title="Create your free account to see your results"
                description="Unlock your certification roadmap and pass-probability results. No payment, no password."
                onUnlocked={unlock}
                preview={
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Your personalised roadmap</div>
                    <div className="font-mono text-2xl font-semibold">00% pass probability</div>
                    <div className="text-xs text-muted-foreground">Steps, timeline and exam costs</div>
                  </div>
                }
              />
            </div>
          )}

          {unlocked && !loadingPred && !predError && predSubmitted && !prediction && (
            <div className="mt-7 border-t border-border pt-6 text-sm text-muted-foreground">
              No prediction available for these inputs yet. Adjust your study hours or mock score and run it again.
            </div>
          )}

          {unlocked && !loadingPred && !predError && prediction && (
            <div className="mt-7 border-t border-border pt-6">
              <div className="flex items-center gap-6">
                <Dial value={prediction.probability} />
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Pass probability
                  </div>
                  <div className="font-mono text-4xl font-semibold">{prediction.probability}%</div>
                  <div className="mt-2 text-sm text-muted-foreground">{prediction.summary}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-warning">
                    <AlertTriangle size={11} /> Risks
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {prediction.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-accent">
                    <Sparkles size={11} /> Next actions
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {prediction.nextActions.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[11px] text-muted-foreground">Rate this prediction's accuracy</span>
                <FeedbackButtons
                  feature="pass_predictor"
                  targetId={certSlug}
                  payload={{ probability: prediction.probability, studyHours, mockScore }}
                  compact
                />
              </div>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Outcome({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon size={11} /> {label}
      </div>
      <div className="mt-1.5 font-mono text-base font-semibold">{value}</div>
    </div>
  );
}

function Dial({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color =
    value >= 80 ? "oklch(0.72 0.18 155)" : value >= 60 ? "oklch(0.78 0.16 75)" : "oklch(0.62 0.22 25)";
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
      <circle cx="55" cy="55" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="8" fill="none" />
      <circle
        cx="55"
        cy="55"
        r={r}
        stroke={color}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}
