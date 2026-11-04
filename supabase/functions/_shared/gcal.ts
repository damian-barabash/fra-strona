// Google Calendar mirror of the site calendar: terms (Terminy), Laponia seasons and trips (wyprawy).
// One-way: the site is the source, Google only shows it. Every change in the panel runs `gcalSync()` in the background, which rebuilds the wanted set of events from the database and
// pushes only what changed (hash per event in `gcal_events`).
//
// Secrets (one of): GCAL_OAUTH = {client_id, client_secret, refresh_token} (raw or base64) — the site acts
// as a person who can edit the calendar (no Workspace admin needed); or GCAL_SA = service-account JSON,
// optionally with GCAL_SUBJECT = a Workspace user to act as (domain-wide delegation). Calendar id: app_config `gcal_id` (or GCAL_ID).
// Event ids are derived from the source key, so two syncs running at once never create a duplicate.
import { db, cfg } from "./mail.ts";

const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");
const TZ = "Europe/Warsaw";
const API = "https://www.googleapis.com/calendar/v3";

/* ---------------- auth: service-account JWT → access token ---------------- */
type SA = { client_email: string; private_key: string; token_uri?: string };
function saKey(): SA | null {
  const raw = (Deno.env.get("GCAL_SA") ?? "").trim();
  if (!raw) return null;
  try { return JSON.parse(raw.startsWith("{") ? raw : atob(raw)); } catch (_) { return null; }
}
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; bytes.forEach((x) => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
type OAuth = { client_id: string; client_secret: string; refresh_token: string; token_uri?: string };
function oauthKey(): OAuth | null {
  const raw = (Deno.env.get("GCAL_OAUTH") ?? "").trim();
  if (!raw) return null;
  try { const o = JSON.parse(raw.startsWith("{") ? raw : atob(raw)); return o?.refresh_token ? o : null; } catch (_) { return null; }
}
let tokenCache: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const oa = oauthKey();
  if (oa) {
    const r = await fetch(oa.token_uri || "https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: oa.refresh_token, client_id: oa.client_id, client_secret: oa.client_secret }),
    });
    const t = await r.json().catch(() => ({}));
    if (!t.access_token) throw new Error(`token Google (konto): ${t.error_description || t.error || r.status} — trzeba ponownie zalogować konto Google`);
    tokenCache = { token: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 };
    return t.access_token;
  }
  const sa = saKey();
  if (!sa) throw new Error("brak sekretu GCAL_OAUTH / GCAL_SA");
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar", aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const subject = (Deno.env.get("GCAL_SUBJECT") ?? "").trim();
  if (subject) claims.sub = subject;
  const head = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head));
  const r = await fetch(String(claims.aud), {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${b64url(sig)}` }),
  });
  const t = await r.json().catch(() => ({}));
  if (!t.access_token) throw new Error(`token Google: ${t.error_description || t.error || r.status}`);
  tokenCache = { token: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000 };
  return t.access_token;
}

async function calId() { return (Deno.env.get("GCAL_ID") ?? "").trim() || (await cfg("gcal_id", "")).trim(); }
export async function gcalConfigured() { return (!!oauthKey() || !!saKey()) && !!(await calId()); }

/* ---------------- helpers ---------------- */
const esc = (s: unknown) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
async function sha1(s: string) { const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
// Google event ids: base32hex (0-9 a-v) — hex digits qualify; "fra" keeps them recognisable
const eventIdOf = async (key: string) => `fra${await sha1(key)}`;
const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const todayWaw = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const plDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const plDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-–·(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

const TRACK: Record<string, string> = { lodz: "Tor Łódź", poznan: "Tor Poznań", krzywa: "Tor Krzywa", kielce: "Tor Kielce", silesia: "Silesia Ring", modlin: "Tor Modlin" };
// Google's 11 event colours: 11 Tomato, 4 Flamingo, 6 Tangerine, 5 Banana, 2 Sage, 10 Basil, 7 Peacock, 9 Blueberry, 1 Lavender, 3 Grape, 8 Graphite
const TYPE: Record<string, { name: string; icon: string; color: string }> = {
  sport: { name: "SPORT DRIVING EXPERIENCE", icon: "🏁", color: "11" },
  indiv: { name: "SZKOLENIE INDYWIDUALNE", icon: "🎯", color: "6" },
  heels: { name: "HEELS ON THE TRACK", icon: "👠", color: "3" },
  ice: { name: "ICE DRIVING EXPERIENCE", icon: "❄️", color: "7" },
};
const LINE = "━━━━━━━━━━━━━━━━━━";

// 11:00–16:00 · 15:30-18:00 · 10.00 - 14.00 · "od 9:00"
function timesOf(s: string): { start: string; end: string } | null {
  const m = String(s || "").match(/(\d{1,2})[:.](\d{2})(?:\s*[–—-]\s*(\d{1,2})[:.](\d{2}))?/);
  if (!m) return null;
  const hh = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}:00`;
  const start = hh(m[1], m[2]);
  const end = m[3] ? hh(m[3], m[4]) : hh(String(Math.min(23, +m[1] + 4)), m[2]);
  return end > start ? { start, end } : { start, end: "23:59:00" };
}


function footer(links: [string, string][]) {
  return `${LINE}<br>${links.map(([l, u]) => `🔗 <a href="${u}">${esc(l)}</a>`).join("<br>")}<br><br>`
    + `<i>Wydarzenie synchronizowane automatycznie ze strony fastlineracingacademy.pl — zmiany wprowadzaj w panelu, nie tutaj (zostaną nadpisane).</i>`;
}

/* ---------------- the wanted set of events ---------------- */
type Wanted = { key: string; body: Record<string, unknown> };

async function buildWanted(): Promise<Wanted[]> {
  const [terms, windows, products] = await Promise.all([
    db.from("terms").select("*").eq("visible", true),
    db.from("ice_windows").select("*").eq("visible", true),
    db.from("products").select("slug, title_pl, theme, trip_status, date_from, date_to, place_pl, schedule_pl, visible, is_test").or("theme.eq.wyprawa,slug.eq.ice-driving-laponia"),
  ]);
  for (const r of [terms, windows, products]) if (r.error) throw new Error(r.error.message);
  const today = todayWaw();
  const out: Wanted[] = [];

  /* --- training days (Terminy) --- */
  for (const t of (terms.data ?? []) as any[]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date ?? ""))) continue;
    const ty = TYPE[t.type] ?? TYPE.sport;
    const name = String(t.title_pl || "").trim() || ty.name;
    const track = TRACK[t.track] || titleCase(String(t.location_pl || "").trim()) || "";
    const place = String(t.address || "").trim();
    const cap = Number(t.capacity) || 0;
    const past = t.date < today;
    const tm = timesOf(t.time);
    const about = String(t.description_pl || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const desc = [
      `<b>${ty.icon} ${esc(name.toUpperCase())}</b>`,
      `${esc(track)}${track && place ? " · " : ""}${esc(place)}`,
      LINE,
      `📅 ${esc(plDay(t.date))}`,
      `🕐 ${esc(t.time || "godziny do ustalenia")}`,
      place ? `📍 <a href="${mapsLink(place)}">${esc(place)}</a>` : "",
      cap ? `👥 Liczba miejsc: ${cap}` : "",
      past ? "✅ <i>Termin już się odbył</i>" : "",
      about ? `${LINE}<br>${esc(about)}` : "",
      footer([
        ...(past ? [] : [["Zarezerwuj ten termin", `${SITE}/rezerwacja?term=${t.id}`] as [string, string]]),
        ["Kalendarz na stronie", `${SITE}/kalendarz`],
      ]),
    ].filter(Boolean).join("<br>");
    const when = tm
      ? { start: { dateTime: `${t.date}T${tm.start}`, timeZone: TZ }, end: { dateTime: `${t.date}T${tm.end}`, timeZone: TZ } }
      : { start: { date: t.date }, end: { date: plusDays(t.date, 1) } };
    out.push({
      key: `term:${t.id}`,
      body: {
        summary: `${ty.icon} ${name.toUpperCase()}${track ? ` · ${track}` : ""}`,
        description: desc, location: place || track, colorId: ty.color, ...when,
        source: { title: "Fastline Racing Academy", url: `${SITE}/kalendarz` },
      },
    });
  }

  /* --- Laponia seasons (ice windows) --- */
  const lap = ((products.data ?? []) as any[]).find((p) => p.slug === "ice-driving-laponia");
  for (const w of (windows.data ?? []) as any[]) {
    if (!w.date_from || !w.date_to) continue;
    const sold = ((w.sold_out ?? []) as string[]).slice().sort();
    const label = String(w.label_pl || "Sezon lodowy").trim();
    const desc = [
      `<b>❄️ ${esc(String(lap?.title_pl || TYPE.ice.name).toUpperCase())}</b>`,
      esc(label),
      LINE,
      `📅 ${plDate(w.date_from)} – ${plDate(w.date_to)}`,
      `📍 <a href="${mapsLink("Kuusamo, Finlandia")}">Kuusamo, Finlandia</a>`,
      w.capacity ? `👥 Miejsc dziennie: ${w.capacity}` : "",
      sold.length ? `⛔ Dni wyprzedane: ${sold.map(plDate).join(", ")}` : "",
      footer([["Laponia na stronie", `${SITE}/produkty/ice-driving-laponia`], ["Zarezerwuj pobyt", `${SITE}/rezerwacja-ice`]]),
    ].filter(Boolean).join("<br>");
    out.push({
      key: `ice:${w.id}`,
      body: {
        summary: `❄️ LAPONIA · ${label}`,
        description: desc, location: "Kuusamo, Finlandia", colorId: TYPE.ice.color,
        start: { date: w.date_from }, end: { date: plusDays(w.date_to, 1) }, transparency: "transparent",
        source: { title: "Fastline Racing Academy", url: `${SITE}/produkty/ice-driving-laponia` },
      },
    });
  }

  /* --- trips (wyprawy): explicit dates, or the first/last date of the schedule --- */
  for (const p of ((products.data ?? []) as any[]).filter((x) => x.theme === "wyprawa" && x.visible !== false && !x.is_test)) {
    const ds = [...String(p.schedule_pl || "").matchAll(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g)]
      .map((m) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`).sort();
    const from = p.date_from || ds[0], to = p.date_to || ds[ds.length - 1] || from;
    if (!from || !to) continue;
    const schedule = String(p.schedule_pl || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const desc = [
      `<b>✈️ ${esc(String(p.title_pl || p.slug).toUpperCase())}</b>`,
      esc(p.place_pl || ""),
      LINE,
      `📅 ${plDate(from)} – ${plDate(to)}`,
      p.place_pl ? `📍 <a href="${mapsLink(p.place_pl)}">${esc(p.place_pl)}</a>` : "",
      schedule.length ? `${LINE}<br><b>HARMONOGRAM</b><ul>${schedule.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "",
      footer([["Wyprawa na stronie", `${SITE}/produkty/${p.slug}`]]),
    ].filter(Boolean).join("<br>");
    out.push({
      key: `trip:${p.slug}`,
      body: {
        summary: `✈️ ${String(p.title_pl || p.slug).toUpperCase()}${p.place_pl ? ` · ${p.place_pl}` : ""}`,
        description: desc, location: p.place_pl || "", colorId: "5",
        start: { date: from }, end: { date: plusDays(to, 1) }, transparency: "transparent",
        source: { title: "Fastline Racing Academy", url: `${SITE}/produkty/${p.slug}` },
      },
    });
  }
  return out;
}

