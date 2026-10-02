/**
 * Platform branding helpers.
 *
 * BRAND_VERSION is appended as a `?v=` query string to every reference of the
 * platform logo, favicon, and og:image so that bumping this number invalidates
 * cached assets in browsers, CDNs, and social-media crawlers instantly.
 *
 * Bump this number whenever the underlying asset bytes change.
 */
export const BRAND_VERSION = 8;

import ogAsset from "@/assets/skilltrack-og.png.asset.json";

export const bust = (url: string) =>
  url.includes("?") ? `${url}&v=${BRAND_VERSION}` : `${url}?v=${BRAND_VERSION}`;

export const BRAND = {
  /**
   * Padded 1644×498 lockups served from /public. The source master was
   * clipped at the canvas edges (grad-hat/book icon flush at x=0), so these
   * carry transparent margins that keep the full mark visible.
   */
  logoLight: bust("/logo.png"),
  logoDark: bust("/logo-dark.png"),
  og: bust(ogAsset.url),
  favicon: `/favicon.png?v=${BRAND_VERSION}`,
};
