import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileUp, Sparkles, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { AdvisorCard } from "@/components/advisor-card";
import {
  ResultsAuthGate,
  UnlockedNote,
  useResultsUnlock,
} from "@/components/results-auth-gate";
import {
  CTC_BANDS,
  OEM_NAMES,
  OEM_OPTIONS,
  ROLE_OPTIONS,
  certLadderForOem,
  estimateSalary,
  pickTopCertifications,
  type AssessmentAnswers,
  type CertPick,
  type Intent,
} from "@/lib/assessment";

const USED_KEY = "skilltrack.assessment.used";

export const Route = createFileRoute("/assessment")({
  validateSearch: (search: Record<string, unknown>) => ({
    oem: typeof search.oem === "string" && OEM_NAMES[search.oem] ? search.oem : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Free Certification Assessment — SkillTrack" },
      {
        name: "description",
        content:
          "Answer five short questions and get your top five certification matches from the SkillTrack catalog, with estimated salary movement for your CTC band.",
      },
      { property: "og:title", content: "Free Certification Assessment — SkillTrack" },
      {
        property: "og:description",
        content: "Five questions. Five certification matches from the real SkillTrack catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/assessment" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/assessment" }],
  }),
  component: AssessmentPage,
});


function bookCallHref(campaign: string, certSlug?: string) {
  const q = new URLSearchParams({
    utm_source: "assessment",
    utm_medium: "site",
    utm_campaign: campaign,
  });
  if (certSlug) q.set("cert", certSlug);
  return `/book-a-call?${q.toString()}`;
}

function AssessmentPage() {
  const { oem } = Route.useSearch();

  const [role, setRole] = useState<string>(ROLE_OPTIONS[4]);
  const [ctcBand, setCtcBand] = useState<string>("");
  const [intent, setIntent] = useState<Intent | "">("");
  const [comments, setComments] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [oemChoice, setOemChoice] = useState<string>(oem ?? "aws");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (oem) setOemChoice(oem);
  }, [oem]);

  const [results, setResults] = useState<CertPick[] | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers | null>(null);

  // One free assessment result per browser (and per account, once they sign up).
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  useEffect(() => {
    try {
      setAlreadyUsed(localStorage.getItem(USED_KEY) !== null);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const { unlocked, unlock } = useResultsUnlock("assessment");


  const scopedName = oemChoice ? (OEM_NAMES[oemChoice] ?? null) : null;
  const ladder = useMemo(() => certLadderForOem(oemChoice), [oemChoice]);

  const salary = useMemo(() => (answers ? estimateSalary(answers) : null), [answers]);

  function clearResumeFile() {
    setResumeFileName(null);
    setResumeText("");
  }

  async function handleResumeFile(file: File | null) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isTxt = lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/");
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";

    if (isPdf) {
      setResumeFileName(file.name);
      toast.message("PDF stored as filename only — paste resume text below for best match.");
      return;
    }

    if (!isTxt) {
      toast.error("Accepted types: .txt, .md, or .pdf (paste text for PDFs).");
      return;
    }

    try {
      const text = await file.text();
      setResumeText(text.slice(0, 20000));
      setResumeFileName(file.name);
      toast.success("Resume text loaded — used only to improve recommendations.");
    } catch {
      toast.error("Could not read that file. Paste the text instead.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ctcBand) return setFormError("Please pick your current CTC / payroll band.");
    if (!intent) return setFormError("Please tell us whether you're switching or elevating.");
    setFormError(null);

    const payload: AssessmentAnswers = {
      role,
      ctcBand,
      intent: intent as Intent,
      comments: comments.trim(),
      oem: oemChoice,
      resumeText: resumeText.trim() || undefined,
    };
    setAnswers(payload);
    setResults(pickTopCertifications(payload));
    try {
      localStorage.setItem(USED_KEY, new Date().toISOString());
    } catch {
      /* storage unavailable */
    }
    setAlreadyUsed(true);
  }




  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-accent">
          <Sparkles size={12} /> Free assessment{scopedName ? ` · ${scopedName}` : ""}
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          {scopedName
            ? `Your ${scopedName} certification ladder.`
            : "Five questions. Your five certification matches."}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {scopedName
            ? `Answer five short questions and we'll shortlist the ${scopedName} certifications we have guides for, in the order that fits your role and goal. We prepare you for the exam you pick — we don't promise a pass.`
            : "Answer five short questions and we'll shortlist certifications from the SkillTrack catalog — matched to your role and goal. We prepare you for the exam you pick; we don't promise a pass."}
        </p>
      </div>

      {scopedName && ladder.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface/60 p-5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-accent">
            {scopedName} ladder · {ladder.length} guide{ladder.length === 1 ? "" : "s"} live
          </div>
          <ol className="mt-3 flex flex-wrap gap-2">
            {ladder.map((step, i) => (
              <li key={step.slug}>
                <Link
                  to="/certifications/$slug"
                  params={{ slug: step.slug }}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-primary/40"
                >
                  <span className="font-mono text-muted-foreground">{i + 1}</span>
                  {step.name}
                  <span className="text-muted-foreground">· {step.difficulty}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!unlocked && (
        <div className="mt-10 max-w-2xl">
          <ResultsAuthGate
            feature="assessment"
            campaign={`assessment-${oemChoice || "general"}`}
            title="Create your free account to start the assessment"
            description="Username, email and phone — that's it. You'll get the five questions, your top five certification matches and your estimated salary movement. No payment, no password."
            notes={() => `Platform of interest: ${OEM_NAMES[oemChoice] ?? oemChoice}`}
            onUnlocked={unlock}
            preview={
              <div className="space-y-2">
                <div className="text-sm font-medium">Five short questions</div>
                <div className="text-sm text-muted-foreground">
                  Role · CTC band · switch or elevate · notes · platform
                </div>
                <div className="font-mono text-2xl font-semibold">Top 5 + estimated hike</div>
              </div>
            }
          />
        </div>
      )}

      {unlocked && (
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Questions */}
        <section className="rounded-2xl border border-border bg-surface p-7 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label="1. What's your current role?">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="2. Your current CTC / payroll band">
              <select
                value={ctcBand}
                onChange={(e) => setCtcBand(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Select a band…</option>
                {CTC_BANDS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="block">
              <legend className="mb-1.5 block text-sm font-medium">
                3. What are you trying to do?
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { key: "switch" as const, label: "Switch career track" },
                  { key: "elevate" as const, label: "Elevate on the same track" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setIntent(opt.key)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      intent === opt.key
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background hover:bg-surface-elevated"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="4. Anything else we should know? (optional)">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Exam deadline, budget, current study plan…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>

            <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
              <div>
                <div className="text-sm font-medium">Optional — attach or paste your resume</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Improves your top-5 by matching vendors, cert codes, roles, and skills mentioned in
                  your resume. This is not a scored skill report — no proficiency meters.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary/40">
                  <FileUp size={14} />
                  Choose file
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void handleResumeFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {resumeFileName && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                    {resumeFileName}
                    <button
                      type="button"
                      aria-label="Remove resume file"
                      onClick={clearResumeFile}
                      className="rounded p-0.5 hover:bg-surface-elevated hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={4}
                maxLength={20000}
                placeholder="Paste resume text here (recommended for PDFs)…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {resumeText.trim() && (
                <p className="text-[11px] text-muted-foreground">
                  {resumeText.trim().length.toLocaleString()} characters will be scanned for catalog keywords.
                </p>
              )}
            </div>

            <Field label="5. Confirm your platform">
              <select
                value={oemChoice}
                onChange={(e) => setOemChoice(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {OEM_OPTIONS.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>

            {formError && (
              <p role="alert" className="text-sm text-warning">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
            >
              <Sparkles size={14} /> {results ? "Update my matches" : "Show my top 5 certifications"}
            </button>
            {alreadyUsed && !results && (
              <p className="text-xs text-muted-foreground">
                You've already used your free assessment on this browser. You can still run it
                again here, or{" "}
                <a href={bookCallHref("assessment-repeat")} className="text-accent underline">
                  book a free diagnostic
                </a>{" "}
                for a deeper review.
              </p>
            )}
          </form>
        </section>

        {/* Results */}
        <section className="space-y-6">
          {!results && (
            <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
              <Sparkles size={20} className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Your top five certification matches appear here once you answer the five questions.
              </p>
            </div>
          )}

          {results && !unlocked && (
            <ResultsAuthGate
              feature="assessment"
              campaign={`assessment-${answers?.oem ?? "general"}`}
              title="Create your free account to reveal your shortlist"
              description="Your top five certification matches and the estimated hike from your current CTC unlock instantly. No payment, no password."
              notes={() =>
                [
                  `OEM: ${OEM_NAMES[answers?.oem ?? ""] ?? answers?.oem ?? ""}`,
                  `Current role: ${answers?.role ?? ""}`,
                  `CTC band: ${CTC_BANDS.find((b) => b.key === answers?.ctcBand)?.label ?? ""}`,
                  `Goal: ${answers?.intent === "switch" ? "Career switch" : "Elevate on same track"}`,
                  `Top 5: ${(results ?? []).map((c) => c.name).join(" | ")}`,
                  answers?.comments ? `Comments: ${answers.comments}` : "",
                  answers?.resumeText ? "Resume: attached/pasted (keyword boost only)" : "",
                ]
                  .filter(Boolean)
                  .join("\n")
              }
              onUnlocked={unlock}
              preview={
                <div className="space-y-2">
                  <div className="text-sm font-medium">Your top 5 certification shortlist</div>
                  <div className="text-sm text-muted-foreground">
                    1. •••••••••••  2. •••••••••  3. ••••••••
                  </div>
                  <div className="font-mono text-2xl font-semibold">+00–00% estimated hike</div>
                </div>
              }
            />
          )}

          {results && unlocked && (
            <>

              <div className="rounded-2xl border border-border bg-surface p-7 shadow-card">
                <div className="font-mono text-[11px] uppercase tracking-wider text-accent">
                  Top 5 for {OEM_NAMES[answers?.oem ?? ""] ?? "your platform"}
                </div>
                <h2 className="mt-2 text-xl font-semibold">Your certification shortlist</h2>
                {answers?.resumeText ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ranked with resume keyword matches (vendors, codes, roles, skills) — not a proficiency score.
                  </p>
                ) : null}
                <div className="mt-5 space-y-3">
                  {results.map((c, i) => (
                    <div
                      key={c.slug}
                      className="flex items-start gap-4 rounded-lg border border-border bg-background p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-primary font-mono text-sm font-semibold text-primary-foreground">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/certifications/$slug"
                          params={{ slug: c.slug }}
                          className="font-medium hover:text-accent"
                        >
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {c.vendor} · {c.code} · {c.difficulty} · ${c.cost} exam fee
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">{c.reason}</p>
                        <a
                          href={bookCallHref(`assessment-${answers?.oem ?? "general"}`, c.slug)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                        >
                          Book free diagnostic <ArrowRight size={12} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Masked salary block */}
              <div className="rounded-2xl border border-border bg-surface p-7 shadow-card">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-accent" />
                  <h2 className="text-xl font-semibold">Salary movement for your band</h2>
                </div>

                <div className="mt-5">
                  <UnlockedNote>Account created — estimates unlocked.</UnlockedNote>
                  {salary ? (
                    <div className="mt-4 rounded-lg border border-border bg-background p-5">
                      <div className="font-mono text-3xl font-semibold">
                        +{salary.hikeLowPct}–{salary.hikeHighPct}%
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Estimated hike from your current band ({salary.currentBandLabel})
                      </div>
                      <div className="mt-3 text-sm">
                        Estimated band after certification:{" "}
                        <span className="font-medium">{salary.estimatedBandLabel}</span>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{salary.note}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        These are estimates based on your inputs and typical Indian market ranges —
                        not an offer, guarantee, or verified salary data.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      We can't estimate a band from the option you picked. Book a free diagnostic
                      and we'll walk through your numbers on the call.
                    </p>
                  )}
                  <a
                    href={bookCallHref(`assessment-${answers?.oem ?? "general"}`, results[0]?.slug)}
                    className="mt-5 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
                  >
                    Book free diagnostic <ArrowRight size={14} />
                  </a>
                </div>
                <AdvisorCard
                  page="assessment"
                  cert={results[0]?.slug}
                  context={role ? `Target role: ${role}` : undefined}
                />

              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
