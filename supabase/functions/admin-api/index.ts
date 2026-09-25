// FRA admin-api — CMS CRUD (admin token) + public checkout (Tpay) + public order status.
// Prices are ALWAYS computed here from the database; the browser only sends ids.
import { db, cfg, listOf, sendMail, shell, table, row, chip, esc, zl } from "../_shared/mail.ts";
import { tpayConfigured, tpayCreateTransaction, tpayToken, TPAY_API } from "../_shared/tpay.ts";
import { fulfillOrder, sendOrderMails, VAT_RATE, gross, round2 } from "../_shared/orders.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");
const SUPA = Deno.env.get("SUPABASE_URL")!;
const TEST_PAYMENTS = Deno.env.get("FRA_TEST_PAYMENTS") === "1";

/* ---------------- translation (Barabash AI) ---------------- */
let _aiKey: string | null = null;
async function getAiKey() {
  if (_aiKey !== null) return _aiKey;
  const env = Deno.env.get("BARABASH_AI_KEY");
  if (env) { _aiKey = env; return env; }
  _aiKey = await cfg("barabash_ai_key");
  return _aiKey;
}
async function translateBatch(texts: string[]) {
  const key = await getAiKey();
  const url = Deno.env.get("BARABASH_AI_URL") ?? "https://barabash-ai.tailcd3444.ts.net/v1/chat/completions";
  const model = Deno.env.get("BARABASH_AI_MODEL") ?? "qwen3.5:9b";
  const clean = texts.map((t) => (t ?? "").toString());
  if (!key || clean.every((t) => !t.trim())) return clean.map(() => null);
  try {
    const prompt =
      "Przetlumacz ponizsze krotkie teksty marketingowe (branza motorsport) z polskiego na angielski. " +
      "Zachowaj ton, wielkosc liter naglowkow (jesli CAPS to CAPS), tagi HTML i jednostki. " +
      "Zwroc WYLACZNIE tablice JSON stringow w tej samej kolejnosci, bez zadnych komentarzy.\n\n" + JSON.stringify(clean);
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(url, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, think: false, temperature: 0.2, stream: false, messages: [{ role: "user", content: prompt }] }),
    });
    clearTimeout(to);
    const j = await r.json();
    let txt = j?.choices?.[0]?.message?.content ?? "";
    const m = txt.match(/\[[\s\S]*\]/);
    if (m) txt = m[0];
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) return clean.map((_, i) => arr[i] ?? null);
  } catch (_) { /* translation is best-effort */ }
  return clean.map(() => null);
}
async function autoTranslate(row: Record<string, unknown>, plFields: string[]) {
  const en = await translateBatch(plFields.map((f) => String(row[f] ?? "")));
  const out = { ...row };
  plFields.forEach((f, i) => { if (en[i]) out[f.replace(/_pl$/, "_en")] = en[i]; });
  return out;
}
const PL_FIELDS: Record<string, string[]> = {
  cars: ["description_pl", "intro_pl"],
  instructors: ["label_pl", "subtitle_pl", "description_pl"],
  events: ["title_pl", "stage_pl", "location_pl", "weekday_pl", "month_pl", "description_pl"],
  programs: ["tag_pl", "title_pl", "desc_pl"],
  banners: [],
  tracks: ["country_pl", "description_pl"],
  media: ["title_pl", "tag_pl", "excerpt_pl"],
  terms: ["location_pl", "title_pl", "description_pl"],
  products: ["title_pl", "tag_pl", "excerpt_pl", "intro_pl", "theory_pl", "practice_pl", "learn_pl", "includes_pl", "places_pl",
    "packages_pl", "price_note_pl", "trip_dates_pl", "schedule_pl", "recap_pl"],
  ice_packages: ["name_pl", "sessions_pl", "desc_pl"],
  ice_windows: ["label_pl"],
  trip_packages: ["name_pl", "includes_pl", "note_pl"],
  trip_attractions: ["title_pl", "short_pl", "body_pl"],
  trip_points: ["title_pl", "note_pl"],
};
const TABLES = Object.keys(PL_FIELDS);

/* ---------------- auth ---------------- */
type Admin = { id: string; login: string; name: string | null; role: string; perms: Record<string, boolean> | null; position?: string | null };
async function auth(req: Request): Promise<Admin | null> {
  const tok = (req.headers.get("x-admin-token") ?? "").trim();
  if (!tok) return null;
  const { data } = await db.from("admin_sessions").select("admin_id, expires_at").eq("token", tok).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const { data: a } = await db.from("admins").select("id, login, name, role, perms, position").eq("id", data.admin_id).maybeSingle();
  return (a as Admin) ?? null;
}

