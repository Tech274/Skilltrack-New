import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildLeadInsertRow,
  certificationInterest,
  examDateFieldErrors,
  examDateLeadInput,
  formatDateInTimeZone,
  indiaToday,
  nextIsoDate,
  parseLead,
  submitLead,
  validateExamDate,
} from "./leads";

const TODAY = "2026-10-23";

function examPayload(overrides: Record<string, unknown> = {}) {
  return {
    source: "exam_date",
    email: "priya@example.com",
    target_exam_date: "2026-11-02",
    submission_id: "submit-1234",
    page_path: "/certifications/cissp",
    certs: "CISSP (cissp)",
    messaging_consent: true,
    ...overrides,
  };
}

describe("exam date validation", () => {
  it("formats the India calendar date", () => {
    expect(formatDateInTimeZone(new Date("2026-10-23T18:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-10-23",
    );
    expect(formatDateInTimeZone(new Date("2026-10-23T20:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-10-24",
    );
    expect(indiaToday(new Date("2026-10-23T20:00:00Z"))).toBe("2026-10-24");
  });

  it("accepts a future ISO date and rejects today, the past, and junk", () => {
    expect(validateExamDate("2026-10-24", TODAY)).toBeNull();
    expect(validateExamDate("2026-10-23", TODAY)).toMatch(/future/i);
    expect(validateExamDate("2026-10-22", TODAY)).toMatch(/future/i);
    expect(validateExamDate("", TODAY)).toMatch(/choose/i);
    expect(validateExamDate("2026-02-31", TODAY)).toMatch(/valid/i);
    expect(validateExamDate("10/24/2026", TODAY)).toMatch(/valid/i);
    expect(nextIsoDate(TODAY)).toBe("2026-10-24");
  });

  it("checks email, exam date, and consent separately for the form", () => {
    expect(examDateFieldErrors("not-an-email", "2026-10-22", TODAY, false)).toEqual({
      email: "Please enter a valid email",
      date: "Exam date must be in the future.",
      consent: "Please agree to be contacted before submitting.",
    });
    expect(examDateFieldErrors("  priya@example.com ", "2026-12-01", TODAY, true)).toEqual({
      email: null,
      date: null,
      consent: null,
    });
  });
});

describe("parseLead", () => {
  it("accepts an exam-date lead without a name or phone", () => {
    const parsed = parseLead(examPayload(), TODAY);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.source).toBe("exam_date");
    expect(parsed.data.name).toBe("");
    expect(parsed.data.phone).toBe("");
    expect(parsed.data.target_exam_date).toBe("2026-11-02");
    expect(parsed.data.certs).toBe("CISSP (cissp)");
  });

  it("rejects a missing, present, or past exam date for this source", () => {
    expect(parseLead(examPayload({ target_exam_date: "" }), TODAY).success).toBe(false);
    expect(parseLead(examPayload({ target_exam_date: TODAY }), TODAY).success).toBe(false);
    expect(parseLead(examPayload({ target_exam_date: "2020-01-01" }), TODAY).success).toBe(false);
  });

  it("rejects an exam-date lead until messaging consent is ticked", () => {
    const parsed = parseLead(examPayload({ messaging_consent: false }), TODAY);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Please agree to be contacted before submitting.",
    );
  });

  it("rejects an invalid email", () => {
    const parsed = parseLead(examPayload({ email: "priya@" }), TODAY);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toMatch(/valid email/i);
  });

  it("still requires a name and phone for the existing book-a-call source", () => {
    const parsed = parseLead(
      {
        source: "book_a_call",
        email: "priya@example.com",
        submission_id: "submit-1234",
      },
      TODAY,
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const messages = parsed.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Please enter your name");
    expect(messages).toContain("Please enter a phone number");
  });

  it("stores the certification the visitor was reading", () => {
    const input = examDateLeadInput({
      email: "priya@example.com",
      targetExamDate: "2026-11-02",
      certification: { slug: "aws-solutions-architect-associate", name: "AWS Solutions Architect" },
      pagePath: "/certifications/aws-solutions-architect-associate",
      utmSource: "site",
      utmMedium: "cert_detail",
      utmCampaign: "aws",
      submissionId: "submit-1234",
      companyWebsite: "",
    });
    expect(input.certs).toBe("AWS Solutions Architect (aws-solutions-architect-associate)");
    expect(input.source).toBe("exam_date");
    expect(certificationInterest(null)).toBe("");
    expect(certificationInterest({ slug: "cissp", name: "" })).toBe("cissp (cissp)");
    expect(input.messaging_consent).toBe(true);
  });

  it("omits target_exam_date until that column exists", () => {
    const parsed = parseLead(examPayload(), TODAY);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const withColumn = buildLeadInsertRow(parsed.data, null, {
      hasTargetExamDateColumn: true,
      consentAt: "2026-10-23T12:00:00.000Z",
    });
    expect(withColumn.source).toBe("exam_date");
    expect(withColumn.target_exam_date).toBe("2026-11-02");
    expect(withColumn.notes).toContain("messaging_consent=true");

    const withoutColumn = buildLeadInsertRow(parsed.data, null, {
      hasTargetExamDateColumn: false,
      consentAt: "2026-10-23T12:00:00.000Z",
    });
    expect(withoutColumn.source).toBe("other");
    expect(withoutColumn).not.toHaveProperty("target_exam_date");
    expect(withoutColumn.timing).toBe("2026-11-02");
    expect(withoutColumn.notes).toContain("[exam_date] target_exam_date=2026-11-02");
    expect(withoutColumn.notes).toContain("[dpdp] messaging_consent=true");

    const booked = buildLeadInsertRow(
      {
        ...parsed.data,
        source: "book_a_call",
        name: "Priya",
        phone: "999",
      },
      null,
      { hasTargetExamDateColumn: false },
    );
    expect(booked.source).toBe("book_a_call");
    expect(booked).not.toHaveProperty("target_exam_date");
  });
});

describe("submitLead", () => {
  it("returns the saved id and surfaces API errors", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, id: "lead-id-1" }), { status: 200 }),
    );
    await expect(
      submitLead({
        source: "exam_date",
        email: "priya@example.com",
        submission_id: "submit-1234",
        target_exam_date: "2026-11-02",
      }),
    ).resolves.toEqual({ ok: true, id: "lead-id-1" });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: "Too many requests. Please try again in a few minutes.",
        }),
        {
          status: 429,
        },
      ),
    );
    await expect(
      submitLead({
        source: "exam_date",
        email: "priya@example.com",
        submission_id: "submit-1234",
        target_exam_date: "2026-11-02",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Too many requests. Please try again in a few minutes.",
    });
    vi.unstubAllGlobals();
  });
});

describe("exam date lead migration", () => {
  const sql = readFileSync("drizzle/migrations/20261023193000_lead_target_exam_date.sql", "utf8");

  it("adds a nullable exam date column and the exam_date source", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS target_exam_date date/i);
    expect(sql).not.toMatch(/target_exam_date date\s+NOT NULL/i);
    expect(sql).toContain("'exam_date'");
    expect(sql).not.toMatch(/0004_lead_exam_date/);
  });

  it("does not grant anonymous inserts", () => {
    expect(sql).not.toMatch(/GRANT INSERT/i);
    expect(sql).not.toMatch(/TO anon/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/FOR INSERT/i);
  });
});
