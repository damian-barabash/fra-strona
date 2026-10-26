// Order fulfilment — the ONE place that marks a booking as paid and sends the e-mails.
// Used by the Tpay webhook (real payments) and by the admin (manual "mark as paid").
import { db, cfg, listOf, sendMail, shell, table, row, button, chip, zl, esc } from "./mail.ts";
import { spend } from "./discounts.ts";
import { syncToFpl } from "./fpl.ts";

const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");

const KIND_LABEL: Record<string, string> = {
  track: "SZKOLENIE NA TORZE", ice: "ICE DRIVING EXPERIENCE — LAPONIA", product: "PROGRAM", trip: "WYPRAWA", voucher: "VOUCHER PREZENTOWY",
};

function voucherCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join("");
  return `FRA-${pick(4)}-${pick(4)}`;
}

function summaryRows(o: any) {
  const rows: string[] = [];
  rows.push(row("Numer zamówienia", `<b>#${o.number}</b>`));
  rows.push(row("Rodzaj", KIND_LABEL[o.kind] || o.kind));
  if (o.kind === "voucher") {
    rows.push(row("Voucher na", esc(o.car_name)));
    if (o.sessions) rows.push(row("Pakiet", `${o.sessions} sesji`));
    if (o.voucher_for) rows.push(row("Dla", esc(o.voucher_for)));
    if (o.voucher_message) rows.push(row("Dedykacja", esc(o.voucher_message)));
  } else {
    rows.push(row(o.kind === "track" ? "Samochód" : "Produkt", esc(o.car_name || o.product_name)));
    if (o.sessions) rows.push(row("Pakiet", `${o.sessions} sesji`));
    if (o.package_name) rows.push(row("Pakiet", esc(o.package_name)));
    if (o.persons && o.persons > 1) rows.push(row("Liczba osób", o.persons));
    if (o.term_label) rows.push(row("Termin", esc(o.term_label)));
    if (o.date_from) rows.push(row("Daty", `${o.date_from}${o.date_to && o.date_to !== o.date_from ? ` – ${o.date_to}` : ""}`));
  }
  const rate = Number(o.vat_rate ?? 0), g = o.total_gross != null ? Number(o.total_gross) : Number(o.total);
  rows.push(row("Wartość netto", zl(o.total, o.currency)));
  if (rate > 0) rows.push(row(`VAT ${Math.round(rate * 100)}%`, zl2(round2(g - Number(o.total)), o.currency)));
  const disc = Number(o.discount_pln) || 0;
  if (disc > 0) {
    // a discount code: the full gross value, what the code took off, and what was actually charged
    rows.push(row("Wartość brutto", `${zl2(g, o.currency)}${o.currency === "EUR" ? ` (${zl2(round2(Number(o.amount_pln) + disc))} PLN)` : ""}`));
    rows.push(row("Kod rabatowy", `${esc(o.discount_code)} · <b style="color:#21b573">−${zl2(disc)}</b>`));
    rows.push(row("Do zapłaty", `<b>${zl2(o.amount_pln)}</b>${Number(o.amount_pln) ? "" : " — pokryte kodem rabatowym"}`, true));
  } else rows.push(row("Do zapłaty brutto", `<b>${zl2(g, o.currency)}</b>${o.currency === "EUR" && o.amount_pln ? ` (${zl2(o.amount_pln)} PLN)` : ""}`, true));
  if (o.tpay_title) rows.push(row("Transakcja Tpay", esc(o.tpay_title)));
  return table(rows.join(""));
}

/* every list price is NET; the customer pays GROSS */
export const VAT_RATE = 0.23;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const gross = (net: number, rate = VAT_RATE) => round2(Number(net) * (1 + rate));
export const zl2 = (n: number, currency = "PLN") => `${(Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "EUR" ? "€" : "zł"}`;

export async function fulfillOrder(orderId: string, paidAmount?: number, method?: string) {
  const { data: o } = await db.from("bookings").select("*").eq("id", orderId).maybeSingle();
  if (!o) throw new Error(`booking ${orderId} not found`);
  if (o.status === "paid") {
    // a repeated notification is a good moment to retry a Performance Lab sync that failed before
    if (!o.meta?.fpl?.ok) await syncToFpl(o);
    return { already: true, order: o };
  }

  const patch: Record<string, unknown> = { status: "paid", paid_at: new Date().toISOString() };
  if (paidAmount != null) patch.paid_amount = paidAmount;
  if (method) patch.tpay_method = method;
  if (o.kind === "voucher" && !o.voucher_code) patch.voucher_code = voucherCode();
  // the order is paid — its discount code is spent (if another order spent it first, the team sees why)
  if (o.discount_id && !(await spend(o))) patch.payment_error = `kod rabatowy ${o.discount_code} był już wykorzystany w innym zamówieniu`;
  const { data: upd, error } = await db.from("bookings").update(patch).eq("id", o.id).select("*").single();
  if (error) throw new Error(error.message);

  // Performance Lab: account (or match by e-mail / phone), payment, Race Litres, training — best-effort
  await syncToFpl(upd);

  // e-mails are best-effort: a failure never un-pays the order (the admin can resend)
  try {
    await sendOrderMails(upd);
    await db.from("bookings").update({ mail_sent: true }).eq("id", o.id);
  } catch (e) {
    console.error("order mails failed", e);
    await db.from("bookings").update({ mail_sent: false, payment_error: `mail: ${String(e).slice(0, 200)}` }).eq("id", o.id);
  }
  return { already: false, order: upd };
}