/* ---------------- permissions ----------------
   'owner' (the moderator) can do everything; an 'admin' only what its perms jsonb allows.
   PERM_KEYS is the catalogue the panel shows as checkboxes. */
const PERM_KEYS = ["orders", "messages", "settings", "content", "products", "cars", "terms", "tracks", "instructors", "admins"];
const isOwner = (a: Admin) => a.role === "owner";
const can = (a: Admin, perm: string) => isOwner(a) || !!a.perms?.[perm];
// which permission a table's CRUD needs
const TABLE_PERM: Record<string, string> = {
  cars: "cars", instructors: "instructors", tracks: "tracks", terms: "terms",
  events: "content", programs: "content", banners: "content", media: "content",
  products: "products", ice_packages: "products", ice_windows: "products", trip_packages: "products", trip_attractions: "products", trip_points: "products",
};
// which permission a named action needs (prefix match); actions missing here are open to every admin (reads)
const ACTION_PERM: [RegExp, string][] = [
  [/^config\./, "settings"], [/^bookings\./, "orders"], [/^messages\./, "messages"], [/^content\./, "content"], [/^admins\./, "admins"],
];
const UPLOAD_PERMS = ["content", "products", "cars", "terms", "tracks", "instructors"];
function allowed(a: Admin, action: string, table: string): boolean {
  if (isOwner(a)) return true;
  if (action === "stats") return true;
  if (action === "media.upload") return UPLOAD_PERMS.some((p) => can(a, p));
  if (action === "logs.list") return false;
  const named = ACTION_PERM.find(([re]) => re.test(action));
  if (named) return can(a, named[1]);
  if (TABLE_PERM[table]) return can(a, TABLE_PERM[table]);
  return true;
}

/* ---------------- audit log ---------------- */
const MUTATING = /\.(upsert|delete|reorder|set|save|upload|markPaid|resendMail|cancel|read|create|update)$/;
async function audit(req: Request, a: Admin, action: string, target: string | null, details: unknown) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    await db.from("audit_log").insert({ admin_id: a.id, admin_login: a.login, admin_name: a.name, action, target, details: details ?? null, ip });
  } catch (_) { /* logging must never break the action */ }
}
// a short human label of a row for the log: title / name / label / login / key
const rowLabel = (r: any) => String(r?.title_pl ?? r?.name ?? r?.name_pl ?? r?.label_pl ?? r?.label ?? r?.login ?? r?.key ?? r?.slug ?? r?.id ?? "").slice(0, 120);
const ADMIN_SELECT = "id, login, name, role, perms, position, created_at";

/* ---------------- helpers ---------------- */
const num = (v: unknown) => { const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const validEmail = (s: string) => /.+@.+\..+/.test(s);
const SESSIONS = [3, 6, 9];
const PRICE_COL: Record<number, string> = { 3: "price_3", 6: "price_6", 9: "price_9" };
const PRICE_COL_PZ: Record<number, string> = { 3: "price_3_poznan", 6: "price_6_poznan", 9: "price_9_poznan" };
const CUSTOM_KEY: Record<number, string> = { 3: "flota.custom.p3", 6: "flota.custom.p6", 9: "flota.custom.p9" };
const CUSTOM_KEY_PZ: Record<number, string> = { 3: "flota.custom.p3_pozn", 6: "flota.custom.p6_pozn", 9: "flota.custom.p9_pozn" };

// only our own domains may host the "thank you" page the gateway sends the payer back to
function returnOrigin(o: unknown) {
  const s = String(o ?? "");
  if (/^https:\/\/([a-z0-9-]+\.)*fastlineracingacademy\.pl$/i.test(s)) return s;
  if (/^http:\/\/localhost(:\d+)?$/i.test(s)) return s;
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(s)) return s;
  return SITE;
}
async function eurRate() { const v = parseFloat((await cfg("eur_pln", "4.35")).replace(",", ".")); return Number.isFinite(v) && v > 0 ? v : 4.35; }
const shortDesc = (o: any) => {
  const what = o.kind === "voucher" ? `Voucher: ${o.car_name}` : (o.car_name || o.product_name || "");
  return `Fastline Racing Academy #${o.number} - ${what}${o.sessions ? ` - ${o.sessions} sesji` : ""}`.slice(0, 120);
};
const phoneOf = (s: string) => { const d = s.replace(/[^\d+]/g, ""); return /^\+?\d{9,15}$/.test(d) ? d : undefined; };

