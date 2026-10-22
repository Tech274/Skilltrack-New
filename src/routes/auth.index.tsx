import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const search: { next?: string } = {};
    if (typeof s.next === "string" && s.next) search.next = s.next;
    // Keep the rest of the query string (utm and friends) across /login and /signup.
    for (const [key, value] of Object.entries(s)) {
      if (key === "next" || typeof value !== "string" || !value) continue;
      (search as Record<string, string>)[key] = value;
    }
    return search;
  },

  head: () => ({
    meta: [
      { title: "Sign in — SkillTrack-365" },
      { name: "description", content: "Sign in or create your free SkillTrack-365 account to start tracking certifications and accelerating your career." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Method = "email" | "phone";

/** Only allow same-origin relative paths as a post-login redirect target. */
function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function AuthPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const redirectTo = safeNext(next);
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const phoneValid = /^\+[1-9]\d{7,14}$/.test(phone.trim());
  const otpValid = /^\d{4,8}$/.test(otp.trim());

  function goAfterAuth() {
    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }
    navigate({ to: "/dashboard" });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      if (redirectTo) {
        window.location.href = redirectTo;
        return;
      }
      navigate({ to: "/dashboard" });
    });
  }, [navigate, redirectTo]);


  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo ?? "/dashboard"}`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        router.invalidate();
        goAfterAuth();

      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const normalized = phone.trim();
    setPhoneError(null);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setPhoneError("Enter your number in international format, e.g. +919812345678");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setOtpSent(true);
      setOtp("");
      setOtpError(null);
      toast.success("Verification code sent via SMS.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      setPhoneError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.trim();
    setOtpError(null);
    if (!/^\d{4,8}$/.test(code)) {
      setOtpError("Enter the numeric code from the SMS (4–8 digits).");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: code,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Signed in.");
      router.invalidate();
      goAfterAuth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }


  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectTo ?? ""}`,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.invalidate();
    goAfterAuth();

  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-elevated">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Sign in to track certifications and skills."
          : "Free forever. No credit card required."}
      </p>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => { setMethod("email"); setOtpSent(false); }}
          className={`rounded px-3 py-1.5 transition-colors ${method === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => { setMethod("phone"); setMode("signin"); }}
          className={`rounded px-3 py-1.5 transition-colors ${method === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Phone (OTP)
        </button>
      </div>

      {method === "email" ? (
        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Lovelace"
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputCls}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      ) : (
        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-3">
          <Field label="Phone number">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
              placeholder="+919812345678"
              disabled={otpSent}
              aria-invalid={!!phoneError}
              className={inputCls}
            />
          </Field>
          {phoneError && (
            <p role="alert" className="text-xs text-destructive">{phoneError}</p>
          )}
          {otpSent && (
            <>
              <Field label="6-digit code">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={4}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
                  placeholder="123456"
                  aria-invalid={!!otpError}
                  className={inputCls}
                />
              </Field>
              {otpError && (
                <p role="alert" className="text-xs text-destructive">{otpError}</p>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={loading || (otpSent ? !otpValid : !phoneValid)}
            className="mt-2 w-full rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? (otpSent ? "Verifying…" : "Sending code…") : otpSent ? "Verify & sign in" : "Send code"}
          </button>
          {otpSent && (
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtp(""); setOtpError(null); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different number
            </button>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Use international format (E.164), e.g. +91 for India. Super Admins can sign in with the phone number attached to their account.
          </p>
        </form>
      )}

      {method === "email" && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to SkillTrack-365?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.3 0-5.9-2.7-5.9-6.1S8.7 6 12 6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.4 0-.5-.1-.9-.1-1.3H12z" />
    </svg>
  );
}
