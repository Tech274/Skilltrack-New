import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { submitFeedback } from "@/lib/feedback.functions";
import { toast } from "sonner";

type Props = {
  feature: "career_advisor" | "pass_predictor" | "milestone" | "next_cert";
  targetId?: string;
  payload?: Record<string, unknown>;
  compact?: boolean;
  label?: string;
};

export function FeedbackButtons({ feature, targetId, payload, compact, label }: Props) {
  const submit = useServerFn(submitFeedback);
  const [sent, setSent] = useState<"up" | "down" | null>(null);
  const [busy, setBusy] = useState(false);

  async function rate(value: 1 | -1) {
    setBusy(true);
    try {
      await submit({ data: { feature, rating: value, targetId, targetPayload: payload } });
      setSent(value === 1 ? "up" : "down");
      toast.success("Thanks — your feedback improves future suggestions");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className={`inline-flex items-center gap-1 text-[10px] text-muted-foreground ${compact ? "" : "mt-2"}`}>
        <Check size={10} /> Feedback recorded
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${compact ? "" : "mt-2"}`}>
      {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>}
      <button
        onClick={() => rate(1)}
        disabled={busy}
        className="rounded-md border border-border bg-background p-1 text-muted-foreground transition-colors hover:border-success/50 hover:text-success disabled:opacity-50"
        aria-label="Helpful"
      >
        {busy ? <Loader2 size={10} className="animate-spin" /> : <ThumbsUp size={10} />}
      </button>
      <button
        onClick={() => rate(-1)}
        disabled={busy}
        className="rounded-md border border-border bg-background p-1 text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
        aria-label="Not helpful"
      >
        <ThumbsDown size={10} />
      </button>
    </div>
  );
}