/** Insert the pending booking and open the Tpay transaction. Returns what the browser needs. */
async function startPayment(rowIn: Record<string, unknown>, p: any) {
  const row: Record<string, unknown> = { ...rowIn, status: "pending", lang: p.lang === "en" ? "en" : "pl" };
  // list prices are net — the gateway charges gross (23% VAT), converted to PLN for EUR trips
  row.vat_rate = VAT_RATE;
  row.total_gross = gross(Number(row.total));
  if (row.currency === "EUR") row.amount_pln = round2(Number(row.total_gross) * (await eurRate()));
  else row.amount_pln = Number(row.total_gross);
  const { data: o, error } = await db.from("bookings").insert(row).select("*").single();
  if (error) return json({ ok: false, error: error.message }, 500);

  if (TEST_PAYMENTS || !tpayConfigured()) {
    if (!TEST_PAYMENTS) console.error("checkout: Tpay not configured");
    if (TEST_PAYMENTS) { await fulfillOrder(o.id, o.amount_pln, "test"); return json({ ok: true, id: o.id, number: o.number, test: true, paid: true }); }
    return json({ ok: false, error: "payments not configured", id: o.id }, 500);
  }
  const back = returnOrigin(p.return_origin);
  try {
    const tr = await tpayCreateTransaction({
      amountGrosze: Math.round(Number(o.amount_pln) * 100),
      description: shortDesc(o),
      hiddenDescription: o.id,
      payerEmail: o.email as string, payerName: o.full_name as string, payerPhone: phoneOf(String(o.phone || "")),
      notificationUrl: `${SUPA}/functions/v1/tpay-notify`,
      successUrl: `${back}/platnosc?order=${o.id}`,
      errorUrl: `${back}/platnosc?order=${o.id}&error=1`,
      lang: row.lang as string,
    });
    await db.from("bookings").update({ tpay_id: tr.transactionId, tpay_title: tr.title, payment_url: tr.transactionPaymentUrl }).eq("id", o.id);
    return json({ ok: true, id: o.id, number: o.number, payment_url: tr.transactionPaymentUrl, total: o.total, total_gross: o.total_gross, vat_rate: o.vat_rate, currency: o.currency, amount_pln: o.amount_pln });
  } catch (e) {
    console.error("checkout: tpay", e);
    await db.from("bookings").update({ payment_error: String(e).slice(0, 300) }).eq("id", o.id);
    return json({ ok: false, error: "Bramka płatności nie odpowiada — spróbuj ponownie za chwilę.", id: o.id }, 502);
  }
}
function payerOf(p: any) {
  const full_name = str(p.full_name, 120), email = str(p.email, 160), phone = str(p.phone, 60);
  if (!full_name || !email || !phone) return { err: "missing data" };
  if (!validEmail(email)) return { err: "bad email" };
  return { full_name, email, phone, note: str(p.note, 1000) };
}

/* ---------------- PUBLIC: checkout flows ---------------- */
async function createBooking(p: any) {
  const sessions = parseInt(p.sessions, 10);
  if (!SESSIONS.includes(sessions)) return json({ ok: false, error: "bad sessions" }, 400);
  const payer = payerOf(p); if ("err" in payer) return json({ ok: false, error: payer.err }, 400);

  let poznan = false;
  let termLabel = str(p.term_label, 200);
  if (p.term_id) {
    const { data: term } = await db.from("terms").select("track, date, time, location_pl").eq("id", p.term_id).maybeSingle();
    if (term) { poznan = term.track === "poznan"; if (!termLabel) termLabel = `${term.location_pl || term.track} · ${term.date} · ${term.time}`; }
  } else if (p.track) poznan = String(p.track) === "poznan";

  const isCustom = !!p.is_custom;
  let total = 0, carName = str(p.car_name, 120), carId: string | null = null;
  if (isCustom) {
    const { data } = await db.from("content").select("pl").eq("key", (poznan ? CUSTOM_KEY_PZ : CUSTOM_KEY)[sessions]).maybeSingle();
    total = num(data?.pl); if (!carName) carName = "Własne auto";
  } else {
    if (!p.car_id) return json({ ok: false, error: "no car" }, 400);
    const col = (poznan ? PRICE_COL_PZ : PRICE_COL)[sessions];
    const { data: car } = await db.from("cars").select(`name, ${col}`).eq("id", p.car_id).maybeSingle();
    if (!car) return json({ ok: false, error: "car not found" }, 404);
    total = num((car as any)[col]); carName = (car as any).name; carId = p.car_id;
  }
  if (!total) return json({ ok: false, error: "no price" }, 400);
  return startPayment({ kind: "track", car_id: carId, car_name: carName, is_custom: isCustom, sessions, term_id: p.term_id ?? null, term_label: termLabel, ...payer, total, currency: "PLN" }, p);
}

