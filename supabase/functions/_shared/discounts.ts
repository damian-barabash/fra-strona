// Kody rabatowe — the one place that decides whether a code is valid, what it is worth on an order,
// and that reserves / spends it. Used by admin-api (public check + checkout + panel) and by
// fulfillOrder (a paid order spends its code). Mirror of the browser maths: src/lib/discount.js.
import { db } from "./mail.ts";

export const RESERVE_MIN = 60;          // a pending order holds its code this long (the gateway session)
export const FREE_BELOW = 1;            // less than 1 zł left to pay = the code covers the order

export const round2 = (n: number) => Math.round(Number(n) * 100) / 100;
export const normCode = (s: unknown) => String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
export const validCode = (c: string) => /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(c);
// Warsaw calendar day — "valid until 31.12" means the whole of that day
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

export type Code = {
  id: string; code: string; kind: "amount" | "product"; value_type: "amount" | "percent" | "full"; value: number;
  target: Target | null; valid_from: string | null; valid_to: string | null; active: boolean;
  reserved_booking: string | null; reserved_email: string | null; reserved_until: string | null; used_at: string | null; used_booking: string | null;
};
export type Target = { kind: "track" | "ice" | "product" | "trip"; car_id?: string | null; sessions?: number | null; package_id?: string | null; slug?: string | null; variant?: string | null };

export const REASON: Record<string, string> = {
  notfound: "Nie znamy takiego kodu. Sprawdź, czy został wpisany bez błędów.",
  used: "Ten kod został już wykorzystany — każdy kod działa tylko raz.",
  disabled: "Ten kod został wyłączony.",
  expired: "Ten kod stracił ważność.",
  early: "Ten kod zacznie działać później.",
  reserved: "Ten kod jest właśnie używany w innej, niedokończonej płatności. Spróbuj ponownie za godzinę.",
  voucher: "To kod vouchera prezentowego — termin z voucherem rezerwujemy telefonicznie lub mailowo: +48 603 102 665, racingacademy@fastline.pl.",
  throttle: "Zbyt wiele prób. Spróbuj ponownie za kilkanaście minut.",
  target: "Ten kod dotyczy innego produktu niż wybrany.",
};

/** Why a code cannot be used right now (null = it can). `email` lets the same customer retry a payment;
 *  `anyHold` = ignore a live reservation (the public check: the customer may be the one coming back from the
 *  gateway — the checkout, which knows the e-mail, decides). */
export function stateOf(c: Code, email = "", anyHold = false): string | null {
  if (c.used_at) return "used";
  if (!c.active) return "disabled";
  const d = today();
  if (c.valid_from && d < c.valid_from) return "early";
  if (c.valid_to && d > c.valid_to) return "expired";
  if (!anyHold && c.reserved_until && new Date(c.reserved_until) > new Date() && (!email || (c.reserved_email || "") !== email.toLowerCase())) return "reserved";
  return null;
}

export async function findCode(code: string): Promise<Code | null> {
  const { data } = await db.from("discount_codes").select("*").eq("code", normCode(code)).maybeSingle();
  return (data as Code) ?? null;
}

/** Does a product code fit the order row (built by the checkout before insert)? Amount codes fit everything. */
export function fits(c: Code, row: Record<string, any>): boolean {
  if (c.kind !== "product") return true;
  const t = c.target;
  if (!t?.kind) return false;
  if (t.kind === "track") {
    if (row.kind !== "track") return false;
    if (t.car_id === "own" && !row.is_custom) return false;
    if (t.car_id && t.car_id !== "own" && row.car_id !== t.car_id) return false;
    return !t.sessions || Number(row.sessions) === Number(t.sessions);
  }
  if (t.kind === "ice") return row.kind === "ice" && (!t.package_id || row.package_id === t.package_id);
  if (t.kind === "product") return row.kind === "product" && row.product_slug === t.slug && (!t.variant || row.package_name === t.variant);
  if (t.kind === "trip") return row.kind === "trip" && (t.package_id ? row.trip_package_id === t.package_id : (!t.slug || row.product_slug === t.slug));
  return false;
}

/** How many PLN the code takes off. base = the whole gross amount in PLN, unit = one person's share
 *  (a product code is worth one place — the 2nd person of a Laponia stay pays in full). */
