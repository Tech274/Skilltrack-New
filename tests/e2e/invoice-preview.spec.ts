/**
 * End-to-end test: Preview & send invoice flow.
 *
 * Prerequisites:
 *   bun add -d @playwright/test
 *   bunx playwright install --with-deps chromium
 *
 * Run with:
 *   bunx playwright test tests/e2e/invoice-preview.spec.ts
 *
 * Required env vars:
 *   E2E_BASE_URL           e.g. http://localhost:5173 or the preview URL
 *   E2E_ADMIN_EMAIL        an admin user the test signs in as
 *   E2E_ADMIN_PASSWORD     that user's password
 *   E2E_DRAFT_INVOICE_ID   id of a draft invoice with a certification voucher attached
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const EMAIL = process.env.E2E_ADMIN_EMAIL!;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD!;
const DRAFT_ID = process.env.E2E_DRAFT_INVOICE_ID!;

test.describe("Invoice Preview & Send", () => {
  test.skip(!EMAIL || !PASSWORD || !DRAFT_ID, "E2E env vars not set");

  test("renders PDF preview with logo + exam line item, then sends", async ({ page }) => {
    // 1. Sign in
    await page.goto(`${BASE}/auth`);
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/dashboard|\/admin/);

    // 2. Go to invoices
    await page.goto(`${BASE}/admin/invoices`);
    await expect(page.getByRole("heading", { name: /invoices/i })).toBeVisible();

    // 3. Open the row's action menu and click "Preview & send"
    const row = page.locator(`a[href*="${DRAFT_ID}"]`).first().locator("xpath=ancestor::tr");
    await row.getByRole("button").last().click(); // dropdown trigger
    await page.getByRole("menuitem", { name: /preview & send/i }).click();

    // 4. Preview dialog renders the PDF in an iframe with a data: URL
    const dialog = page.getByRole("dialog", { name: /preview invoice/i });
    await expect(dialog).toBeVisible();
    const iframe = dialog.locator("iframe");
    await expect(iframe).toHaveAttribute("src", /^data:application\/pdf;base64,/);

    // 5. Decode the PDF, assert it contains the logo image stream and an "Exam:" line item.
    //    pdf-lib text drawing emits literal strings, so we can grep the raw bytes.
    const src = await iframe.getAttribute("src");
    const base64 = src!.replace(/^data:application\/pdf;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    const asString = buf.toString("latin1");
    expect(asString).toContain("INVOICE");
    expect(asString).toContain("Exam:");
    // Embedded PNG → at least one /Image XObject must be present when logo is included.
    expect(asString).toMatch(/\/Subtype\s*\/Image/);

    // 6. Confirm send
    await dialog.getByRole("button", { name: /confirm & mark as sent/i }).click();

    // 7. Toast and badge update
    await expect(page.getByText(/invoice updated/i)).toBeVisible();
    await expect(row.getByText(/sent/i)).toBeVisible();
  });
});
