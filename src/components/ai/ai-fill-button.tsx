import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { autofillForm } from "@/lib/ai-autofill.functions";

type Props = {
  formKey:
    | "certification"
    | "study_resource"
    | "mock_question"
    | "mock_exam"
    | "milestone"
    | "learning_path"
    | "organization"
    | "org_settings"
    | "invoice_email_template";
  currentValues: Record<string, unknown>;
  onApply: (patch: Record<string, unknown>) => void;
  contextHint?: string;
  label?: string;
  size?: "sm" | "default";
};

function previewValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function AiFillButton({ formKey, currentValues, onApply, contextHint, label = "Fill with AI", size = "sm" }: Props) {
  const run = useServerFn(autofillForm);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const mut = useMutation({
    mutationFn: () =>
      run({
        data: {
          formKey,
          prompt: prompt.trim(),
          currentValues,
          context: contextHint,
        },
      }),
    onSuccess: (res) => {
      const s = (res?.suggestions ?? {}) as Record<string, unknown>;
      setSuggestions(s);
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(s)) next[k] = true;
      setSelected(next);
    },
    onError: (e: any) => toast.error(e?.message ?? "AI autofill failed"),
  });

  const reset = () => {
    setPrompt("");
    setSuggestions(null);
    setSelected({});
  };

  const handleApply = () => {
    if (!suggestions) return;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(suggestions)) {
      if (selected[k]) patch[k] = v;
    }
    onApply(patch);
    toast.success(`Applied ${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? "" : "s"}`);
    setOpen(false);
    reset();
  };

  const entries = suggestions ? Object.entries(suggestions) : [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Sparkles size={14} className="text-primary" />
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> AI fill
            </DialogTitle>
          </DialogHeader>

          {!suggestions ? (
            <div className="space-y-3">
              <Label htmlFor="ai-fill-prompt">Describe what to fill</Label>
              <Textarea
                id="ai-fill-prompt"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. AWS Certified Solutions Architect Associate (SAA-C03), intermediate level"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                AI will suggest field values. Nothing is saved until you review and apply.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Review suggestions, then apply.</p>
              <ScrollArea className="max-h-[50vh] rounded-md border border-border/60">
                <div className="divide-y divide-border/60">
                  {entries.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">AI did not return any fields.</div>
                  ) : (
                    entries.map(([k, v]) => {
                      const current = currentValues?.[k];
                      const changed = JSON.stringify(current ?? null) !== JSON.stringify(v ?? null);
                      return (
                        <label key={k} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
                          <Checkbox
                            checked={!!selected[k]}
                            onCheckedChange={(c) => setSelected((s) => ({ ...s, [k]: !!c }))}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold">{k}</span>
                              {changed && (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-600">
                                  changed
                                </span>
                              )}
                            </div>
                            {changed && current !== undefined && current !== null && current !== "" && (
                              <div className="mt-1 text-xs text-muted-foreground line-through">
                                {previewValue(current)}
                              </div>
                            )}
                            <div className="mt-0.5 text-sm whitespace-pre-wrap break-words">{previewValue(v)}</div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!suggestions ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => mut.mutate()} disabled={mut.isPending || prompt.trim().length < 2}>
                  {mut.isPending ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" /> Thinking…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5" /> Generate
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={reset}>
                  New prompt
                </Button>
                <Button onClick={handleApply} disabled={Object.values(selected).every((v) => !v)}>
                  Apply selected
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
