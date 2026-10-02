import { useMemo } from "react";

type Step = { title: string; estimated_hours?: number };
type Milestone = { title: string; due_date?: string | null; success_criteria?: string; completed_at?: string | null };

export function MilestoneTimeline({
  steps,
  prerequisites,
  milestones,
  startDate,
}: {
  steps: Step[];
  prerequisites: string[];
  milestones: Milestone[];
  startDate?: Date;
}) {
  const today = new Date();
  const start = startDate ?? today;

  // Derived milestones: synthesize from steps if none provided.
  const derived = useMemo<Milestone[]>(() => {
    if (milestones.length) return milestones;
    let cursor = new Date(start);
    return steps.map((s) => {
      const days = Math.max(1, Math.ceil((s.estimated_hours ?? 8) / 4));
      cursor = new Date(cursor.getTime() + days * 86400000);
      return { title: s.title || "Untitled step", due_date: cursor.toISOString().slice(0, 10) };
    });
  }, [milestones, steps, start]);

  if (derived.length === 0) {
    return <p className="text-xs text-muted-foreground">No milestones or steps to chart yet.</p>;
  }

  const dates = derived
    .map((m) => (m.due_date ? new Date(m.due_date) : null))
    .filter(Boolean) as Date[];
  const minD = new Date(Math.min(start.getTime(), ...dates.map((d) => d.getTime())));
  const maxD = new Date(Math.max(start.getTime() + 7 * 86400000, ...dates.map((d) => d.getTime())));
  const span = Math.max(1, (maxD.getTime() - minD.getTime()) / 86400000);
  const pct = (d: Date) => ((d.getTime() - minD.getTime()) / 86400000 / span) * 100;

  const completedCount = derived.filter((m) => m.completed_at).length;
  const progress = Math.round((completedCount / derived.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{minD.toISOString().slice(0, 10)}</span>
        <span>Progress: {progress}% ({completedCount}/{derived.length})</span>
        <span>{maxD.toISOString().slice(0, 10)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute left-0 top-0 h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        {pct(today) >= 0 && pct(today) <= 100 && (
          <div className="absolute -top-1 h-4 w-px bg-foreground/60" style={{ left: `${pct(today)}%` }} title="Today" />
        )}
      </div>

      {prerequisites.length > 0 && (
        <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Prerequisites:</span> {prerequisites.join(" → ")}
        </div>
      )}

      <ol className="space-y-2">
        {derived.map((m, i) => {
          const due = m.due_date ? new Date(m.due_date) : null;
          const overdue = due && !m.completed_at && due < today;
          return (
            <li key={i} className="grid grid-cols-12 items-center gap-2 text-sm">
              <div className="col-span-4 truncate">
                <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  m.completed_at ? "bg-primary text-primary-foreground" : overdue ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"
                }`}>{i + 1}</span>
                <span className="truncate">{m.title}</span>
              </div>
              <div className="col-span-6">
                <div className="relative h-6">
                  {i > 0 && (
                    <div className="absolute top-1/2 h-px bg-border" style={{ left: 0, width: "100%" }} />
                  )}
                  {due && (
                    <div
                      className={`absolute top-1/2 -mt-1.5 h-3 w-3 rounded-full ring-2 ring-background ${
                        m.completed_at ? "bg-primary" : overdue ? "bg-destructive" : "bg-foreground/60"
                      }`}
                      style={{ left: `${Math.min(100, Math.max(0, pct(due)))}%` }}
                      title={due.toDateString()}
                    />
                  )}
                </div>
              </div>
              <div className={`col-span-2 text-right text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                {m.due_date ?? "no date"}
              </div>
              {m.success_criteria && (
                <div className="col-span-12 -mt-1 pl-7 text-xs text-muted-foreground">
                  ✓ {m.success_criteria}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
