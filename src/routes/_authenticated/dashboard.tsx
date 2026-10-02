import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { certifications, getCert } from "@/lib/certifications";
import { generateMilestones, predictPass, recommendNextCerts } from "@/lib/ai.functions";
import { ReminderBell } from "@/components/reminder-bell";
import { MockResultDialog } from "@/components/mock-result-dialog";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { toast } from "sonner";
import {
  BookmarkIcon,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Wand2,
  Bell,
  Loader2,
  ChevronRight,
  GitCompare,
} from "lucide-react";
import { AiFillButton } from "@/components/ai/ai-fill-button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Learner Dashboard — SkillTrack-365" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s: Record<string, unknown>): { checkout?: string } =>
    typeof s.checkout === "string" ? { checkout: s.checkout } : {},
  component: Dashboard,
});

const WELCOME_KEY = (id: string) => `skilltrack.welcomeSeen.${id}`;

function CheckoutSuccessBanner() {
  const [dismissed, setDismissed] = useState(true);
  const subQ = useQuery({
    queryKey: ["welcome_banner_sub"],
    queryFn: async (): Promise<string | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", u.user.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0]?.id ?? null;
    },
  });
  const subId = subQ.data ?? null;
  useEffect(() => {
    if (!subId) return;
    try {
      setDismissed(localStorage.getItem(WELCOME_KEY(subId)) !== null);
    } catch {
      setDismissed(false);
    }
  }, [subId]);
  function dismiss() {
    if (subId) {
      try {
        localStorage.setItem(WELCOME_KEY(subId), "1");
      } catch {
        /* storage unavailable */
      }
    }
    setDismissed(true);
  }
  if (!subId || dismissed) return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
      <div>
        <div className="font-medium text-success">
          Welcome aboard! Your subscription is active.
        </div>
        <div className="mt-1 text-muted-foreground">
          Manage your plan anytime from{" "}
          <Link to="/billing" className="underline">
            Billing
          </Link>
          .
        </div>
      </div>
      <button
        onClick={dismiss}
        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated"
      >
        Dismiss
      </button>
    </div>
  );
}

const FREE_CARD_KEY = "skilltrack.dashboard.freeCardDismissed";

function FreeVsPrepCard() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(FREE_CARD_KEY) !== null);
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  function dismiss() {
    try {
      localStorage.setItem(FREE_CARD_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    setHidden(true);
  }
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">What's free, and what we help with</h3>
        <button
          onClick={dismiss}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Free: certification guides, compare, salary data, pass predictor and your study plan. Cert
        Clarity + Prep: a founder-led prep plan built with you on a free 20-minute diagnostic call.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/certifications"
          className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface-elevated"
        >
          Add a certification
        </Link>
        <Link
          to="/book-a-call"
          search={{ utm_source: "site", utm_medium: "dashboard", utm_campaign: "onboarding" }}
          className="inline-flex items-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card"
        >
          Book a free diagnostic
        </Link>
      </div>
    </div>
  );
}

type UserCert = {
  id: string;
  certification_slug: string;
  status: "planned" | "studying" | "scheduled" | "passed" | "failed";
  target_date: string | null;
  remind_at: string | null;
  study_hours: number;
  mock_score: number | null;
  completed_at: string | null;
};

type Milestone = {
  id: string;
  user_certification_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  order_index: number;
  milestone_type: string;
  source: string;
  completed_at: string | null;
};

