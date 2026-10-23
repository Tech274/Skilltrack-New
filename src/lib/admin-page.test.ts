import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPagedRows, ilikePattern, pageBounds } from "./admin-page";
import { asRoles, isBanned } from "./admin-directory.server";

describe("admin page bounds", () => {
  it("defaults to page 1 and 50 rows", () => {
    expect(pageBounds()).toEqual({ page: 1, pageSize: 50, from: 0, to: 49 });
  });

  it("clamps an oversized page size", () => {
    expect(pageBounds(2, 500)).toEqual({ page: 2, pageSize: 100, from: 100, to: 199 });
  });

  it("treats a non-positive page as the first page", () => {
    expect(pageBounds(0, 10).page).toBe(1);
  });
});

describe("paged export", () => {
  it("walks every full page and stops on a short page", async () => {
    const calls: Array<[number, number]> = [];
    const rows = await collectPagedRows(async (from, to) => {
      calls.push([from, to]);
      if (from === 0) return Array.from({ length: 1000 }, (_, i) => i);
      if (from === 1000) return [1000, 1001];
      return [];
    });
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(rows).toHaveLength(1002);
    expect(rows[1001]).toBe(1001);
  });

  it("pages the csv exports instead of one limit above 1000", () => {
    for (const file of [
      "src/lib/super-admin.functions.ts",
      "src/lib/admin-ai-audit.functions.ts",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      expect(src, file).toContain("collectPagedRows");
      expect(src, file).not.toContain(".limit(10000)");
      expect(src, file).not.toContain(".limit(1000)");
    }
  });

  it("refuses to silently stop at the old 1000-row cap", async () => {
    await expect(
      collectPagedRows(async () => Array.from({ length: 3 }, () => "row"), 3, 5),
    ).rejects.toThrow(/stopped after 5 rows/);
  });
});

describe("ilike pattern", () => {
  it("drops filter metacharacters", () => {
    expect(ilikePattern("a%b_c,d(e)")).toBe("%a b c d e%");
  });

  it("returns null for a blank search", () => {
    expect(ilikePattern("  ")).toBeNull();
    expect(ilikePattern("%,()")).toBeNull();
  });
});

describe("directory helpers", () => {
  it("parses a postgres role array", () => {
    expect(asRoles("{admin,learner}")).toEqual(["admin", "learner"]);
    expect(asRoles(["manager"])).toEqual(["manager"]);
  });

  it("treats a future ban as disabled", () => {
    expect(isBanned("2999-01-01T00:00:00.000Z")).toBe(true);
    expect(isBanned(null)).toBe(false);
    expect(isBanned("2000-01-01T00:00:00.000Z")).toBe(false);
  });
});

describe("admin directory migration", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261023191000_admin_directory_page.sql"),
    "utf8",
  );

  it("is service-role only and reads auth.users", () => {
    expect(sql).toContain("FROM auth.users u");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public, auth");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) TO service_role",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) FROM anon, authenticated",
    );
    expect(sql).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) TO authenticated",
    );
  });
});

describe("paged admin lists", () => {
  const leads = readFileSync(resolve("src/lib/admin-leads.functions.ts"), "utf8");
  const subscribers = readFileSync(resolve("src/lib/admin-reports.functions.ts"), "utf8");
  const users = readFileSync(resolve("src/lib/admin.functions.ts"), "utf8");

  it("pages saved leads on the user client", () => {
    expect(leads).toContain('count: "exact"');
    expect(leads).toContain(".range(");
    expect(leads).not.toContain(".limit(1000)");
    expect(leads).toContain("context.supabase");
    expect(leads).not.toContain("requireAdmin");
  });

  it("applies subscriber search on plan, customer, and scope", () => {
    const handler = subscribers.slice(subscribers.indexOf("export const listSubscribers"));
    expect(handler).toContain("plan_code.ilike");
    expect(handler).toContain("stripe_customer_id.ilike");
    expect(handler).toContain("scope.ilike");
    expect(handler).toContain("ilikePattern");
  });

  it("keeps the existing super-admin gate on the user directory", () => {
    const handler = users.slice(
      users.indexOf("export const listAllUsers"),
      users.indexOf("async function recordAudit"),
    );
    expect(handler).toContain("assertSuperAdmin");
    expect(handler).toContain("queryAdminDirectory");
    expect(handler).not.toContain("requireAdmin");
    expect(handler).not.toContain("isPlatformAdmin");
  });
});
