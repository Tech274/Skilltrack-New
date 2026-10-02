import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Certification } from "@/lib/certifications";
import { brandForVendor } from "@/lib/vendor-brands";

export function VendorLogo({
  label,
  color,
  localSrc,
  simpleIcon,
  layout = "mark",
  cover = false,
  hero = false,
}: {
  label: string;
  color: string;
  localSrc?: string;
  simpleIcon?: string;
  layout?: "wordmark" | "mark";
  /** Larger exhibit treatment for cover/banner space. */
  cover?: boolean;
  /** Full-width hero treatment: the logo is the primary visual. */
  hero?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = localSrc ?? (simpleIcon ? `https://cdn.simpleicons.org/${simpleIcon}` : undefined);
  const well = hero
    ? "flex h-24 w-full items-center justify-center rounded-xl px-6"
    : cover
      ? "flex h-16 min-w-40 shrink-0 items-center justify-center rounded-xl px-5"
      : layout === "wordmark"
        ? "flex h-11 w-24 shrink-0 items-center justify-center rounded-lg px-2"
        : "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg p-1.5";
  const imgClass = hero
    ? "max-h-16 w-auto max-w-[220px] object-contain"
    : cover
      ? "h-12 w-auto max-w-[160px] object-contain"
      : layout === "wordmark"
        ? "h-10 w-full max-w-[96px] object-contain object-left"
        : "h-11 w-11 object-contain";

  if (!src || failed) {
    return (
      <div
        className={
          hero
            ? "flex h-24 w-full items-center justify-center rounded-xl text-3xl font-bold tracking-tight"
            : cover
              ? "flex h-16 min-w-40 shrink-0 items-center justify-center rounded-xl px-5 text-lg font-bold"
              : layout === "wordmark"
                ? "flex h-11 w-24 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                : "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
        }
        style={{ backgroundColor: `${color}22`, color }}
        aria-hidden
      >
        {hero ? label : label.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div
      className={well}
      style={
        hero
          ? {
              backgroundColor: "#ffffff",
              backgroundImage: `linear-gradient(135deg, ${color}1f 0%, ${color}0d 100%)`,
            }
          : { backgroundColor: `${color}18` }
      }
    >
      <img
        src={src}
        alt=""
        width={hero ? 220 : cover ? 160 : layout === "wordmark" ? 96 : 48}
        height={hero ? 64 : cover ? 48 : layout === "wordmark" ? 40 : 48}
        loading="lazy"
        className={imgClass}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

type Variant = "marketplace" | "featured";

export function CertMarketplaceCard({
  cert,
  variant = "marketplace",
}: {
  cert: Certification;
  variant?: Variant;
}) {
  const brand = brandForVendor(cert.vendor);

  return (
    <Link
      to="/certifications/$slug"
      params={{ slug: cert.slug }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
      style={{
        backgroundImage: `linear-gradient(135deg, ${brand.color}14 0%, transparent 55%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-l-xl"
        style={{ backgroundColor: brand.color, width: 4 }}
      />

      {/* Vendor logo hero */}
      <div
        className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-4"
        style={{ backgroundImage: `linear-gradient(135deg, ${brand.color}1f 0%, transparent 60%)` }}
      >
        <VendorLogo
          label={brand.shortLabel}
          color={brand.color}
          localSrc={brand.localSrc}
          simpleIcon={brand.simpleIcon}
          layout={brand.logoLayout ?? "mark"}
          hero
        />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {cert.vendor}
        </span>
      </div>

      <div className="flex items-start gap-3 pl-1">
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-foreground">
            {cert.name}
          </h3>
        </div>
      </div>

      <p className="mt-3 pl-1 text-sm text-muted-foreground line-clamp-2">{cert.tagline}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1">
        <span className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {cert.code}
        </span>
        {variant === "featured" && (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            ROI {cert.roiScore}
          </span>
        )}
      </div>

      <div className="mt-auto pt-5 pl-1">
        {variant === "marketplace" ? (
          <div className="grid grid-cols-4 gap-2 border-t border-border/60 pt-4 text-xs">
            <Stat label="Cost" value={`$${cert.cost}`} />
            <Stat label="Pass" value={`${cert.successRate}%`} />
            <Stat label="Salary" value={`$${Math.round(cert.avgSalary / 1000)}K`} />
            <Stat label="ROI" value={String(cert.roiScore)} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-xs">
            <Stat label="Salary" value={`$${Math.round(cert.avgSalary / 1000)}K`} />
            <Stat label="Demand" value={String(cert.demandScore)} />
            <Stat label="Pass" value={`${cert.successRate}%`} />
          </div>
        )}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono font-semibold text-foreground">{value}</div>
    </div>
  );
}
