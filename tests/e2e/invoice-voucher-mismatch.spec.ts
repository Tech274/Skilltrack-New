/**
 * E2E: Admin attempts to create an invoice where the certification voucher and
 * the amount do not match. The server must reject the request, no invoice row
 * is persisted, and no PDF is generated.
 *
 * Run:
 *   bunx playwright test tests/e2e/invoice-voucher-mismatch.spec.ts
 *
 * Env:
 *   E2E_BASE_URL         e.g. http://localhost:5173
 *   E2E_ADMIN_EMAIL      admin user
 *   E2E_ADMIN_PASSWORD   admin password
 *   E2E_LEARNER_QUERY    a search string that resolves to ≥1 learner row
 *   E2E_VOUCHER_CERT     visible substring of a published certification (e.g. "AWS")
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const EMAIL = process.env.E2E_ADMIN_EMAIL!;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD!;
const LEARNER_QUERY = process.env.E2E_LEARNER_QUERY || "@";
const VOUCHER_CERT = process.env.E2E_VOUCHER_CERT || "AWS";

test.describe("Invoice voucher mismatch", () => {
  test.skip(!EMAIL || !PASSWORD, "E2E env vars not set");

  test("rejects mismatched amount, no PDF, no invoice persisted", async ({ page }) => {
    // Sign in
    await page.goto(`${BASE}/auth`);
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/dashboard|\/admin/);

    // Go to invoices
    await page.goto(`${BASE}/admin/invoices`);
    const beforeRowCount = await page.locator("tbody tr").count();

    // Open dialog
    await page.getByRole("button", { name: /new invoice/i }).click();
    const dialog = page.getByRole("dialog", { name: /new invoice/i });
    await expect(dialog).toBeVisible();

    // Pick a learner
    await dialog.getByPlaceholder(/search learners/i).fill(LEARNER_QUERY);
    await dialog.locator("button").filter({ hasText: /@/ }).first().click();

    // Pick a certification voucher (auto-fills cost)
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option").filter({ hasText: new RegExp(VOUCHER_CERT, "i") }).first().click();

    // Tamper with the amount → mismatch
    const amount = dialog.getByLabel(/amount/i);
    await amount.fill("1"); // intentionally wrong

    // Inline client-side error visible and submit disabled
    await expect(dialog.getByText(/does not match the configured voucher cost/i)).toBeVisible();
    const createBtn = dialog.getByRole("button", { name: /create invoice/i });
    await expect(createBtn).toBeDisabled();

    // Bypass the disabled state to prove the SERVER rejects too. Intercept the
    // server-fn POST and watch for the failure response.
    await createBtn.evaluate((el) => el.removeAttribute("disabled"));
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/_serverFn/") && r.request().method() === "POST",
      { timeout: 10_000 },
    );
    await createBtn.click();
    const resp = await responsePromise;
    expect(resp.ok()).toBe(false);
    const body = await resp.text();
    expect(body).toMatch(/does not match the configured voucher cost/i);

    // Toast surfaces the failure
    await expect(page.getByText(/does not match the configured voucher cost/i).first()).toBeVisible();

    // Close dialog and verify no row was added → no PDF generated
    await page.keyboard.press("Escape");
    await page.reload();
    const afterRowCount = await page.locator("tbody tr").count();
    expect(afterRowCount).toBe(beforeRowCount);
  });
});
