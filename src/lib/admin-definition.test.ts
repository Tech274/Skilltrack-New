import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin definition from the leads RLS branch", () => {
  it("uses requireAdmin and requireLeadAccess and does not add is_admin", () => {
    const auth = readFileSync("src/lib/admin-auth.server.ts", "utf8");
    expect(auth).toContain("export async function requireAdmin");
    expect(auth).toContain("export async function requireLeadAccess");
    expect(auth).toContain("LEAD_ACCESS_ROLES");

    const users = readFileSync("src/lib/admin.functions.ts", "utf8");
    const list = users.slice(users.indexOf("export const listAllUsers"), users.indexOf("export const grantUserRole"));
    expect(list).toContain("await requireAdmin(context.userId)");
    expect(list).toContain("await assertSuperAdmin");
    expect(list).not.toContain("isPlatformAdmin");
    expect(list).not.toContain("is_admin");

    const nav = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
    expect(nav).toContain('to: "/admin/users", label: "User Management", icon: Users, superOnly: true');
    expect(nav).not.toContain("platformAdmin");

    expect(existsSync("src/lib/platform-admin.server.ts")).toBe(false);
    expect(existsSync("supabase/migrations/20261023190000_unify_is_admin.sql")).toBe(false);
  });
});