async function createIceBooking(p: any) {
  const payer = payerOf(p); if ("err" in payer) return json({ ok: false, error: payer.err }, 400);
  const persons = Math.min(10, Math.max(1, parseInt(p.persons, 10) || 1));
  const { data: pkg } = await db.from("ice_packages").select("*").eq("id", p.package_id ?? "").maybeSingle();
  if (!pkg) return json({ ok: false, error: "package not found" }, 404);
  const { data: win } = await db.from("ice_windows").select("*").eq("id", p.window_id ?? "").maybeSingle();
  if (!win) return json({ ok: false, error: "window not found" }, 404);
  const days = Math.max(1, pkg.days ?? 1);
  const start = String(p.date_from ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return json({ ok: false, error: "bad date" }, 400);
  const end = new Date(start + "T00:00:00"); end.setDate(end.getDate() + days - 1);
  const endIso = end.toISOString().slice(0, 10);
  if (start < win.date_from || endIso > win.date_to) return json({ ok: false, error: "date outside window" }, 400);
  const total = (pkg.price ?? 0) * persons;
  return startPayment({
    kind: "ice", product_slug: "ice-driving-laponia", package_id: pkg.id, package_name: pkg.name_pl, days, persons,
    date_from: start, date_to: endIso, car_name: "Ice Driving Experience — Laponia",
    term_label: `${pkg.name_pl} · ${start} – ${endIso} · ${persons} os.`, ...payer, total, currency: pkg.currency ?? "EUR",
  }, p);
}

async function createProductBooking(p: any) {
  const payer = payerOf(p); if ("err" in payer) return json({ ok: false, error: payer.err }, 400);
  const { data: prod } = await db.from("products").select("slug, title_pl, price, currency, buy_direct, packages_pl").eq("slug", String(p.product_slug ?? "")).maybeSingle();
  if (!prod || !prod.buy_direct) return json({ ok: false, error: "product not for sale" }, 404);
  // variants = package lines like "Alpine A110S — 999 zł netto · …" (Race Taxi); the price comes from the chosen line
  const variants = String(prod.packages_pl ?? "").split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("## ")).map((l: string) => {
    const m = l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł/i); return m ? { name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10) } : null;
  }).filter(Boolean) as { name: string; price: number }[];
  let total = Number(prod.price) || 0, variantName = "";
  if (variants.length) {
    const v = variants.find((x) => x.name === String(p.variant ?? "")) ?? variants[0];
    total = v.price; variantName = v.name;
  }
  if (!total) return json({ ok: false, error: "product not for sale" }, 404);
  const label = variantName ? `${prod.title_pl} — ${variantName}` : prod.title_pl;
  return startPayment({
    kind: "product", product_slug: prod.slug, product_name: prod.title_pl, car_name: variantName || prod.title_pl, term_label: label, persons: 1, package_name: variantName || null,
    ...payer, total, currency: prod.currency ?? "PLN",
  }, p);
}

async function createTripBooking(p: any) {
  const payer = payerOf(p); if ("err" in payer) return json({ ok: false, error: payer.err }, 400);
  const persons = Math.min(10, Math.max(1, parseInt(p.persons, 10) || 1));
  const { data: pkg } = await db.from("trip_packages").select("*").eq("id", p.package_id ?? "").maybeSingle();
  if (!pkg || pkg.visible === false) return json({ ok: false, error: "package not found" }, 404);
  const { data: prod } = await db.from("products").select("slug, title_pl, trip_status").eq("slug", pkg.product_slug).maybeSingle();
  if (!prod) return json({ ok: false, error: "trip not found" }, 404);
  if (prod.trip_status === "past") return json({ ok: false, error: "trip already finished" }, 400);
  const total = (pkg.price ?? 0) * persons;
  return startPayment({
    kind: "trip", product_slug: prod.slug, product_name: prod.title_pl, trip_package_id: pkg.id, package_name: pkg.name_pl, persons,
    car_name: `${prod.title_pl} — ${pkg.name_pl}`, term_label: `${prod.title_pl} · ${pkg.name_pl} · ${persons} os.`,
    ...payer, total, currency: pkg.currency ?? "EUR",
  }, p);
}

