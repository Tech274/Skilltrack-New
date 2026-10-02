import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * Interactive OEM doorway / hero tiles.
 * Official SVGs for AWS, Azure, GCP, Salesforce under /logos/oem/.
 * HashiCorp uses pack light PNG. ServiceNow uses Creative white wordmark on dark UI.
 */
type Oem = {
  slug: string;
  name: string;
  blurb: string;
  /** Absolute path under public/ for local official SVG */
  localSrc?: string;
  /** simpleicons slug for CDN logos */
  logo?: string;
  color: string;
  /** wordmark → wide well; mark → square (default) */
  logoLayout?: "wordmark" | "mark";
  /** Logo artwork is white — needs a dark well to stay legible in light mode. */
  whiteArtwork?: boolean;
};

export const OEMS: Oem[] = [
  { slug: "aws", name: "AWS", blurb: "Cloud Practitioner → Architect", localSrc: "/logos/oem/aws.svg", logoLayout: "wordmark", color: "#FF9900" },
  { slug: "azure", name: "Microsoft Azure", blurb: "AZ-900 → Solutions Architect", localSrc: "/logos/oem/azure.svg", color: "#0078D4" },
  { slug: "gcp", name: "Google Cloud", blurb: "ACE → Professional Architect", localSrc: "/logos/oem/gcp.svg", logoLayout: "wordmark", color: "#4285F4" },
  { slug: "salesforce", name: "Salesforce", blurb: "Admin → Consultant tracks", localSrc: "/logos/oem/salesforce.png", logoLayout: "wordmark", color: "#00A1E0" },
  { slug: "servicenow", name: "ServiceNow", blurb: "CSA → CAD paths", localSrc: "/logos/oem/servicenow-white.png", logoLayout: "wordmark", whiteArtwork: true, color: "#62D84E" },
  { slug: "pmi", name: "PMI", blurb: "PMP & CAPM prep", color: "#B32134" },
  { slug: "comptia", name: "CompTIA", blurb: "A+, Network+, Security+", localSrc: "/logos/oem/comptia.png", logoLayout: "wordmark", color: "#E31837" },
  { slug: "hashicorp", name: "HashiCorp", blurb: "Terraform Associate", localSrc: "/logos/oem/hashicorp-light.png", whiteArtwork: true, color: "#7B42BC" },
  { slug: "snowflake", name: "Snowflake", blurb: "SnowPro Core → Advanced", localSrc: "/logos/oem/snowflake-bug.svg", color: "#29B5E8" },
  { slug: "databricks", name: "Databricks", blurb: "Data Engineer Associate", localSrc: "/logos/oem/databricks.png", color: "#FF3621" },
  { slug: "cisco", name: "Cisco", blurb: "CCNA networking track", logo: "cisco", color: "#049FD9" },
  { slug: "kubernetes", name: "CNCF / Kubernetes", blurb: "CKA · CKAD · KCNA", localSrc: "/logos/oem/kubernetes.svg", color: "#326CE5" },
];

function LogoMark({ oem }: { oem: Oem }) {
  const [failed, setFailed] = useState(false);
  const src = oem.localSrc ?? (oem.logo ? `https://cdn.simpleicons.org/${oem.logo}` : undefined);
  const wide = oem.logoLayout === "wordmark";
  if (!src || failed) {
    return (
      <div
        className={
          wide
            ? "flex h-10 w-24 shrink-0 items-center justify-center rounded-md text-sm font-bold"
            : "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-bold"
        }
        style={{ backgroundColor: `${oem.color}1f`, color: oem.color }}
        aria-hidden
      >
        {oem.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${oem.name} logo`}
      width={wide ? 96 : 44}
      height={wide ? 40 : 44}
      loading="lazy"
      className={
        (wide
          ? "h-10 w-24 shrink-0 object-contain object-left"
          : "h-11 w-11 shrink-0 object-contain") + (oem.whiteArtwork ? " logo-well" : "")
      }
      onError={() => setFailed(true)}
    />
  );
}

export function OemDoorway() {
  return (
    <section className="border-t border-border/60 bg-surface/30" aria-labelledby="oem-doorway">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-wider text-accent">
            Start with your platform
          </div>
          <h2 id="oem-doorway" className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Pick a vendor. See your cert ladder.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Click the platform you&apos;re targeting and answer five short questions — you&apos;ll
            see the certification ladder for that vendor and your top five matches, free.
            We prepare you for the exam you choose; passing is still down to you.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {OEMS.map((oem) => (
            <Link
              key={oem.slug}
              to="/assessment"
              search={{ oem: oem.slug }}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
            >
              <LogoMark oem={oem} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{oem.name}</div>
                <div className="truncate text-xs text-muted-foreground">{oem.blurb}</div>
              </div>
              <ArrowRight
                size={14}
                className="ml-auto shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OemTiles({ limit }: { limit?: number }) {
  const items = typeof limit === "number" ? OEMS.slice(0, limit) : OEMS;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((oem) => (
        <Link
          key={oem.slug}
          to="/assessment"
          search={{ oem: oem.slug }}
          className="group flex items-center gap-4 rounded-xl border border-border bg-surface/70 p-4 text-left backdrop-blur transition-all hover:border-primary/40 hover:bg-surface-elevated hover:shadow-elevated"
        >
          <LogoMark oem={oem} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{oem.name}</div>
            <div className="truncate text-xs text-muted-foreground">{oem.blurb}</div>
          </div>
          <ArrowRight
            size={14}
            className="ml-auto shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100"
          />
        </Link>
      ))}
    </div>
  );
}
