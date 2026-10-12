import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

/* Meta Pixel: loads only after the cookie consent, and reports the sales funnel
   (PageView → ViewContent → AddToCart → InitiateCheckout → Purchase). Nothing leaves the machine:
   fbevents.js is answered empty, so the calls stay in `fbq.queue`; admin-api is mocked.
   Automated browsers never get the pixel on their own, so the tests ask for it (`fra_pixel_force`). */
const ORDER = "00000000-0000-4000-8000-0000000000c1";
const calls = (page) => page.evaluate(() => (window.fbq?.queue || []).map((a) => Array.from(a)));
const events = async (page) => (await calls(page)).filter((c) => c[0] === "track").map((c) => c[1]);

async function setup(page, cookies = "all") {
  await page.addInitScript((c) => {
    try { localStorage.setItem("fra_pixel_force", "1"); if (c && !localStorage.getItem("fra_cookies")) localStorage.setItem("fra_cookies", c); } catch {}
  }, cookies);
  await page.route("**/connect.facebook.net/**", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
}

test("no pixel before the consent; accepting starts it with a PageView, each new page adds one", async ({ page, isMobile }) => {
  await setup(page, null);
  await page.goto("/");
  await expect(page.locator(".ckb")).toBeVisible();
  expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
  await page.locator(".ckb__ok").click();
  await expect.poll(() => events(page)).toEqual(["PageView"]);
  expect((await calls(page))[0]).toEqual(["init", "231855914162315"]);
  expect(await page.locator('script[src*="fbevents.js"]').count()).toBe(1);

  if (isMobile) await page.locator(".nav__burger, .burger").first().click();
  await page.locator('a[href="/cennik"]:visible').first().click();
  await expect(page).toHaveURL(/\/cennik$/);
  await expect.poll(() => events(page)).toEqual(["PageView", "PageView"]);
});

test("“only essential” cookies and the panel never load the pixel", async ({ page }) => {
  await setup(page, "essential");
  await page.goto("/oferta");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");

  await page.evaluate(() => localStorage.setItem("fra_cookies", "all"));
  await page.goto("/admin");
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
});

test("a car page reports ViewContent with its gross price", async ({ page }) => {
  await setup(page);
  await page.goto("/flota/bmw-m2");
  await expect.poll(() => events(page)).toEqual(["PageView", "ViewContent"]);
  const vc = (await calls(page)).find((c) => c[1] === "ViewContent")[2];
  expect(vc.content_ids).toEqual(["bmw-m2"]);
  expect(vc.currency).toBe("PLN");
  expect(vc.value).toBeGreaterThan(1000);
});

test("direct purchase: AddToCart → InitiateCheckout → Purchase (once per order)", async ({ page, request }) => {
  const r = await request.get(`${SUPABASE_URL}/rest/v1/products?select=slug,price&visible=eq.true&buy_direct=eq.true&theme=neq.wyprawa&order=sort&limit=1`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  const [prod] = await r.json();
  test.skip(!prod, "no direct-purchase product in the CMS");

  await setup(page);
  await page.route("**/functions/v1/admin-api", (route) => {
    const { action } = JSON.parse(route.request().postData() || "{}");
    if (action === "booking.createProduct") return route.fulfill({ json: { ok: true, paid: true, id: ORDER } });
    if (action === "booking.status") return route.fulfill({ json: { ok: true, order: { id: ORDER, number: 77, kind: "product", status: "paid", total: 999, currency: "PLN", amount_pln: 1228.77, product_name: "RACE TAXI", email: "jan@example.com" } } });
    return route.continue();
  });

  await page.goto(`/zakup?produkt=${prod.slug}`);
  await expect.poll(() => events(page)).toEqual(["PageView", "AddToCart"]);
  const inputs = page.locator(".zk-form input");
  await inputs.nth(0).fill("Jan Testowy");
  await inputs.nth(1).fill("600100200");
  await inputs.nth(2).fill("jan@example.com");
  await page.locator(".zk-foot .btn--red").click();
  await expect.poll(() => events(page)).toContain("InitiateCheckout");

  await expect(page).toHaveURL(/\/platnosc\?order=/, { timeout: 15000 });
  await expect.poll(() => events(page), { timeout: 15000 }).toEqual(["PageView", "AddToCart", "InitiateCheckout", "PageView", "Purchase"]);
  const p = (await calls(page)).find((c) => c[1] === "Purchase");
  expect(p[2]).toMatchObject({ value: 1228.77, currency: "PLN", content_name: "RACE TAXI" });
  expect(p[3]).toEqual({ eventID: ORDER });

  // coming back to the confirmation page does not report the same order again
  await page.reload();
  await expect(page.locator(".pl-t--go")).toBeVisible({ timeout: 15000 });
  expect(await events(page)).toEqual(["PageView"]);
});

test("configurator: the product card is ViewContent, ordering it AddToCart, the payment step InitiateCheckout", async ({ page, request }) => {
  const r = await request.get(`${SUPABASE_URL}/rest/v1/cars?select=id,name,price_3&visible=eq.true&category=eq.sport&price_3=gt.0&order=sort&limit=1`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  const [car] = await r.json();
  await setup(page);
  // the order never reaches the server: the payment step waits on this answer
  await page.route("**/functions/v1/admin-api", (route) => {
    const { action } = JSON.parse(route.request().postData() || "{}");
    return action === "booking.create" ? route.fulfill({ json: { ok: false, error: "test" } }) : route.continue();
  });

  await page.goto(`/rezerwacja?car=${car.id}`);
  await page.locator(".fl-term--nodate").click();
  await page.locator(".rz-foot .btn--red").click();
  await page.locator(".fl-pkg").first().click();
  await page.locator(".rz-foot .btn--red").click();
  await expect(page.locator(".pcard-x")).toBeVisible();
  await expect.poll(() => events(page)).toEqual(["PageView", "ViewContent"]);
  const gross = Math.round(car.price_3 * 1.23 * 100) / 100;
  expect((await calls(page)).find((c) => c[1] === "ViewContent")[2]).toMatchObject({ value: gross, currency: "PLN" });

  await page.locator(".pcard-x__btn").click();
  await expect.poll(() => events(page)).toEqual(["PageView", "ViewContent", "AddToCart"]);
  const inputs = page.locator(".fl-bk input");
  await inputs.nth(0).fill("Jan Testowy");
  await inputs.nth(1).fill("600100200");
  await inputs.nth(2).fill("jan@example.com");
  await page.locator(".rz-foot .btn--red").click();
  await expect.poll(() => events(page)).toEqual(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]);
  expect((await calls(page)).find((c) => c[1] === "InitiateCheckout")[2]).toMatchObject({ value: gross, currency: "PLN" });
});