// Gift voucher: a car + package (Łódź price set) or "własne auto"; the code is issued after payment.
async function createVoucherBooking(p: any) {
  const payer = payerOf(p); if ("err" in payer) return json({ ok: false, error: payer.err }, 400);
  const sessions = parseInt(p.sessions, 10);
  if (!SESSIONS.includes(sessions)) return json({ ok: false, error: "bad sessions" }, 400);
  const poznan = String(p.track) === "poznan";
  let total = 0, carName = "", carId: string | null = null;
  if (p.is_custom) {
    const { data } = await db.from("content").select("pl").eq("key", (poznan ? CUSTOM_KEY_PZ : CUSTOM_KEY)[sessions]).maybeSingle();
    total = num(data?.pl); carName = "Własne auto";
  } else {
    const col = (poznan ? PRICE_COL_PZ : PRICE_COL)[sessions];
    const { data: car } = await db.from("cars").select(`name, ${col}`).eq("id", p.car_id ?? "").maybeSingle();
    if (!car) return json({ ok: false, error: "car not found" }, 404);
    total = num((car as any)[col]); carName = (car as any).name; carId = p.car_id;
  }
  if (!total) return json({ ok: false, error: "no price" }, 400);
  return startPayment({
    kind: "voucher", car_id: carId, car_name: carName, is_custom: !!p.is_custom, sessions,
    term_label: `Voucher · ${carName} · ${sessions} sesji · ${poznan ? "Poznań" : "Łódź"}`,
    voucher_for: str(p.voucher_for, 120), voucher_message: str(p.voucher_message, 600),
    ...payer, total, currency: "PLN",
  }, p);
}

// PUBLIC: order status for the "thank you" page (only by the unguessable uuid)
async function orderStatus(p: any) {
  const id = String(p?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "not found" }, 404);
  const { data: o } = await db.from("bookings")
    .select("id, number, kind, status, total, currency, amount_pln, car_name, product_name, package_name, sessions, persons, term_label, date_from, date_to, payment_url, voucher_code, voucher_for, full_name, email, paid_at, created_at")
    .eq("id", id).maybeSingle();
  if (!o) return json({ ok: false, error: "not found" }, 404);
  return json({ ok: true, order: o });
}

/* ---------------- ADMIN extras ---------------- */
const CONFIG_KEYS = ["contact_to", "firma_to", "voucher_to", "order_to", "contact_from", "eur_pln"];

async function stats() {
  const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1);
  const [{ data: paid }, { data: pendingRows }, { data: latest }, { data: msgs }, { data: terms }] = await Promise.all([
    db.from("bookings").select("id, kind, amount_pln, total, currency, paid_at, created_at, car_name, product_name, full_name, number, status").eq("status", "paid").gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
    // pending = started at the gateway, not paid yet (count + how much is waiting)
    db.from("bookings").select("id, amount_pln").eq("status", "pending"),
    // the dashboard's "latest orders" list shows every status, not only paid ones
    db.from("bookings").select("id, kind, amount_pln, paid_at, created_at, car_name, product_name, full_name, number, status").order("created_at", { ascending: false }).limit(6),
    db.from("messages").select("id, kind, is_read, created_at").order("created_at", { ascending: false }).limit(500),
    db.from("terms").select("id, date, type, track").gte("date", new Date().toISOString().slice(0, 10)).order("date"),
  ]);
  const months: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 0; i < 12; i++) { const d = new Date(since); d.setMonth(since.getMonth() + i); months[d.toISOString().slice(0, 7)] = { revenue: 0, orders: 0 }; }
  const byKind: Record<string, { revenue: number; orders: number }> = {};
  (paid ?? []).forEach((b: any) => {
    const k = String(b.paid_at || b.created_at).slice(0, 7);
    if (months[k]) { months[k].revenue += b.amount_pln || 0; months[k].orders += 1; }
    byKind[b.kind] ||= { revenue: 0, orders: 0 }; byKind[b.kind].revenue += b.amount_pln || 0; byKind[b.kind].orders += 1;
  });
  return json({
    ok: true,
    months: Object.entries(months).map(([m, v]) => ({ month: m, ...v })),
    byKind, recent: latest ?? [],
    pending: (pendingRows ?? []).length,
    pendingSum: (pendingRows ?? []).reduce((s: number, b: any) => s + (Number(b.amount_pln) || 0), 0),
    paidCount: (paid ?? []).length,
    revenue: (paid ?? []).reduce((s: number, b: any) => s + (b.amount_pln || 0), 0),
    messages: { total: (msgs ?? []).length, unread: (msgs ?? []).filter((m: any) => !m.is_read).length, firma: (msgs ?? []).filter((m: any) => m.kind === "firma").length },
    upcomingTerms: (terms ?? []).length, nextTerm: (terms ?? [])[0] ?? null,
  });
}

