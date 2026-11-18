// Black Friday Weeks 2026 (/black-week) — one campaign, five products, a gift with every purchase.
// The gift is never a discount: the customer pays the normal price and the team hands the gift over
// (a checklist per order in the panel). Race Taxi is the exception — the second voucher is a
// single-use "whole product" code issued automatically after payment.
import { db, cfg, listOf, sendMail, esc, table, row } from "./mail.ts";

export const BW = "black-week-2026";
const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");
const BANNER = `${SITE}/assets/bw/mail-banner.jpg`;

// same lists as src/lib/blackweek.js
export const GLOVE_COLORS = ["Czarne", "Czerwone", "Niebieskie", "Białe"];
export const GLOVE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
export const BW_TITLE: Record<string, string> = { sd: "SPORT DRIVING", d2r: "DRIVER2RACER", taxi: "RACE TAXI", heels: "HEELS ON THE TRACK", ice: "ICE DRIVING LAPONIA" };
export const BW_HEADLINE: Record<string, string> = {
  sd: "Nawet 3 sesje gratis",
  d2r: "+2 sesje w Porsche 911 + rękawice OMP",
  taxi: "2 vouchery w cenie 1",
  heels: "Koleżanka za pół ceny albo golf FIERI w prezencie",
  ice: "2 sesje Sport Driving na Torze Łódź gratis",
};
const HEELS_PKG: Record<string, string> = { basic: "BASIC", premium: "PREMIUM PORSCHE" };

const num = (v: unknown) => { const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown, max = 200) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const todayWaw = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const dmy = (d: string) => String(d).slice(0, 10).split("-").reverse().join(".");
const sessWord = (n: number) => (n === 1 ? "1 sesja" : n < 5 ? `${n} sesje` : `${n} sesji`);
const content = async (key: string) => (await db.from("content").select("pl").eq("key", key).maybeSingle()).data?.pl ?? "";

export const bwOn = async () => (await content("bw.on")) === "1";

type Gift = { id: string; label: string; auto?: boolean; done?: boolean; done_at?: string | null; done_by?: string | null };
export type BwItem = { row: Record<string, unknown>; gifts: Gift[]; options: Record<string, unknown>; title: string };

