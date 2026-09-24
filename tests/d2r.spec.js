import { test, expect } from "@playwright/test";
import { visibleProducts } from "./_cms.js";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("Driver2Racer sits on the wall in its CMS slot", async ({ page, request }) => {
  const products = await visibleProducts(request);
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const titles = await page.locator(".pp__title").allInnerTexts();
  const idx = products.findIndex((p) => p.slug === "driver2racer");
  expect(idx).toBeGreaterThanOrEqual(0);
  expect(titles[idx]).toContain("DRIVER 2 RACER");
  expect(await page.locator(".pp").count()).toBe(products.length);
});

test("Driver2Racer page renders the parsed program (hero video, gains, sessions, fleet)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/produkty/driver2racer");
  await page.waitForSelector(".d2-hero__logo", { timeout: 10000 });

  await expect(page.locator(".d2-hero__logo")).toBeVisible();     // the real wordmark
  await expect(page.locator("h1.sr-only")).toContainText("DRIVER");
  await expect(page.locator(".d2-hero__vid")).toBeVisible();      // editable hero video
  await expect(page.locator(".d2-gain")).toHaveCount(3);          // SZYBKOŚĆ / REAKCJA / TECHNIKA
  await expect(page.locator(".d2-sess__slice")).toHaveCount(4);   // 10 + 10 + 4 + 6
  await expect(page.locator(".d2-car")).toHaveCount(6);           // race cars
  await expect(page.locator(".d2-step")).toHaveCount(4);
  await expect(page.locator(".d2-price__v")).toContainText("17 800");

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("buying the package skips the configurator: details → payment", async ({ page }) => {
  await page.goto("/produkty/driver2racer");
  await page.waitForSelector(".d2-hero__logo");

  await page.locator(".d2-buy").click();
  await expect(page).toHaveURL(/\/zakup\?produkt=driver2racer/);

  // exactly two steps, no car/date/package pickers
  await expect(page.locator(".zk-step")).toHaveCount(2);
  await expect(page.locator(".zk-step.on")).toContainText("DANE");
  await expect(page.locator(".zk-head__price")).toContainText("17 800");
  await expect(page.locator(".fl-steps__i, .cn-cell--price")).toHaveCount(0);

  // the price is shown on the pay button as well
  await page.fill('.zk-field:has(span:text-is("Imię i nazwisko")) input', "Playwright D2R");
  await page.fill('.zk-field:has(span:text-is("Telefon")) input', "+48 500 600 700");
  await page.fill('.zk-field input[type=email]', "pw-d2r@example.com");
  await expect(page.locator(".zk-foot .btn--red")).toContainText("17 800");
});
