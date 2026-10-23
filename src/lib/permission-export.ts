// Client-side export helpers for the Permission Matrix.
// CSV uses a plain Blob; PDF uses window.print() against a generated HTML doc
// (no extra deps; user picks "Save as PDF" in the print dialog).

export type MatrixRow = {
  permission: string;
  description: string | null;
  byRole: Record<string, boolean | null>;
};

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildPermissionCsv(
  roles: string[],
  roleLabels: Record<string, string>,
  rows: MatrixRow[],
): string {
  const header = ["Permission", "Description", ...roles.map((r) => roleLabels[r] ?? r)];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.permission,
        r.description ?? "",
        ...roles.map((role) => {
          const v = r.byRole[role];
          return v == null ? "—" : v ? "Allowed" : "Denied";
        }),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Stable inline script so the print window can be allowed by a CSP hash. */
export const PERMISSION_PDF_PRINT_SCRIPT =
  "window.addEventListener('load',()=>setTimeout(()=>window.print(),250));";

export function openPermissionPdf(
  roles: string[],
  roleLabels: Record<string, string>,
  rows: MatrixRow[],
  meta: { generatedAt: string; generatedBy: string | null },
) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  const cell = (v: boolean | null | undefined) =>
    v == null
      ? '<td style="text-align:center;color:#999">—</td>'
      : v
        ? '<td style="text-align:center;color:#0a7d2c;font-weight:600">✓</td>'
        : '<td style="text-align:center;color:#b00020">✗</td>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Permission Matrix</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px}
  .meta{color:#555;font-size:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}
  th{background:#f5f5f7;text-align:left;font-weight:600}
  .perm{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px}
  .desc{color:#555;font-size:10px}
  @media print{ @page{ size:A3 landscape; margin:12mm } }
</style></head><body>
<h1>Role Permissions Matrix</h1>
<div class="meta">Generated ${new Date(meta.generatedAt).toLocaleString()}${meta.generatedBy ? ` by ${meta.generatedBy}` : ""}</div>
<table><thead><tr><th>Permission</th>${roles.map((r) => `<th>${roleLabels[r] ?? r}</th>`).join("")}</tr></thead>
<tbody>
${rows.map((r) => `<tr><td><div class="perm">${r.permission}</div>${r.description ? `<div class="desc">${r.description}</div>` : ""}</td>${roles.map((role) => cell(r.byRole[role])).join("")}</tr>`).join("")}
</tbody></table>
<script>${PERMISSION_PDF_PRINT_SCRIPT}</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}
