/**
 * Every non-lead admin server function must call requireAdmin().
 * Lead PII functions must call requireLeadAccess() (admin, operations,
 * finance, support, or super_admins) instead of the broad gate.
 * A new createServerFn that skips its gate fails this test.
 *
 * requireAdmin stays broad: any admin-flavor role or a super_admins row.
 * Narrower per-file checks (finance, content, super-only, permissions)
 * stay in place, so those roles keep the access they already had.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actor = { isSuper: false, roles: [] as string[] };

vi.mock("@/lib/super-admin.server", () => ({
  isSuperAdminUser: async () => actor.isSuper,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        in() {
          return builder;
        },
        eq() {
          if (table === "user_roles") {
            return Promise.resolve({ data: actor.roles.map((role) => ({ role })) });
          }
          return Promise.resolve({ data: [] });
        },
      };
      return builder;
    },
  },
}));

/** Admin server modules. Filenames must match; the test reads them from disk. */
export function adminServerFunctionFiles(dir = "src/lib"): string[] {
  const named = readdirSync(dir).filter((name) => /^admin.*\.functions\.ts$/.test(name));
  return [...named, "sales-leads.functions.ts", "password-reset.functions.ts"].map((name) =>
    join(dir, name),
  );
}

const LEAD_SERVER_FILES = new Set(["admin-leads.functions.ts", "sales-leads.functions.ts"]);

/** Drop comments so a commented-out gate does not satisfy the test. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Names of createServerFn exports whose handler skips its required gate. */
export function adminFnsMissingRequireAdmin(file: string, src: string): string[] {
  const base = file.split("/").pop() ?? file;
  const needle = LEAD_SERVER_FILES.has(base) ? "requireLeadAccess(" : "requireAdmin(";
  const clean = stripComments(src);
  const matches = [...clean.matchAll(/export const (\w+) = createServerFn\b/g)];
  const missing: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1];
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? clean.length) : clean.length;
    const chunk = clean.slice(start, end);
    const handlerAt = chunk.indexOf(".handler(");
    const body = handlerAt === -1 ? chunk : chunk.slice(handlerAt);
    if (!body.includes(needle)) missing.push(name);
  }
  return missing;
}

describe("requireAdmin covers every admin server function", () => {
  it("fails when a server function omits requireAdmin", () => {
    const src = `
      export const leakLeads = createServerFn({ method: "GET" })
        .handler(async ({ context }) => {
          // await requireAdmin(context.userId);
          return context.userId;
        });
    `;
    expect(adminFnsMissingRequireAdmin("admin-dashboard.functions.ts", src)).toEqual(["leakLeads"]);
  });

  it("accepts a server function that calls requireAdmin", () => {
    const src = `
      export const getAdminDashboard = createServerFn({ method: "GET" })
        .handler(async ({ context }) => {
          await requireAdmin(context.userId);
          return [];
        });
    `;
    expect(adminFnsMissingRequireAdmin("admin-dashboard.functions.ts", src)).toEqual([]);
  });

  it("requires requireLeadAccess on lead PII functions, not the broad gate", () => {
    const broad = `
      export const listSavedLeads = createServerFn({ method: "GET" })
        .handler(async ({ context }) => {
          await requireAdmin(context.userId);
          return [];
        });
    `;
    const narrow = `
      export const listSavedLeads = createServerFn({ method: "GET" })
        .handler(async ({ context }) => {
          await requireLeadAccess(context.userId);
          return [];
        });
    `;
    expect(adminFnsMissingRequireAdmin("admin-leads.functions.ts", broad)).toEqual([
      "listSavedLeads",
    ]);
    expect(adminFnsMissingRequireAdmin("admin-leads.functions.ts", narrow)).toEqual([]);
  });

  it("every admin server function calls its gate", () => {
    const missed: string[] = [];
    for (const file of adminServerFunctionFiles()) {
      const src = readFileSync(file, "utf8");
      for (const name of adminFnsMissingRequireAdmin(file, src)) missed.push(`${file}#${name}`);
    }
    expect(missed, `Admin server functions missing their auth gate: ${missed.join(", ")}`).toEqual(
      [],
    );
  });
});

