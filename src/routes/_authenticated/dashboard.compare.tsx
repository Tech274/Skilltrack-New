import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Award, Check, ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { certifications, getCert } from "@/lib/certifications";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/compare")({
  head: () => ({
    meta: [{ title: "Compare bookmarks — SkillTrack-365" }, { name: "robots", content: "noindex" }],
  }),
  component: BookmarkCompare,
});

function BookmarkCompare() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const bookmarksQ = useQuery({
    queryKey: ["bookmarks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_bookmarks").select("certification_slug");
      return (data ?? []).map((d) => d.certification_slug);
    },
  });

  const planQ = useQuery({
    queryKey: ["user_certs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("user_certifications").select("certification_slug");
      return (data ?? []).map((d) => d.certification_slug);
    },
  });

  useEffect(() => {
    if (bookmarksQ.data && picked.length === 0) {
      setPicked(bookmarksQ.data.slice(0, 3));
    }
  }, [bookmarksQ.data, picked.length]);

  const addCert = useMutation({
    mutationFn: async (slug: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_certifications")
        .insert({ user_id: userId, certification_slug: slug, status: "studying" });
      if (error) throw error;
    },
    onSuccess: (_d, slug) => {
      toast.success(`${getCert(slug)?.name} added to your plan`);
      qc.invalidateQueries({ queryKey: ["user_certs"] });
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bookmarks = bookmarksQ.data ?? [];
  const inPlan = new Set(planQ.data ?? []);
  const items = picked
    .map((s) => certifications.find((c) => c.slug === s))
    .filter(Boolean) as typeof certifications;

  function toggle(slug: string) {
    setPicked((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= 4
          ? [...prev.slice(1), slug]
          : [...prev, slug],
    );
  }

  const winners =
    items.length >= 2
      ? {
          cheapest: minBy(items, (c) => c.cost),
          highestSalary: maxBy(items, (c) => c.avgSalary),
          highestDemand: maxBy(items, (c) => c.demandScore),
          bestROI: maxBy(items, (c) => c.roiScore),
          easiest: maxBy(items, (c) => c.successRate),
        }
      : null;

  return (
    <div className="bg-mesh">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back to dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Compare your <span className="text-gradient-gold">bookmarks</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick up to 4 bookmarked certifications. We highlight winners and let you add the best fit
          straight to your study plan.
        </p>

        {bookmarks.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No bookmarks yet.{" "}
              <Link to="/certifications" className="text-primary hover:underline">
                Browse certifications
              </Link>{" "}
              and bookmark a few certifications to compare.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your bookmarks
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bookmarks.map((slug) => {
                  const meta = getCert(slug);
                  if (!meta) return null;
                  const on = picked.includes(slug);
                  return (
                    <button
                      key={slug}
                      onClick={() => toggle(slug)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        on
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {on && <Check size={11} />}
                      {meta.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {winners && (
              <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Lowest cost", c: winners.cheapest },
                  { label: "Highest salary", c: winners.highestSalary },
                  { label: "Highest demand", c: winners.highestDemand },
                  { label: "Best ROI", c: winners.bestROI },
                  { label: "Easiest pass", c: winners.easiest },
                ].map((w) => (
                  <div
                    key={w.label}
                    className="rounded-lg border border-border bg-card/70 p-4 backdrop-blur"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-accent">
                      <Award size={12} /> {w.label}
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-tight">{w.c.code}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-card/60">
                    <th className="w-44 p-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Attribute
                    </th>
                    {items.map((c) => (
                      <th key={c.slug} className="p-4 text-left align-top">
                        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {c.vendor}
                        </div>
                        <div className="mt-1 font-semibold">{c.name}</div>
                        <div className="mt-3">
                          {inPlan.has(c.slug) ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[10px] font-semibold text-success">
                              <Check size={10} /> In plan
                            </span>
                          ) : (
                            <button
                              onClick={() => addCert.mutate(c.slug)}
                              disabled={addCert.isPending}
                              className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                            >
                              <Plus size={11} /> Add to plan
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Row label="Difficulty" items={items.map((c) => c.difficulty)} />
                  <Row label="Exam cost" items={items.map((c) => `$${c.cost}`)} mono />
                  <Row label="Duration" items={items.map((c) => `${c.durationMin} min`)} mono />
                  <Row label="Success rate" items={items.map((c) => `${c.successRate}%`)} mono />
                  <Row
                    label="Avg salary"
                    items={items.map((c) => `$${c.avgSalary.toLocaleString()}`)}
                    mono
                  />
                  <Row label="Demand" items={items.map((c) => `${c.demandScore}/100`)} mono />
                  <Row label="ROI" items={items.map((c) => `${c.roiScore}/100`)} mono />
                  <Row label="Validity" items={items.map((c) => `${c.validityYears} yr`)} mono />
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, items, mono }: { label: string; items: string[]; mono?: boolean }) {
  return (
    <tr>
      <td className="bg-card/40 p-4 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
      {items.map((v, i) => (
        <td key={i} className={`p-4 ${mono ? "font-mono" : ""}`}>
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
