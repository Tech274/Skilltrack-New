import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { listMyOrgs, createOrg, joinDemoOrg } from "@/lib/org.functions";
import { toast } from "sonner";
import { AiFillButton } from "@/components/ai/ai-fill-button";


export const Route = createFileRoute("/_authenticated/org/")({
  head: () => ({ meta: [{ title: "Organizations — SkillTrack-365" }, { name: "robots", content: "noindex" }] }),
  component: OrgIndex,
});

function OrgIndex() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyOrgs);
  const createFn = useServerFn(createOrg);
  const demoFn = useServerFn(joinDemoOrg);

  const q = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => listFn(),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, slug } }),
    onSuccess: (d) => {
      toast.success("Organization created");
      navigate({ to: "/org/$slug/exec", params: { slug: d.slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinDemo = useMutation({
    mutationFn: () => demoFn(),
    onSuccess: (d) => navigate({ to: "/org/$slug/exec", params: { slug: d.slug } }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-wider text-primary">Enterprise</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your organizations</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Run workforce skills, compliance, and certification ROI for your whole organization.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Joined</h2>
          {q.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : (q.data ?? []).length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-card/40 p-6">
              <p className="text-sm text-muted-foreground">
                You're not in any organization yet. Try the demo workspace to explore enterprise dashboards instantly.
              </p>
              <button
                onClick={() => joinDemo.mutate()}
                disabled={joinDemo.isPending}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Sparkles size={14} /> Try the Skylark demo workspace
              </button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {(q.data ?? []).map((m) => (
                <li key={m.org.id}>
                  <Link
                    to="/org/$slug/exec"
                    params={{ slug: m.org.slug }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/70 p-4 backdrop-blur hover:border-primary/40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                      <Building2 size={16} className="text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{m.org.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.org.industry ?? "—"} · {m.org.size_band ?? "—"} · role: {m.role}
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Create new
            </h2>
            <AiFillButton
              formKey="organization"
              currentValues={{ name, slug }}
              onApply={(patch) => {
                if (typeof patch.name === "string") setName(patch.name);
                if (typeof patch.slug === "string") setSlug(patch.slug);
              }}
              contextHint="Pre-fill organization name and URL slug. Slug: lowercase, hyphenated, max 60 chars."
            />
          </div>
          <div className="mt-3 rounded-xl border border-border bg-card/70 p-5 backdrop-blur">

            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Organization name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")
                    .slice(0, 60),
                );
              }}
              placeholder="Acme Corp"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              URL slug
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-corp"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !name || !slug}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Plus size={14} /> Create organization
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              You'll be added as the executive owner. Invite teammates from Members tab.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
