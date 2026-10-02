// Client-side export helpers (CSV + PDF) for a single learning path.
import jsPDF from "jspdf";

type Step = { title: string; topics?: string[]; estimated_hours?: number; resource_hints?: string[] };
type Assessment = { title: string; kind?: string; passing_score?: number };
export type ExportablePath = {
  title: string;
  description?: string | null;
  target_certification_slug?: string | null;
  difficulty?: string | null;
  estimated_hours?: number | null;
  status?: string;
  steps: Step[];
  prerequisites: string[];
  assessments: Assessment[];
  milestones?: { title: string; due_date?: string | null; success_criteria?: string }[];
};

const csvEscape = (s: unknown) => {
  const v = s == null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function pathToCsv(p: ExportablePath): string {
  const rows: string[][] = [];
  rows.push(["Section", "Index", "Field", "Value"]);
  rows.push(["Path", "", "Title", p.title]);
  rows.push(["Path", "", "Description", p.description ?? ""]);
  rows.push(["Path", "", "Target certification", p.target_certification_slug ?? ""]);
  rows.push(["Path", "", "Difficulty", p.difficulty ?? ""]);
  rows.push(["Path", "", "Estimated hours", p.estimated_hours != null ? String(p.estimated_hours) : ""]);
  rows.push(["Path", "", "Status", p.status ?? ""]);
  p.prerequisites.forEach((pre, i) => rows.push(["Prerequisite", String(i + 1), "Text", pre]));
  p.steps.forEach((s, i) => {
    rows.push(["Step", String(i + 1), "Title", s.title]);
    rows.push(["Step", String(i + 1), "Estimated hours", s.estimated_hours != null ? String(s.estimated_hours) : ""]);
    rows.push(["Step", String(i + 1), "Topics", (s.topics ?? []).join(" | ")]);
    rows.push(["Step", String(i + 1), "Resource hints", (s.resource_hints ?? []).join(" | ")]);
  });
  p.assessments.forEach((a, i) => {
    rows.push(["Assessment", String(i + 1), "Title", a.title]);
    rows.push(["Assessment", String(i + 1), "Kind", a.kind ?? ""]);
    rows.push(["Assessment", String(i + 1), "Passing score", a.passing_score != null ? String(a.passing_score) : ""]);
  });
  (p.milestones ?? []).forEach((m, i) => {
    rows.push(["Milestone", String(i + 1), "Title", m.title]);
    rows.push(["Milestone", String(i + 1), "Due date", m.due_date ?? ""]);
    rows.push(["Milestone", String(i + 1), "Success criteria", m.success_criteria ?? ""]);
  });
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function pathToPdf(p: ExportablePath): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) { doc.addPage(); y = M; }
  };
  const wrap = (text: string, w: number, size = 10) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(text || "", w);
  };
  const heading = (t: string, size = 14) => {
    ensure(size + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(t, M, y);
    y += size + 6;
    doc.setFont("helvetica", "normal");
  };
  const para = (t: string, size = 10) => {
    const lines = wrap(t, W - 2 * M, size);
    ensure(lines.length * (size + 2));
    doc.setFontSize(size);
    doc.text(lines, M, y);
    y += lines.length * (size + 2) + 4;
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(p.title || "Learning path", M, y);
  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  const meta = [
    p.target_certification_slug ? `Cert: ${p.target_certification_slug}` : null,
    p.difficulty ? `Difficulty: ${p.difficulty}` : null,
    p.estimated_hours ? `~${p.estimated_hours}h` : null,
    p.status ? `Status: ${p.status}` : null,
  ].filter(Boolean).join("  •  ");
  if (meta) { doc.text(meta, M, y); y += 14; }
  doc.setTextColor(0);

  if (p.description) { y += 6; para(p.description); }

  if (p.prerequisites.length) {
    heading("Prerequisites");
    p.prerequisites.forEach((pre, i) => para(`${i + 1}. ${pre}`));
  }

  if (p.steps.length) {
    heading("Steps");
    p.steps.forEach((s, i) => {
      heading(`${i + 1}. ${s.title}${s.estimated_hours ? `  (${s.estimated_hours}h)` : ""}`, 12);
      if (s.topics?.length) para(`Topics: ${s.topics.join(", ")}`);
      if (s.resource_hints?.length) para(`Resources: ${s.resource_hints.join(", ")}`);
    });
  }

  if (p.assessments.length) {
    heading("Assessments");
    p.assessments.forEach((a, i) => {
      para(`${i + 1}. ${a.title}${a.kind ? ` — ${a.kind}` : ""}${a.passing_score != null ? `, pass ${a.passing_score}%` : ""}`);
    });
  }

  if (p.milestones?.length) {
    heading("Milestones");
    p.milestones.forEach((m, i) => {
      para(`${i + 1}. ${m.title}${m.due_date ? ` — due ${m.due_date}` : ""}`);
      if (m.success_criteria) para(`   Success: ${m.success_criteria}`, 9);
    });
  }

  return doc.output("blob");
}
