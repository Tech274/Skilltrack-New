import { createFileRoute, Link } from "@tanstack/react-router";
import { hasSalesWhatsApp, waLink } from "@/config/contact";
import { ArrowRight, Mail, CalendarClock, Building2 } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact SkillTrack-365 — Talk to our team" },
      {
        name: "description",
        content:
          "Get in touch with SkillTrack-365 about certifications, team plans or enterprise rollouts. Book a free call and we respond within 24 hours on weekdays.",
      },
      { property: "og:title", content: "Contact SkillTrack-365" },
      {
        property: "og:description",
        content: "Book a free call or email us about team and enterprise certification programmes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: Contact,
});

function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Contact us</h1>
      <p className="mt-4 text-muted-foreground">
        The fastest route is to book a call — Sales will WhatsApp or call you within 24 hours on
        weekdays.
        {hasSalesWhatsApp && (
          <>
            {" "}
            <a href={waLink()} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
              WhatsApp us
            </a>
          </>
        )}
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <CalendarClock size={18} className="text-accent" />
          <div className="mt-3 text-sm font-medium">Book a call</div>
          <p className="mt-1 text-xs text-muted-foreground">Under a minute to request one.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <Mail size={18} className="text-accent" />
          <div className="mt-3 text-sm font-medium">Email</div>
          <a
            href="mailto:admin@skilltrack.co.in"
            className="mt-1 block break-all text-xs text-muted-foreground hover:text-foreground"
          >
            admin@skilltrack.co.in
          </a>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <Building2 size={18} className="text-accent" />
          <div className="mt-3 text-sm font-medium">Enterprise</div>
          <p className="mt-1 text-xs text-muted-foreground">Team rollouts and skill mapping.</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/book-a-call"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
        >
          Book a free call <ArrowRight size={14} />
        </Link>
        <Link
          to="/enterprise"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-elevated"
        >
          Enterprise overview
        </Link>
      </div>
    </div>
  );
}
