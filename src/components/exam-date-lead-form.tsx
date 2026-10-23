import { useEffect, useId, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { MessagingConsentField } from "@/components/messaging-consent";
import {
  examDateFieldErrors,
  examDateLeadInput,
  examFormToday,
  newSubmissionId,
  nextIsoDate,
  submitLead,
} from "@/lib/leads";

export type ExamDateCertification = { slug: string; name: string };

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60";

/**
 * Email + future exam date capture. Self-contained so it can sit on the home
 * page and certification pages without sharing state with the rest of the page.
 * Certification pages pass the cert the visitor is reading; the home page does not.
 */
export function ExamDateLeadForm({ certification }: { certification?: ExamDateCertification }) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const emailId = `${baseId}-email`;
  const dateId = `${baseId}-date`;
  const statusId = `${baseId}-status`;
  const consentId = `${baseId}-consent`;
  const successRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);

  const [email, setEmail] = useState("");
  const [examDate, setExamDate] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [submissionId] = useState(newSubmissionId);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  const [minDate, setMinDate] = useState("");
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");
  const [messagingConsent, setMessagingConsent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setMinDate(nextIsoDate(examFormToday()));
    const q = new URLSearchParams(window.location.search);
    setUtm({
      source: (q.get("utm_source") ?? "").slice(0, 200),
      medium: (q.get("utm_medium") ?? "").slice(0, 200),
      campaign: (q.get("utm_campaign") ?? "").slice(0, 200),
    });
  }, []);

  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  const statusText = submitted
    ? ""
    : [emailError, dateError, consentError, formError].filter(Boolean).join(" ") ||
      (submitting ? "Saving your exam date." : "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted || lock.current || submitted) return;

    const errors = examDateFieldErrors(email, examDate, examFormToday(), messagingConsent);
    setEmailError(errors.email);
    setDateError(errors.date);
    setConsentError(errors.consent);
    setFormError(null);
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.date) {
      dateRef.current?.focus();
      return;
    }
    if (errors.consent) {
      document.getElementById(consentId)?.focus();
      return;
    }

    lock.current = true;
    setSubmitting(true);
    try {
      const result = await submitLead(
        examDateLeadInput({
          email,
          targetExamDate: examDate,
          certification,
          pagePath: window.location.pathname,
          utmSource: utm.source,
          utmMedium: utm.medium,
          utmCampaign: utm.campaign,
          submissionId,
          companyWebsite,
        }),
      );
      if (result.ok) {
        setReference(result.id.slice(0, 8).toUpperCase());
        setSubmitted(true);
        return;
      }
      setFormError(result.error);
      lock.current = false;
    } catch {
      setFormError("We could not send your request. Please try again.");
      lock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  const title = certification
    ? `Planning ${certification.name}?`
    : "Tell us when you want to sit the exam";

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border bg-surface p-7 shadow-card"
    >
      {submitted ? (
        <div className="text-center">
          <CheckCircle2 size={36} className="mx-auto text-success" aria-hidden="true" />
          <h2
            ref={successRef}
            id={headingId}
            tabIndex={-1}
            className="mt-4 text-xl font-semibold tracking-tight outline-none"
          >
            Exam date saved
          </h2>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">
            Thanks. We'll be in touch at {email} about your {examDate} exam date.
            {reference ? ` Reference ${reference}.` : ""}
          </p>
        </div>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <CalendarCheck size={12} className="text-primary" aria-hidden="true" />
            Exam date
          </div>
          <h2 id={headingId} className="mt-4 text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {certification
              ? "Share the email we should use and the date you are aiming for. We will save them with this certification."
              : "Share the email we should use and the date you are aiming for."}
          </p>
          {certification && (
            <p className="mt-3 text-sm text-muted-foreground">
              Certification:{" "}
              <span className="font-medium text-foreground">{certification.name}</span>
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-6 space-y-5"
            aria-busy={submitting}
          >
            <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={`${baseId}-company`}>Company website</label>
              <input
                id={`${baseId}-company`}
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={companyWebsite}
                onChange={(event) => setCompanyWebsite(event.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor={emailId}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Email <span className="sr-only">(required)</span>
              </label>
              <input
                ref={emailRef}
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={255}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="you@company.com"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? statusId : undefined}
                disabled={submitting}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor={dateId}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Target exam date <span className="sr-only">(required)</span>
              </label>
              <input
                ref={dateRef}
                id={dateId}
                name="target_exam_date"
                type="date"
                required
                min={minDate || undefined}
                value={examDate}
                onChange={(event) => {
                  setExamDate(event.target.value);
                  if (dateError) setDateError(null);
                }}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? statusId : undefined}
                disabled={submitting}
                className={inputClass}
              />
            </div>

            <p
              id={statusId}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={
                statusText
                  ? "rounded-md border border-warning/40 bg-background px-3 py-2 text-xs text-warning"
                  : "sr-only"
              }
            >
              {statusText}
            </p>

            <MessagingConsentField
              id={consentId}
              checked={messagingConsent}
              onChange={(checked) => {
                setMessagingConsent(checked);
                if (checked) setConsentError(null);
              }}
            />

            <button
              type="submit"
              disabled={!mounted || submitting || !messagingConsent}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <CalendarCheck size={14} aria-hidden="true" />
              )}
              {submitting ? "Saving…" : "Save my exam date"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
