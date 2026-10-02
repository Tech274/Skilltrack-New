/**
 * E2E: Admin switches AI recommendation strategy to deterministic, then verifies
 *      (1) the dashboard banner shows the "AI recommendations disabled" message and
 *      (2) the latest audit row records strategy=deterministic.
 *
 * Run:
 *   bunx playwright test tests/e2e/ai-recs-deterministic.spec.ts
 *
 * Env:
 *   E2E_BASE_URL         e.g. http://localhost:5173
 *   E2E_ADMIN_EMAIL      admin user
 *   E2E_ADMIN_PASSWORD   admin password
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const EMAIL = process.env.E2E_ADMIN_EMAIL!;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

test.describe("AI recommendations — deterministic strategy", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E env vars not set");

  test("switch to deterministic, banner shown, audit row recorded", async ({ page }) => {
    // Sign in
    await page.goto(`${BASE}/auth`);
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/dashboard|\/admin/);

    // Switch strategy → deterministic
    await page.goto(`${BASE}/admin/ai-settings`);
    await page.getByRole("button", { name: /deterministic/i }).click();
    await expect(page.getByText(/strategy set to deterministic/i)).toBeVisible();

    // Trigger a recommendations call from the dashboard, then verify banner.
    await page.goto(`${BASE}/dashboard`);
    await expect(
      page.getByText(/AI recommendations disabled by configuration/i),
    ).toBeVisible({ timeout: 15_000 });

    // Verify audit page shows the latest row as deterministic
    await page.goto(`${BASE}/admin/ai-audit`);
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText(/deterministic/i);

    // Restore strategy
    await page.goto(`${BASE}/admin/ai-settings`);
    await page.getByRole("button", { name: /AI \(default\)/i }).click();
    await expect(page.getByText(/strategy set to ai/i)).toBeVisible();
  });
});
