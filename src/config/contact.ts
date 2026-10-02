export const SALES_WHATSAPP = "919036496255"; // +91 90364 96255
export const hasSalesWhatsApp =
  /^\d{10,15}$/.test(SALES_WHATSAPP) &&
  !["910000000000", "919999999999", "919876543210"].includes(SALES_WHATSAPP);
export const waLink = (t?: string) =>
  `https://wa.me/${SALES_WHATSAPP}${t ? `?text=${encodeURIComponent(t)}` : ""}`;
export const SALES_WHATSAPP_DISPLAY = "+91 90364 96255";