/** What the customer buys and what they get for free — everything worked out from the database. */
export async function bwItem(b: any): Promise<BwItem | { err: string }> {
  const product = String(b?.product ?? "");
  if (product === "sd") {
    const sessions = parseInt(b.sessions, 10);
    if (![3, 6, 9].includes(sessions)) return { err: "Wybierz pakiet 3, 6 lub 9 sesji." };
    let poznan = String(b.track) === "poznan", termId: string | null = null, termTxt = "";
    if (b.term_id) {
      const { data: t } = await db.from("terms").select("id, track, date, time, type, location_pl, visible").eq("id", b.term_id).maybeSingle();
      if (!t || t.visible === false || String(t.date) < todayWaw() || ["heels", "ice"].includes(t.type)) return { err: "Ten termin nie jest już dostępny — wybierz inny." };
      termId = t.id; poznan = t.track === "poznan"; termTxt = `${t.location_pl || (poznan ? "Tor Poznań" : "Tor Łódź")} · ${dmy(t.date)}${t.time ? ` · ${t.time}` : ""}`;
    }
    const col = poznan ? `price_${sessions}_poznan` : `price_${sessions}`;
    const { data: car } = await db.from("cars").select(`id, name, visible, category, ${col}`).eq("id", b.car_id ?? "").maybeSingle();
    if (!car || (car as any).visible === false || (car as any).category === "race") return { err: "Wybierz auto." };
    const total = num((car as any)[col]);
    if (!total) return { err: "Brak ceny dla tego wyboru." };
    const bonus = sessions / 3;
    const track = poznan ? "Tor Poznań" : "Tor Łódź";
    return {
      title: BW_TITLE.sd,
      row: { kind: "track", car_id: (car as any).id, car_name: (car as any).name, is_custom: false, sessions, term_id: termId,
        term_label: `Black Week · ${termTxt || `${track} · termin do ustalenia`}`, total, currency: "PLN", _track: poznan ? "poznan" : "lodz" },
      options: { car: (car as any).name, sessions, track, track_key: poznan ? "poznan" : "lodz", term: termTxt || null, bonus },
      gifts: [{ id: "sd-bonus", label: `+${sessWord(bonus)} gratis (${(car as any).name}) — dopisać do pakietu ${sessions} sesji` }],
    };
  }
  if (product === "d2r") {
    const { data: prod } = await db.from("products").select("slug, title_pl, price, currency, visible").eq("slug", "driver2racer").maybeSingle();
    if (!prod || prod.visible === false || !Number(prod.price)) return { err: "Driver2Racer nie jest teraz dostępny." };
    const color = GLOVE_COLORS.find((c) => c === b.glove_color), size = GLOVE_SIZES.find((s) => s === b.glove_size);
    if (!color || !size) return { err: "Wybierz kolor i rozmiar rękawic OMP." };
    return {
      title: BW_TITLE.d2r,
      row: { kind: "product", product_slug: prod.slug, product_name: prod.title_pl, car_name: prod.title_pl, persons: 1, package_name: null,
        term_label: `Black Week · ${prod.title_pl}`, total: Number(prod.price), currency: prod.currency ?? "PLN" },
      options: { glove_color: color, glove_size: size },
      gifts: [
        { id: "d2r-porsche", label: "+2 sesje w Porsche 911 — dopisać do programu" },
        { id: "d2r-gloves", label: `Rękawice OMP — kolor: ${color}, rozmiar: ${size}` },
      ],
    };
  }
  if (product === "taxi") {
    const { data: prod } = await db.from("products").select("slug, title_pl, price, currency, packages_pl, visible").eq("slug", "race-taxi").maybeSingle();
    if (!prod || prod.visible === false) return { err: "Race Taxi nie jest teraz dostępne." };
    const variants = String(prod.packages_pl ?? "").split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("## ")).map((l: string) => {
      const m = l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł/i); return m ? { name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10) } : null;
    }).filter(Boolean) as { name: string; price: number }[];
    const v = variants.find((x) => x.name === String(b.variant ?? "")) ?? (variants.length === 1 ? variants[0] : null);
    if (!v && variants.length) return { err: "Wybierz auto Race Taxi." };
    const total = v ? v.price : Number(prod.price) || 0;
    if (!total) return { err: "Race Taxi nie jest teraz dostępne." };
    const name = v?.name || prod.title_pl;
    return {
      title: BW_TITLE.taxi,
      row: { kind: "product", product_slug: prod.slug, product_name: prod.title_pl, car_name: name, package_name: v?.name || null, persons: 1,
        term_label: `Black Week · ${prod.title_pl} — ${name} + drugi voucher gratis`, total, currency: prod.currency ?? "PLN" },
      options: { variant: v?.name || null },
      gifts: [{ id: "taxi-voucher", label: `Drugi voucher Race Taxi (${name}) — kod wysyłany automatycznie po opłaceniu`, auto: true }],
    };
  }
  if (product === "heels") {
    const pkg = b.package === "premium" ? "premium" : b.package === "basic" ? "basic" : "";
    if (!pkg) return { err: "Wybierz pakiet Heels on the Track." };
    const price = num(await content(`bw.heels.${pkg}`));
    if (!price) return { err: "Brak ceny pakietu." };
    const gift = b.gift === "friend" ? "friend" : b.gift === "golf" ? "golf" : "";
    if (!gift) return { err: "Wybierz prezent: golf FIERI albo koleżanka za pół ceny." };
    const friend = str(b.friend_name, 80);
    if (gift === "friend" && friend.length < 2) return { err: "Wpisz imię i nazwisko koleżanki." };
    let termTxt = "", termId: string | null = null;
    if (b.term_id) {
      const { data: t } = await db.from("terms").select("id, track, date, time, type, location_pl, visible").eq("id", b.term_id).maybeSingle();
      if (!t || t.visible === false || String(t.date) < todayWaw() || t.type !== "heels") return { err: "Ten termin nie jest już dostępny — wybierz inny." };
      termId = t.id; termTxt = `${t.location_pl || (t.track === "poznan" ? "Tor Poznań" : "Tor Łódź")} · ${dmy(t.date)}${t.time ? ` · ${t.time}` : ""}`;
    }
    const persons = gift === "friend" ? 2 : 1;
    const total = gift === "friend" ? Math.round(price * 1.5) : price;
    return {
      title: BW_TITLE.heels,
      row: { kind: "product", product_slug: "heels-on-the-track", product_name: "HEELS ON THE TRACK", car_name: `Heels on the Track — ${HEELS_PKG[pkg]}`,
        package_name: `Pakiet ${HEELS_PKG[pkg]}${gift === "friend" ? " · 2 osoby (koleżanka −50%)" : ""}`, persons, term_id: termId,
        term_label: `Black Week · Heels on the Track · ${termTxt || "najbliższa edycja — termin do ustalenia"}`, total, currency: "PLN" },
      options: { package: pkg, gift, friend: gift === "friend" ? friend : null, term: termTxt || null },
      gifts: gift === "friend"
        ? [{ id: "heels-friend", label: `Koleżanka za pół ceny: ${friend} — dopisać do listy uczestniczek (pakiet ${HEELS_PKG[pkg]})` }]
        : [{ id: "heels-golf", label: "Golf FIERI w prezencie — wręczyć na szkoleniu" }],
    };
  }
  if (product === "ice") {
    const persons = Math.min(8, Math.max(1, parseInt(b.persons, 10) || 1));
    const { data: pkg } = await db.from("ice_packages").select("*").eq("id", b.package_id ?? "").maybeSingle();
    if (!pkg || pkg.visible === false) return { err: "Wybierz pakiet Laponii." };
    const { data: win } = await db.from("ice_windows").select("*").eq("id", b.window_id ?? "").maybeSingle();
    if (!win || win.visible === false) return { err: "Sezon w Laponii nie jest dostępny." };
    const days = Math.max(1, pkg.days ?? 1), start = String(b.date_from ?? "");
    // a gift voucher may stay open — the recipient picks the days in the season later
    if (!start && b.mode === "gift") {
      return {
        title: BW_TITLE.ice,
        row: { kind: "ice", product_slug: "ice-driving-laponia", package_id: pkg.id, package_name: pkg.name_pl, days, persons, date_from: null, date_to: null,
          car_name: "Ice Driving Experience — Laponia", term_label: `Black Week · ${pkg.name_pl} · voucher otwarty (${win.label_pl || "sezon"}) · ${persons} os.`,
          total: (Number(pkg.price) || 0) * persons, currency: pkg.currency ?? "EUR" },
        options: { package: pkg.name_pl, persons, date_from: null, date_to: null },
        gifts: [{ id: "ice-sd", label: `Sport Driving na Torze Łódź — 2 sesje gratis${persons > 1 ? ` × ${persons} os.` : ""} — umówić termin przed wylotem` }],
      };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { err: "Wybierz pierwszy dzień pobytu." };
    const end = new Date(start + "T00:00:00Z"); end.setUTCDate(end.getUTCDate() + days - 1);
    const endIso = end.toISOString().slice(0, 10);
    if (start < win.date_from || endIso > win.date_to) return { err: "Ten termin jest poza sezonem." };
    const sold = new Set(((win.sold_out ?? []) as string[]).map((d) => String(d).slice(0, 10)));
    for (let i = 0; i < days; i++) { const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + i); if (sold.has(d.toISOString().slice(0, 10))) return { err: "Wybrany termin jest już wyprzedany — wybierz inny dzień." }; }
    return {
      title: BW_TITLE.ice,
      row: { kind: "ice", product_slug: "ice-driving-laponia", package_id: pkg.id, package_name: pkg.name_pl, days, persons, date_from: start, date_to: endIso,
        car_name: "Ice Driving Experience — Laponia", term_label: `Black Week · ${pkg.name_pl} · ${dmy(start)} – ${dmy(endIso)} · ${persons} os.`,
        total: (Number(pkg.price) || 0) * persons, currency: pkg.currency ?? "EUR" },
      options: { package: pkg.name_pl, persons, date_from: start, date_to: endIso },
      gifts: [{ id: "ice-sd", label: `Sport Driving na Torze Łódź — 2 sesje gratis${persons > 1 ? ` × ${persons} os.` : ""} — umówić termin przed wylotem` }],
    };
  }
  return { err: "Wybierz produkt." };
}

function voucherCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join("");
  return `FRA-${pick(4)}-${pick(4)}`;
}

/** a single-use "whole product" code valid 12 months (the same mechanism as every gift voucher on the site) */
async function issueCode(target: Record<string, unknown>, batch: string, note: string) {
  const valid = new Date(); valid.setFullYear(valid.getFullYear() + 1);
  const validTo = valid.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  let code = voucherCode();
  for (let i = 0; i < 6; i++) {
    const { error } = await db.from("discount_codes").insert({
      code, kind: "product", value_type: "full", value: 0, target, active: true, valid_from: null, valid_to: validTo, batch, note: note.slice(0, 300), created_by: "black-week",
    });
    if (!error) return { code, validTo };
    if (error.code !== "23505") throw new Error(error.message);
    code = voucherCode();
  }
  throw new Error("could not issue a unique code");
}
/** what a gift voucher of this order lets the recipient book (online through the configurators, or by phone) */
function voucherTarget(o: any) {
  const d = o.promo_data || {};
  if (d.product === "sd") return { kind: "track", car_id: o.car_id, sessions: o.sessions, track: d.options?.track_key || "lodz", term_id: o.term_id || null };
  if (d.product === "ice") return { kind: "ice", package_id: o.package_id, date_from: o.date_from || null };
  if (d.product === "taxi") return { kind: "product", slug: o.product_slug || "race-taxi", variant: o.package_name || null };
  return { kind: "product", slug: o.product_slug, variant: null };   // Driver2Racer, Heels (redeemed by phone)
}