export function offFor(c: Code, basePln: number, unitPln: number): number {
  let off = 0;
  if (c.kind === "amount") off = Number(c.value) || 0;
  else if (c.value_type === "full") off = unitPln;
  else if (c.value_type === "percent") off = round2(unitPln * Math.min(100, Math.max(0, Number(c.value) || 0)) / 100);
  else off = Math.min(Number(c.value) || 0, unitPln);
  off = Math.min(round2(off), basePln);
  if (basePln - off < FREE_BELOW) off = basePln;
  return round2(off);
}

export async function reserve(c: Code, bookingId: string, email: string) {
  const { data, error } = await db.rpc("discount_reserve", { p_id: c.id, p_booking: bookingId, p_email: email, p_minutes: RESERVE_MIN });
  return !error && data === true;
}
/** a pending order that is cancelled / deleted / never created gives its code back */
export async function release(bookingId: string) {
  await db.from("discount_codes").update({ reserved_booking: null, reserved_email: null, reserved_until: null })
    .eq("reserved_booking", bookingId).is("used_at", null);
}
export async function spend(o: { id: string; discount_id?: string | null; email?: string | null }) {
  if (!o.discount_id) return true;
  const { data, error } = await db.rpc("discount_use", { p_id: o.discount_id, p_booking: o.id, p_email: o.email || "" });
  return !error && data === true;
}

/* "Alpine A110S — 999 zł netto · …" → variant names, the same parsing as the checkout and the browser */
export const variantsOf = (txt: unknown) => String(txt ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("## "))
  .map((l) => l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł/i)?.[1]?.trim()).filter(Boolean) as string[];

/** What a product code is for, in words, and where its configurator starts (the browser goes there). */
export async function describeTarget(c: Code): Promise<{ label: string; url: string }> {
  const t = c.target;
  const k = `kod=${encodeURIComponent(c.code)}`;
  if (c.kind !== "product" || !t?.kind) return { label: "", url: "" };
  if (t.kind === "track") {
    let car = "dowolne auto";
    if (t.car_id === "own") car = "własne auto";
    else if (t.car_id) { const { data } = await db.from("cars").select("name").eq("id", t.car_id).maybeSingle(); car = data?.name || car; }
    const q = [t.car_id === "own" ? "custom=1" : t.car_id ? `car=${t.car_id}` : "", t.sessions ? `sessions=${t.sessions}` : "", k].filter(Boolean).join("&");
    return { label: `Szkolenie na torze · ${car}${t.sessions ? ` · ${t.sessions} sesji` : ""}`, url: `/rezerwacja?${q}` };
  }
  if (t.kind === "ice") {
    let pkg = "dowolny pakiet";
    if (t.package_id) { const { data } = await db.from("ice_packages").select("name_pl").eq("id", t.package_id).maybeSingle(); pkg = data?.name_pl || pkg; }
    return { label: `Ice Driving Experience — Laponia · ${pkg}`, url: `/rezerwacja-ice?${[t.package_id ? `pkg=${t.package_id}` : "", k].filter(Boolean).join("&")}` };
  }
  if (t.kind === "product") {
    const { data: p } = await db.from("products").select("slug, title_pl, packages_pl").eq("slug", t.slug ?? "").maybeSingle();
    const i = t.variant ? variantsOf(p?.packages_pl).indexOf(t.variant) : -1;
    return { label: `${p?.title_pl || t.slug}${t.variant ? ` · ${t.variant}` : ""}`, url: `/zakup?produkt=${encodeURIComponent(t.slug ?? "")}${i >= 0 ? `&wariant=${i}` : ""}&${k}` };
  }
  if (t.kind === "trip") {
    if (t.package_id) {
      const { data: pk } = await db.from("trip_packages").select("name_pl, product_slug").eq("id", t.package_id).maybeSingle();
      const { data: p } = await db.from("products").select("title_pl").eq("slug", pk?.product_slug ?? "").maybeSingle();
      return { label: `${p?.title_pl || "Wyprawa"} · ${pk?.name_pl || ""}`, url: `/zakup-wyprawa?pakiet=${t.package_id}&${k}` };
    }
    const { data: p } = await db.from("products").select("title_pl").eq("slug", t.slug ?? "").maybeSingle();
    return { label: `${p?.title_pl || t.slug} · dowolny pakiet`, url: `/produkty/${t.slug}?${k}` };
  }
  return { label: "", url: "" };
}
