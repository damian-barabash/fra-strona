/* Post-build SEO step (runs after `vite build`, see package.json):
 *   1. sitemap.xml   — every public route + product/car pages from Supabase
 *   2. llms.txt      — a plain-text guide to the site for chat assistants (llmstxt.org)
 *   3. prerender     — a static HTML snapshot of every public route (dist/<route>.html) so that
 *                      crawlers that do not run JavaScript (most AI bots, link previews) still get
 *                      the full page: text, headings, per-page meta and JSON-LD. React boots on top.
 *   4. llms-full.txt — the readable text of every prerendered page in one file
 * Anything that fails (no Supabase, no Chromium) degrades to the plain SPA build — never breaks CI. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SITE = "https://fastlineracingacademy.pl";
const TODAY = new Date().toISOString().slice(0, 10);

const STATIC = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/oferta", priority: 0.9, freq: "weekly" },
  { path: "/rezerwacja", priority: 0.9, freq: "weekly" },
  { path: "/flota", priority: 0.8, freq: "monthly" },
  { path: "/cennik", priority: 0.8, freq: "monthly" },
  { path: "/kalendarz", priority: 0.8, freq: "daily" },
  { path: "/dla-firm", priority: 0.8, freq: "monthly" },
  { path: "/voucher", priority: 0.7, freq: "monthly" },
  { path: "/mariusz-miekos-racing", priority: 0.7, freq: "monthly" },
  { path: "/o-szkole", priority: 0.6, freq: "monthly" },
  { path: "/media-o-nas", priority: 0.5, freq: "monthly" },
  { path: "/kontakt", priority: 0.6, freq: "yearly" },
  { path: "/rezerwacja-ice", priority: 0.6, freq: "monthly" },
  { path: "/polityka-prywatnosci", priority: 0.2, freq: "yearly" },
  { path: "/regulamin-platnosci", priority: 0.2, freq: "yearly" },
];

async function sb(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  return r.json();
}

let products = [], cars = [], terms = [];
try {
  [products, cars, terms] = await Promise.all([
    sb("products", "select=slug,title_pl,tag_pl,excerpt_pl,external_url,theme,price,currency,date_from,date_to,place_pl&visible=eq.true&order=sort"),
    sb("cars", "select=slug,name,category,engine,power,price_3,price_6,price_9,price_3_poznan,price_6_poznan,price_9_poznan,description_pl&visible=eq.true&order=sort"),
    sb("terms", `select=date,time,title_pl,location_pl,address&visible=eq.true&date=gte.${TODAY}&order=date`),
  ]);
  console.log(`[seo] supabase: ${products.length} products, ${cars.length} cars, ${terms.length} terms`);
} catch (e) {
  console.warn(`[seo] supabase unavailable (${e.message}) — static routes only`);
}

const routes = [
  ...STATIC,
  ...products.filter((p) => !p.external_url).map((p) => ({ path: `/produkty/${p.slug}`, priority: 0.8, freq: "monthly" })),
  ...cars.map((c) => ({ path: `/flota/${c.slug}`, priority: 0.7, freq: "monthly" })),
];

/* ---------- 1. sitemap ---------- */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url><loc>${SITE}${r.path === "/" ? "/" : r.path}</loc><lastmod>${TODAY}</lastmod><changefreq>${r.freq}</changefreq><priority>${r.priority}</priority></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(DIST, "sitemap.xml"), sitemap);

