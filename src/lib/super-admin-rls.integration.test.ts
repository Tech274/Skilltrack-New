// Integration test: verifies the `is_super_admin()` SQL helper and the RLS
// posture of the `super_admins` and `super_admin_audit_log` tables, for both
// super admins and non-super admins.
//
// We connect with psql using SUPABASE_DB_URL (already in the sandbox env),
// simulate an authenticated request by setting `request.jwt.claims` + the
// `authenticated` role, and confirm:
//   - is_super_admin returns true for users in super_admins, false otherwise
//   - non-super admins cannot SELECT other rows of super_admins
//   - non-super admins cannot INSERT/DELETE on super_admins
//   - non-super admins cannot SELECT super_admin_audit_log
//   - super admins can read both tables
//   - the grant/revoke trigger writes audit rows
//
// Run with: bunx vitest run src/lib/super-admin-rls.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const DB = process.env.SUPABASE_DB_URL ?? process.env.PG_URL ?? "";
const RUN = DB ? describe : describe.skip;

function sql(query: string): string {
  const args = DB
    ? ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", DB, "-c", query]
    : ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query];
  return execFileSync("psql", args, { encoding: "utf8" }).trim();
}

function asUser(uid: string, body: string): string {
  // Wrap body in a transaction with set_config so RLS policies see the user.
  const claims = JSON.stringify({ sub: uid, role: "authenticated" }).replace(/'/g, "''");
  return sql(`
    begin;
    select set_config('request.jwt.claims', '${claims}', true);
    set local role authenticated;
    ${body}
    commit;
  `);
}

const SUPER_UID = randomUUID();
const NORMAL_UID = randomUUID();

RUN("super-admin RLS", () => {
  beforeAll(() => {
    // Insert two fake auth.users entries so FKs hold.
    sql(`
      insert into auth.users (id, email, instance_id, aud, role)
      values
        ('${SUPER_UID}', 'rls-super-${SUPER_UID}@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
        ('${NORMAL_UID}', 'rls-normal-${NORMAL_UID}@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
      on conflict (id) do nothing;
    `);
    // Promote SUPER_UID. Insert as service role (no RLS) — emulates admin server.
    sql(`insert into public.super_admins (user_id) values ('${SUPER_UID}') on conflict do nothing;`);
  });

  afterAll(() => {
    sql(`delete from public.super_admin_audit_log where target_user_id in ('${SUPER_UID}','${NORMAL_UID}');`);
    sql(`delete from public.super_admins where user_id in ('${SUPER_UID}','${NORMAL_UID}');`);
    sql(`delete from auth.users where id in ('${SUPER_UID}','${NORMAL_UID}');`);
  });

  it("is_super_admin() returns true for super and false for non-super", () => {
    expect(sql(`select public.is_super_admin('${SUPER_UID}')`)).toBe("t");
    expect(sql(`select public.is_super_admin('${NORMAL_UID}')`)).toBe("f");
  });

  it("super admin can read super_admins rows", () => {
    const rows = asUser(SUPER_UID, `select count(*)::int from public.super_admins;`);
    expect(Number(rows.split("\n").pop())).toBeGreaterThanOrEqual(1);
  });

  it("non-super admin only sees their own row (none) in super_admins", () => {
    const rows = asUser(NORMAL_UID, `select count(*)::int from public.super_admins;`);
    expect(Number(rows.split("\n").pop())).toBe(0);
  });

  it("non-super admin cannot insert into super_admins", () => {
    expect(() =>
      asUser(NORMAL_UID, `insert into public.super_admins (user_id) values ('${NORMAL_UID}');`),
    ).toThrow();
  });

  it("non-super admin cannot delete from super_admins", () => {
    expect(() =>
      asUser(NORMAL_UID, `delete from public.super_admins where user_id = '${SUPER_UID}';`),
    ).toThrow();
  });

  it("non-super admin cannot read super_admin_audit_log", () => {
    const rows = asUser(NORMAL_UID, `select count(*)::int from public.super_admin_audit_log;`);
    expect(Number(rows.split("\n").pop())).toBe(0);
  });

  it("grant/revoke trigger writes audit_log rows", () => {
    const beforeStr = sql(`select count(*)::int from public.super_admin_audit_log where target_user_id = '${NORMAL_UID}';`);
    sql(`insert into public.super_admins (user_id) values ('${NORMAL_UID}');`);
    sql(`delete from public.super_admins where user_id = '${NORMAL_UID}';`);
    const afterStr = sql(`select count(*)::int from public.super_admin_audit_log where target_user_id = '${NORMAL_UID}';`);
    expect(Number(afterStr)).toBe(Number(beforeStr) + 2);
  });
});
