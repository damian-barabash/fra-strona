import { test, expect } from "@playwright/test";

/* Black Friday Weeks: the pop-up (once per visit → badge in the bottom-left corner), the /black-week
   configurator and the panel tab. The switch (content bw.on) is flipped in the site_data answer and
   admin-api is mocked — the database and Tpay are never touched. */
const SHOTS = process.env.BW_SHOTS || "";

async function bw(page, { on = true } = {}) {
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); localStorage.setItem("fra_popup_force", "1"); sessionStorage.setItem("fra_pre", "1"); } catch {} });
  await page.route("**/rest/v1/rpc/site_data*", async (route) => {
    const r = await route.fetch().catch(() => null);   // the test may already be over
    if (!r) return;
    const d = await r.json();
    d.content = (d.content || []).filter((c) => c.key !== "bw.on").concat({ key: "bw.on", pl: on ? "1" : "0", en: null, kind: "url" });
    d.popups = [];
    await route.fulfill({ response: r, json: d });
  });
  const sent = [];
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "booking.createBw") { sent.push(body.payload); return route.fulfill({ json: { ok: true, id: "00000000-0000-4000-8000-00000000bw01", payment_url: "/platnosc?order=00000000-0000-4000-8000-00000000bw01" } }); }
    if (body.action === "booking.status") return route.fulfill({ json: { ok: true, order: { id: body.payload.id, number: 77, kind: "product", status: "paid", total: 999, total_gross: 1228.77, currency: "PLN", amount_pln: 1228.77, car_name: "Alpine A110S", product_name: "RACE TAXI", term_label: "Black Week · Race Taxi", full_name: "Jan Test", email: "jan@test.pl", is_test: true, promo: "black-week-2026",
      promo_data: { product: "taxi", title: "RACE TAXI", gifts: [{ id: "taxi-voucher", label: "Drugi voucher Race Taxi (Alpine A110S) — kod FRA-TEST-CODE wysłany klientowi", done: true }], taxi_code: "FRA-TEST-CODE", taxi_valid_to: "2027-11-18" } } } });
    return route.fulfill({ json: { ok: true } });
  });
  return sent;
}
const watch = (page) => { const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text()) && errs.push(m.text())); return errs; };
const shot = (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize().width}.png` });

test("pop-up: opens on a new visit, closes into the corner badge, the badge stays for the visit and opens the configurator", async ({ page }) => {
  const errs = watch(page);
  await bw(page);
  await page.goto("/");
  const pop = page.locator(".bwp");
  await expect(pop).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".bwp__cta")).toHaveText(/SPRAWDŹ OFERTĘ/);
  await page.waitForTimeout(1300);
  await shot(page, "popup");
  await page.locator(".bwp__x").click();
  await expect(pop).toHaveCount(0, { timeout: 3000 });
  const pill = page.locator(".bwp-pill");
  await expect(pill).toBeVisible();
  const box = await pill.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeLessThan(30);
  expect(box.y + box.height).toBeGreaterThan(vp.height - 40);
  await shot(page, "pill");
  // same visit: no pop-up again, the badge is there
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(page.locator(".bwp")).toHaveCount(0);
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page).toHaveURL(/\/black-week$/);
  await expect(page.locator(".bwc-prod")).toHaveCount(5);
  await expect(page.locator(".bwp-pill")).toHaveCount(0);   // not on the campaign page itself
  expect(errs).toEqual([]);
});

test("pop-up: CTA opens the configurator; nothing when the campaign is off", async ({ page, browser }) => {
  await bw(page);
  await page.goto("/flota");
  await page.locator(".bwp__cta").click();
  await expect(page).toHaveURL(/\/black-week$/);
  await page.waitForTimeout(900);
  await shot(page, "products");

  const ctx = await browser.newContext({ viewport: page.viewportSize() });
  const p2 = await ctx.newPage();
  await bw(p2, { on: false });
  await p2.goto("/");
  await p2.waitForTimeout(2500);
  await expect(p2.locator(".bwp, .bwp-pill")).toHaveCount(0);
  await p2.goto("/black-week");
  await expect(p2.locator(".bwc-closed")).toBeVisible();
  await ctx.close();
});

const self = async (page) => { await page.locator(".bwc-mode").first().click(); await page.locator(".bwc-foot__next").click(); };
const fillData = async (page) => {
  await page.locator(".bwc-form .bwc-field input").nth(0).fill("Jan Test");
  await page.locator(".bwc-form .bwc-field input").nth(1).fill("600 100 200");
  await page.locator(".bwc-form .bwc-field input").nth(2).fill("jan@test.pl");
};

test("landing: hero with countdown, benefits, offers, holiday vouchers, how it works, FAQ", async ({ page }) => {
  const errs = watch(page);
  await bw(page);
  await page.addInitScript(() => { try { sessionStorage.setItem("fra_bw", "min"); } catch {} });
  await page.goto("/black-week");
  await expect(page.locator(".bwc-badge")).toHaveText(/Tylko do 30 listopada/i);
  await expect(page.locator(".bwc-count2 b")).toHaveCount(3);
  await expect(page.locator(".bwc-perk")).toHaveCount(3);
  await expect(page.locator(".bwc-prod")).toHaveCount(5);
  await expect(page.locator(".bwc-faq details")).toHaveCount(6);
  await expect(page.locator(".bwc-how li")).toHaveCount(3);
  await page.waitForTimeout(1200);
  await shot(page, "lp-top");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lp-full-${page.viewportSize().width}.png`, fullPage: true });
  // "Kup voucher na prezent" → the configurator with the gift form chosen
  await page.locator(".bwc-ghost").click();
  await page.locator(".bwc-tile").first().click();
  await expect(page.locator(".bwc-mode").nth(1)).toHaveClass(/on/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  expect(errs).toEqual([]);
});

