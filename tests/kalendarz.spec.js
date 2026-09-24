import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("calendar renders the month board from CMS terms, with no console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-cell.has", { timeout: 10000 });

  await expect(page.locator(".kal-board__wd span")).toHaveCount(7);
  expect(await page.locator(".kal-cell").count()).toBeGreaterThanOrEqual(28);
  // every upcoming term shows up in the list below the board
  expect(await page.locator(".kal-row").count()).toBeGreaterThan(0);

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("nav 'KALENDARZ' opens the calendar page", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);
  if (isMobile) {
    await page.locator(".nav__burger").click();
    await page.locator(".mobile-menu a", { hasText: "KALENDARZ" }).click();
  } else {
    await page.locator(".nav__menu a", { hasText: "KALENDARZ" }).click();
  }
  await expect(page).toHaveURL(/\/kalendarz/);
  await page.waitForSelector(".kal-cell.has", { timeout: 10000 });
});

test("picking a training leads into the booking flow with the date preset", async ({ page, isMobile }) => {
  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-cell.has", { timeout: 10000 });

  if (isMobile) {
    // mobile: tapping a day opens the bottom sheet with the training card
    await page.locator(".kal-cell.has").first().click();
    await expect(page.locator(".kal-sheet__box")).toBeVisible();
    await page.locator(".kal-sheet .kal-card__btn").first().click();
  } else {
    // desktop: the side rail shows the selected training
    await expect(page.locator(".kal-rail .kal-card")).toBeVisible();
    await page.locator(".kal-rail .kal-card__btn").click();
  }

  await expect(page).toHaveURL(/\/rezerwacja\?term=/);
  // the date step is skipped: the flow starts at the car picker
  await expect(page.locator(".fl-steps__i").first()).toContainText(/AUTO/i);
  await expect(page.locator(".rz-head__ctx")).toContainText(/\d{4}|Tor|Circuit/);
});

test("type filter narrows the calendar to Heels dates", async ({ page }) => {
  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-row", { timeout: 10000 });
  const all = await page.locator(".kal-row").count();
  await page.locator(".kal-chip", { hasText: "HEELS" }).click();
  await page.waitForTimeout(400);
  const heels = await page.locator(".kal-row").count();
  expect(heels).toBeGreaterThan(0);
  expect(heels).toBeLessThan(all);
  await expect(page.locator(".kal-row__badge").first()).toHaveText("HEELS");
});

test("menu 'KUP SZKOLENIE' opens the full configurator (car → date → package → product → details → payment)", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);
  if (isMobile) {
    await page.locator(".nav__burger").click();
    await page.locator(".mobile-menu__cta").first().click();
  } else {
    await page.locator(".nav__cta").first().click();
  }
  await expect(page).toHaveURL(/\/rezerwacja$/);
  // the header names the product, the line under it the flow
  await expect(page.locator(".rz-head__eyebrow")).toContainText("SPORT DRIVING EXPERIENCE");
  await expect(page.locator(".rz-head__product")).toContainText("SZKOLENIE Z JAZDY SPORTOWEJ");
  await expect(page.locator(".rz-head__product")).toContainText("KONFIGURATOR");
  await expect(page.locator(".fl-steps__i")).toHaveCount(6);
  await expect(page.locator(".fl-steps__i").nth(0)).toContainText(/AUTO/i);
  await expect(page.locator(".fl-steps__i").nth(1)).toContainText(/TERMIN/i);
  await expect(page.locator(".fl-steps__i").nth(2)).toContainText(/PAKIET/i);
  await expect(page.locator(".fl-steps__i").nth(3)).toContainText(/PRODUKT/i);
  await expect(page.locator(".rz-auto .fl-stage")).toBeVisible(); // the car configurator slider
});

test("menu 'KUP PREZENT' (black button) opens the voucher configurator", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  if (isMobile) {
    await page.locator(".nav__burger").click();
    await page.locator(".mobile-menu__cta--dark").click();
  } else {
    await page.locator(".nav__cta--dark").click();
  }
  await expect(page).toHaveURL(/\/voucher$/);
});
