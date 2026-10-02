import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Certification guidance from SkillTrack" },
      {
        name: "description",
        content:
          "Practical notes on choosing cloud and DevOps certifications, exam prep planning, and career progression. First articles are on the way.",
      },
      { property: "og:title", content: "SkillTrack Blog — Certification guidance" },
      {
        property: "og:description",
        content: "Notes on picking the right certification and preparing for the vendor exam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/blog" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/blog" }],
  }),
  component: BlogPage,
});

function BlogPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <div className="font-mono text-xs uppercase tracking-wider text-accent">Blog</div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Certification guidance, in plain language
      </h1>
      <p className="mt-4 text-muted-foreground">
        We're writing our first articles on picking the right certification for your track,
        planning exam prep around a working week, and what changes in pay actually look like.
        Nothing published yet — check back shortly.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/assessment"
          search={{ oem: undefined }}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          Start with your platform <ArrowRight size={16} />
        </Link>
        <Link
          to="/certifications"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-surface-elevated"
        >
          Browse guides
        </Link>
      </div>
    </section>
  );
}
