// Smoke test: ensure no hardcoded super-admin email gating survives anywhere
// in the admin codebase. The legacy check pinned super-admin to whoever
// owned `admin@skillbridge365.co.in`; the system is now driven by the
// `super_admins` table and `is_super_admin()` SQL helper. If anyone
// reintroduces an email-string check, this test fails immediately.
//
// Run with: bunx vitest run src/lib/admin-routes-smoke.test.ts

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = "admin@skillbridge365.co.in";
const ROOTS = ["src/lib", "src/routes/_authenticated", "src/components"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("admin routes smoke test", () => {
  it("no admin file references the legacy hardcoded super-admin email", () => {
    const files = ROOTS.flatMap((r) => {
      try { return walk(r); } catch { return []; }
    });
    const hits = files.filter((f) => !f.endsWith(".test.ts") && readFileSync(f, "utf8").includes(FORBIDDEN));
    expect(hits, `Hardcoded admin email still present in: ${hits.join(", ")}`).toEqual([]);
  });

  it("admin route files all exist and export a Route", () => {
    const routes = walk("src/routes/_authenticated").filter((f) => f.includes("/admin"));
    expect(routes.length).toBeGreaterThan(5);
    for (const f of routes) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} missing Route export`).toMatch(/export const Route\s*=\s*createFileRoute/);
    }
  });

  it("admin server helpers use isSuperAdminUser instead of email checks", () => {
    const adminLibs = walk("src/lib").filter((f) => /admin[-.]/.test(f) && !f.endsWith(".test.ts"));
    let usesHelper = 0;
    for (const f of adminLibs) {
      const src = readFileSync(f, "utf8");
      if (src.includes("isSuperAdminUser") || src.includes("is_super_admin")) usesHelper++;
      expect(src, `${f} must not compare against an email literal`).not.toMatch(/admin@\w+\.\w+/);
    }
    expect(usesHelper).toBeGreaterThan(0);
  });
});
