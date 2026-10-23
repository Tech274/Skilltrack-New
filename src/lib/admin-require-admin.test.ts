/**
 * Every admin server function must call requireAdmin().
 * A new createServerFn in these files that skips the call fails this test.
 *
 * requireAdmin allows any admin-flavor role or a super_admins row.
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

/** Drop comments so a commented-out requireAdmin() does not satisfy the test. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Names of createServerFn exports whose handler never calls requireAdmin(. */
export function adminFnsMissingRequireAdmin(src: string): string[] {
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
    if (!body.includes("requireAdmin(")) missing.push(name);
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
    expect(adminFnsMissingRequireAdmin(src)).toEqual(["leakLeads"]);
  });

  it("accepts a server function that calls requireAdmin", () => {
    const src = `
      export const listSavedLeads = createServerFn({ method: "GET" })
        .handler(async ({ context }) => {
          await requireAdmin(context.userId);
          return [];
        });
    `;
    expect(adminFnsMissingRequireAdmin(src)).toEqual([]);
  });

  it("every admin server function calls requireAdmin", () => {
    const missed: string[] = [];
    for (const file of adminServerFunctionFiles()) {
      const src = readFileSync(file, "utf8");
      for (const name of adminFnsMissingRequireAdmin(src)) missed.push(`${file}#${name}`);
    }
    expect(missed, `Admin server functions missing requireAdmin(): ${missed.join(", ")}`).toEqual(
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

describe("leads RLS migration file", () => {
  const path = "supabase/migrations/20261023180000_leads_admin_rls.sql";

  it("enables RLS with admin select/update and the public lead insert, and says to apply it live", () => {
    const sql = readFileSync(path, "utf8");
    expect(sql).toMatch(/NOT APPLIED/i);
    expect(sql).toMatch(/live database/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/FOR SELECT/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/FOR INSERT/);
    expect(sql).toMatch(/is_super_admin/);
    expect(sql).toMatch(/is_admin_role/);
    expect(sql).toMatch(/service_role/);
    expect(sql).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|LEAD_SYNC_TOKEN|SHEET_EXEC_URL/);
  });
});
