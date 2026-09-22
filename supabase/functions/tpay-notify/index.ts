// FRA — Tpay webhook: the ONLY place that marks a booking as paid. Deployed with --no-verify-jwt.
//   1. X-JWS-Signature (RS256, cert from x5u, chain to Tpay root CA) — required
//   2. optional md5sum (TPAY_MERCHANT_ID + TPAY_SECURITY_CODE)
//   3. amount + order id checked against the database — never trusted from the request
import { db } from "../_shared/mail.ts";
import { fulfillOrder } from "../_shared/orders.ts";
import { verifyTpayJws, md5 } from "../_shared/tpay.ts";

const MERCHANT_ID = Deno.env.get("TPAY_MERCHANT_ID") ?? "";
const SECURITY_CODE = Deno.env.get("TPAY_SECURITY_CODE") ?? "";
const SKIP_JWS = Deno.env.get("TPAY_SKIP_JWS") === "1";

const TRUE = () => new Response("TRUE", { status: 200, headers: { "Content-Type": "text/plain" } });
const FAIL = (msg: string, s = 400) => { console.error("tpay-notify odrzucone:", msg); return new Response(`FALSE ${msg}`, { status: s, headers: { "Content-Type": "text/plain" } }); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return FAIL("tylko POST", 405);
  const raw = await req.text();

  const sig = req.headers.get("x-jws-signature");
  if (sig) { const v = await verifyTpayJws(sig, raw); if (!v.ok) return FAIL(`podpis JWS: ${v.err}`, 403); }
  else if (SKIP_JWS) console.warn("tpay-notify: brak podpisu, przepuszczone przez TPAY_SKIP_JWS=1");
  else return FAIL("brak nagłówka X-JWS-Signature", 403);

  const f = new URLSearchParams(raw);
  const trCrc = f.get("tr_crc") || "", trId = f.get("tr_id") || "", trAmount = f.get("tr_amount") || "0";
  const trPaid = f.get("tr_paid") || "0", trStatus = (f.get("tr_status") || "").toLowerCase();
  const currency = (f.get("tr_currency") || "PLN").toUpperCase();
  const channel = f.get("channel") || f.get("tr_channel") || "";

  if (MERCHANT_ID && SECURITY_CODE) {
    const expected = await md5(`${MERCHANT_ID}${trId}${trAmount}${trCrc}${SECURITY_CODE}`);
    if ((f.get("md5sum") || "").toLowerCase() !== expected) return FAIL("md5sum nie zgadza się", 403);
  }
  if (!/^[0-9a-f-]{36}$/i.test(trCrc)) return FAIL(`tr_crc nie jest id zamówienia: ${trCrc}`);
  const { data: o } = await db.from("bookings").select("*").eq("id", trCrc).maybeSingle();
  if (!o) return FAIL(`nie znaleziono zamówienia ${trCrc}`, 404);

  if (trStatus === "chargeback") {
    await db.from("bookings").update({ status: "chargeback", payment_error: "chargeback" }).eq("id", o.id);
    console.warn(`tpay-notify: chargeback #${o.number}`);
    return TRUE();
  }
  if (trStatus !== "true") {
    await db.from("bookings").update({ payment_error: `tr_status=${trStatus} ${f.get("tr_error") || ""}`.trim() }).eq("id", o.id);
    return TRUE();
  }
  const paidPln = Math.round(parseFloat(trPaid.replace(",", ".")));
  if (currency !== "PLN") return FAIL(`waluta ${currency}`);
  if (!Number.isFinite(paidPln) || paidPln < Number(o.amount_pln)) {
    await db.from("bookings").update({ payment_error: `niedopłata: ${trPaid} z ${o.amount_pln}`, paid_amount: paidPln }).eq("id", o.id);
    return FAIL(`niedopłata #${o.number}: ${trPaid} < ${o.amount_pln}`);
  }
  // tr_id in the notification is the readable title (TR-XXX-XXXXXXX), not the ULID
  if (trId && o.tpay_title && o.tpay_title !== trId && o.tpay_id !== trId) console.warn(`tpay-notify: #${o.number} tr_id ${trId} ≠ ${o.tpay_title}`);
  try {
    const res = await fulfillOrder(o.id, paidPln, channel || "tpay");
    console.log(`tpay-notify: #${o.number} ${res.already ? "już opłacone" : "opłacone"}`);
  } catch (e) {
    console.error("tpay-notify: realizacja", e);
    return FAIL("błąd realizacji", 500);   // Tpay retries until it gets TRUE
  }
  return TRUE();
});
