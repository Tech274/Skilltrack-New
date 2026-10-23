// Application writes for admin_audit_log. The service role bypasses RLS, so
// append-only behaviour is enforced by the BEFORE UPDATE/DELETE trigger in
// 20261023180000_admin_audit_log.sql. A missing table must not fail the
// mutation that already succeeded; log the error code only.

export type AdminAuditEntry = {
  actorId: string;
  action: string;
  targetTable: string;
  targetId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
};

type InsertResult = { error: { code?: string } | null };

type AuditClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<InsertResult>;
  };
};

type SnapshotClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
};

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function recordAdminAudit(admin: unknown, entry: AdminAuditEntry): Promise<void> {
  const client = admin as AuditClient;
  const row = {
    actor_id: entry.actorId,
    action: clip(entry.action, 80),
    target_table: clip(entry.targetTable, 80),
    target_id: clip(entry.targetId, 200),
    summary: clip(entry.summary, 300),
    before: entry.before ?? null,
    after: entry.after ?? null,
  };
  try {
    const { error } = await client.from("admin_audit_log").insert(row);
    if (error) console.error("admin_audit_log insert failed", error.code ?? "unknown");
  } catch {
    console.error("admin_audit_log insert failed", "thrown");
  }
}

export async function snapshotRow(
  admin: unknown,
  table: string,
  id: string,
  columns: string,
): Promise<Record<string, unknown> | null> {
  try {
    const client = admin as SnapshotClient;
    const { data, error } = await client.from(table).select(columns).eq("id", id).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}
