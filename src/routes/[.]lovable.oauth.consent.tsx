import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

type OAuthDetails = {
  client?: { name?: string | null; client_id?: string | null; client_uri?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">Authorization request failed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Close this window and start the connection again from your AI assistant.
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-mesh">
      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="mx-auto mb-8 flex items-center gap-2.5">
          <BrandLogo className="h-10 w-10 object-contain" size={40} />
          <span className="text-base font-semibold tracking-tight">
            Skilltrack<span className="text-primary">-365</span>
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-elevated backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an AI assistant";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(null);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">Connect {clientName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {clientName} is requesting access to your SkillTrack-365 account. It will act as you.
      </p>

      <ul className="mt-5 space-y-2 text-sm text-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span> Search the certification catalog
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span> Read and update your tracked certifications
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span> Read and complete your study milestones
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span> Browse learning paths available to you
        </li>
      </ul>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide(false)}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-elevated disabled:opacity-50"
        >
          {busy === "deny" ? "Cancelling…" : "Deny"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide(true)}
          className="flex-1 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {busy === "approve" ? "Connecting…" : "Approve"}
        </button>
      </div>
    </Shell>
  );
}
