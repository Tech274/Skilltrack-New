import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nav = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

describe("admin nav", () => {
  it("lists one leads entry and keeps the sales pipeline as the target", () => {
    expect(nav.match(/label:\s*"Leads"/g) ?? []).toHaveLength(1);
    expect(nav).not.toContain('label: "Sales Leads"');
    expect(nav).toContain('to: "/admin/sales-leads", label: "Leads", icon: Users, leadAccess: true');
    expect(nav).toContain("if (it.leadAccess) return Boolean(who.leadAccess)");
    expect(nav).not.toContain('to: "/admin/leads"');
  });

  it("does not offer parked modules", () => {
    expect(nav).not.toContain("parked:");
    expect(nav).not.toContain("/admin/subscribers");
    expect(nav).not.toContain("/admin/subscription");
    expect(nav).not.toContain('to: "/admin/reports"');
  });
});

describe("lead access", () => {
  it("checks requireLeadAccess before returning saved-lead rows", () => {
    const src = readFileSync("src/lib/admin-leads.functions.ts", "utf8");
    const list = src.slice(src.indexOf("export const listSavedLeads"));
    expect(list.indexOf("requireLeadAccess")).toBeGreaterThan(-1);
    expect(list.indexOf("requireLeadAccess")).toBeLessThan(list.indexOf(".from(\"leads\")"));
    expect(src).toContain("export const guardLeadAccess");
    const sales = readFileSync("src/lib/sales-leads.functions.ts", "utf8");
    expect(sales).toContain("requireLeadAccess");
    expect(sales).not.toContain("assertSalesAccess");
    const roles = readFileSync("src/lib/admin-dashboard.functions.ts", "utf8");
    expect(roles).toContain("requireLeadAccess");
    expect(roles).toContain("leadAccess");
  });
});

describe("parked and duplicate admin routes", () => {
  it("redirects the old leads URL to the sales pipeline", () => {
    const src = readFileSync("src/routes/_authenticated/admin.leads.tsx", "utf8");
    expect(src).toContain('redirect({ to: "/admin/sales-leads" })');
  });

  it.each([
    "src/routes/_authenticated/admin.subscribers.tsx",
    "src/routes/_authenticated/admin.reports.tsx",
    "src/routes/_authenticated/admin.subscription.tsx",
  ])("%s redirects to /admin", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain('redirect({ to: "/admin" })');
  });
});
