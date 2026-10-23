import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children?: ReactNode; to: string; className?: string }) =>
    createElement("a", { href: to, className }, children),
}));

import { ExamDateLeadForm } from "./exam-date-lead-form";

function renderForm(certification?: { slug: string; name: string }) {
  return renderToStaticMarkup(createElement(ExamDateLeadForm, { certification }));
}

describe("ExamDateLeadForm", () => {
  it("asks for an email and a future exam date, with a consent line and a live status", () => {
    const html = renderForm();
    expect(html).toContain("Email");
    expect(html).toContain('type="email"');
    expect(html).toContain("Target exam date");
    expect(html).toContain('type="date"');
    expect(html).toContain("required");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("contact you at this email");
    expect(html).toContain("Save my exam date");
    expect(html).not.toContain("Certification:");
  });

  it("names the certification the visitor is reading", () => {
    const html = renderForm({ slug: "cissp", name: "CISSP" });
    expect(html).toContain("Planning CISSP?");
    expect(html).toContain("Certification:");
    expect(html).toContain("CISSP");
  });
});
