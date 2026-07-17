import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

let _aiKey = null;
async function getAiKey() {
  if (_aiKey !== null) return _aiKey;
  const env = Deno.env.get("BARABASH_AI_KEY");
  if (env) { _aiKey = env; return env; }
  const { data } = await db.from("app_config").select("value").eq("key", "barabash_ai_key").maybeSingle();
  _aiKey = data?.value ?? "";
  return _aiKey;
}

async function translateBatch(texts) {
  const key = await getAiKey();
  const url = Deno.env.get("BARABASH_AI_URL") ??
    "https://barabash-ai.tailcd3444.ts.net/v1/chat/completions";
  const model = Deno.env.get("BARABASH_AI_MODEL") ?? "qwen3.5:9b";
  const clean = texts.map((t) => (t ?? "").toString());
  if (!key || clean.every((t) => !t.trim())) return clean.map(() => null);
  try {
    const prompt =
      "Przetlumacz ponizsze krotkie teksty marketingowe (branza motorsport) z polskiego na angielski. " +
      "Zachowaj ton, wielkosc liter naglowkow (jesli CAPS to CAPS) i jednostki. " +
      "Zwroc WYLACZNIE tablice JSON stringow w tej samej kolejnosci, bez zadnych komentarzy.\n\n" +
      JSON.stringify(clean);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model, think: false, temperature: 0.2, stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    let txt = j?.choices?.[0]?.message?.content ?? "";
    const m = txt.match(/\[[\s\S]*\]/);
    if (m) txt = m[0];
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) return clean.map((_, i) => (arr[i] ?? null));
  } catch (_) {}
  return clean.map(() => null);
}

async function autoTranslate(row, plFields) {
  const vals = plFields.map((f) => row[f] ?? "");
  const en = await translateBatch(vals);
  const out = { ...row };
  plFields.forEach((f, i) => {
    const enField = f.replace(/_pl$/, "_en");
    if (en[i]) out[enField] = en[i];
  });
  return out;
}

const PL_FIELDS = {
  cars: ["description_pl"],
  instructors: ["label_pl", "subtitle_pl", "description_pl"],
  events: ["title_pl", "stage_pl", "location_pl", "weekday_pl", "month_pl", "description_pl"],
  programs: ["tag_pl", "title_pl", "desc_pl"],
  banners: [],
  tracks: ["country_pl", "description_pl"],
  media: ["title_pl", "tag_pl", "excerpt_pl"],
  // terms feed the calendar: name of the training + its description are translated too
  terms: ["location_pl", "title_pl", "description_pl"],
  products: ["title_pl", "tag_pl", "excerpt_pl", "intro_pl", "theory_pl", "practice_pl",
    "learn_pl", "includes_pl", "places_pl", "packages_pl", "price_note_pl",
    "trip_dates_pl", "schedule_pl", "recap_pl"],
  ice_packages: ["name_pl", "sessions_pl", "desc_pl"],
  ice_windows: ["label_pl"],
  trip_packages: ["name_pl", "includes_pl", "note_pl"],
  trip_attractions: ["title_pl", "short_pl", "body_pl"],
  trip_points: ["title_pl", "note_pl"],
};

