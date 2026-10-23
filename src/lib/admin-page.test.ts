import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPagedRows, csvCell, exportWindowEnd, ilikePattern, pageBounds } from "./admin-page";
import { asRoles, isBanned, loadUserEmails } from "./admin-directory.server";

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
      expect(src, file).toContain('.order("id", { ascending: false })');
      expect(src, file).toContain("csvCell");
      expect(src, file).not.toContain(".limit(10000)");
      expect(src, file).not.toContain(".limit(1000)");
    }
    const audit = readFileSync(resolve("src/lib/super-admin.functions.ts"), "utf8");
    expect(audit).toContain("exportWindowEnd");
    expect(audit).not.toContain('if (forExport) q = q.order("id", { ascending: false })');
    const ai = readFileSync(resolve("src/lib/admin-ai-audit.functions.ts"), "utf8");
    const list = ai.slice(ai.indexOf("export const listAiRecsAudit"), ai.indexOf("export const exportAiRecsAuditCsv"));
    expect(list).toContain('.order("id", { ascending: false })');
    expect(ai).toContain('.lte("created_at", startedAt)');
    const enrich = ai.slice(
      ai.indexOf("async function enrichEmails"),
      ai.indexOf("export const listAiRecsAudit"),
    );
    expect(enrich).toContain("loadUserEmails");
    expect(enrich).not.toContain("getUserById");
  });

  it("refuses to silently stop at the old 1000-row cap", async () => {
    await expect(
      collectPagedRows(async () => Array.from({ length: 3 }, () => "row"), 3, 5),
    ).rejects.toThrow(/stopped after 5 rows/);
  });
});

describe("ilike pattern", () => {
  it("keeps a plain search as a contains pattern", () => {
    expect(ilikePattern("hello")).toBe("%hello%");
  });

  it("escapes like wildcards and quotes PostgREST specials", () => {
    expect(ilikePattern("a%b_c,d(e)")).toBe('"%a\\\\%b\\\\_c,d(e)%"');
    expect(ilikePattern("a.b:c d")).toBe('"%a.b:c d%"');
  });

  it("returns null for a blank search", () => {
    expect(ilikePattern("  ")).toBeNull();
  });
});

describe("csv cells", () => {
  it("prefixes cells that a spreadsheet would treat as a formula", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell("safe")).toBe("safe");
    expect(csvCell("=1,2")).toBe(`"'=1,2"`);
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
    expect(csvCell("\r=1+1")).toBe("\"'\r=1+1\"");
  });
});

describe("export window", () => {
  it("freezes the export at the earlier of the filter and the start time", () => {
    const started = "2026-01-01T00:00:00.000Z";
    expect(exportWindowEnd("2020-01-01T00:00:00.000Z", started)).toBe("2020-01-01T00:00:00.000Z");
    expect(exportWindowEnd("2099-01-01T00:00:00.000Z", started)).toBe(started);
    expect(exportWindowEnd(null, started)).toBe(started);
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
    expect(sql).toContain("filtered.id ASC");
  });

  it("loads many auth emails in one function", () => {
    const emails = readFileSync(
      resolve("supabase/migrations/20261023220000_admin_user_emails.sql"),
      "utf8",
    );
    expect(emails).toContain("FROM auth.users u");
    expect(emails).toContain("WHERE u.id = ANY");
    expect(emails).toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO service_role",
    );
    expect(emails).toContain(
      "REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM PUBLIC, anon, authenticated",
    );
    const loader = readFileSync(resolve("src/lib/admin-directory.server.ts"), "utf8");
    expect(loader).toContain('admin.rpc("admin_user_emails"');
    const subscribers = readFileSync(resolve("src/lib/admin-reports.functions.ts"), "utf8");
    const list = subscribers.slice(subscribers.indexOf("export const listSubscribers"));
    expect(list).toContain("loadUserEmails");
    expect(list).not.toContain("getUserById");
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
    expect(leads).toContain("requireLeadAccess");
    expect(leads).toContain("export const guardLeadAccess");
    expect(leads).not.toContain("requireAdmin");
  });

  it("applies subscriber search on plan, customer, and scope", () => {
    const handler = subscribers.slice(subscribers.indexOf("export const listSubscribers"));
    expect(handler).toContain("plan_code.ilike");
    expect(handler).toContain("stripe_customer_id.ilike");
    expect(handler).toContain("scope.ilike");
    expect(handler).toContain("ilikePattern");
  });

  it("breaks timestamp ties with the row id on each on-screen list", () => {
    for (const file of [
      "src/lib/admin-leads.functions.ts",
      "src/lib/admin-reports.functions.ts",
      "src/lib/admin-content.functions.ts",
      "src/lib/admin-invoices.functions.ts",
      "src/lib/admin-ai-actions-audit.functions.ts",
      "src/lib/admin-ai-audit.functions.ts",
      "src/lib/question-bank.functions.ts",
      "src/lib/campaigns.functions.ts",
      "src/lib/learning-paths.functions.ts",
      "src/lib/admin-marketplace.functions.ts",
      "src/lib/admin.functions.ts",
      "src/lib/admin-learners.functions.ts",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      expect(src, file).toContain('.order("id", { ascending: false })');
    }
  });

  it("keeps the existing super-admin gate on the user directory", () => {
    const handler = users.slice(
      users.indexOf("export const listAllUsers"),
      users.indexOf("async function recordAudit"),
    );
    expect(handler).toContain("await requireAdmin(context.userId)");
    expect(handler).toContain("assertSuperAdmin");
    expect(handler).toContain("queryAdminDirectory");
    expect(handler).not.toContain("isPlatformAdmin");
  });
});

describe("loadUserEmails fallback", () => {
  function adminWith(pages: Array<Array<{ id: string; email: string | null }>>, code = "PGRST202") {
    let call = 0;
    return {
      rpc: async () => ({ data: null, error: { code } }),
      auth: {
        admin: {
          listUsers: async () => {
            const users = pages[call] ?? [];
            call += 1;
            return { data: { users }, error: null };
          },
        },
      },
    };
  }

  it("returns emails from a directory of 5,000 or fewer users", async () => {
    const admin = adminWith([[{ id: "user-1", email: "one@example.com" }]]);
    const emails = await loadUserEmails(admin as never, ["user-1", "missing"]);
    expect(emails.get("user-1")).toBe("one@example.com");
    expect(emails.has("missing")).toBe(false);
  });

  it("throws when the migration is missing and the directory is over 5,000 users", async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({ id: `other-${i}`, email: `other-${i}@example.com` }));
    const pages = Array.from({ length: 25 }, () => full);
    pages.push([{ id: "user-5001", email: "past-cap@example.com" }]);
    const admin = adminWith(pages, "42883");
    await expect(loadUserEmails(admin as never, ["wanted-user"])).rejects.toThrow(
      /more than 5,000 users/,
    );
  });

  it("does not throw when the 5,000th user is the last one", async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({ id: `other-${i}`, email: null }));
    const pages = Array.from({ length: 25 }, () => full);
    pages.push([]);
    const admin = adminWith(pages);
    const emails = await loadUserEmails(admin as never, ["wanted-user"]);
    expect(emails.has("wanted-user")).toBe(false);
  });
});
