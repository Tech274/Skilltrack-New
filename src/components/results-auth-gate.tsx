import { useEffect, useState } from "react";
import { z } from "zod";
import { useLocation } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Lock, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { submitLead, newSubmissionId } from "@/lib/leads";
import { MessagingConsentField } from "@/components/messaging-consent";
const keyFor = (feature: string) => `skilltrack.unlock.${feature}`;

/** All CertIQ soft-gated features — one sign-in unlocks every tool. */
const SOFT_FEATURES = ["assessment", "career-explorer", "compare", "salary"];

function setStored(feature: string) {
  try {
    localStorage.setItem(keyFor(feature), new Date().toISOString());
  } catch {
    /* storage unavailable */
  }
}

function unlockAll() {
  for (const f of SOFT_FEATURES) setStored(f);
}

export function useResultsUnlock(feature: string) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      if (localStorage.getItem(keyFor(feature)) !== null) {
        setUnlocked(true);
        setReady(true);
      }
    } catch {
      /* storage unavailable */
    }

    // Active Supabase session (Google SSO / email / phone) unlocks every tool.
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        unlockAll();
        setUnlocked(true);
      }
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        unlockAll();
        setUnlocked(true);
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [feature]);

  function unlock() {
    setStored(feature);
    setUnlocked(true);
  }

  return { unlocked, ready, unlock };
}

const accountSchema = z.object({
  username: z.string().trim().min(2, "Please enter a username").max(60),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().min(6, "Please enter a phone or WhatsApp number").max(30),
  messagingConsent: z.literal(true, {
    message: "Please agree to be contacted before submitting.",
  }),
});

export function ResultsAuthGate({
  feature,
  title = "Create your free account to see your results",
  description = "Takes under a minute. No payment, no password — we'll send you a sign-in code when you're ready.",
  campaign,
  notes,
  onUnlocked,
  preview,
}: {
  feature: string;
  title?: string;
  description?: string;
  campaign: string;
  notes?: () => string;
  onUnlocked: () => void;
  preview?: React.ReactNode;
}) {
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState(""); // honeypot
  const [messagingConsent, setMessagingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [submissionId] = useState(newSubmissionId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Already-signed-in users never see the lead form — unlock immediately.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.user));
      if (data.user) onUnlocked();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        setSignedIn(true);
        onUnlocked();
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = `${location.pathname}${location.searchStr ?? ""}`;
  const authHref = `/auth?next=${encodeURIComponent(next)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mounted || saving) return;
    const parsed = accountSchema.safeParse({ username, email, phone, messagingConsent });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const result = await submitLead({
        source: "results_gate",
        name: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone,
        timing: "Account signup",
        utm_source: feature,
        utm_medium: "site",
        utm_campaign: campaign,
        hear_about: "Other",
        page_path: location.pathname,
        notes: [`Username: ${parsed.data.username}`, `Feature: ${feature}`, notes?.() ?? ""]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1000),
        company_website: companyWebsite,
        submission_id: submissionId,
        messaging_consent: true,
      });
      if (result.ok) {
        onUnlocked();
      } else {
        setError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-7 shadow-card">
      <div className="relative overflow-hidden rounded-lg border border-border bg-background p-5">
        <div aria-hidden className="select-none blur-sm">
          {preview ?? (
            <div className="space-y-2">
              <div className="font-mono text-3xl font-semibold">••••••</div>
              <div className="text-sm text-muted-foreground">
                Your personalised results are ready.
              </div>
              <div className="text-xs text-muted-foreground">
                Detailed breakdown and recommendations.
              </div>
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium">
            <Lock size={12} /> Locked
          </span>
        </div>
      </div>

      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 max-w-md space-y-3">
        <a
          href={authHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
        >
          <LogIn size={14} /> Sign in / Create account
        </a>

        {!showLeadForm ? (
          <button
            type="button"
            onClick={() => setShowLeadForm(true)}
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Or continue without a password
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone / WhatsApp"
              autoComplete="tel"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />
            <MessagingConsentField
              id="results-messaging-consent"
              checked={messagingConsent}
              onChange={setMessagingConsent}
            />
            {error && (
              <p role="alert" className="text-sm text-warning">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !mounted}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-surface-elevated disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {saving ? "Creating your account…" : "Continue without a password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function UnlockedNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-accent">
      <CheckCircle2 size={14} /> {children ?? "Account created — results unlocked."}
    </div>
  );
}
