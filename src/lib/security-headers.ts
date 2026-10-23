import { createHash, randomBytes } from "node:crypto";

export const X_FRAME_OPTIONS = "DENY";

/**
 * Document policy for this app.
 *
 * Browser origins: Supabase (`https://*.supabase.co`, `wss://*.supabase.co`),
 * Stripe.js (`js.stripe.com`, `*.js.stripe.com`, `hooks.stripe.com`,
 * `checkout.stripe.com`, `api.stripe.com`, `q.stripe.com`, `m.stripe.com`,
 * `m.stripe.network`), and Inter from `https://rsms.me`.
 * Images use `https:` because campaign art may be an absolute URL and some OEM
 * marks fall back to `https://cdn.simpleicons.org`.
 * `frame-src data: blob:` is the in-app invoice PDF preview.
 * `frame-ancestors 'none'` matches `X-Frame-Options: DENY`.
 *
 * Not in this policy: skillhub365.co.in and skillbridge365.co.in (top-level
 * navigations), Lovable OAuth (`/~oauth/initiate`, popup/postMessage to
 * oauth.lovable.app and lovable.dev), server-only calls to
 * ai.gateway.lovable.dev, connector-gateway.lovable.dev, and open.er-api.com.
 * This repo pushes `window.dataLayer` and does not load an analytics script.
 * script-src allows the theme bootstrap and the permission-matrix print
 * snippet by sha256. It does not allow 'unsafe-inline'. style-src still
 * allows inline styles used by the chart theme.
 * TanStack's bootstrap changes on every response and does not survive HTML
 * parsing unchanged, so each HTML document gets a nonce on its inline scripts.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'sha256-2MUoBzrHp+ozczLgTnymGxpXSXtYI578H/CPThjS2o4=' 'sha256-yP8nlIf19QQlhoctCL0QE23v0Z35QserAqrMJUrv3t0=' https://js.stripe.com https://*.js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://rsms.me",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://q.stripe.com https://m.stripe.com https://m.stripe.network",
  "frame-src 'self' data: blob: https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

export function scriptSourceHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

const SCRIPT_OPEN = /<script(?![^>]*\bsrc\s*=)\b([^>]*)>/gi;

export function applyScriptNonces(html: string, nonce: string): { html: string; used: boolean } {
  let used = false;
  const next = html.replace(SCRIPT_OPEN, (tag, attrs: string) => {
    const type = /type\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase();
    if (
      type &&
      type !== "module" &&
      type !== "text/javascript" &&
      type !== "application/javascript"
    ) {
      return tag;
    }
    if (/\bnonce\s*=/i.test(attrs)) return tag;
    used = true;
    return `<script nonce="${nonce}"${attrs}>`;
  });
  return { html: next, used };
}

export function contentSecurityPolicyForHtml(html: string, nonce?: string): string {
  if (!nonce) return CONTENT_SECURITY_POLICY;
  return CONTENT_SECURITY_POLICY.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`);
}

export async function withSecurityHeaders(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set("X-Frame-Options", X_FRAME_OPTIONS);
  const type = headers.get("content-type") ?? "";
  let body: BodyInit | null = response.body;
  if (type.includes("text/html")) {
    const html = await response.text();
    const nonce = randomBytes(16).toString("base64");
    const applied = applyScriptNonces(html, nonce);
    body = applied.html;
    headers.set(
      "Content-Security-Policy",
      applied.used ? contentSecurityPolicyForHtml(applied.html, nonce) : CONTENT_SECURITY_POLICY,
    );
    headers.delete("content-length");
  } else {
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
