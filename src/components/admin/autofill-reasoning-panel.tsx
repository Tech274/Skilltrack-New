import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Info } from "lucide-react";

export type ReasoningEntry = {
  source: string;
  entity: string;
  columns: string[];
  sample_count: number;
  note: string;
};
export type ReasoningMap = Record<string, ReasoningEntry>;

type Proposal = {
  patch: { settings?: Record<string, any>; program_template?: Record<string, any> };
  reasoning: ReasoningMap;
  fromJob: { id: string; target_entity: string; mapped_columns: string[] };
} | null;

function getNested(obj: any, path: string) {
  return path.split(".").reduce((a, k) => (a ? a[k] : undefined), obj);
}

export function AutofillReasoningPanel({
  proposal,
  currentSettings,
  currentTemplate,
  onAccept,
  onReject,
  onAcceptAll,
  onDismiss,
}: {
  proposal: Proposal;
  currentSettings: Record<string, any>;
  currentTemplate: Record<string, any>;
  onAccept: (field: string, value: any) => void;
  onReject: (field: string) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
}) {
  if (!proposal) return null;
  const all = { settings: proposal.patch.settings ?? {}, program_template: proposal.patch.program_template ?? {} };
  const fields: { key: string; value: any; current: any }[] = [];
  for (const k of Object.keys(all.settings)) {
    fields.push({ key: `settings.${k}`, value: all.settings[k], current: currentSettings[k] });
  }
  for (const k of Object.keys(all.program_template)) {
    fields.push({ key: `program_template.${k}`, value: all.program_template[k], current: currentTemplate[k] });
  }

  if (fields.length === 0) {
    return (
      <Card className="mt-3 p-4 text-sm text-muted-foreground">
        Pre-fill produced no proposals from this job.
        <Button size="sm" variant="ghost" className="ml-2" onClick={onDismiss}>Dismiss</Button>
      </Card>
    );
  }

  return (
    <Card className="mt-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Info size={14} className="text-primary" /> Autofill reasoning</h3>
          <p className="text-xs text-muted-foreground">
            From job <code className="font-mono">{proposal.fromJob.id.slice(0, 8)}</code> · entity {proposal.fromJob.target_entity}.
            Review each field, then accept or override.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAcceptAll}>Accept all</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {fields.map(({ key, value, current }) => {
          const r = proposal.reasoning[key];
          const changed = JSON.stringify(current ?? null) !== JSON.stringify(value ?? null);
          return (
            <div key={key} className="rounded-md border border-border/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs">{key}</code>
                    {changed ? <Badge variant="outline">change</Badge> : <Badge variant="secondary">same</Badge>}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Current</span>
                      <pre className="mt-1 overflow-auto rounded bg-muted/40 p-2"><code>{JSON.stringify(current ?? null, null, 2)}</code></pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Proposed</span>
                      <pre className="mt-1 overflow-auto rounded bg-primary/5 p-2"><code>{JSON.stringify(value, null, 2)}</code></pre>
                    </div>
                  </div>
                  {r && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Why:</span> {r.note}
                      {r.columns.length > 0 && (
                        <> · columns: {r.columns.map((c) => <code key={c} className="ml-1 rounded bg-muted px-1 font-mono text-[10px]">{c}</code>)}</>
                      )}
                      <> · samples: {r.sample_count}</>
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="default" onClick={() => onAccept(key, value)} disabled={!changed}>
                    <Check size={12} className="mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onReject(key)}>
                    <X size={12} className="mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
