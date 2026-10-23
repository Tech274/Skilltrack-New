import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { hasSalesWhatsApp, waLink, SALES_WHATSAPP_DISPLAY } from "@/config/contact";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { ExternalLinkMarker } from "@/components/external-link";

/** Same-origin endpoint that returns real JSON {ok:true|false}. */
import { submitLead, newSubmissionId } from "@/lib/leads";
import { getCert } from "@/lib/certifications";

function chipForVendor(vendor: string): string {
  const v = vendor.toLowerCase();
  if (v.includes("amazon")) return "AWS";
  if (v.includes("microsoft") || v.includes("azure")) return "Azure";
  if (v.includes("google")) return "GCP";
  return "DevOps";
}

const CERT_OPTIONS = ["AWS", "Azure", "GCP", "DevOps"] as const;
const TIMING_OPTIONS = ["This week", "This month", "In 1–3 months", "Just exploring"] as const;
const HEAR_OPTIONS = ["Google", "Social", "WhatsApp", "Friend", "Other"] as const;

const leadSchema = z.object({
  name: z.string().trim().nonempty("Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().nonempty("Please enter a phone or WhatsApp number").max(30),
  certs: z.array(z.string()).min(1, "Pick at least one certification interest"),
  timing: z.string().nonempty("Please choose a timeframe"),
  hearAbout: z.string().nonempty("Please choose an option"),
  notes: z.string().trim().max(1000).optional(),
});

type Utm = { utm_source: string; utm_medium: string; utm_campaign: string };

const SEARCH_KEYS = ["cert", "context", "utm_source", "utm_medium", "utm_campaign"] as const;
type BookSearch = Partial<Record<(typeof SEARCH_KEYS)[number], string>>;

export const Route = createFileRoute("/book-a-call")({
  validateSearch: (s: Record<string, unknown>): BookSearch => {
    const out: BookSearch = {};
    for (const k of SEARCH_KEYS) {
      const v = s[k];
      if (typeof v === "string" && v) out[k] = v.slice(0, 200);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Book a Free Diagnostic Call — SkillTrack" },
      {
        name: "description",
        content:
          "Book a free 20-minute diagnostic call with SkillTrack. We help you pick the right certification and build a prep plan that fits your week.",
      },
      { property: "og:title", content: "Book a Free Diagnostic Call — SkillTrack" },
      {
        property: "og:description",
        content: "Cert Clarity + Prep: pick the right certification and pass it, with a plan built on the call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/book-a-call" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/book-a-call" }],
  }),
  component: BookACallPage,
});

function BookACallPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [certs, setCerts] = useState<string[]>([]);
  const [timing, setTiming] = useState("");
  const [hearAbout, setHearAbout] = useState("");
  const [notes, setNotes] = useState("");
  const [utm, setUtm] = useState<Utm>({ utm_source: "", utm_medium: "", utm_campaign: "" });
  const [companyWebsite, setCompanyWebsite] = useState(""); // honeypot
  const [submissionId] = useState(newSubmissionId);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [error, setError] = useState<string | null>(null);

  // Capture UTMs from the page URL on load (client-only).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setUtm({
      utm_source: q.get("utm_source") ?? "",
      utm_medium: q.get("utm_medium") ?? "",
      utm_campaign: q.get("utm_campaign") ?? "",
    });
  }, []);

  // Optional pre-fill from ?cert= / ?context= (still fully editable).
  const { cert: certParam, context: contextParam } = Route.useSearch();
  useEffect(() => {
    const c = certParam ? getCert(certParam) : undefined;
    if (c) {
      const chip = chipForVendor(c.vendor);
      setCerts((prev) => (prev.includes(chip) ? prev : [...prev, chip]));
    }
    const lines = [c ? `Interested in: ${c.name}` : "", contextParam ?? ""].filter(Boolean);
    if (lines.length) setNotes((prev) => (prev.trim() ? prev : lines.join("\n").slice(0, 1000)));
  }, [certParam, contextParam]);

  function toggleCert(c: string) {
    setCerts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mounted || submitting) return;
    setError(null);

    const parsed = leadSchema.safeParse({ name, email, phone, certs, timing, hearAbout, notes });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitLead({
        source: "book_a_call",
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        certs: parsed.data.certs.join(", "),
        timing: parsed.data.timing,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        hear_about: parsed.data.hearAbout,
        notes: parsed.data.notes ?? "",
        page_path: typeof window !== "undefined" ? window.location.pathname : "/book-a-call",
        company_website: companyWebsite,
        submission_id: submissionId,
      });
      if (result.ok) {
        setReference(result.id.slice(0, 8).toUpperCase());
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="relative mx-auto max-w-2xl px-6 py-20">
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <CalendarCheck size={12} className="text-primary" /> Free 20-minute diagnostic
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            Book a <span className="text-gradient">free diagnostic</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground md:text-base">
            Takes under a minute to request. We'll help you pick the right certification and
            build a prep plan — we WhatsApp/call within 24 hours on weekdays.
          </p>
          {hasSalesWhatsApp && (
            <p className="mt-2 text-sm text-muted-foreground">
              WhatsApp us:{" "}
              <a
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                {SALES_WHATSAPP_DISPLAY}
                <ExternalLinkMarker className="size-3" />
              </a>
            </p>
          )}
        </div>

        {submitted ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface p-10 text-center shadow-card">
            <CheckCircle2 size={36} className="mx-auto text-success" />
            <h2 className="mt-4 text-xl font-semibold">Request received</h2>
            {reference && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">Reference: {reference}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Thanks — Sales will WhatsApp/call you within 24 hours on weekdays.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5 rounded-2xl border border-border bg-surface p-7 shadow-card"
          >
            {/* Honeypot — hidden from people, tempting to bots. */}
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="company_website">Company website</label>
              <input
                id="company_website"
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
              />
            </div>
            <Field label="Full name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Sharma"
                maxLength={100}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  maxLength={255}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Phone / WhatsApp">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 phone number"
                  maxLength={30}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>

            <Field label="Certification interest">
              <div className="flex flex-wrap gap-2">
                {CERT_OPTIONS.map((c) => {
                  const active = certs.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCert(c)}
                      aria-pressed={active}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "border-primary bg-gradient-primary font-medium text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="How soon?">
                <select
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {TIMING_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="How did you hear about us?">
                <select
                  value={hearAbout}
                  onChange={(e) => setHearAbout(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {HEAR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Team size, timeline, questions…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>

            {error && (
              <div role="alert" className="rounded-md border border-warning/40 bg-background px-3 py-2 text-xs text-warning">
                {error}
                <div className="mt-1">Or email admin@skilltrack.co.in</div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !mounted}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
              {submitting ? "Sending…" : "Book my free diagnostic"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
