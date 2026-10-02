import { describe, it, expect } from "vitest";
import { buildPermissionCsv, type MatrixRow } from "./permission-export";

describe("buildPermissionCsv", () => {
  const roles = ["learner", "admin"];
  const labels = { learner: "Learner", admin: "Admin" };
  const rows: MatrixRow[] = [
    { permission: "reports.view", description: "View reports", byRole: { learner: false, admin: true } },
    { permission: "users.manage", description: null, byRole: { learner: null, admin: true } },
    { permission: "comma,test", description: 'has "quotes"', byRole: { learner: true, admin: false } },
  ];

  it("emits header + rows", () => {
    const csv = buildPermissionCsv(roles, labels, rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Permission,Description,Learner,Admin");
    expect(lines[1]).toBe("reports.view,View reports,Denied,Allowed");
    expect(lines[2]).toBe("users.manage,,—,Allowed");
  });

  it("escapes commas and quotes", () => {
    const csv = buildPermissionCsv(roles, labels, rows);
    const last = csv.split("\n").pop()!;
    expect(last).toContain('"comma,test"');
    expect(last).toContain('"has ""quotes"""');
  });
});
