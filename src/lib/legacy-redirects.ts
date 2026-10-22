/** Permanent aliases for paths that used to be real routes. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/login": "/auth",
  "/signup": "/auth",
  "/privacy-policy": "/privacy",
};

function normalizedPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "");
  return pathname;
}

/**
 * Absolute URL to send for a legacy path, or null when the request should
 * continue. Search and hash are copied unchanged, including percent-encoding.
 */
export function legacyRedirectUrl(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const target = LEGACY_REDIRECTS[normalizedPath(url.pathname)];
  if (!target) return null;
  const pathStart = requestUrl.indexOf(url.pathname);
  const suffix =
    pathStart >= 0 ? requestUrl.slice(pathStart + url.pathname.length) : `${url.search}${url.hash}`;
  return `${url.origin}${target}${suffix}`;
}

/** Router href for a matched legacy route, preserving search and hash. */
export function legacyLocationHref(fromPath: string, href: string): string {
  const target = LEGACY_REDIRECTS[fromPath];
  if (!target) return href;
  if (href === fromPath || href.startsWith(`${fromPath}?`) || href.startsWith(`${fromPath}#`)) {
    return target + href.slice(fromPath.length);
  }
  return target;
}
