import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SkillTrack-365 — Certification Intelligence" },
      {
        name: "description",
        content:
          "SkillTrack-365 helps professionals and teams choose the right certifications, track study progress, and prove skills with data.",
      },
      { property: "og:title", content: "About SkillTrack-365" },
      {
        property: "og:description",
        content:
          "Why we built a certification intelligence platform for individuals and enterprise learning teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">About SkillTrack-365</h1>
      <p className="mt-4 text-muted-foreground">
        SkillTrack-365 is a certification intelligence platform. We help individuals pick the
        credential that actually moves their career, and help learning teams see skill coverage
        across an entire workforce.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-xl font-semibold">What we do</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We maintain a curated catalog of cloud, DevOps, security, data, AI and CRM
            certifications with exam cost, duration, passing score and skill coverage. On top of
            that catalog we run a career roadmap builder, a pass-probability predictor, study
            milestone tracking, mock exams and a central question bank.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Who it's for</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Professionals planning their next certification with a clear timeline.</li>
            <li>Training partners running cohorts and tracking learner readiness.</li>
            <li>Enterprise L&amp;D teams mapping skill gaps across teams and roles.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold">How we work</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every roadmap is built from our real certification catalog and published learning
            paths — not guesswork. Organisation data is isolated per tenant, and access to
            content is governed by explicit access rules.
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          to="/book-a-call"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
        >
          Book a free call <ArrowRight size={14} />
        </Link>
        <Link
          to="/certifications"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-elevated"
        >
          Browse certifications
        </Link>
      </div>
    </div>
  );
}