/* ---------- 2. llms.txt ---------- */
const zl = (n) => (n ? `${Number(n).toLocaleString("pl-PL")} zł netto` : "—");
const sport = cars.filter((c) => c.category !== "race");
const race = cars.filter((c) => c.category === "race");
const llms = `# Fastline Racing Academy

> Szkoła jazdy sportowej i wyścigowej prowadzona przez dziewięciokrotnego Wyścigowego Mistrza Polski Mariusza Miękosia. Szkolenia indywidualne 1:1 z instruktorem (czynnym zawodnikiem) na torach Łódź, Poznań i Modlin, Ice Driving Experience na zamarzniętych jeziorach Laponii (Kuusamo, Finlandia), wyprawy supersamochodami (Monaco, Andaluzja), vouchery prezentowe oraz eventy firmowe na torze. Strona: ${SITE}

Język strony: polski (wersja angielska przełączana na stronie). Operator: Fastline Events Sp. z o.o., ul. Wita Stwosza 48, Warszawa.
Kontakt: +48 603 102 665 (Łukasz Kaźmierczak, szef instruktorów — szkolenia indywidualne i vouchery), racingacademy@fastline.pl, WhatsApp +48 732 098 423. Social: facebook.com/fastlineracingacademy, instagram.com/fastline_racing_academy.

## Jak to działa
- Szkolenie na torze kupuje się w konfiguratorze (${SITE}/rezerwacja): wybór auta → termin → pakiet 3, 6 lub 9 sesji → płatność online (Tpay). Każda sesja to jazda 1:1 z instruktorem; pakiet zawiera wykład z teorii jazdy sportowej.
- Tory: Tor Łódź (Kiełmina 78), Tor Poznań (Wyścigowa 3, Przeźmierowo), Tor Modlin. Ceny w Poznaniu są wyższe niż w Łodzi.
- Wszystkie ceny na stronie są cenami netto (bez VAT).
- Voucher prezentowy (${SITE}/voucher): auto + pakiet + dedykacja, kod vouchera przychodzi e-mailem po opłaceniu.
- Eventy firmowe (${SITE}/dla-firm): integracje, dni B2B i szkolenia dla firm na torach w Polsce i Europie, wycena indywidualna.

## Oferta (programy)
${products.map((p) => `- [${p.title_pl}](${p.external_url || `${SITE}/produkty/${p.slug}`})${p.tag_pl ? ` — ${p.tag_pl}` : ""}${p.excerpt_pl ? `: ${p.excerpt_pl}` : ""}${p.date_from ? ` Termin: ${p.date_from}${p.date_to ? ` – ${p.date_to}` : ""}${p.place_pl ? `, ${p.place_pl}` : ""}.` : ""}${p.price ? ` Cena: ${Number(p.price).toLocaleString("pl-PL")} ${p.currency || "PLN"}.` : ""}`).join("\n")}

## Flota — auta sportowe do szkoleń (cena za pakiet 3 / 6 / 9 sesji, Łódź; Poznań w nawiasie)
${sport.map((c) => `- [${c.name}](${SITE}/flota/${c.slug}) — ${c.engine || ""}${c.power ? `, ${c.power} KM` : ""}: ${zl(c.price_3)} / ${zl(c.price_6)} / ${zl(c.price_9)}${c.price_3_poznan ? ` (Poznań: ${zl(c.price_3_poznan)} / ${zl(c.price_6_poznan)} / ${zl(c.price_9_poznan)})` : ""}`).join("\n")}
- Własne auto: 1 450 / 2 350 / 3 350 zł netto

## Samochody wyścigowe (Fastline Racing — testy i szkolenie wyścigowe, wycena indywidualna)
${race.map((c) => `- [${c.name}](${SITE}/flota/${c.slug})`).join("\n")}

## Najbliższe terminy
${terms.length ? terms.slice(0, 12).map((x) => `- ${x.date}${x.time ? ` ${x.time}` : ""} — ${x.title_pl || "Sport Driving Experience"}, ${x.location_pl}${x.address ? ` (${x.address})` : ""}`).join("\n") : `- aktualny kalendarz: ${SITE}/kalendarz`}

## Strony
- [Strona główna](${SITE}/)
- [Oferta](${SITE}/oferta)
- [Kup szkolenie — konfigurator](${SITE}/rezerwacja)
- [Rezerwacja Ice Driving Laponia](${SITE}/rezerwacja-ice)
- [Flota](${SITE}/flota)
- [Cennik](${SITE}/cennik)
- [Kalendarz](${SITE}/kalendarz)
- [Dla firm — eventy na torze](${SITE}/dla-firm)
- [Voucher prezentowy](${SITE}/voucher)
- [Mariusz Miękoś — założyciel](${SITE}/mariusz-miekos-racing)
- [O szkole](${SITE}/o-szkole)
- [Media o nas](${SITE}/media-o-nas)
- [Kontakt](${SITE}/kontakt)
- [Polityka prywatności](${SITE}/polityka-prywatnosci)
- [Regulamin płatności](${SITE}/regulamin-platnosci)

## Optional
- [Pełna treść wszystkich stron w jednym pliku](${SITE}/llms-full.txt)
- [Sitemap](${SITE}/sitemap.xml)
`;
writeFileSync(join(DIST, "llms.txt"), llms);
console.log(`[seo] sitemap.xml (${routes.length} urls) + llms.txt written`);

/* ---------- 3. prerender ---------- */
const pristine = readFileSync(join(DIST, "index.html"), "utf8");
writeFileSync(join(DIST, "404.html"), pristine); // SPA fallback for everything we did not snapshot

let chromium;
try { ({ chromium } = await import("playwright")); } catch { try { ({ chromium } = await import("@playwright/test")); } catch { chromium = null; } }
if (!chromium || process.env.SEO_PRERENDER === "0") {
  console.warn("[seo] prerender skipped (no playwright / SEO_PRERENDER=0)");
  process.exit(0);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".webm": "video/webm", ".json": "application/json", ".txt": "text/plain", ".xml": "application/xml" };
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = join(DIST, url);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
  res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.warn(`[seo] chromium unavailable (${e.message}) — prerender skipped`);
  server.close();
  process.exit(0);
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pl-PL" });
await ctx.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); localStorage.setItem("fra_lang", "pl"); } catch {} });
// keep media out of the snapshot run — faster and no autoplay video buffering
await ctx.route(/\.(mp4|webm)(\?|$)/, (r) => r.abort());

let full = `# Fastline Racing Academy — pełna treść strony\n\nWygenerowano ${TODAY}. Krótszy przewodnik: ${SITE}/llms.txt\n`;
let ok = 0;
for (const r of routes) {
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}${r.path}`, { waitUntil: "networkidle", timeout: 45000 });
    // wait for the CMS data to land (the store renders defaults first, then Supabase content)
    await page.waitForFunction(() => document.querySelector("#root main") && document.querySelector("#root main").innerText.trim().length > 200, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const { html, text, title } = await page.evaluate(() => {
      document.querySelectorAll(".reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale").forEach((el) => el.classList.add("in"));
      document.querySelectorAll(".cookie, .cookiebar, [class*='cookie']").forEach((el) => el.remove());
      const main = document.querySelector("#root main");
      const text = main ? main.innerText.replace(/\n{3,}/g, "\n\n").trim() : "";
      return { html: `<!doctype html>\n${document.documentElement.outerHTML}`, text, title: document.title };
    });
    const out = r.path === "/" ? join(DIST, "index.html") : join(DIST, `${r.path.slice(1)}.html`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    full += `\n\n---\n\n# ${title}\nURL: ${SITE}${r.path === "/" ? "/" : r.path}\n\n${text}\n`;
    ok++;
  } catch (e) {
    console.warn(`[seo] prerender failed for ${r.path}: ${e.message}`);
  } finally {
    await page.close();
  }
}
writeFileSync(join(DIST, "llms-full.txt"), full);
await browser.close();
server.close();
console.log(`[seo] prerendered ${ok}/${routes.length} routes + llms-full.txt`);
