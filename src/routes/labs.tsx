import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { buildHandoffUrl, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";

/**
 * /labs is not a product surface — nav Labs already opens SkillHub externally.
 * This route redirects there with the same handoff query params so bookmarks
 * and old "coming soon" links never show an empty Labs page again.
 */
export const Route = createFileRoute("/labs")({
  beforeLoad: () => {
    // SSR / first paint: anonymous handoff (email/phone filled client-side below).
    throw redirect({
      href: buildHandoffUrl(SKILLHUB_BASE_URL),
    });
  },
  head: () => ({
    meta: [
      { title: "Labs — SkillHub | SkillTrack" },
      {
        name: "description",
        content: "Hands-on labs live on SkillHub. Continue there from SkillTrack.",
      },
      { property: "og:title", content: "Labs — SkillHub | SkillTrack" },
      {
        property: "og:description",
        content: "Continue to SkillHub for hands-on labs.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://skilltrack.co.in/labs" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/labs" }],
  }),
  component: LabsRedirectFallback,
});

/** Shown only if the beforeLoad redirect is skipped (e.g. client nav quirk). */
function LabsRedirectFallback() {
  const handoff = useHandoffContext();
  const hubUrl = useMemo(
    () => buildHandoffUrl(SKILLHUB_BASE_URL, handoff),
    [handoff.email, handoff.phone],
  );

  useEffect(() => {
    window.location.replace(hubUrl);
  }, [hubUrl]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
        <FlaskConical size={12} /> Redirecting
      </div>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
        Continuing to SkillHub…
      </h1>
      <p className="mt-4 text-muted-foreground">
        Labs live on SkillHub. If you are not redirected automatically, use the button below.
      </p>

      <div className="mt-10">
        <a
          href={hubUrl}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
        >
          Continue to SkillHub <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}