async function auth(req) {
  // the admin session token comes in x-admin-token (Authorization is reserved for the anon JWT);
  // the old Bearer-token form is still accepted so older clients keep working
  const tok = (req.headers.get("x-admin-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "").trim();
  if (!tok) return null;
  const { data } = await db.from("admin_sessions").select("admin_id, expires_at").eq("token", tok).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.admin_id;
}

const PRICE_COL = { 1: "price_1", 3: "price_3", 5: "price_5", 6: "price_6", 9: "price_9" };
const PRICE_COL_PZ = { 1: "price_1_poznan", 3: "price_3_poznan", 5: "price_5_poznan", 6: "price_6_poznan", 9: "price_9_poznan" };
const CUSTOM_KEY = { 1: "flota.custom.p1", 3: "flota.custom.p3", 5: "flota.custom.p5", 6: "flota.custom.p6", 9: "flota.custom.p9" };
const CUSTOM_KEY_PZ = { 1: "flota.custom.p1_pozn", 3: "flota.custom.p3_pozn", 5: "flota.custom.p5_pozn", 6: "flota.custom.p6_pozn", 9: "flota.custom.p9_pozn" };
const num = (v) => { const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10); return Number.isFinite(n) ? n : 0; };

// PUBLIC: create a stub booking (no admin auth). Total computed server-side, track-aware.
async function createBooking(payload) {
  const p = payload ?? {};
  const sessions = parseInt(p.sessions, 10);
  if (![1, 3, 5, 6, 9].includes(sessions)) return json({ ok: false, error: "bad sessions" }, 400);
  const full_name = String(p.full_name ?? "").trim();
  const email = String(p.email ?? "").trim();
  const phone = String(p.phone ?? "").trim();
  if (!full_name || !email || !phone) return json({ ok: false, error: "missing data" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  // Poznań term/track → Poznań price set; every other track → base (Łódź)
  let poznan = false;
  const termLabel = String(p.term_label ?? "").slice(0, 200);
  if (p.term_id) {
    const { data: term } = await db.from("terms").select("track").eq("id", p.term_id).maybeSingle();
    if (term) poznan = term.track === "poznan";
  } else if (p.track) {
    poznan = String(p.track) === "poznan";
  }

  const isCustom = !!p.is_custom;
  let total = 0;
  let carName = String(p.car_name ?? "").trim();
  let carId = null;
  if (isCustom) {
    const keymap = poznan ? CUSTOM_KEY_PZ : CUSTOM_KEY;
    const { data } = await db.from("content").select("pl").eq("key", keymap[sessions]).maybeSingle();
    total = num(data?.pl);
    if (!carName) carName = "Własne auto";
  } else {
    if (!p.car_id) return json({ ok: false, error: "no car" }, 400);
    const col = (poznan ? PRICE_COL_PZ : PRICE_COL)[sessions];
    const { data: car } = await db.from("cars").select(`name, ${col}`).eq("id", p.car_id).maybeSingle();
    if (!car) return json({ ok: false, error: "car not found" }, 404);
    total = num(car[col]);
    carName = car.name;
    carId = p.car_id;
  }

  const row = {
    kind: "track",
    car_id: carId,
    car_name: carName,
    is_custom: isCustom,
    sessions,
    term_id: p.term_id ?? null,
    term_label: termLabel,
    full_name, email, phone,
    note: String(p.note ?? "").slice(0, 1000),
    total,
    currency: "PLN",
    status: "paid",
  };
  const { data, error } = await db.from("bookings").insert(row).select("id, total, car_name").single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, total: data.total, car_name: data.car_name });
}

// PUBLIC: Ice Driving (Laponia) booking. Package price + the available date window both come
// from the CMS tables, and the total is computed here — never trusted from the client.
async function createIceBooking(payload) {
  const p = payload ?? {};
  const full_name = String(p.full_name ?? "").trim();
  const email = String(p.email ?? "").trim();
  const phone = String(p.phone ?? "").trim();
  if (!full_name || !email || !phone) return json({ ok: false, error: "missing data" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  const persons = Math.min(10, Math.max(1, parseInt(p.persons, 10) || 1));
  const { data: pkg } = await db.from("ice_packages").select("*").eq("id", p.package_id ?? "").maybeSingle();
  if (!pkg) return json({ ok: false, error: "package not found" }, 404);
  const { data: win } = await db.from("ice_windows").select("*").eq("id", p.window_id ?? "").maybeSingle();
  if (!win) return json({ ok: false, error: "window not found" }, 404);

  // the stay must start inside the window and fit fully within it
  const days = Math.max(1, pkg.days ?? 1);
  const start = String(p.date_from ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return json({ ok: false, error: "bad date" }, 400);
  const end = new Date(start + "T00:00:00");
  end.setDate(end.getDate() + days - 1);
  const endIso = end.toISOString().slice(0, 10);
  if (start < win.date_from || endIso > win.date_to) return json({ ok: false, error: "date outside window" }, 400);

  // the customer also picks the car for the ice track (it does not change the package price)
  let carId = null, carName = "Ice Driving Experience — Laponia";
  if (p.car_id) {
    const { data: car } = await db.from("cars").select("id, name").eq("id", p.car_id).maybeSingle();
    if (car) { carId = car.id; carName = car.name; }
  }

  const total = (pkg.price ?? 0) * persons;
  const row = {
    kind: "ice",
    product_slug: "ice-driving-laponia",
    package_id: pkg.id,
    package_name: pkg.name_pl,
    days, persons,
    date_from: start,
    date_to: endIso,
    car_id: carId,
    car_name: carName,
    term_label: `${pkg.name_pl} · ${start} – ${endIso} · ${persons} os.`,
    full_name, email, phone,
    note: String(p.note ?? "").slice(0, 1000),
    total,
    currency: pkg.currency ?? "EUR",
    status: "paid",
  };
  const { data, error } = await db.from("bookings").insert(row).select("id, total, currency").single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, total: data.total, currency: data.currency, date_to: endIso });
}

// PUBLIC: buy a fixed-price product straight away (Driver2Racer) — no configurator.
// The price always comes from the product row, never from the client.
async function createProductBooking(payload) {
  const p = payload ?? {};
  const full_name = String(p.full_name ?? "").trim();
  const email = String(p.email ?? "").trim();
  const phone = String(p.phone ?? "").trim();
  if (!full_name || !email || !phone) return json({ ok: false, error: "missing data" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  const { data: prod } = await db.from("products")
    .select("slug, title_pl, price, currency, buy_direct")
    .eq("slug", String(p.product_slug ?? "")).maybeSingle();
  if (!prod || !prod.buy_direct || !prod.price) return json({ ok: false, error: "product not for sale" }, 404);

  const row = {
    kind: "product",
    product_slug: prod.slug,
    product_name: prod.title_pl,
    car_name: prod.title_pl,
    term_label: prod.title_pl,
    persons: 1,
    full_name, email, phone,
    note: String(p.note ?? "").slice(0, 1000),
    total: prod.price,
    currency: prod.currency ?? "PLN",
    status: "paid",
  };
  const { data, error } = await db.from("bookings").insert(row).select("id, total, currency").single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, total: data.total, currency: data.currency });
}

// PUBLIC: buy a trip package (Monaco…). Price + product come from `trip_packages`, and the
// trip must still be upcoming — a finished trip cannot be booked.
async function createTripBooking(payload) {
  const p = payload ?? {};
  const full_name = String(p.full_name ?? "").trim();
  const email = String(p.email ?? "").trim();
  const phone = String(p.phone ?? "").trim();
  if (!full_name || !email || !phone) return json({ ok: false, error: "missing data" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);

  const persons = Math.min(10, Math.max(1, parseInt(p.persons, 10) || 1));
  const { data: pkg } = await db.from("trip_packages").select("*").eq("id", p.package_id ?? "").maybeSingle();
  if (!pkg || pkg.visible === false) return json({ ok: false, error: "package not found" }, 404);

  const { data: prod } = await db.from("products")
    .select("slug, title_pl, trip_status").eq("slug", pkg.product_slug).maybeSingle();
  if (!prod) return json({ ok: false, error: "trip not found" }, 404);
  if (prod.trip_status === "past") return json({ ok: false, error: "trip already finished" }, 400);

  const total = (pkg.price ?? 0) * persons;
  const row = {
    kind: "trip",
    product_slug: prod.slug,
    product_name: prod.title_pl,
    trip_package_id: pkg.id,
    package_name: pkg.name_pl,
    persons,
    car_name: `${prod.title_pl} — ${pkg.name_pl}`,
    term_label: `${prod.title_pl} · ${pkg.name_pl} · ${persons} os.`,
    full_name, email, phone,
    note: String(p.note ?? "").slice(0, 1000),
    total,
    currency: pkg.currency ?? "EUR",
    status: "paid",
  };
  const { data, error } = await db.from("bookings").insert(row).select("id, total, currency").single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, total: data.total, currency: data.currency });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, payload } = await req.json();

    // ---- PUBLIC actions (no admin token) ----
    if (action === "booking.create") return await createBooking(payload);
    if (action === "booking.createIce") return await createIceBooking(payload);
    if (action === "booking.createProduct") return await createProductBooking(payload);
    if (action === "booking.createTrip") return await createTripBooking(payload);

    // ---- everything below requires an admin session ----
    const adminId = await auth(req);
    if (!adminId) return json({ ok: false, error: "unauthorized" }, 401);

    const table = action?.split(".")?.[0];
    const op = action?.split(".")?.[1];

    if (action === "bookings.list") {
      const { data, error } = await db.from("bookings").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, rows: data });
    }

    // contact-form inbox
    if (action === "messages.list") {
      const { data, error } = await db.from("messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, rows: data });
    }
    if (action === "messages.delete") {
      const { error } = await db.from("messages").delete().eq("id", payload?.id ?? "");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "messages.read") {
      const { error } = await db.from("messages").update({ is_read: true }).eq("id", payload?.id ?? "");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "bookings.delete") {
      const { error } = await db.from("bookings").delete().eq("id", payload?.id ?? "");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "media.upload") {
      const { path, dataUrl } = payload;
      const mm = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!mm) return json({ ok: false, error: "bad dataUrl" }, 400);
      const mime = mm[1], b64 = mm[2];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const { error } = await db.storage.from("media").upload(path, bytes, {
        contentType: mime, upsert: true,
      });
      if (error) return json({ ok: false, error: error.message }, 500);
      const { data } = db.storage.from("media").getPublicUrl(path);
      return json({ ok: true, url: data.publicUrl });
    }

    if (action === "content.save") {
      const items = payload.items ?? [];
      const en = await translateBatch(items.map((i) => i.pl ?? ""));
      const rows = items.map((i, idx) => ({
        key: i.key, pl: i.pl, en: (i.kind === "text" || i.kind === "html") ? (en[idx] ?? i.pl) : null,
        kind: i.kind ?? "text", updated_at: new Date().toISOString(),
      }));
      const { error } = await db.from("content").upsert(rows, { onConflict: "key" });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, rows });
    }

    if (["cars", "instructors", "events", "programs", "banners", "tracks", "media", "terms", "products",
      "ice_packages", "ice_windows", "trip_packages", "trip_attractions", "trip_points"].includes(table)) {
      if (op === "upsert") {
        let row = { ...payload };
        const fields = (PL_FIELDS[table] ?? []).filter((f) => row[f] != null);
        if (fields.length) row = await autoTranslate(row, fields);
        let res;
        if (row.id) {
          const id = row.id; delete row.created_at;
          res = await db.from(table).update(row).eq("id", id).select().single();
        } else {
          delete row.id;
          res = await db.from(table).insert(row).select().single();
        }
        if (res.error) return json({ ok: false, error: res.error.message }, 500);
        return json({ ok: true, row: res.data });
      }
      if (op === "delete") {
        const { error } = await db.from(table).delete().eq("id", payload.id);
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true });
      }
      if (op === "reorder") {
        const ids = payload.ids ?? [];
        await Promise.all(ids.map((id, i) => db.from(table).update({ sort: i + 1 }).eq("id", id)));
        return json({ ok: true });
      }
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
