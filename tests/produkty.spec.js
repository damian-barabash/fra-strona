import { test, expect } from "@playwright/test";
import { visibleProducts } from "./_cms.js";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("products wall renders every product from the CMS, no console errors", async ({ page, request }) => {
  const products = await visibleProducts(request);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/produkty");
  await page.waitForSelector(".pp", { timeout: 10000 });

  expect(await page.locator(".pp").count()).toBe(products.length);
  // plates with a logo show it instead of the code plate; the first code plate belongs to the first product without a logo
  const firstCode = products.find((p) => !p.logo);
  await expect(page.locator(".pp__code").first()).toHaveText(firstCode.code);
  await expect(page.locator(".pp__logo")).toHaveCount(products.filter((p) => p.logo).length);
  // every plate has a photo
  const withPhoto = await page.locator(".pp__photo").count();
  expect(withPhoto).toBe(products.length);

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("nav 'PRODUKTY' opens the wall and a plate opens the product page", async ({ page, isMobile }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/");
  await page.waitForTimeout(1200);
  if (isMobile) {
    await page.locator(".nav__burger").click();
    await page.locator(".mobile-menu a", { hasText: "OFERTA" }).click();
  } else {
    await page.locator(".nav__menu a", { hasText: "OFERTA" }).click();
  }
  await expect(page).toHaveURL(/\/oferta$/);
  await page.waitForSelector(".pp");

  await page.locator('a.pp[href="/produkty/stage-1"]').click();   // the plate itself — the footer links there too
  await expect(page).toHaveURL(/\/produkty\/stage-1/);
  await expect(page.locator(".pd-hero__code")).toHaveText("STAGE 1");
  await expect(page.locator(".pd-hero__title")).toContainText("SZKOLENIE JAZDY SPORTOWEJ");
  // parsed content is on the page
  await expect(page.locator(".pd-part")).toHaveCount(2);
  expect(await page.locator(".pd-li").count()).toBeGreaterThan(5);
  await expect(page.locator(".pd-pkg")).toHaveCount(3);
  await expect(page.locator(".pd-gal")).toHaveCount(3);

  // booking CTA leads into the configurator
  await page.locator(".pd-hero__btns .btn--red").click();
  await expect(page).toHaveURL(/\/rezerwacja$/);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("Heels plate links out to heelsonthetrack.pl instead of a subpage", async ({ page }) => {
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const heels = page.locator(".pp--ext");
  await expect(heels).toHaveCount(1);
  await expect(heels).toHaveAttribute("href", "https://heelsonthetrack.pl/");
  await expect(heels).toHaveAttribute("target", "_blank");
  // it carries its own brand logo instead of the code plate
  await expect(heels.locator(".pp__logo img")).toBeVisible();
  await expect(heels.locator(".pp__code")).toHaveCount(0);
});

test("simulator page is information-only — no booking buttons", async ({ page }) => {
  await page.goto("/produkty/symulator");
  await page.waitForSelector(".pd-hero__title");
  await expect(page.locator(".pd-hero__title")).toContainText("SYMULATOR");
  // no links into the booking flow in the page content (the nav's own "DLA CIEBIE" link stays)
  await expect(page.locator('main a[href*="/rezerwacja"]')).toHaveCount(0);
  await expect(page.locator(".pd-pkg__go")).toHaveCount(0);
  await expect(page.locator(".pd-pkgs__h")).toContainText("ETAPY");
  // and a bookable product still has them
  await page.goto("/produkty/stage-1");
  await page.waitForSelector(".pd-hero__title");
  expect(await page.locator('main a[href*="/rezerwacja"]').count()).toBeGreaterThan(0);
});

test("every product page renders (all slugs)", async ({ page }) => {
  const slugs = ["stage-1", "stage-2", "stage-3", "safe-and-sport-driving-academy", "symulator"];
  for (const s of slugs) {
    await page.goto(`/produkty/${s}`);
    await page.waitForSelector(".pd-hero__title", { timeout: 10000 });
    await expect(page.locator(".pd-hero__title")).not.toBeEmpty();
    await expect(page.locator(".pd-hero__code")).not.toBeEmpty();
  }
});
