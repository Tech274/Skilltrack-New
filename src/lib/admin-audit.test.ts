import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { recordAdminAudit, snapshotRow } from "./admin-audit.server";

const migration = readFileSync("supabase/migrations/20261023180000_admin_audit_log.sql", "utf8");

describe("admin_audit_log migration", () => {
  it("is append-only and readable by admins and super admins", () => {
    expect(migration).toContain("CREATE TABLE public.admin_audit_log");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("public.is_super_admin(auth.uid())");
    expect(migration).toContain("public.is_admin_role(");
    expect(migration).not.toMatch(/FOR\s+UPDATE/i);
    expect(migration).not.toMatch(/FOR\s+DELETE/i);
    expect(migration).not.toMatch(/FOR\s+INSERT/i);
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role",
    );
    expect(migration).toContain("RAISE EXCEPTION 'admin_audit_log is append-only'");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON public.admin_audit_log");
    expect(migration).not.toContain("is_admin(");
  });
});

describe("recordAdminAudit", () => {
  it("inserts actor, action, target, and leaves failures as a code-only log", async () => {
    const inserted: Record<string, unknown>[] = [];
    const admin = {
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          inserted.push({ table, ...row });
          return { error: null };
        },
      }),
    };
    await recordAdminAudit(admin, {
      actorId: "11111111-1111-1111-1111-111111111111",
      action: "invoice.create",
      targetTable: "invoices",
      targetId: "22222222-2222-2222-2222-222222222222",
      summary: "INV-1001",
    });
    expect(inserted[0]).toMatchObject({
      table: "admin_audit_log",
      actor_id: "11111111-1111-1111-1111-111111111111",
      action: "invoice.create",
      target_table: "invoices",
      target_id: "22222222-2222-2222-2222-222222222222",
      summary: "INV-1001",
    });

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await recordAdminAudit(
      {
        from: () => ({
          insert: async () => ({
            error: { code: "42P01", message: "relation secret_value does not exist" },
          }),
        }),
      },
      {
        actorId: "11111111-1111-1111-1111-111111111111",
        action: "invoice.delete",
        targetTable: "invoices",
      },
    );
    expect(error).toHaveBeenCalledWith("admin_audit_log insert failed", "42P01");
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret_value");
    error.mockRestore();
  });

  it("returns the prior row and ignores a failed snapshot", async () => {
    const row = await snapshotRow(
      {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "a", status: "draft" }, error: null }),
            }),
          }),
        }),
      },
      "invoices",
      "a",
      "id, status",
    );
    expect(row).toEqual({ id: "a", status: "draft" });
    const missing = await snapshotRow(
      {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { code: "42P01", message: "hidden" },
              }),
            }),
          }),
        }),
      },
      "invoices",
      "a",
      "id",
    );
    expect(missing).toBeNull();
  });
});

describe("admin mutation coverage", () => {
  it("records content, invoice, and user mutations", () => {
    const expected: Record<string, string[]> = {
      "src/lib/admin-content.functions.ts": [
        "certification.create",
        "certification.update",
        "certification.status",
        "certification.delete",
        "resource.create",
        "resource.update",
        "resource.status",
        "resource.delete",
        "mock_exam.create",
        "mock_exam.update",
        "mock_exam.status",
        "mock_exam.delete",
        "mock_exam_question.upsert",
        "mock_exam_question.delete",
      ],
      "src/lib/question-bank.functions.ts": [
        "question_bank.create",
        "question_bank.update",
        "question_bank.delete",
        "question_bank.import",
      ],
      "src/lib/learning-paths.functions.ts": [
        "learning_path.save",
        "learning_path.delete",
        "learning_path.rollback",
      ],
      "src/lib/admin-invoices.functions.ts": [
        "invoice.create",
        "invoice.status",
        "invoice.delete",
        "payment.record",
        "payment.status",
      ],
      "src/lib/admin.functions.ts": ["user.role_grant", "user.role_revoke", "user.delete"],
      "src/lib/admin-learners.functions.ts": [
        "learner.create",
        "learner.update",
        "learner.status",
        "learner.import",
      ],
    };
    for (const [file, actions] of Object.entries(expected)) {
      const src = readFileSync(file, "utf8");
      for (const action of actions) {
        expect(src, `${file} missing ${action}`).toContain(`action: "${action}"`);
      }
    }
    const list = readFileSync("src/lib/admin-audit.functions.ts", "utf8");
    expect(list).toContain("assertAdminOrSuper");
    expect(list).not.toContain("requireAdmin");
    const nav = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
    expect(nav).toContain(
      'to: "/admin/audit", label: "Audit Log", icon: ScrollText, anyAdmin: true',
    );
  });
});
