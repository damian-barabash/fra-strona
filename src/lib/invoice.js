// Faktura VAT na firmę — the same rules as the server (admin-api `invoiceOf`).
// NIP: 10 digits, the last one is the checksum (weights 6,5,7,2,3,4,5,6,7, modulo 11).

export const EMPTY_INVOICE = { want: false, nip: "", company: "", street: "", postal: "", city: "" };

export const normNip = (v) => String(v || "").replace(/^\s*PL/i, "").replace(/[\s-]/g, "");
export function nipValid(nip) {
  if (!/^\d{10}$/.test(nip)) return false;
  const sum = [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((s, k, i) => s + k * Number(nip[i]), 0) % 11;
  return sum !== 10 && sum === Number(nip[9]);
}
export const fmtNip = (nip) => (nip && nip.length === 10 ? `${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8)}` : nip || "");
// "00916" / "00 916" → "00-916" while typing
export const fmtPostal = (v) => { const d = String(v || "").replace(/\D/g, "").slice(0, 5); return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d; };

/** The first thing to fix (a text key), or "" when the invoice data is fine / not wanted. */
export function invoiceProblem(inv) {
  if (!inv?.want) return "";
  if (!nipValid(normNip(inv.nip))) return "inv.errNip";
  if (!inv.company.trim()) return "inv.errCompany";
  if (!inv.street.trim() || !inv.city.trim()) return "inv.errAddress";
  if (!/^\d{2}-\d{3}$/.test(inv.postal.trim())) return "inv.errPostal";
  return "";
}

/** What goes to checkout: null = no invoice. */
export const invoicePayload = (inv) => (inv?.want ? {
  nip: normNip(inv.nip), company: inv.company.trim(), street: inv.street.trim(), postal: inv.postal.trim(), city: inv.city.trim(),
} : null);
