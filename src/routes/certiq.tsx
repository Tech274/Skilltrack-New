import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  FileText,
  GitCompare,
  LayoutDashboard,
  LineChart,
} from "lucide-react";
import { CertIqTabs } from "@/components/certiq-tabs";
import { buildHandoffUrl, SKILLBRIDGE_BASE_URL } from "@/lib/handoff";
import { useHandoffContext } from "@/hooks/use-handoff-context";
import { OEM_NAMES, certLadderForOem } from "@/lib/assessment";

export const Route = createFileRoute("/certiq")({
  validateSearch: (search: Record<string, unknown>) => ({
    oem:
      typeof search.oem === "string" && OEM_NAMES[search.oem]
        ? search.oem
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CertIQ — Compare, advise and price your next cert | SkillTrack" },
      {
        name: "description",
        content:
          "CertIQ brings certification comparison, the career advisor, salary intel and resume builder together in one place, so you can choose your next exam with real numbers.",
      },
      { property: "og:title", content: "CertIQ — SkillTrack" },
      {
        property: "og:description",
        content:
          "Compare certifications, get advice, see pay ranges and build a resume in one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://skilltrack.co.in/certiq" },
    ],
    links: [{ rel: "canonical", href: "https://skilltrack.co.in/certiq" }],
  }),
  component: CertIqPage,
});

type Section =
  | {
      icon: React.ElementType;
      to: string;
      title: string;
      body: string;
    }
  | {
      icon: React.ElementType;
      href: string;
      title: string;
      body: string;
      external: true;
    };

const sections: Section[] = [
  {
    icon: LayoutDashboard,
    to: "/certiq",
    title: "Overview",
    body:
      "CertIQ is your certification decision workspace: compare exams, get a prep roadmap, check pay ranges, then build a resume for the role.",
  },
  {
    icon: GitCompare,
    to: "/compare",
    title: "Compare",
    body: "Put up to four certifications side by side on cost, exam length, demand and pay.",
  },
  {
    icon: Brain,
    to: "/career-explorer",
    title: "Career Advisor",
    body: "Share your role and hours per week, get a step-by-step prep roadmap from our catalogue.",
  },
  {
    icon: LineChart,
    to: "/salary",
    title: "Salary Intel",
    body: "Typical pay ranges by country and experience level — estimates to sanity-check your choice.",
  },
  {
    icon: FileText,
    href: SKILLBRIDGE_BASE_URL,
    title: "Resume Builder",
    body: "Build a tech resume that matches your target certification and role.",
    external: true,
  },
];

function CertIqPage() {
  const handoff = useHandoffContext();
  const { oem } = Route.useSearch();
  const oemSlug = oem && OEM_NAMES[oem] ? oem : undefined;
  const oemName = oemSlug ? OEM_NAMES[oemSlug] : null;
  const ladder = oemSlug ? certLadderForOem(oemSlug) : [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CertIqTabs />

      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          CertIQ
        </h1>
        <p className="mt-3 text-muted-foreground">
          One place to work out which certification is worth your time: compare the
          options, get a prep roadmap, check what the market pays, and build a resume
          for the role. We help you prepare for the exam you choose — we don't promise a pass.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sections.map((s) => {
          const card = (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary shadow-card">
                <s.icon size={18} className="text-primary-foreground" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <div className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-accent">
                Open <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </>
          );
          return "external" in s ? (
            <a
              key={s.title}
              href={buildHandoffUrl(s.href, handoff)}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:bg-surface-elevated"
            >
              {card}
            </a>
          ) : (
            <Link
              key={s.title}
              to={s.to}
              className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:bg-surface-elevated"
            >
              {card}
            </Link>
          );
        })}
      </div>

      {oemName && ladder.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Prepare for your {oemName} exam</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Step-by-step prep for the {oemName} certifications we cover. Pick a guide to start.
              </p>
            </div>
            <Link
              to="/assessment"
              search={{ oem: oemSlug }}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card sm:mt-0"
            >
              Start {oemName} assessment <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ladder.map((step) => (
              <Link
                key={step.slug}
                to="/certifications/$slug"
                params={{ slug: step.slug }}
                className="rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:bg-surface-elevated"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{step.name}</h3>
                  <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {step.code}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Difficulty: <span className="text-foreground">{step.difficulty}</span>
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent">
                  View guide <ArrowRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {oemName && ladder.length === 0 && (
        <div className="mt-12 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Prepare for your {oemName} exam</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            We don't have a published {oemName} prep guide yet. Take the assessment and we'll recommend the closest match in our catalog.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/assessment"
              search={{ oem: oemSlug }}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
            >
              Take the assessment <ArrowRight size={16} />
            </Link>
            <Link
              to="/book-a-call"
              search={{ utm_campaign: "certiq" }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
            >
              Book free diagnostic
            </Link>
          </div>
        </div>
      )}

      {!oemName && (
        <div className="mt-12 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Not sure where to start?</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Take the five-question assessment for your platform, or book a free
            20-minute diagnostic and we'll narrow it down with you.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/assessment"
              search={{ oem: undefined }}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
            >
              Take the assessment <ArrowRight size={16} />
            </Link>
            <Link
              to="/book-a-call"
              search={{ utm_campaign: "certiq" }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
            >
              Book free diagnostic
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