/** Paid: the gift voucher (if bought as a gift) and Race Taxi's second voucher get their codes. Idempotent. */
export async function bwAfterPaid(o: any) {
  const d = { ...(o.promo_data || {}) };
  const now = new Date().toISOString();
  const batch = o.is_test ? "voucher-test" : `${BW}`;
  const tag = `${o.is_test ? "[TEST] " : ""}Black Week #${o.number} (${o.full_name})`;
  let changed = false;
  if (d.voucher && !d.voucher.code) {
    const r = await issueCode(voucherTarget(o), batch, `${tag}: voucher prezentowy dla ${d.voucher.for}`);
    d.voucher = { ...d.voucher, code: r.code, valid_to: r.validTo };
    d.gifts = [...(d.gifts || []).filter((g: Gift) => g.id !== "voucher"), { id: "voucher", label: `Voucher prezentowy dla ${d.voucher.for} — kod ${r.code} wysłany klientowi`, auto: true, done: true, done_at: now, done_by: "automat" }];
    changed = true;
  }
  if (d.product === "taxi" && !d.taxi_code) {
    const r = await issueCode({ kind: "product", slug: o.product_slug || "race-taxi", variant: o.package_name || null }, o.is_test ? "voucher-test" : `${BW}-taxi`, `${tag}: drugi voucher Race Taxi`);
    d.taxi_code = r.code; d.taxi_valid_to = r.validTo;
    d.gifts = (d.gifts || []).map((g: Gift) => (g.id === "taxi-voucher" ? { ...g, label: `${g.label.replace(/ — kod.*$/, "")} — kod ${r.code} wysłany klientowi`, done: true, done_at: now, done_by: "automat" } : g));
    changed = true;
  }
  if (!changed) return o;
  const { data } = await db.from("bookings").update({ promo_data: d }).eq("id", o.id).select("*").single();
  return data ?? { ...o, promo_data: d };
}