/* ---------------- push to Google ---------------- */
async function gapi(method: string, path: string, body?: unknown) {
  const token = await accessToken();
  const r = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  return { status: r.status, data };
}

let running: Promise<unknown> | null = null, again = false;
/** Full reconcile. Safe to call often: unchanged events cost no Google call; calls overlapping in one instance are merged. */
export function gcalSync(force = false): Promise<unknown> {
  if (running) { again = true; return running; }
  running = (async () => {
    let res: unknown;
    do { again = false; res = await syncOnce(force); } while (again);
    return res;
  })().finally(() => { running = null; });
  return running;
}

async function syncOnce(force: boolean) {
  if (!(await gcalConfigured())) return { ok: false, skipped: true, error: "Synchronizacja z Google nie jest skonfigurowana" };
  const cal = encodeURIComponent(await calId());
  const stats = { created: 0, updated: 0, deleted: 0, same: 0, errors: 0 };
  let firstErr = "";
  try {
    const wanted = await buildWanted();
    const { data: known } = await db.from("gcal_events").select("key, event_id, hash");
    const byKey = new Map(((known ?? []) as any[]).map((k) => [k.key, k]));
    for (const w of wanted) {
      const id = await eventIdOf(w.key);
      const body = { ...w.body, id, status: "confirmed", extendedProperties: { private: { fra_key: w.key } }, reminders: { useDefault: true } };
      const hash = await sha1(JSON.stringify(body));
      const k = byKey.get(w.key);
      byKey.delete(w.key);
      if (!force && k?.hash === hash) { stats.same++; continue; }
      // update first (covers events deleted earlier — cancelled events keep their id and come back), insert when unknown
      let r = await gapi("PUT", `/calendars/${cal}/events/${id}`, body);
      if (r.status === 404) { r = await gapi("POST", `/calendars/${cal}/events`, body); if (r.status < 300) stats.created++; }
      else if (r.status < 300) stats.updated++;
      if (r.status >= 300) {
        stats.errors++; const msg = `${w.key}: ${r.data?.error?.message || r.status}`; firstErr ||= msg;
        await db.from("gcal_events").upsert({ key: w.key, event_id: id, hash: null, error: msg, synced_at: new Date().toISOString() });
        continue;
      }
      await db.from("gcal_events").upsert({ key: w.key, event_id: id, hash, error: null, synced_at: new Date().toISOString() });
    }
    // gone from the site (deleted / hidden) → gone from Google
    for (const k of byKey.values() as Iterable<any>) {
      const r = await gapi("DELETE", `/calendars/${cal}/events/${k.event_id}`);
      if (r.status < 300 || r.status === 404 || r.status === 410) { stats.deleted++; await db.from("gcal_events").delete().eq("key", k.key); }
      else { stats.errors++; firstErr ||= `${k.key}: ${r.data?.error?.message || r.status}`; }
    }
  } catch (e) { stats.errors++; firstErr ||= String((e as Error)?.message ?? e); }
  const status = { at: new Date().toISOString(), ok: !stats.errors, ...stats, error: firstErr || null };
  await db.from("app_config").upsert({ key: "gcal_status", value: JSON.stringify(status), updated_at: status.at }, { onConflict: "key" });
  if (firstErr) console.error("gcal sync:", firstErr);
  return status;
}

/** Fire-and-forget from a request handler: the response is not held up by Google. */
export function gcalLater() {
  const p = gcalSync().catch((e) => console.error("gcal sync", e));
  try { (globalThis as any).EdgeRuntime.waitUntil(p); } catch (_) { /* local run */ }
}
