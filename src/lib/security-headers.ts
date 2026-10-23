export const X_FRAME_OPTIONS = "DENY";

/**
 * Document feature policy. Camera, microphone, geolocation, and USB are unused.
 * `payment` stays open for this origin and Stripe Embedded Checkout.
 * Browsers ignore a Permissions-Policy meta tag, so this is sent as a response
 * header (and mirrored in public/_headers for the static host).
 */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "encrypted-media=(self)",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  'payment=(self "https://js.stripe.com" "https://checkout.stripe.com")',
  "publickey-credentials-get=(self)",
  "usb=()",
  "interest-cohort=()",
].join(", ");

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
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://rsms.me",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://q.stripe.com https://m.stripe.com https://m.stripe.network",
  "frame-src 'self' data: blob: https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Frame-Options", X_FRAME_OPTIONS);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
