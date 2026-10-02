// Server-only file parsers. Imported lazily from handlers only.

export type ParsedFile =
  | { kind: "text"; text: string; truncated: boolean; chars: number }
  | { kind: "tabular"; headers: string[]; rows: Record<string, any>[]; truncated: boolean; totalRows: number };

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_TEXT_CHARS = 200_000;
const MAX_TABULAR_ROWS = 1000;

export const ALLOWED_EXT = ["pdf", "docx", "xlsx", "xls", "csv", "txt"] as const;
export const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "application/octet-stream", // generic — magic-byte check still applies at parse time
];

/** Validate filename extension + MIME + magic bytes. Throws on rejection. */
export function validateUpload(buffer: ArrayBuffer, mime: string, name: string): void {
  if (buffer.byteLength === 0) throw new Error("Empty file");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`);
  }
  const lower = (name ?? "").toLowerCase();
  const ext = lower.split(".").pop() ?? "";
  if (!ALLOWED_EXT.includes(ext as any)) {
    throw new Error(`File type "${ext}" not allowed. Use PDF, DOCX, XLS/XLSX, CSV, or TXT.`);
  }
  const m = (mime ?? "").toLowerCase();
  if (m && !ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p))) {
    throw new Error(`MIME type "${mime}" not allowed.`);
  }
  // Magic-byte sniff
  const b = new Uint8Array(buffer.slice(0, 8));
  const isPdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
  const isZip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; // PK (docx/xlsx)
  const isOldXls = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // OLE2
  if (ext === "pdf" && !isPdf) throw new Error("File contents do not match PDF format");
  if ((ext === "docx" || ext === "xlsx") && !isZip) throw new Error("File contents do not match Office format");
  if (ext === "xls" && !isOldXls && !isZip) throw new Error("File contents do not match XLS format");
}

export async function parseAiUpload(buffer: ArrayBuffer, mime: string, name: string): Promise<ParsedFile> {
  validateUpload(buffer, mime, name);
  const lower = (name ?? "").toLowerCase();
  const isPdf = mime?.includes("pdf") || lower.endsWith(".pdf");
  const isDocx = mime?.includes("officedocument.wordprocessingml") || lower.endsWith(".docx");
  const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime?.includes("spreadsheet");
  const isCsv = lower.endsWith(".csv") || mime?.includes("csv");

  if (isPdf) {
    const mod: any = await import("pdf-parse");
    const fn = mod.default ?? mod;
    const res = await fn(Buffer.from(buffer));
    const raw = String(res?.text ?? "");
    return { kind: "text", text: raw.slice(0, MAX_TEXT_CHARS), truncated: raw.length > MAX_TEXT_CHARS, chars: raw.length };
  }
  if (isDocx) {
    const mammoth: any = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const raw = String(res?.value ?? "");
    return { kind: "text", text: raw.slice(0, MAX_TEXT_CHARS), truncated: raw.length > MAX_TEXT_CHARS, chars: raw.length };
  }
  if (isXlsx || isCsv) {
    const XLSX: any = await import("xlsx");
    const wb = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      kind: "tabular",
      headers,
      rows: rows.slice(0, MAX_TABULAR_ROWS),
      truncated: rows.length > MAX_TABULAR_ROWS,
      totalRows: rows.length,
    };
  }
  const raw = new TextDecoder().decode(buffer);
  return { kind: "text", text: raw.slice(0, MAX_TEXT_CHARS), truncated: raw.length > MAX_TEXT_CHARS, chars: raw.length };
}
