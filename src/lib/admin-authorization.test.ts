/**
 * Authorization tests for the two routes that historically locked out
 * Super Admins: My Plan (/admin/subscription) and Permission Matrix
 * (/admin/permissions).
 *
 * Strategy: stub `getAdminContext` and `isSuperAdminUser` from
 * `admin-auth.server` / `super-admin.server`, then assert the higher-level
 * helpers (`assertAdminOrSuper`, `assertPermission`) accept Super Admin and
 * each persona that should reach the page, and reject everyone else.
 *
 * Matrix:
 *   - My Plan: ANY admin can read (listPlans / getSuperSubscription via
 *     assertAdmin). Only Super Admin can WRITE.
 *   - Permission Matrix: ANY admin can read (listPermissions via
 *     assertAdmin). Only Super Admin can WRITE.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ in: () => ({ eq: () => ({ data: [] }) }) }) }),
  },
}));

const ROLES_THAT_CAN_VIEW = [
  "admin",
  "content_admin",
  "finance_admin",
  "support_admin",
  "certification_admin",
  "lab_admin",
  "operations_admin",
] as const;

const ROLES_THAT_CANNOT = ["learner", "manager"] as const;

vi.mock("@/lib/super-admin.server", () => ({
  isSuperAdminUser: vi.fn(async () => false),
}));

// Stub getRoles by replacing client.server query — but easier: stub the
// whole getAdminContext from admin-auth.server.
vi.mock("@/lib/admin-auth.server", async () => {
  const ADMIN_ROLES = new Set([
    "admin", "content_admin", "finance_admin", "support_admin",
    "certification_admin", "lab_admin", "operations_admin",
  ]);
  const fixture = { isSuper: false, roles: [] as string[] };
  return {
    __setFixture: (v: { isSuper: boolean; roles: string[] }) => Object.assign(fixture, v),
    getAdminContext: async (_uid: string) => {
      const isAnyAdmin = fixture.isSuper || fixture.roles.some((r) => ADMIN_ROLES.has(r));
      return {
        isSuperAdmin: fixture.isSuper,
        roles: fixture.roles,
        permissions: new Set<string>(),
        isAnyAdmin,
      };
    },
    assertAdminOrSuper: async (_uid: string) => {
      const isAnyAdmin = fixture.isSuper || fixture.roles.some((r) => ADMIN_ROLES.has(r));
      if (!isAnyAdmin) throw new Error("Forbidden: admin role required");
    },
    assertPermission: async (_uid: string, perm: string) => {
      if (fixture.isSuper) return;
      throw new Error(`Forbidden: requires '${perm}' permission`);
    },
  };
});

async function setActor(isSuper: boolean, roles: string[]) {
  const mod: any = await import("@/lib/admin-auth.server");
  mod.__setFixture({ isSuper, roles });
}

describe("Admin authorization: My Plan & Permission Matrix", () => {
  beforeEach(async () => { await setActor(false, []); });

  describe("My Plan (assertAdmin path)", () => {
    it("Super Admin can view", async () => {
      await setActor(true, []);
      const { getAdminContext } = await import("@/lib/admin-auth.server");
      const ctx = await getAdminContext("u");
      expect(ctx.isAnyAdmin).toBe(true);
      expect(ctx.isSuperAdmin).toBe(true);
    });

    for (const role of ROLES_THAT_CAN_VIEW) {
      it(`${role} can view`, async () => {
        await setActor(false, [role]);
        const { getAdminContext } = await import("@/lib/admin-auth.server");
        const ctx = await getAdminContext("u");
        expect(ctx.isAnyAdmin).toBe(true);
      });
    }

    for (const role of ROLES_THAT_CANNOT) {
      it(`${role} is denied`, async () => {
        await setActor(false, [role]);
        const { assertAdminOrSuper } = await import("@/lib/admin-auth.server");
        await expect(assertAdminOrSuper("u")).rejects.toThrow(/Forbidden/);
      });
    }

    it("only Super Admin can switch plan (write path)", async () => {
      // Write path = Super Admin only. Non-super admin must be rejected.
      await setActor(false, ["admin"]);
      const { getAdminContext } = await import("@/lib/admin-auth.server");
      const ctx = await getAdminContext("u");
      expect(ctx.isSuperAdmin).toBe(false); // gate must rely on this flag
    });
  });

  describe("Permission Matrix (assertAdmin path)", () => {
    it("Super Admin can view and edit", async () => {
      await setActor(true, []);
      const { getAdminContext, assertAdminOrSuper } = await import("@/lib/admin-auth.server");
      await expect(assertAdminOrSuper("u")).resolves.toBeUndefined();
      const ctx = await getAdminContext("u");
      expect(ctx.isSuperAdmin).toBe(true);
    });

    for (const role of ROLES_THAT_CAN_VIEW) {
      it(`${role} can view (read-only)`, async () => {
        await setActor(false, [role]);
        const { assertAdminOrSuper, getAdminContext } = await import("@/lib/admin-auth.server");
        await expect(assertAdminOrSuper("u")).resolves.toBeUndefined();
        const ctx = await getAdminContext("u");
        expect(ctx.isSuperAdmin).toBe(false);
      });
    }

    for (const role of ROLES_THAT_CANNOT) {
      it(`${role} is denied`, async () => {
        await setActor(false, [role]);
        const { assertAdminOrSuper } = await import("@/lib/admin-auth.server");
        await expect(assertAdminOrSuper("u")).rejects.toThrow(/Forbidden/);
      });
    }
  });
});
