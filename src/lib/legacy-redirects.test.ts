import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS, legacyLocationHref, legacyRedirectUrl } from "./legacy-redirects";
import { CONTENT_SECURITY_POLICY, withSecurityHeaders, X_FRAME_OPTIONS } from "./security-headers";

describe("legacy redirects", () => {
  it("sends login, signup, and privacy-policy to their replacements", () => {
    expect(legacyRedirectUrl("https://skilltrack.co.in/login")).toBe(
      "https://skilltrack.co.in/auth",
    );
    expect(legacyRedirectUrl("https://skilltrack.co.in/signup")).toBe(
      "https://skilltrack.co.in/auth",
    );
    expect(legacyRedirectUrl("https://skilltrack.co.in/privacy-policy")).toBe(
      "https://skilltrack.co.in/privacy",
    );
  });

  it("keeps the query string and hash, including percent-encoding", () => {
    expect(legacyRedirectUrl("https://skilltrack.co.in/login?next=%2Fdashboard&utm=a#x")).toBe(
      "https://skilltrack.co.in/auth?next=%2Fdashboard&utm=a#x",
    );
    expect(legacyRedirectUrl("https://skilltrack.co.in/signup/?next=%2Fbilling")).toBe(
      "https://skilltrack.co.in/auth?next=%2Fbilling",
    );
  });

  it("does not redirect lookalike paths", () => {
    expect(legacyRedirectUrl("https://skilltrack.co.in/login-help")).toBeNull();
    expect(legacyRedirectUrl("https://skilltrack.co.in/privacy")).toBeNull();
    expect(legacyRedirectUrl("https://skilltrack.co.in/privacy-policy/extra")).toBeNull();
  });

  it("builds the same href the router redirect uses", () => {
    expect(legacyLocationHref("/login", "/login?next=%2Fdashboard#x")).toBe(
      "/auth?next=%2Fdashboard#x",
    );
    expect(legacyLocationHref("/privacy-policy", "/privacy-policy")).toBe("/privacy");
  });

  it("matches public/_redirects", () => {
    const text = readFileSync("public/_redirects", "utf8");
    for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
      expect(text).toContain(`${from} ${to} 301`);
      expect(text).toContain(`${from}/ ${to} 301`);
    }
  });
});

describe("security headers", () => {
  it("sets DENY and the content security policy without dropping other headers", () => {
    const response = withSecurityHeaders(
      new Response("ok", { status: 201, headers: { "content-type": "text/html", "x-test": "1" } }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("text/html");
    expect(response.headers.get("x-test")).toBe("1");
    expect(response.headers.get("X-Frame-Options")).toBe(X_FRAME_OPTIONS);
    expect(response.headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
  });

  it("allows the origins this app loads in the browser", () => {
    for (const origin of [
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://js.stripe.com",
      "https://*.js.stripe.com",
      "https://hooks.stripe.com",
      "https://checkout.stripe.com",
      "https://api.stripe.com",
      "https://m.stripe.network",
      "https://rsms.me",
      "https://cdn.simpleicons.org",
    ]) {
      const covered =
        CONTENT_SECURITY_POLICY.includes(origin) ||
        (origin === "https://cdn.simpleicons.org" &&
          CONTENT_SECURITY_POLICY.includes("img-src 'self' data: blob: https:"));
      expect(covered, origin).toBe(true);
    }
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });

  it("matches public/_headers", () => {
    const text = readFileSync("public/_headers", "utf8");
    expect(text).toContain(`X-Frame-Options: ${X_FRAME_OPTIONS}`);
    expect(text).toContain(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`);
  });
});
