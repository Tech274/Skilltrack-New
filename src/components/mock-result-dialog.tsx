import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { logMockResult } from "@/lib/mocks.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type UCOption = { id: string; slug: string; name: string };

export function MockResultDialog({ certs, defaultCertId }: { certs: UCOption[]; defaultCertId?: string }) {
  const qc = useQueryClient();
  const logFn = useServerFn(logMockResult);
  const [open, setOpen] = useState(false);
  const [certId, setCertId] = useState(defaultCertId ?? certs[0]?.id ?? "");
  const [score, setScore] = useState("");
  const [passing, setPassing] = useState("70");
  const [provider, setProvider] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const cert = certs.find((c) => c.id === certId);
      if (!cert) throw new Error("Pick a certification");
      return logFn({
        data: {
          userCertificationId: cert.id,
          certificationSlug: cert.slug,
          score: Number(score),
          passingScore: Number(passing),
          provider: provider || undefined,
          durationMinutes: duration ? Number(duration) : undefined,
          notes: notes || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Mock result logged. Pass probability updated.");
      qc.invalidateQueries({ queryKey: ["user_certs"] });
      qc.invalidateQueries({ queryKey: ["predict"] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["mocks"] });
      setOpen(false);
      setScore("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (certs.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/70 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-card">
          <ClipboardCheck size={14} /> Log mock exam
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a mock exam result</DialogTitle>
          <DialogDescription>
            Updates your study plan's average mock score and recomputes pass probability.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Certification</Label>
            <select
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="score">Score (%)</Label>
              <Input
                id="score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="78"
              />
            </div>
            <div>
              <Label htmlFor="passing">Passing (%)</Label>
              <Input
                id="passing"
                type="number"
                min={0}
                max={100}
                value={passing}
                onChange={(e) => setPassing(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Tutorials Dojo, A Cloud Guru…"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weakest domain, what to review…"
            />
          </div>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending || !score}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
            Save result
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
