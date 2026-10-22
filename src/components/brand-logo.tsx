import { BRAND } from "@/lib/brand";

/**
 * Renders the SkillTrack-365 logo with separate light and dark variants.
 * The light variant is used in light mode; the dark (white-tinted) variant
 * is used when the surrounding surface is dark. Variant selection uses
 * Tailwind's `dark:` class so it works against the platform theme switch.
 */
/**
 * The lockup is a wide 1644×498 padded wordmark (icon + SkillTrack-365 +
 * "Learn. Grow. Succeed"). `size` is the rendered height in px; width is
 * derived so the full lockup (including caption) stays visible, uncropped.
 */
const LOCKUP_RATIO = 1644 / 498;

export function BrandLogo({
  className = "h-10 w-auto object-contain",
  alt = "SkillTrack-365",
  size = 40,
  /**
   * `surface = "auto"` (default): swap based on the document color scheme.
   * `surface = "light"`: always use the light (dark-ink) variant — e.g. PDFs.
   * `surface = "dark"`: always use the dark (white) variant — e.g. dark hero.
   */
  surface = "auto",
  src,
  loading = "eager",
  fetchPriority,
}: {
  className?: string;
  alt?: string;
  size?: number;
  surface?: "auto" | "light" | "dark";
  /** Optional override (e.g. a tenant's uploaded logo URL). */
  src?: string;
  /** Header logo stays eager. Pass `lazy` for below-the-fold placements. */
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const width = Math.round(size * LOCKUP_RATIO);
  const shared = {
    alt,
    width,
    height: size,
    loading,
    decoding: "async" as const,
    fetchPriority,
  };
  if (src) {
    return <img src={src} {...shared} className={className} />;
  }
  if (surface === "light") {
    return <img src={BRAND.logoLight} {...shared} className={className} />;
  }
  if (surface === "dark") {
    return <img src={BRAND.logoDark} {...shared} className={className} />;
  }
  return (
    <>
      <img src={BRAND.logoLight} {...shared} className={`${className} block dark:hidden`} />
      <img src={BRAND.logoDark} {...shared} className={`${className} hidden dark:block`} />
    </>
  );
}