test("configurator: Race Taxi from a product link → 2 vouchers → cart → Tpay", async ({ page }) => {
  const errs = watch(page);
  const sent = await bw(page);
  await page.goto("/black-week?produkt=race-taxi");
  await expect(page.locator(".bwc-t")).toHaveText("DLA KOGO?");
  await self(page);
  await page.locator(".bwc-opt").first().click();
  await expect(page.locator(".bwc-side__gift")).toContainText("Drugi voucher Race Taxi");
  await shot(page, "taxi-opts");
  await expect(page.locator(".bwc-foot__next")).toContainText("DODAJ DO KOSZYKA");
  await page.locator(".bwc-foot__next").click();
  await expect(page.locator(".bwc-flash")).toContainText("Bonus Black Friday dodany");
  await fillData(page);
  await page.locator(".bwc-foot__next").click();
  await expect(page.locator(".bwc-sum")).toContainText("Drugi voucher");
  await shot(page, "taxi-sum");
  await page.locator(".bwc-pay").click();
  await expect(page).toHaveURL(/\/platnosc\?order=/, { timeout: 8000 });
  expect(sent[0].bw).toMatchObject({ product: "taxi", mode: "self" });
  expect(sent[0].bw.variant).toBeTruthy();
  expect(sent[0].discount_code).toBeUndefined();
  await expect(page.locator(".pl-bw__code b")).toHaveText("FRA-TEST-CODE", { timeout: 10000 });
  await shot(page, "platnosc");
  expect(errs).toEqual([]);
});

test("configurator: gift voucher — name on the holiday template, e-mail or InPost (+fee), open date", async ({ page }) => {
  const sent = await bw(page);
  await page.goto("/black-week?produkt=sport-driving&forma=prezent");
  await expect(page.locator(".bwc-mode").nth(1)).toHaveClass(/on/);
  await page.locator(".bwc-namefield input").fill("Łukasza");
  await expect(page.locator(".bwc-vprev .gvc__name")).toHaveText("ŁUKASZA");
  await page.locator(".bwc-giftbox .bwc-mode").nth(1).click();   // printed + locker
  await expect(page.locator(".bwc-lockerbox")).toBeVisible();
  await page.locator(".bwc-foot__next").click();
  await expect(page.locator(".bwc-err")).toContainText("Paczkomat");
  await shot(page, "gift-dla");
  await page.locator(".bwc-giftbox .bwc-mode").nth(0).click();   // back to e-mail
  await page.locator(".bwc-foot__next").click();
  await page.locator(".bwc-car").first().click();
  await page.locator(".bwc-pkg").first().click();
  await page.locator(".bwc-foot__next").click();
  await expect(page.locator(".bwc-later")).toContainText("VOUCHER OTWARTY");
  await page.locator(".bwc-later").click();
  await page.locator(".bwc-foot__next").click();
  await fillData(page);
  await page.locator(".bwc-foot__next").click();
  await expect(page.locator(".bwc-sum")).toContainText("Voucher prezentowy dla");
  await expect(page.locator(".bwc-vprev--sum .gvc__name")).toHaveText("ŁUKASZA");
  await shot(page, "gift-sum");
  await page.locator(".bwc-pay").click();
  await expect(page).toHaveURL(/\/platnosc/, { timeout: 8000 });
  expect(sent[0].bw).toMatchObject({ product: "sd", mode: "gift", gift_for: "Łukasza", sessions: 3, term_id: null });
  expect(sent[0].delivery).toBe("email");
});

