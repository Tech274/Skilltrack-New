// Invoice currency: a saved label + formatting only. No FX conversion.
export const INVOICE_CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE" },
] as const;

export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number]["code"];
export const INVOICE_CURRENCY_CODES = INVOICE_CURRENCIES.map((c) => c.code) as [
  InvoiceCurrency,
  ...InvoiceCurrency[],
];

export function normalizeCurrency(c: unknown): InvoiceCurrency {
  const s = String(c ?? "").toUpperCase();
  return (INVOICE_CURRENCY_CODES as string[]).includes(s) ? (s as InvoiceCurrency) : "INR";
}

export function formatInvoiceAmount(amount: unknown, currency: unknown, digits = 2): string {
  const code = normalizeCurrency(currency);
  const meta = INVOICE_CURRENCIES.find((c) => c.code === code)!;
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount || 0));
}

/** PDF standard fonts (WinAnsi) can't encode ₹, so swap it for "Rs." there only. */
export function formatInvoiceAmountPdf(amount: unknown, currency: unknown): string {
  return formatInvoiceAmount(amount, currency).replace(/₹\s?/g, "Rs. ");
}

/** Sum per currency — never across currencies. */
export function sumByCurrency<T>(
  rows: T[],
  getCurrency: (r: T) => unknown,
  getAmount: (r: T) => unknown,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const c = normalizeCurrency(getCurrency(r));
    out[c] = (out[c] ?? 0) + Number(getAmount(r) || 0);
  }
  return out;
}

export function formatCurrencyTotals(totals: Record<string, number>, digits = 0): string {
  const parts = INVOICE_CURRENCY_CODES.filter((c) => totals[c] !== undefined).map((c) =>
    formatInvoiceAmount(totals[c], c, digits),
  );
  return parts.length ? parts.join(" · ") : formatInvoiceAmount(0, "INR", digits);
}

/** Convert per-currency totals into one target currency using INR-based rates (1 INR = rates[c]). */
export function convertTotals(
  totals: Record<string, number>,
  target: InvoiceCurrency,
  rates: Record<string, number> | null | undefined,
): number | null {
  if (!rates) return null;
  let sum = 0;
  for (const [c, amt] of Object.entries(totals)) {
    const from = rates[c];
    const to = rates[target];
    if (!from || !to) return null;
    sum += (amt / from) * to;
  }
  return sum;
}

/** Canonical invoice money formatter (alias). */
export const formatMoney = (amount: unknown, currency: unknown) => formatInvoiceAmount(amount, currency);

/** GST applies to INR invoices only. */
export const isGstCurrency = (currency: unknown) => normalizeCurrency(currency) === "INR";
