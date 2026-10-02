import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Cpu } from "lucide-react";
import { getAiRecsStrategy, setAiRecsStrategy } from "@/lib/admin-ai-settings.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ai-settings")({
  head: () => ({ meta: [{ title: "AI Settings — Admin — SkillTrack-365" }] }),
  component: AiSettingsPage,
});

function AiSettingsPage() {
  const get = useServerFn(getAiRecsStrategy);
  const set = useServerFn(setAiRecsStrategy);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin", "ai-recs-strategy"],
    queryFn: () => get({}),
  });

  const mut = useMutation({
    mutationFn: (strategy: "ai" | "deterministic") => set({ data: { strategy } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin", "ai-recs-strategy"] });
      toast.success(`Strategy set to ${r.strategy}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update strategy"),
  });

  const current = q.data?.strategy ?? "ai";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">AI Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose how learner next-cert recommendations are generated. Changes apply to all new requests immediately.
      </p>

      {q.data?.envOverride && (
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          Note: the environment variable <code>AI_RECS_STRATEGY={q.data.envOverride}</code> is set as a fallback when the database value is unavailable.
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <StrategyCard
          icon={Brain}
          title="AI (default)"
          desc="Call the model with one strict-prompt retry, then deterministic fallback."
          selected={current === "ai"}
          onClick={() => mut.mutate("ai")}
          disabled={mut.isPending}
        />
        <StrategyCard
          icon={Cpu}
          title="Deterministic"
          desc="Skip the model entirely. Always return ROI-sorted picks from the catalog."
          selected={current === "deterministic"}
          onClick={() => mut.mutate("deterministic")}
          disabled={mut.isPending}
        />
      </div>

      {q.data?.updatedAt && (
        <p className="mt-4 text-xs text-muted-foreground">Last changed: {new Date(q.data.updatedAt).toLocaleString()}</p>
      )}
    </div>
  );
}

function StrategyCard({
  icon: Icon, title, desc, selected, onClick, disabled,
}: { icon: any; title: string; desc: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-4 text-left transition ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      } disabled:opacity-60`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {selected && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">Active</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
      {!selected && <Button size="sm" className="mt-3" variant="outline">Use this strategy</Button>}
    </button>
  );
}