async function tpayDetails(id: string) {
  const { data: o } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!o) return json({ ok: false, error: "not found" }, 404);
  if (!o.tpay_id) return json({ ok: true, order: o, tpay: null });
  try {
    const t = await tpayToken();
    const r = await fetch(`${TPAY_API}/transactions/${o.tpay_id}`, { headers: { Authorization: `Bearer ${t}`, Accept: "application/json" } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: true, order: o, tpay: null, tpayError: body?.message || `tpay ${r.status}` });
    return json({ ok: true, order: o, tpay: body });
  } catch (e) { return json({ ok: true, order: o, tpay: null, tpayError: String(e) }); }
}

/* ---------------- server ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, payload } = await req.json();

    // ---- PUBLIC ----
    if (action === "booking.create") return await createBooking(payload ?? {});
    if (action === "booking.createIce") return await createIceBooking(payload ?? {});
    if (action === "booking.createProduct") return await createProductBooking(payload ?? {});
    if (action === "booking.createTrip") return await createTripBooking(payload ?? {});
    if (action === "booking.createVoucher") return await createVoucherBooking(payload ?? {});
    if (action === "booking.status") return await orderStatus(payload ?? {});

    // ---- ADMIN ----
    const me = await auth(req);
    if (!me) return json({ ok: false, error: "unauthorized" }, 401);
    const [table, op] = String(action ?? "").split(".");
    if (!allowed(me, String(action ?? ""), table)) return json({ ok: false, error: "forbidden", perm: true }, 403);
    if (action === "me") return json({ ok: true, admin: me });

    // every mutating action leaves a trace (the log itself is read by the owner only)
    const res = await handle(req, me, String(action ?? ""), payload ?? {}, table, op);
    if (MUTATING.test(String(action ?? "")) && res.status < 400) {
      const d = describe(String(action ?? ""), payload ?? {}, table);
      await audit(req, me, String(action ?? ""), d.target, d.details);
    }
    return res;
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

/* what goes into the log for an action (never passwords / file bodies) */
function describe(action: string, p: any, table: string): { target: string | null; details: unknown } {
  if (action === "content.save") { const keys = (p.items ?? []).map((i: any) => i.key); return { target: keys.slice(0, 5).join(", "), details: { keys: keys.slice(0, 40), count: keys.length } }; }
  if (action === "media.upload") return { target: String(p.path ?? ""), details: null };
  if (action === "config.set") return { target: String(p.key ?? ""), details: { value: String(p.value ?? "").slice(0, 200) } };
  if (action.startsWith("bookings.")) return { target: String(p.number ? `#${p.number}` : p.id ?? ""), details: null };
  if (action.startsWith("messages.")) return { target: String(p.id ?? ""), details: null };
  if (action.startsWith("admins.")) return { target: String(p.login ?? p.id ?? ""), details: { role: p.role, perms: p.perms, name: p.name, position: p.position } };
  if (table) {
    if (action.endsWith(".reorder")) return { target: table, details: { ids: (p.ids ?? []).length } };
    return { target: `${table}: ${rowLabel(p)}`, details: { table, id: p.id ?? null, visible: p.visible } };
  }
  return { target: null, details: null };
}

