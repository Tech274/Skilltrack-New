/**
 * Platform branding helpers.
 *
 * BRAND_VERSION is appended as a `?v=` query string to every reference of the
 * platform logo, favicon, and og:image so that bumping this number invalidates
 * cached assets in browsers, CDNs, and social-media crawlers instantly.
 *
 * Bump this number whenever the underlying asset bytes change.
 */
export const BRAND_VERSION = 9;

import ogAsset from "@/assets/skilltrack-og.png.asset.json";

export const bust = (url: string) =>
  url.includes("?") ? `${url}&v=${BRAND_VERSION}` : `${url}?v=${BRAND_VERSION}`;

export const BRAND = {
  /**
   * WebP derivatives of the padded 1644×498 lockup (served at 822×249, about
   * 5× the header's CSS size). The ratio is unchanged. Smaller PNGs remain at
   * /logo.png and /logo-dark.png for anything still requesting those paths.
   */
  logoLight: bust("/logo.webp"),
  logoDark: bust("/logo-dark.webp"),
  og: bust(ogAsset.url),
  favicon: `/favicon.png?v=${BRAND_VERSION}`,
};
