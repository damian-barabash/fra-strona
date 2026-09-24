import { test, expect } from "@playwright/test";
import { visibleProducts } from "./_cms.js";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("the wall follows the CMS order and carries the flagship products", async ({ page, request }) => {
  const products = await visibleProducts(request);
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const titles = await page.locator(".pp__title").allInnerTexts();
  expect(titles).toEqual(products.map((p) => p.title_pl));
  const all = titles.join(" | ");
  for (const must of ["HEELS", "DRIVER 2 RACER", "MONACO", "ICE DRIVING"]) expect(all).toContain(must);
});

test("Laponia page renders in the ice theme with hero video and CMS packages", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/produkty/ice-driving-laponia");
  await page.waitForSelector(".lp-hero__logo", { timeout: 10000 });

  await expect(page.locator(".lp-hero__logo")).toBeVisible();           // icy wordmark replaces the headline
  await expect(page.locator("h1.sr-only")).toContainText("ICE DRIVING EXPERIENCE");
  await expect(page.locator(".lp-hero__vid")).toBeVisible();            // editable hero video
  await expect(page.locator(".lp-hero__dates .lp-frost-chip")).toContainText("2027");
  await expect(page.locator(".lp-pkg")).toHaveCount(2);                 // from ice_packages
  await expect(page.locator(".lp-pkg__price").first()).toContainText("€");
  expect(await page.locator(".lp-gal").count()).toBeGreaterThan(2);

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("ice configurator: package → date inside the season window → product card → details → payment", async ({ page }) => {
  await page.goto("/produkty/ice-driving-laponia");
  await page.waitForSelector(".lp-pkg__btn");
  await page.locator(".lp-pkg__btn").first().click();   // 2-day package
  await expect(page).toHaveURL(/\/rezerwacja-ice\?pkg=/);

  // the package is preset, so we start on the date step (no car choice for the ice programme)
  await expect(page.locator(".ri-step.on")).toContainText("TERMIN");
  await expect(page.locator(".ri-chips")).toContainText("5450");
  await expect(page.locator(".ri-step", { hasText: "AUTO" })).toHaveCount(0);

  // only dates where a 2-day stay fits inside the window are selectable
  const free = page.locator(".ri-day.is-free");
  expect(await free.count()).toBeGreaterThan(15);   // 20 Feb – 10 Mar window, 2-day stays
  await free.nth(2).click();
  await expect(page.locator(".ri-range")).toContainText("2027");

  await page.locator(".ri-foot .lp-btn").click();       // → PRODUKT (the shop-style card)
  await expect(page.locator(".ri-step.on")).toContainText("PRODUKT");
  await expect(page.locator(".pcard-x__price b")).toContainText("€");
  await expect(page.locator(".pcard-x__price i")).toContainText("PLN");
  await page.locator(".pcard-x__btn").click();          // ZAMAWIAM → DANE
  await expect(page.locator(".ri-step.on")).toContainText("DANE");
  await page.fill('.ri-field:has(span:text-is("Imię i nazwisko")) input', "Playwright Ice");
  await page.fill('.ri-field:has(span:text-is("Telefon")) input', "+48 500 100 200");
  await page.fill('.ri-field input[type=email]', "pw-ice@example.com");
  await expect(page.locator(".ri-foot__sum b")).toContainText("5450");
});

test("gallery photos open fullscreen (products + cars)", async ({ page }) => {
  await page.goto("/produkty/stage-1");
  await page.waitForSelector(".pd-gal");
  await page.locator(".pd-gal").first().click();
  await expect(page.locator(".lbx__img")).toBeVisible();
  await expect(page.locator(".lbx__count")).toContainText("1 /");
  await page.locator(".lbx__nav--next").click();
  await expect(page.locator(".lbx__count")).toContainText("2 /");
  await page.keyboard.press("Escape");
  await expect(page.locator(".lbx")).toHaveCount(0);

  // fleet thumbnails on the home page
  await page.goto("/");
  await page.waitForSelector(".fleet__thumb");
  await page.locator(".fleet__thumb").first().hover();
  await page.locator(".fleet__zoom").first().click();
  await expect(page.locator(".lbx__img")).toBeVisible();
  await page.locator(".lbx__x").click();
  await expect(page.locator(".lbx")).toHaveCount(0);
});