async function handle(req: Request, me: Admin, action: string, payload: any, table: string, op: string): Promise<Response> {
  {

    if (action === "stats") return await stats();

    // ---- admins (accounts + permissions) ----
    if (action === "admins.list") {
      const { data } = await db.from("admins").select(ADMIN_SELECT).order("created_at");
      return json({ ok: true, rows: data ?? [], me: me.id, perms: PERM_KEYS });
    }
    if (action === "admins.create" || action === "admins.update") {
      const login = str(payload.login, 60).toLowerCase(), name = str(payload.name, 80), password = String(payload.password ?? ""), position = str(payload.position, 80) || null;
      const role = payload.role === "owner" ? "owner" : "admin";
      const perms: Record<string, boolean> = {};
      PERM_KEYS.forEach((k) => { if (payload.perms?.[k]) perms[k] = true; });
      // an admin may only hand out what it holds itself, and never touch owners
      if (!isOwner(me)) {
        if (role === "owner") return json({ ok: false, error: "Tylko moderator może nadać rolę moderatora" }, 403);
        for (const k of Object.keys(perms)) if (!can(me, k)) return json({ ok: false, error: `Nie możesz nadać uprawnienia „${k}”, którego sam nie masz` }, 403);
      }
      if (action === "admins.create") {
        if (!/^[a-z0-9._-]{3,}$/.test(login)) return json({ ok: false, error: "Login: min. 3 znaki, litery/cyfry/kropka/myślnik" }, 400);
        if (password.length < 8) return json({ ok: false, error: "Hasło: min. 8 znaków" }, 400);
        const { data, error } = await db.rpc("admin_create", { p_login: login, p_name: name || login, p_password: password, p_role: role, p_perms: perms, p_position: position });
        if (error) return json({ ok: false, error: /duplicate|unique/i.test(error.message) ? "Taki login już istnieje" : error.message }, 400);
        return json({ ok: true, row: data });
      }
      const id = String(payload.id ?? "");
      const { data: target } = await db.from("admins").select(ADMIN_SELECT).eq("id", id).maybeSingle();
      if (!target) return json({ ok: false, error: "not found" }, 404);
      if (!isOwner(me) && target.role === "owner") return json({ ok: false, error: "Konta moderatora nie może zmieniać administrator" }, 403);
      if (target.id === me.id && !isOwner(me) && role !== target.role) return json({ ok: false, error: "Nie możesz zmienić własnej roli" }, 403);
      // the last owner can never be demoted
      if (target.role === "owner" && role !== "owner") {
        const { count } = await db.from("admins").select("id", { count: "exact", head: true }).eq("role", "owner");
        if ((count ?? 0) <= 1) return json({ ok: false, error: "Musi zostać co najmniej jeden moderator" }, 400);
      }
      const patch: any = { name: name || target.name, role, perms, position };
      const { data, error } = await db.from("admins").update(patch).eq("id", id).select(ADMIN_SELECT).single();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (password) {
        if (password.length < 8) return json({ ok: false, error: "Hasło: min. 8 znaków" }, 400);
        const { error: pe } = await db.rpc("admin_set_password", { p_id: id, p_password: password });
        if (pe) return json({ ok: false, error: pe.message }, 500);
        if (id !== me.id) await db.from("admin_sessions").delete().eq("admin_id", id);   // new password = old sessions out
      }
      return json({ ok: true, row: data });
    }
    if (action === "admins.delete") {
      const id = String(payload.id ?? "");
      if (id === me.id) return json({ ok: false, error: "Nie możesz usunąć własnego konta" }, 400);
      const { data: target } = await db.from("admins").select(ADMIN_SELECT).eq("id", id).maybeSingle();
      if (!target) return json({ ok: false, error: "not found" }, 404);
      if (!isOwner(me) && target.role === "owner") return json({ ok: false, error: "Konta moderatora nie może usunąć administrator" }, 403);
      if (target.role === "owner") {
        const { count } = await db.from("admins").select("id", { count: "exact", head: true }).eq("role", "owner");
        if ((count ?? 0) <= 1) return json({ ok: false, error: "Musi zostać co najmniej jeden moderator" }, 400);
      }
      const { error } = await db.from("admins").delete().eq("id", id);   // sessions cascade
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }

    // ---- audit log (owner only — gated in allowed()) ----
    if (action === "logs.list") {
      let q = db.from("audit_log").select("*").order("at", { ascending: false }).limit(Math.min(500, Number(payload.limit) || 200));
      if (payload.admin_id) q = q.eq("admin_id", String(payload.admin_id));
      if (payload.before) q = q.lt("at", String(payload.before));
      if (payload.action) q = q.ilike("action", `${String(payload.action)}%`);
      const { data, error } = await q;
      if (error) return json({ ok: false, error: error.message }, 500);
      const { data: admins } = await db.from("admins").select("id, login, name, role, position");
      return json({ ok: true, rows: data ?? [], admins: admins ?? [] });
    }

    if (action === "config.get") {
      const { data } = await db.from("app_config").select("key, value").in("key", CONFIG_KEYS);
      return json({ ok: true, rows: data ?? [] });
    }
    if (action === "config.set") {
      const key = String(payload?.key ?? ""), value = String(payload?.value ?? "").slice(0, 2000);
      if (!CONFIG_KEYS.includes(key)) return json({ ok: false, error: "bad key" }, 400);
      const { error } = await db.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }

    if (action === "bookings.list") {
      const { data, error } = await db.from("bookings").select("*").order("created_at", { ascending: false }).limit(400);
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true, rows: data });
    }
    if (action === "bookings.delete") {
      const { error } = await db.from("bookings").delete().eq("id", payload?.id ?? "");
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }
    if (action === "bookings.tpay") return await tpayDetails(String(payload?.id ?? ""));
    if (action === "bookings.markPaid") {
      const r = await fulfillOrder(String(payload?.id ?? ""), undefined, "manual");
      return json({ ok: true, already: r.already, row: r.order });
    }
    if (action === "bookings.resendMail") {
      const { data: o } = await db.from("bookings").select("*").eq("id", payload?.id ?? "").maybeSingle();
      if (!o) return json({ ok: false, error: "not found" }, 404);
      if (o.status !== "paid") return json({ ok: false, error: "order not paid" }, 400);
      try { await sendOrderMails(o); await db.from("bookings").update({ mail_sent: true }).eq("id", o.id); return json({ ok: true }); }
      catch (e) { return json({ ok: false, error: String(e) }, 502); }
    }
    if (action === "bookings.cancel") {
      const { error } = await db.from("bookings").update({ status: "cancelled" }).eq("id", payload?.id ?? "");
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }

    if (action === "messages.list") {
      const { data, error } = await db.from("messages").select("*").order("created_at", { ascending: false }).limit(300);
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true, rows: data });
    }
    if (action === "messages.delete") {
      const { error } = await db.from("messages").delete().eq("id", payload?.id ?? "");
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }
    if (action === "messages.read") {
      const { error } = await db.from("messages").update({ is_read: true }).eq("id", payload?.id ?? "");
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
    }

    if (action === "media.upload") {
      const { path, dataUrl } = payload;
      const mm = String(dataUrl ?? "").match(/^data:([^;]+);base64,(.+)$/);
      if (!mm) return json({ ok: false, error: "bad dataUrl" }, 400);
      const bytes = Uint8Array.from(atob(mm[2]), (c) => c.charCodeAt(0));
      const { error } = await db.storage.from("media").upload(path, bytes, { contentType: mm[1], upsert: true });
      if (error) return json({ ok: false, error: error.message }, 500);
      const { data } = db.storage.from("media").getPublicUrl(path);
      return json({ ok: true, url: data.publicUrl });
    }

    if (action === "content.save") {
      const items = payload.items ?? [];
      const en = await translateBatch(items.map((i: any) => i.pl ?? ""));
      const rows = items.map((i: any, idx: number) => ({
        key: i.key, pl: i.pl, en: (i.kind === "text" || i.kind === "html") ? (en[idx] ?? i.pl) : null,
        kind: i.kind ?? "text", updated_at: new Date().toISOString(),
      }));
      const { error } = await db.from("content").upsert(rows, { onConflict: "key" });
      return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true, rows });
    }

    if (TABLES.includes(table)) {
      if (op === "upsert") {
        let row = { ...payload };
        const fields = (PL_FIELDS[table] ?? []).filter((f) => row[f] != null);
        if (fields.length) row = await autoTranslate(row, fields);
        let res;
        if (row.id) { const id = row.id; delete row.created_at; res = await db.from(table).update(row).eq("id", id).select().single(); }
        else { delete row.id; res = await db.from(table).insert(row).select().single(); }
        return res.error ? json({ ok: false, error: res.error.message }, 500) : json({ ok: true, row: res.data });
      }
      if (op === "delete") {
        const { error } = await db.from(table).delete().eq("id", payload.id);
        return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true });
      }
      if (op === "reorder") {
        const ids: string[] = payload.ids ?? [];
        await Promise.all(ids.map((id, i) => db.from(table).update({ sort: i + 1 }).eq("id", id)));
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: "unknown action" }, 400);
  }
}
// keep unused imports referenced for bundlers
void [listOf, sendMail, shell, table, row, chip, esc, zl];
