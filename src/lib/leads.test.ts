import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
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

function examPayload(overrides: Record<string, string> = {}) {
  return {
    source: "exam_date",
    email: "priya@example.com",
    target_exam_date: "2026-11-02",
    submission_id: "submit-1234",
    page_path: "/certifications/cissp",
    certs: "CISSP (cissp)",
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

  it("checks email and exam date separately for the form", () => {
    expect(examDateFieldErrors("not-an-email", "2026-10-22", TODAY)).toEqual({
      email: "Please enter a valid email",
      date: "Exam date must be in the future.",
    });
    expect(examDateFieldErrors("  priya@example.com ", "2026-12-01", TODAY)).toEqual({
      email: null,
      date: null,
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
  const sql = readFileSync("drizzle/migrations/0004_lead_exam_date.sql", "utf8");

  it("adds the exam date column and the exam_date source", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS target_exam_date date/i);
    expect(sql).toContain("'exam_date'");
  });

  it("lets the anonymous role insert and does not let it read", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.leads FROM anon/i);
    expect(sql).toMatch(
      /GRANT INSERT \([\s\S]*target_exam_date[\s\S]*\) ON TABLE public\.leads TO anon/i,
    );
    expect(sql).not.toMatch(/GRANT SELECT[\s\S]{0,80}TO anon/i);
    expect(sql).toMatch(/FOR INSERT\s+TO anon/i);
    expect(sql).not.toMatch(/FOR SELECT[\s\S]{0,40}TO anon/i);
    expect(sql).toMatch(
      /target_exam_date > \(CURRENT_TIMESTAMP AT TIME ZONE 'Asia\/Kolkata'\)::date/,
    );
  });
});