/* ---------------- e-mails ---------------- */
const SILVER = "#c9ccd1";
function darkShell(title: string, body: string, preheader = "") {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark light"><title>${esc(title)}</title></head>
<body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000"><tr><td align="center" style="padding:24px 10px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#0b0b0c;border:1px solid #26282c">
  <tr><td style="padding:0"><img src="${BANNER}" alt="Black Friday Weeks — Fastline Racing Academy" width="620" style="display:block;width:100%;max-width:620px;height:auto;border:0"></td></tr>
  <tr><td style="padding:6px 30px 0"><div style="height:2px;background:linear-gradient(90deg,#55595f,#f2f3f5,#55595f)"></div></td></tr>
  <tr><td style="padding:22px 30px 8px"><div style="font-size:26px;font-weight:800;line-height:1.15;color:#f2f3f5;text-transform:uppercase">${esc(title)}</div></td></tr>
  <tr><td style="padding:8px 30px 26px;font-size:15px;line-height:1.65;color:#d7d9dc">${body}</td></tr>
  <tr><td style="background:#050506;padding:18px 30px;font-size:11.5px;line-height:1.6;color:#7c8188;border-top:1px solid #1f2125">
    Fastline Racing Academy · FASTLINE EVENTS sp. z o.o. · ul. Wita Stwosza 48, 02-661 Warszawa<br>
    <a href="${SITE}" style="color:${SILVER};text-decoration:none">fastlineracingacademy.pl</a> · racingacademy@fastline.pl · +48 603 102 665
  </td></tr>
</table></td></tr></table></body></html>`;
}
const giftList = (o: any) => {
  const gifts: Gift[] = o.promo_data?.gifts || [];
  return `<div style="margin:18px 0;padding:18px 20px;background:#141518;border:1px solid #2c2f34;border-left:4px solid #e9eaec">
    <div style="color:${SILVER};font-size:11px;font-weight:bold;letter-spacing:1px">TWÓJ PREZENT BLACK WEEK</div>
    <div style="font-size:18px;font-weight:800;color:#fff;margin:6px 0 10px">${esc(BW_HEADLINE[o.promo_data?.product] || "")}</div>
    <ul style="margin:0;padding-left:18px;color:#d7d9dc;font-size:14px;line-height:1.7">${gifts.map((g) => `<li>${esc(g.label.replace(/ — (dopisać|wręczyć|umówić).*$/, "").replace(/ — kod.*$/, ""))}</li>`).join("")}</ul>
  </div>`;
};
const taxiBox = (o: any) => !o.promo_data?.taxi_code ? "" : `<div style="margin:18px 0;padding:22px;background:#f2f3f5;color:#0b0b0c;text-align:center">
    <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:#55595f">DRUGI VOUCHER RACE TAXI — DO PODAROWANIA</div>
    <div style="font-size:32px;font-weight:800;letter-spacing:4px;margin-top:8px">${esc(o.promo_data.taxi_code)}</div>
    <div style="font-size:12px;margin-top:8px;color:#55595f">ważny do ${dmy(o.promo_data.taxi_valid_to || "")} · ${esc(o.package_name || "Race Taxi")}</div>
    <div style="font-size:13px;margin-top:10px">Osoba obdarowana wpisuje kod w polu „Mam kod” na stronie Race Taxi — zamówienie za 0 zł.</div>
  </div>`;
const PLACEHOLDER = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/media/swieta/voucher-placeholder.jpg`;
const voucherBox = (o: any) => !o.promo_data?.voucher?.code ? "" : `<div style="margin:18px 0;padding:0 0 24px;background:#0b0b0c;border:1px solid #c9ccd1;text-align:center">
    <img src="${PLACEHOLDER}" alt="Voucher prezentowy Fastline Racing Academy" width="620" style="display:block;width:100%;max-width:620px;height:auto;border:0;margin-bottom:20px">
    <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${SILVER}">VOUCHER PREZENTOWY</div>
    <div style="font-size:22px;font-weight:800;color:#fff;margin-top:8px">DLA ${esc(String(o.promo_data.voucher.for).toUpperCase())}</div>
    <div style="font-size:13px;color:${SILVER};margin-top:4px">${esc(o.promo_data.title || "")}${o.package_name ? ` · ${esc(o.package_name)}` : o.sessions ? ` · ${o.sessions} sesji` : ""}</div>
    <div style="display:inline-block;margin-top:14px;padding:12px 18px;background:#f2f3f5;color:#0b0b0c;font-size:28px;font-weight:800;letter-spacing:4px">${esc(o.promo_data.voucher.code)}</div>
    <div style="font-size:12px;margin-top:10px;color:${SILVER}">ważny do ${dmy(o.promo_data.voucher.valid_to || "")}</div>
    <div style="font-size:13px;margin-top:12px;color:#d7d9dc;line-height:1.6">Osoba obdarowana wpisuje kod w polu „Mam kod” w konfiguratorze na stronie albo dzwoni do nas i podaje kod — rezerwacja za 0 zł.</div>
    ${o.delivery === "inpost" ? `<div style="margin:16px 20px 0;padding:12px 14px;border:1px dashed #6b7077;font-size:13px;color:#fff;line-height:1.6">📦 Drukowany voucher w eleganckiej kopercie wyślemy do Paczkomatu InPost <b>${esc(o.delivery_data?.locker)}</b>${o.delivery_data?.address ? ` (${esc(o.delivery_data.address)})` : ""}. Dostaniesz SMS od InPost, gdy będzie gotowy do odbioru.</div>` : ""}
    ${silverBtn(`${SITE}/rezerwacja?kod=${encodeURIComponent(o.promo_data.voucher.code)}`, "Wykorzystaj voucher online")}
  </div>`;
const silverBtn = (href: string, label: string) =>
  `<div style="margin:22px 0 6px"><a href="${href}" style="display:inline-block;background:#e9eaec;background-image:linear-gradient(180deg,#ffffff,#b9bcc1);color:#0b0b0c;text-decoration:none;font-weight:bold;letter-spacing:1px;font-size:13px;padding:14px 24px;text-transform:uppercase">${esc(label)} ›</a></div>`;
const whiteCard = (html: string) => `<div style="background:#fff;color:#14161a;padding:6px 18px 4px;margin:14px 0">${html}</div>`;

/** customer + team (order_to) + Mariusz (bw_to). summaryRows / invoiceBox come from orders.ts. */
export async function sendBwMails(o: any, h: { summaryRows: (o: any) => string; invoiceBox: (inv: any, staff: boolean) => string; isTest: boolean }) {
  const T = o.is_test ? "[TEST] " : "";
  const first = esc((o.full_name || "").split(" ")[0]);
  const title = o.promo_data?.title || BW_TITLE[o.promo_data?.product] || "";
  let body = `<p>Cześć ${first}!</p>
    <p>Dziękujemy — zamówienie <b>#${o.number}</b> (${esc(title)}) jest opłacone. Prezent z Black Friday Weeks jest Twój, a my odezwiemy się, żeby dopiąć szczegóły.</p>
    ${voucherBox(o)}${giftList(o)}${taxiBox(o)}
    ${whiteCard(h.summaryRows(o))}${h.invoiceBox(o.invoice, false)}
    <p style="font-size:13px;color:#9ea3a9">Pytania? Łukasz: <a href="tel:+48603102665" style="color:#fff">+48 603 102 665</a> · <a href="mailto:racingacademy@fastline.pl" style="color:#fff">racingacademy@fastline.pl</a></p>
    ${silverBtn(`${SITE}/kalendarz`, "Kalendarz szkoleń")}`;
  const vFor = o.promo_data?.voucher?.for;
  const c = await sendMail(o.email, `${T}Black Friday Weeks — ${vFor ? `voucher dla ${vFor} gotowy` : `zamówienie #${o.number} opłacone, prezent czeka`}`, darkShell(vFor ? "Voucher gotowy" : "Zamówienie opłacone", body, `${title} · ${BW_HEADLINE[o.promo_data?.product] || ""}`), undefined,
    o.promo_data?.voucher?.code ? [{ filename: `Voucher_FRA_${o.promo_data.voucher.code}.jpg`, path: PLACEHOLDER }] : undefined);
  if (!c.ok) throw new Error(c.error);

  // the TEST path tells only the person who filled the form (also the "Mariusz" e-mail, so it can be checked)
  const people = table([
    row("Klient", `<b>${esc(o.full_name)}</b>`),
    row("E-mail", `<a href="mailto:${esc(o.email)}" style="color:#e30613">${esc(o.email)}</a>`),
    row("Telefon", `<a href="tel:${esc(o.phone)}" style="color:#e30613">${esc(o.phone)}</a>`),
    row("Uwagi", esc(o.note || "—")),
    row("Opłacono", o.paid_at ? new Date(o.paid_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }) : "—"),
  ].join(""));
  const todo = (o.promo_data?.gifts || []).map((g: Gift) => `<tr><td style="padding:9px 0;border-bottom:1px solid #2c2f34;width:26px;vertical-align:top;color:${g.done ? "#7fd99a" : SILVER}">${g.done ? "✓" : "☐"}</td><td style="padding:9px 0;border-bottom:1px solid #2c2f34;color:#fff">${esc(g.label)}</td></tr>`).join("");
  const mBody = `<p style="margin:0 0 6px"><span style="display:inline-block;background:#f2f3f5;color:#0b0b0c;font-size:11px;font-weight:bold;padding:5px 9px">NOWE ZAMÓWIENIE Z PROMOCJI</span></p>
    <p><b>${esc(o.full_name)}</b> skorzystał(a) z Black Friday Weeks — <b>${esc(title)}</b>${o.promo_data?.voucher ? ` jako <b>voucher prezentowy dla ${esc(o.promo_data.voucher.for)}</b>` : ""}.</p>
    <div style="margin:16px 0;padding:16px 20px;background:#141518;border:1px solid #2c2f34;border-left:4px solid #e9eaec">
      <div style="color:${SILVER};font-size:11px;font-weight:bold;letter-spacing:1px">CO TRZEBA DAĆ KLIENTOWI</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:6px">${todo}</table>
    </div>
    ${whiteCard(people + h.summaryRows(o))}${h.invoiceBox(o.invoice, true)}
    ${silverBtn(`${SITE}/admin`, "Lista Black Week w panelu")}`;
  const to = h.isTest ? [o.email] : listOf(await cfg("bw_to", "mariusz.miekos@greywolfgroup.pl"));
  if (to.length) await sendMail(to, `${T}🖤 Black Week #${o.number}: ${o.full_name} — ${title}${o.delivery === "inpost" ? " — DO WYSŁANIA (InPost)" : ""}`, darkShell(`Black Week · #${o.number}`, mBody, `${o.full_name} · ${title}`), o.email);
}