/* faktura VAT na firmę — the team issues it by hand, the customer sees which details it will carry */
const fmtNip = (n: string) => (n && n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}` : n || "");
function invoiceBox(inv: any, staff: boolean) {
  if (!inv?.nip) return "";
  const lines = `<b>${esc(inv.company)}</b><br>NIP: ${esc(fmtNip(inv.nip))}<br>${esc(inv.street)}, ${esc(inv.postal)} ${esc(inv.city)}`;
  return `<div style="margin:18px 0;padding:16px 18px;background:#f6f7f8;border-left:4px solid #e30613">
    <div style="color:#e30613;font-size:10px;letter-spacing:2px;font-weight:bold">${staff ? "KLIENT PROSI O FAKTURĘ VAT" : "FAKTURA VAT NA DANE"}</div>
    <div style="font-size:14px;line-height:1.7;margin-top:6px">${lines}</div>
    ${staff ? "" : `<div style="color:#6c7075;font-size:12px;margin-top:6px">Fakturę wyślemy osobno na ten adres e-mail.</div>`}
  </div>`;
}

export async function sendOrderMails(o: any) {
  const isVoucher = o.kind === "voucher";
  const details = summaryRows(o);

  // ---- customer ----
  let body = `<p>Cześć ${esc((o.full_name || "").split(" ")[0])}!</p>`;
  if (isVoucher) {
    body += `<p>Dziękujemy za zakup vouchera Fastline Racing Academy. Poniżej Twój kod — obdarowana osoba podaje go przy rezerwacji terminu na torze (telefonicznie, mailowo lub w konfiguratorze na stronie).</p>
      <div style="margin:22px 0;padding:22px;background:#0d0d0d;color:#fff;text-align:center;border-top:4px solid #e30613">
        <div style="color:#e30613;font-size:10px;letter-spacing:3px;font-weight:bold">KOD VOUCHERA</div>
        <div style="font-size:34px;font-weight:800;letter-spacing:4px;margin-top:8px">${esc(o.voucher_code)}</div>
        <div style="color:#9aa0a6;font-size:12px;margin-top:8px">ważny 12 miesięcy od daty zakupu</div>
      </div>`;
  } else {
    body += `<p>Płatność została zaksięgowana, a Twoje zamówienie jest potwierdzone. Skontaktujemy się przed terminem, żeby dopiąć szczegóły — do zobaczenia na torze!</p>`;
  }
  body += details;
  body += invoiceBox(o.invoice, false);
  body += `<p style="font-size:13px;color:#6c7075">Pytania? Łukasz: <a href="tel:+48603102665" style="color:#e30613">+48 603 102 665</a> · <a href="mailto:racingacademy@fastline.pl" style="color:#e30613">racingacademy@fastline.pl</a></p>`;
  body += button(`${SITE}/kalendarz`, isVoucher ? "Zobacz terminy na torze" : "Kalendarz szkoleń");
  const T = o.is_test ? "[TEST] " : "";   // the hidden test product — never mistaken for a real sale
  const custSubject = T + (isVoucher ? `Twój voucher ${o.voucher_code} — Fastline Racing Academy` : `Potwierdzenie zamówienia #${o.number} — Fastline Racing Academy`);
  const c = await sendMail(o.email, custSubject, shell(isVoucher ? "Voucher gotowy!" : "Zamówienie opłacone", body, { eyebrow: "FASTLINE RACING ACADEMY", preheader: `Zamówienie #${o.number}` }));
  if (!c.ok) throw new Error(c.error);

  // ---- staff ----
  const toKey = isVoucher ? "voucher_to" : "order_to";
  const staff = listOf(await cfg(toKey, "lukasz.kazmierczak@greywolfgroup.pl"));
  const sBody = `<p>${chip(o.is_test ? "ZAMÓWIENIE TESTOWE" : isVoucher ? "NOWY VOUCHER" : "NOWE ZAMÓWIENIE")}</p>
    ${details}
    ${invoiceBox(o.invoice, true)}
    ${table([
      row("Klient", `<b>${esc(o.full_name)}</b>`),
      row("E-mail", `<a href="mailto:${esc(o.email)}" style="color:#e30613">${esc(o.email)}</a>`),
      row("Telefon", `<a href="tel:${esc(o.phone)}" style="color:#e30613">${esc(o.phone)}</a>`),
      row("Uwagi", esc(o.note || "—")),
      row("Opłacono", o.paid_at ? new Date(o.paid_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }) : "—"),
    ].join(""))}
    ${button(`${SITE}/admin`, "Otwórz w panelu")}`;
  await sendMail(staff, `${T}${isVoucher ? "Voucher" : "Zamówienie"} #${o.number} — ${o.full_name} — ${zl(o.total, o.currency)}${o.invoice?.nip ? " — FAKTURA" : ""}`, shell(isVoucher ? `Voucher #${o.number}` : `Zamówienie #${o.number}`, sBody, { eyebrow: "PANEL SPRZEDAŻY" }), o.email);
}
