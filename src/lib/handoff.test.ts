import { describe, it, expect } from "vitest";
import {
  buildHandoffUrl,
  HANDOFF_SOURCE,
  SKILLBRIDGE_BASE_URL,
  SKILLHUB_BASE_URL,
} from "./handoff";

describe("buildHandoffUrl", () => {
  it("always sets handoff=skilltrack by default", () => {
    const out = buildHandoffUrl(SKILLHUB_BASE_URL);
    const u = new URL(out);
    expect(u.origin).toBe("https://skillhub365.co.in");
    expect(u.pathname === "/" || u.pathname === "").toBe(true);
    expect(u.searchParams.get("handoff")).toBe(HANDOFF_SOURCE);
    expect(u.searchParams.has("email")).toBe(false);
    expect(u.searchParams.has("phone")).toBe(false);
    expect(u.searchParams.has("sku")).toBe(false);
    expect(u.searchParams.has("cert")).toBe(false);
  });

  it("URL-encodes email and phone when provided", () => {
    const out = buildHandoffUrl(SKILLBRIDGE_BASE_URL, {
      email: "ada@example.com",
      phone: "+91 98765 43210",
    });
    const u = new URL(out);
    expect(u.searchParams.get("handoff")).toBe("skilltrack");
    expect(u.searchParams.get("email")).toBe("ada@example.com");
    expect(u.searchParams.get("phone")).toBe("+91 98765 43210");
    expect(out).toContain("email=ada%40example.com");
    expect(out).toContain("phone=%2B91");
  });

  it("includes sku and cert when provided", () => {
    const out = buildHandoffUrl(SKILLHUB_BASE_URL, {
      sku: "skillhub-labs",
      cert: "saa-c03",
    });
    const u = new URL(out);
    expect(u.searchParams.get("handoff")).toBe("skilltrack");
    expect(u.searchParams.get("sku")).toBe("skillhub-labs");
    expect(u.searchParams.get("cert")).toBe("saa-c03");
  });

  it("omits blank / whitespace-only extras and nullish values", () => {
    const out = buildHandoffUrl(SKILLHUB_BASE_URL, {
      email: "  ",
      phone: null,
      sku: " ",
      cert: null,
      lead: undefined,
      invoice: "  ",
      source: "skilltrack",
    });
    const u = new URL(out);
    expect(u.searchParams.get("handoff")).toBe("skilltrack");
    expect(u.searchParams.has("email")).toBe(false);
    expect(u.searchParams.has("phone")).toBe(false);
    expect(u.searchParams.has("sku")).toBe(false);
    expect(u.searchParams.has("cert")).toBe(false);
    expect(u.searchParams.has("lead")).toBe(false);
    expect(u.searchParams.has("invoice")).toBe(false);
  });

  it("allows a custom source override", () => {
    const out = buildHandoffUrl(SKILLBRIDGE_BASE_URL, { source: "certiq" });
    expect(new URL(out).searchParams.get("handoff")).toBe("certiq");
  });
});