describe("requireAdmin allows admins and super admins", () => {
  beforeEach(() => {
    actor.isSuper = false;
    actor.roles = [];
  });

  it("rejects a user with no admin role", async () => {
    actor.roles = ["learner"];
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    await expect(requireAdmin("user-1")).rejects.toThrow(/Forbidden: admin role required/);
  });

  it("allows each admin-flavor role", async () => {
    const { requireAdmin } = await import("@/lib/admin-auth.server");
    for (const role of [
      "admin",
      "content_admin",
      "finance_admin",
      "support_admin",
      "certification_admin",
      "lab_admin",
      "operations_admin",
    ]) {
      actor.isSuper = false;
      actor.roles = [role];
      await expect(requireAdmin("user-1")).resolves.toMatchObject({
        isAnyAdmin: true,
        isSuperAdmin: false,
      });
    }
  });

  it("allows a super admin who has no admin role", async () => {
    actor.isSuper = true;
    actor.roles = [];
    const { requireAdmin, assertAdminOrSuper } = await import("@/lib/admin-auth.server");
    await expect(requireAdmin("user-1")).resolves.toMatchObject({
      isAnyAdmin: true,
      isSuperAdmin: true,
    });
    await expect(assertAdminOrSuper("user-1")).resolves.toBeUndefined();
  });
});

describe("requireLeadAccess matches the sales-leads allowlist", () => {
  beforeEach(() => {
    actor.isSuper = false;
    actor.roles = [];
  });

  it("allows admin, operations, finance, support, and super admins", async () => {
    const { requireLeadAccess } = await import("@/lib/admin-auth.server");
    for (const role of ["admin", "operations_admin", "finance_admin", "support_admin"]) {
      actor.isSuper = false;
      actor.roles = [role];
      await expect(requireLeadAccess("user-1")).resolves.toMatchObject({ isSuperAdmin: false });
    }
    actor.isSuper = true;
    actor.roles = [];
    await expect(requireLeadAccess("user-1")).resolves.toMatchObject({ isSuperAdmin: true });
  });

  it("rejects other admin-flavor roles that requireAdmin still allows", async () => {
    const { requireAdmin, requireLeadAccess } = await import("@/lib/admin-auth.server");
    for (const role of ["content_admin", "certification_admin", "lab_admin", "learner"]) {
      actor.isSuper = false;
      actor.roles = [role];
      await expect(requireLeadAccess("user-1")).rejects.toThrow(/Forbidden: lead access required/);
    }
    actor.roles = ["content_admin"];
    await expect(requireAdmin("user-1")).resolves.toMatchObject({ isAnyAdmin: true });
  });
});

describe("leads RLS migration file", () => {
  const path = "supabase/migrations/20261023180000_leads_admin_rls.sql";

  it("limits select/update to the sales-leads roles and has no service-role policies", () => {
    const sql = readFileSync(path, "utf8");
    expect(sql).toMatch(/NOT APPLIED/i);
    expect(sql).toMatch(/live database/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/FOR SELECT/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/is_super_admin/);
    expect(sql).toMatch(/is_admin_role/);
    for (const role of ["admin", "operations_admin", "finance_admin", "support_admin"]) {
      expect(sql).toContain(`'${role}'`);
    }
    expect(sql).not.toMatch(/content_admin|certification_admin|lab_admin/);
    expect(sql).not.toMatch(/CREATE POLICY[^;]*TO service_role/);
    expect(sql).not.toMatch(/FOR INSERT/);
    expect(sql).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|LEAD_SYNC_TOKEN|SHEET_EXEC_URL/);
  });
});
