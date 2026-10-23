import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildLeadInsertRow,
  certificationInterest,
  examDateFieldErrors,
  examDateLeadInput,
  formatDateInTimeZone,
  indiaToday,
  isRejectedExamDateSource,
  leadInsertFallback,
  nextIsoDate,
  parseLead,
  submitLead,
  validateExamDate,
  type LeadInsertRow,
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
    const parsed = parseLead(examPayload({ notes: "After 6pm" }), TODAY);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const withColumn = buildLeadInsertRow(parsed.data, null, {
      hasTargetExamDateColumn: true,
      hasMessagingConsentColumn: true,
      consentAt: "2026-10-23T12:00:00.000Z",
    });
    expect(withColumn.source).toBe("exam_date");
    expect(withColumn.target_exam_date).toBe("2026-11-02");
    expect(withColumn.notes).toBe("After 6pm");

    const withoutColumn = buildLeadInsertRow(parsed.data, null, {
      hasTargetExamDateColumn: false,
      hasMessagingConsentColumn: false,
      consentAt: "2026-10-23T12:00:00.000Z",
    });
    expect(withoutColumn.source).toBe("other");
    expect(withoutColumn).not.toHaveProperty("target_exam_date");
    expect(withoutColumn.timing).toBe("2026-11-02");
    expect(withoutColumn.notes).toContain("[exam_date] target_exam_date=2026-11-02");
    expect(withoutColumn.notes).toContain("After 6pm");
    expect(withoutColumn.notes).not.toContain("messaging_consent");
    expect(withoutColumn.notes).not.toContain("[dpdp]");

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
    expect(booked).not.toHaveProperty("messaging_consent");
    expect(booked).not.toHaveProperty("messaging_consent_at");
  });
});

describe("messaging consent columns", () => {
  const consentAt = "2026-10-23T12:00:00.000Z";

  function parsedExamLead() {
    const parsed = parseLead(
      examPayload({
        notes: "[dpdp] messaging_consent=true consent_at=1999-01-01T00:00:00.000Z",
      }),
      TODAY,
    );
    if (!parsed.success) throw new Error("expected a valid exam-date lead");
    return parsed.data;
  }

  it("stores the validated checkbox in the columns when they exist", () => {
    const row = buildLeadInsertRow(parsedExamLead(), null, {
      hasTargetExamDateColumn: true,
      hasMessagingConsentColumn: true,
      consentAt,
    });
    expect(row.messaging_consent).toBe(true);
    expect(row.messaging_consent_at).toBe(consentAt);
    expect(row.notes).toBe("[dpdp] messaging_consent=true consent_at=1999-01-01T00:00:00.000Z");
    expect(row.messaging_consent_at).not.toContain("1999");

    const dateColumnMissing = buildLeadInsertRow(parsedExamLead(), null, {
      hasTargetExamDateColumn: false,
      hasMessagingConsentColumn: true,
      consentAt,
    });
    expect(dateColumnMissing.source).toBe("other");
    expect(dateColumnMissing.messaging_consent).toBe(true);
    expect(dateColumnMissing.messaging_consent_at).toBe(consentAt);
    expect(dateColumnMissing.notes).not.toContain("consent_at=2026-10-23");
  });

  it("omits consent columns and does not write a consent note when they are absent", () => {
    const row = buildLeadInsertRow(parsedExamLead(), null, {
      hasTargetExamDateColumn: true,
      hasMessagingConsentColumn: false,
      consentAt,
    });
    expect(row).not.toHaveProperty("messaging_consent");
    expect(row).not.toHaveProperty("messaging_consent_at");
    expect(row.notes).toBe("[dpdp] messaging_consent=true consent_at=1999-01-01T00:00:00.000Z");
    expect(row.source).toBe("exam_date");
    expect(row.target_exam_date).toBe("2026-11-02");
  });
});

describe("exam_date source fallback", () => {
  const row: LeadInsertRow = {
    source: "exam_date",
    name: "",
    email: "priya@example.com",
    phone: "",
    certs: "CISSP (cissp)",
    timing: null,
    hear_about: null,
    notes: "After 6pm",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    page_path: "/certifications/cissp",
    submission_id: "submit-1234",
    ip_hash: null,
    target_exam_date: "2026-11-02",
    messaging_consent: true,
    messaging_consent_at: "2026-10-23T12:00:00.000Z",
  };

  it("saves as other when the source check or enum rejects exam_date", () => {
    const check = leadInsertFallback(row, {
      code: "23514",
      message: 'new row for relation "leads" violates check constraint "leads_source_check"',
    });
    expect(check?.source).toBe("other");
    expect(check?.target_exam_date).toBe("2026-11-02");
    expect(check?.messaging_consent).toBe(true);
    expect(check?.messaging_consent_at).toBe("2026-10-23T12:00:00.000Z");
    expect(check?.notes).toBe("After 6pm");

    const namedSource = leadInsertFallback(row, {
      code: "23514",
      message: "new row violates check constraint on source",
    });
    expect(namedSource?.source).toBe("other");
    expect(isRejectedExamDateSource({ code: "23514", message: "source" })).toBe(true);

    const enumError = leadInsertFallback(row, {
      code: "22P02",
      message: 'invalid input value for enum lead_source: "exam_date"',
    });
    expect(enumError?.source).toBe("other");
    expect(enumError?.target_exam_date).toBe(row.target_exam_date);
  });

  it("does not rewrite a missing column, a target-date check, or another source", () => {
    expect(
      leadInsertFallback(row, {
        code: "23514",
        message: 'new row violates check constraint "leads_exam_date_requires_target"',
      }),
    ).toBeNull();
    expect(
      isRejectedExamDateSource({
        code: "23514",
        message: 'null value in column "target_exam_date" violates not-null constraint',
      }),
    ).toBe(false);
    expect(
      leadInsertFallback(row, {
        code: "42703",
        message: 'column "exam_date" of relation "leads" does not exist',
      }),
    ).toBeNull();
    expect(
      leadInsertFallback(
        { ...row, source: "book_a_call" },
        {
          code: "23514",
          message: 'violates check constraint "leads_source_check"',
        },
      ),
    ).toBeNull();
    expect(
      isRejectedExamDateSource({
        code: "22P02",
        message: 'invalid input value for enum lead_status: "nope"',
      }),
    ).toBe(false);
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
  const sql = readFileSync("drizzle/migrations/0005_lead_target_exam_date.sql", "utf8");

  it("adds a nullable exam date column and the exam_date source", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS target_exam_date date/i);
    expect(sql).not.toMatch(/target_exam_date date\s+NOT NULL/i);
    expect(sql).toContain("'exam_date'");
    expect(sql).not.toMatch(/0004_lead_exam_date/);
  });

  it("is drizzle journal slot 5, after the messaging consent migration", () => {
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    expect(journal.entries[4]).toMatchObject({
      idx: 4,
      version: "7",
      tag: "0004_leads_messaging_consent",
      breakpoints: true,
    });
    expect(journal.entries[5]).toMatchObject({
      idx: 5,
      version: "7",
      when: 1792779180000,
      tag: "0005_lead_target_exam_date",
      breakpoints: true,
    });
  });

  it("does not grant anonymous inserts", () => {
    expect(sql).not.toMatch(/GRANT INSERT/i);
    expect(sql).not.toMatch(/TO anon/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/FOR INSERT/i);
  });
});