test("configurator: Sport Driving bonus, Heels friend price, D2R gloves", async ({ page }) => {
  const sent = await bw(page);
  await page.goto("/black-week");
  await page.locator(".bwc-prod__cta").first().click();
  await self(page);
  await page.locator(".bwc-car").first().click();
  await page.locator(".bwc-pkg").nth(1).click();
  await expect(page.locator(".bwc-side__gift")).toContainText("+2 sesje gratis");
  await shot(page, "sd-opts");
  await page.locator(".bwc-foot__next").click();
  await page.locator(".bwc-later").click();
  await shot(page, "sd-term");
  await page.locator(".bwc-foot__next").click();
  await fillData(page);
  await page.locator(".bwc-foot__next").click();
  await page.locator(".bwc-pay").click();
  await expect(page).toHaveURL(/\/platnosc/, { timeout: 8000 });
  expect(sent[0].bw).toMatchObject({ product: "sd", sessions: 6, term_id: null, mode: "self" });

  for (const [q, need] of [["driver2racer", "rękawic"], ["heels-on-the-track", "pakiet"]]) {
    await page.goto(`/black-week?produkt=${q}`);
    await expect(page.locator(".bwc-steptag")).toContainText("KROK 2");
    await page.locator(".bwc-foot__next").click();
    await expect(page.locator(".bwc-err")).toContainText("dla siebie");
    await self(page);
    await page.locator(".bwc-foot__next").click();
    await expect(page.locator(".bwc-err")).toContainText(need);
  }
  await page.goto("/black-week?produkt=heels-on-the-track");
  await self(page);
  await page.locator(".bwc-opt").nth(1).click();
  await page.locator(".bwc-opt--gift").first().click();
  await expect(page.locator(".bwc-foot__sum b")).toContainText(/6\s?750 zł/);
  await page.locator(".bwc-friend input").fill("Ola Test");
  await shot(page, "heels-opts");
  await page.goto("/black-week?produkt=driver2racer");
  await self(page);
  await page.locator(".bwc-color").nth(1).click();
  await page.locator(".bwc-sizes button").nth(2).click();
  await expect(page.locator(".bwc-side__gift")).toContainText("czerwone, rozmiar M");
  await shot(page, "d2r-opts");
});

test("panel: Black Week tab — switch, sum, links and the gift checklist", async ({ page, isMobile }) => {
  test.skip(isMobile, "panel checked on desktop");
  const checks = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); localStorage.setItem("fra_admin_token", "test-token"); } catch {} });
  await page.route("**/functions/v1/admin-auth", (route) => route.fulfill({ json: { ok: true, admin: { id: "a1", login: "test", name: "Tester", role: "owner", perms: {} } } }));
  const row = (n, status, gifts, extra = {}) => ({ id: `id-${n}`, number: n, status, created_at: "2026-11-20T10:00:00Z", full_name: `Klient ${n}`, email: `k${n}@test.pl`, phone: "600100200", amount_pln: 1228.77, term_label: "Black Week · Race Taxi", promo: "black-week-2026", promo_data: { product: "taxi", title: "RACE TAXI", gifts }, ...extra });
  const rows = [
    row(81, "paid", [{ id: "d2r-porsche", label: "+2 sesje w Porsche 911 — dopisać do programu" }, { id: "d2r-gloves", label: "Rękawice OMP — kolor: Czerwone, rozmiar: M" }], { amount_pln: 26900.4, promo_data: { product: "d2r", title: "DRIVER2RACER", gifts: [{ id: "d2r-porsche", label: "+2 sesje w Porsche 911 — dopisać do programu" }, { id: "d2r-gloves", label: "Rękawice OMP — kolor: Czerwone, rozmiar: M" }] } }),
    row(80, "paid", [{ id: "taxi-voucher", label: "Drugi voucher Race Taxi (Alpine A110S) — kod FRA-AB12-CD34 wysłany klientowi", auto: true, done: true, done_by: "automat", done_at: "2026-11-20T10:01:00Z" }]),
    row(79, "pending", [{ id: "sd-bonus", label: "+1 sesja gratis (BMW M2) — dopisać do pakietu 3 sesji" }]),
  ];
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "bw.list") return route.fulfill({ json: { ok: true, on: true, heels_basic: 3200, heels_premium: 4500, bw_to: "mariusz.miekos@greywolfgroup.pl", rows } });
    if (body.action === "bw.check") { checks.push(body.payload); const r = rows.find((x) => x.id === body.payload.id); return route.fulfill({ json: { ok: true, row: { ...r, promo_data: { ...r.promo_data, gifts: r.promo_data.gifts.map((g) => (g.id === body.payload.gift ? { ...g, done: body.payload.done, done_by: "Tester", done_at: new Date().toISOString() } : g)) } } } }); }
    if (/^(stats|me)$/.test(body.action)) return route.fulfill({ json: { ok: true, months: [], byKind: {}, recent: [], messages: {} } });
    return route.fulfill({ json: { ok: true, rows: [], tables: {} } });
  });
  await page.goto("/admin");
  await page.locator(".adm-nav", { hasText: "Black Week" }).click();
  await expect(page.locator(".adm-bw-switch")).toContainText("PROMOCJA WŁĄCZONA");
  await expect(page.locator(".adm-bw-kpis .is-main b")).toContainText(/28\s129,17/);
  await expect(page.locator(".adm-bw-row")).toHaveCount(1);   // "do zrobienia": only the D2R order
  await page.locator(".adm-bw-gifts input").first().check();
  await expect.poll(() => checks.length).toBe(1);
  expect(checks[0]).toMatchObject({ id: "id-81", gift: "d2r-porsche", done: true });
  await page.locator(".adm-bw-links summary").first().click();
  await expect(page.locator(".adm-bw-link code")).toHaveCount(6);
  await page.locator(".adm-chip", { hasText: "Wszystkie" }).first().click();
  await shot(page, "admin");
});