function Dashboard() {
  const qc = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeCertId, setActiveCertId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Persist the browser's IANA timezone once so reminders fire at user local time.
  useEffect(() => {
    if (!userId) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      supabase
        .from("profiles")
        .update({ timezone: tz })
        .eq("id", userId)
        .then(() => {});
    } catch {
      /* ignore */
    }
  }, [userId]);

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, headline, target_role, avatar_url")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const certsQ = useQuery({
    queryKey: ["user_certs", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserCert[]> => {
      const { data, error } = await supabase
        .from("user_certifications")
        .select(
          "id, certification_slug, status, target_date, remind_at, study_hours, mock_score, completed_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserCert[];
    },
  });

  const bookmarksQ = useQuery({
    queryKey: ["bookmarks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_bookmarks").select("certification_slug");
      if (error) throw error;
      return (data ?? []).map((d) => d.certification_slug);
    },
  });

  const milestonesQ = useQuery({
    queryKey: ["milestones", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase
        .from("study_milestones")
        .select(
          "id, user_certification_id, title, description, due_date, order_index, milestone_type, source, completed_at",
        )
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const addCert = useMutation({
    mutationFn: async (slug: string) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("user_certifications")
        .insert({ user_id: userId, certification_slug: slug, status: "studying" })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_certs"] });
      toast.success("Added to your study plan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeBookmark = useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase
        .from("user_bookmarks")
        .delete()
        .eq("certification_slug", slug);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const updateCert = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<UserCert> }) => {
      const { error } = await supabase.from("user_certifications").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_certs"] }),
  });

  const toggleMilestone = useMutation({
    mutationFn: async (m: Milestone) => {
      const { error } = await supabase
        .from("study_milestones")
        .update({ completed_at: m.completed_at ? null : new Date().toISOString() })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });

  const genMilestonesFn = useServerFn(generateMilestones);
  const genMilestones = useMutation({
    mutationFn: async (uc: UserCert) =>
      genMilestonesFn({
        data: {
          userCertificationId: uc.id,
          certificationSlug: uc.certification_slug,
          targetDate: uc.target_date ?? undefined,
          hoursPerWeek: 8,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("AI milestones generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recommendFn = useServerFn(recommendNextCerts);
  const recommendQ = useQuery({
    queryKey: ["ai_recommendations", userId],
    enabled: !!userId && (certsQ.data?.length ?? 0) > 0,
    queryFn: () => recommendFn({ data: {} }),
    staleTime: 1000 * 60 * 10,
  });

  const certs = certsQ.data ?? [];
  const passed = certs.filter((c) => c.status === "passed").length;
  const inProgress = certs.filter(
    (c) => c.status === "studying" || c.status === "scheduled",
  ).length;
  const totalHours = certs.reduce((s, c) => s + Number(c.study_hours || 0), 0);
  const profile = profileQ.data;
  const greetingName = profile?.display_name?.split(" ")[0] || "there";

  const suggestions = certifications
    .filter((c) => !certs.some((uc) => uc.certification_slug === c.slug))
    .slice(0, 3);

  const activeCert =
    certs.find((c) => c.id === activeCertId) ?? certs.find((c) => c.status !== "passed") ?? null;

  return (
    <div className="bg-mesh">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <CheckoutSuccessBanner />
        {/* Hero */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-primary">
              Learner Portal
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Welcome back, <span className="text-gradient-gold">{greetingName}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {profile?.headline ||
                "Track your certification journey, log study hours, and let AI predict your pass probability."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <ReminderBell userId={userId} />
            <MockResultDialog
              certs={certs
                .filter((c) => c.status !== "passed")
                .map((c) => ({
                  id: c.id,
                  slug: c.certification_slug,
                  name: getCert(c.certification_slug)?.name ?? c.certification_slug,
                }))}
              defaultCertId={activeCert?.id}
            />
            <Link
              to="/certifications"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
            >
              <Plus size={16} /> Add certification
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Trophy size={18} />}
            label="Certifications passed"
            value={passed}
            accent="primary"
          />
          <Stat icon={<Target size={18} />} label="In progress" value={inProgress} />
          <Stat icon={<Clock size={18} />} label="Study hours logged" value={totalHours} />
          <Stat
            icon={<BookmarkIcon size={18} />}
            label="Bookmarks"
            value={bookmarksQ.data?.length ?? 0}
          />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {/* Active plan column */}
          <section className="lg:col-span-2">
            {certsQ.isSuccess && certs.length === 0 && <FreeVsPrepCard />}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">My study plan</h2>
              <span className="text-xs text-muted-foreground">{certs.length} total</span>
            </div>

            {certsQ.isLoading ? (
              <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
            ) : certs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing tracked yet. Add a certification below to start your roadmap.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {certs.map((uc) => (
                  <PlanCard
                    key={uc.id}
                    uc={uc}
                    userId={userId!}
                    milestones={(milestonesQ.data ?? []).filter(
                      (m) => m.user_certification_id === uc.id,
                    )}
                    isActive={activeCert?.id === uc.id}
                    onActivate={() => setActiveCertId(uc.id)}
                    onUpdate={(patch) => updateCert.mutate({ id: uc.id, patch })}
                    onGenerate={() => genMilestones.mutate(uc)}
                    generating={genMilestones.isPending && genMilestones.variables?.id === uc.id}
                    onToggle={(m) => toggleMilestone.mutate(m)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right column: Pass predictor + bookmarks */}
          <aside className="space-y-6">
            {activeCert && <PassPredictorCard cert={activeCert} />}

            <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">AI next steps</h3>
              </div>
              {recommendQ.isLoading ? (
                <p className="mt-4 text-xs text-muted-foreground">Analyzing your profile…</p>
              ) : recommendQ.error ? (
                <p className="mt-4 text-xs text-destructive">
                  {(recommendQ.error as Error).message}
                </p>
              ) : recommendQ.data ? (
                <>
                  {"message" in (recommendQ.data as any) && (recommendQ.data as any).fallback && (
                    <div
                      role="status"
                      className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700"
                    >
                      {(recommendQ.data as any).message}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">{recommendQ.data.rationale}</p>
                  <div className="mt-4 space-y-2">
                    {recommendQ.data.recommendations.map((r) => {
                      const meta = getCert(r.slug);
                      if (!meta) return null;
                      return (
                        <div
                          key={r.slug}
                          className="rounded-lg border border-border bg-background/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{meta.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                <PriorityPill p={r.priority} /> · {meta.vendor}
                              </div>
                            </div>
                            <button
                              onClick={() => addCert.mutate(r.slug)}
                              className="rounded-md bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25"
                            >
                              Add
                            </button>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">{r.reason}</p>
                          <FeedbackButtons
                            feature="next_cert"
                            targetId={r.slug}
                            payload={{ priority: r.priority }}
                            compact
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Add a certification to your plan to receive personalized AI recommendations.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Bookmarks */}
        <section className="mt-12">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookmarkIcon size={16} className="text-primary" />
              <h2 className="text-xl font-semibold">Bookmarked certifications</h2>
            </div>
            {(bookmarksQ.data?.length ?? 0) >= 2 && (
              <Link
                to="/dashboard/compare"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/70 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-card"
              >
                <GitCompare size={14} /> Compare bookmarks
              </Link>
            )}
          </div>

          {(bookmarksQ.data?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
              No bookmarks yet.{" "}
              <Link to="/certifications" className="text-primary hover:underline">
                Browse certifications
              </Link>{" "}
              and tap the bookmark icon on any certification.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {(bookmarksQ.data ?? []).map((slug) => {
                const meta = getCert(slug);
                if (!meta) return null;
                const inPlan = certs.some((c) => c.certification_slug === slug);
                return (
                  <div key={slug} className="rounded-xl border border-border bg-card/70 p-5">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {meta.vendor}
                    </div>
                    <h3 className="mt-1 font-semibold tracking-tight">{meta.name}</h3>
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {meta.tagline}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>${meta.cost} exam</span>
                      <span>{meta.difficulty}</span>
                      <span>${(meta.avgSalary / 1000).toFixed(0)}K avg</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to="/certifications/$slug"
                        params={{ slug }}
                        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated"
                      >
                        Details
                      </Link>
                      <Link
                        to="/compare"
                        className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated"
                      >
                        Compare
                      </Link>
                      {inPlan ? (
                        <button
                          onClick={() => {
                            const uc = certs.find((c) => c.certification_slug === slug);
                            if (uc) {
                              setActiveCertId(uc.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                          className="rounded-md bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25"
                        >
                          Resume study
                        </button>
                      ) : (
                        <button
                          onClick={() => addCert.mutate(slug)}
                          className="rounded-md bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Add to plan
                        </button>
                      )}
                      <button
                        onClick={() => removeBookmark.mutate(slug)}
                        className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-xl font-semibold">Suggested for you</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {suggestions.map((c) => (
                <div
                  key={c.slug}
                  className="rounded-xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/40"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.vendor}
                  </p>
                  <h3 className="mt-1 font-semibold tracking-tight">{c.name}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{c.tagline}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      ${c.avgSalary.toLocaleString()} avg
                    </span>
                    <button
                      onClick={() => addCert.mutate(c.slug)}
                      disabled={addCert.isPending}
                      className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- Plan card with milestones ---------- */

function PlanCard({
  uc,
  userId,
  milestones,
  isActive,
  onActivate,
  onUpdate,
  onGenerate,
  generating,
  onToggle,
}: {
  uc: UserCert;
  userId: string;
  milestones: Milestone[];
  isActive: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<UserCert>) => void;
  onGenerate: () => void;
  generating: boolean;
  onToggle: (m: Milestone) => void;
}) {
  const meta = getCert(uc.certification_slug);
  const [open, setOpen] = useState(isActive);
  const qc = useQueryClient();
  const addMilestone = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const title = String(patch.title ?? "").trim();
      if (!title) throw new Error("Title required");
      const { error } = await supabase.from("study_milestones").insert({
        user_id: userId,
        user_certification_id: uc.id,
        certification_slug: uc.certification_slug,
        title,
        description: typeof patch.description === "string" ? patch.description : null,
        due_date: typeof patch.due_date === "string" ? patch.due_date : null,
        milestone_type: "study",
        source: "manual",
        order_index: milestones.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add milestone"),
  });
  const done = milestones.filter((m) => m.completed_at).length;
  const total = milestones.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className={`rounded-xl border bg-card/70 backdrop-blur transition-colors ${
        isActive ? "border-primary/50 shadow-card" : "border-border"
      }`}
    >
      <button
        onClick={() => {
          setOpen((o) => !o);
          onActivate();
        }}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={uc.status} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {meta?.code ?? uc.certification_slug}
            </span>
            {uc.target_date && (
              <span className="text-[10px] text-muted-foreground">Exam {uc.target_date}</span>
            )}
          </div>
          <h3 className="mt-1 font-semibold tracking-tight">
            {meta?.name ?? uc.certification_slug}
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{Number(uc.study_hours)}h studied</span>
            {uc.mock_score != null && <span>Mock: {uc.mock_score}%</span>}
            {total > 0 && (
              <span>
                {done}/{total} milestones · {pct}%
              </span>
            )}
          </div>
          {total > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <ChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          {/* Plan controls */}
          <div className="grid gap-3 md:grid-cols-4">
            <InlineField label="Exam date">
              <input
                type="date"
                value={uc.target_date ?? ""}
                onChange={(e) => onUpdate({ target_date: e.target.value || null })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </InlineField>
            <InlineField label="Reminder">
              <input
                type="date"
                value={uc.remind_at ? uc.remind_at.slice(0, 10) : ""}
                onChange={(e) =>
                  onUpdate({
                    remind_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </InlineField>
            <InlineField label="Study hours">
              <input
                type="number"
                min={0}
                value={uc.study_hours}
                onChange={(e) => onUpdate({ study_hours: Number(e.target.value) })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </InlineField>
            <InlineField label="Mock %">
              <input
                type="number"
                min={0}
                max={100}
                value={uc.mock_score ?? ""}
                onChange={(e) =>
                  onUpdate({ mock_score: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </InlineField>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {total > 0 ? "Regenerate AI milestones" : "Generate AI milestones"}
            </button>
            {uc.remind_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] text-warning">
                <Bell size={10} /> Reminder set {new Date(uc.remind_at).toLocaleDateString()}
              </span>
            )}
            {uc.status !== "passed" && (
              <button
                onClick={() =>
                  onUpdate({ status: "passed", completed_at: new Date().toISOString() })
                }
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25"
              >
                <CheckCircle2 size={12} /> Mark passed
              </button>
            )}
          </div>

          {/* Add a single milestone with AI */}
          <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              Need a custom milestone? Use AI to draft title, description, and due date.
            </div>
            <AiFillButton
              formKey="milestone"
              currentValues={{}}
              onApply={(patch) => addMilestone.mutate(patch)}
              contextHint={`Certification: ${meta?.name ?? uc.certification_slug}. Exam date: ${uc.target_date ?? "not set"}. Existing milestones: ${milestones.length}.`}
              label="Add milestone with AI"
            />
          </div>

          {/* Milestone checklist */}
          {total === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground">
              No milestones yet. Generate an AI roadmap above to get a step-by-step checklist.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3"
                >
                  <button
                    onClick={() => onToggle(m)}
                    className="mt-0.5 shrink-0 text-primary"
                    aria-label={m.completed_at ? "Mark incomplete" : "Mark complete"}
                  >
                    {m.completed_at ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          m.completed_at ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {m.title}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {m.milestone_type}
                      </span>
                      {m.due_date && (
                        <span className="text-[10px] text-muted-foreground">due {m.due_date}</span>
                      )}
                    </div>
                    {m.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pass predictor card (AI) ---------- */

function PassPredictorCard({ cert }: { cert: UserCert }) {
  const meta = getCert(cert.certification_slug);
  const predictFn = useServerFn(predictPass);
  const q = useQuery({
    queryKey: ["predict", cert.id, cert.study_hours, cert.mock_score, cert.target_date],
    queryFn: () =>
      predictFn({
        data: {
          certificationSlug: cert.certification_slug,
          studyHours: Number(cert.study_hours || 0),
          mockScore: Number(cert.mock_score ?? 0),
          courseCompletion: Math.min(100, Math.round(Number(cert.study_hours || 0) * 1.2)),
          practiceCount: 0,
          daysToExam: cert.target_date
            ? Math.max(
                0,
                Math.round(
                  (new Date(cert.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                ),
              )
            : 30,
        },
      }),
    staleTime: 1000 * 60 * 5,
  });

  const value = q.data?.probability ?? 0;
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Pass probability</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{meta?.name}</p>
      <div className="mt-4 flex items-center gap-4">
        <Dial value={value} />
        <div className="flex-1">
          <div className="font-mono text-3xl font-semibold">{q.isLoading ? "…" : `${value}%`}</div>
          {q.data && <p className="mt-1 text-xs text-muted-foreground">{q.data.summary}</p>}
        </div>
      </div>
      {q.data && (
        <div className="mt-4 grid gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risks</div>
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
              {q.data.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Next actions
            </div>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {q.data.nextActions.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {q.error && <p className="mt-3 text-xs text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <div className="mt-4 border-t border-border pt-3">
          <FeedbackButtons
            feature="pass_predictor"
            targetId={cert.id}
            payload={{ probability: q.data.probability, slug: cert.certification_slug }}
            label="Rate accuracy"
            compact
          />
        </div>
      )}
    </div>
  );
}

/* ---------- small helpers ---------- */

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "primary";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={accent === "primary" ? "text-primary" : ""}>{icon}</span>
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: UserCert["status"] }) {
  const cls: Record<UserCert["status"], string> = {
    planned: "bg-muted text-muted-foreground",
    studying: "bg-accent/15 text-accent",
    scheduled: "bg-warning/15 text-warning",
    passed: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls[status]}`}
    >
      {status}
    </span>
  );
}

function PriorityPill({ p }: { p: "high" | "medium" | "low" }) {
  const cls = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-muted-foreground",
  }[p];
  return <span className={`font-semibold uppercase ${cls}`}>{p}</span>;
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

function Dial({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color =
    value >= 80
      ? "oklch(0.72 0.18 155)"
      : value >= 60
        ? "oklch(0.78 0.16 75)"
        : "oklch(0.62 0.22 25)";
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90 shrink-0">
      <circle cx="42" cy="42" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" fill="none" />
      <circle
        cx="42"
        cy="42"
        r={r}
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    </svg>
  );
}
