import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("cennik: price board is generated from the CMS and re-prices per track", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/cennik");
  // wait for the cars to land (the board starts with just the header + "own car" row)
  await page.waitForFunction(() => document.querySelectorAll(".cn-row .cn-car").length > 5, null, { timeout: 10000 });

  // one row per car + the "own car" row, five packages each
  expect(await page.locator(".cn-row").count()).toBeGreaterThan(5);
  await expect(page.locator(".cn-row--own")).toHaveCount(1);

  const cell = page.locator(".cn-row").nth(1).locator(".cn-cell--price").nth(0);
  const lodz = await cell.innerText();
  await page.locator(".cn-switch__b", { hasText: "POZNAŃ" }).click();
  await expect(cell).not.toHaveText(lodz);                  // Poznań has its own price set

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("cennik: clicking a price opens the configurator with that car and package", async ({ page }) => {
  await page.goto("/cennik");
  await page.waitForFunction(() => document.querySelectorAll(".cn-row .cn-car").length > 5, null, { timeout: 10000 });
  const carName = await page.locator(".cn-row").nth(1).locator(".cn-car b").innerText();

  await page.locator(".cn-row").nth(1).locator(".cn-cell--price").nth(0).click();  // 3-session cell (packages are 3 / 6 / 9 now)
  await expect(page).toHaveURL(/\/rezerwacja\?car=.*sessions=3/);
  await expect(page.locator(".rz-head__ctx")).toContainText(carName);
  await expect(page.locator(".rz-head__ctx")).toContainText("zł");                  // total already computed
});

test("kontakt: page renders the parsed contacts and validates the form", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/kontakt");
  await page.waitForSelector(".kt-form", { timeout: 10000 });

  await expect(page.locator(".kt-card--mail")).toContainText("racingacademy@fastline.pl");
  await expect(page.locator(".kt-card--tel").first()).toContainText("603 102 665");
  await expect(page.locator(".kt-card--tel").nth(1)).toContainText("601 280 520");
  await expect(page.locator(".kt-light")).toHaveCount(5);   // F1 start lights

  // empty form → validation, no request
  await page.locator(".kt-send").click();
  await expect(page.locator(".kt-err")).toBeVisible();
  await expect(page.locator(".kt-done")).toHaveCount(0);

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("nav: CENNIK and KONTAKT open their pages", async ({ page, isMobile }) => {
  for (const [label, url] of [["CENNIK", /\/cennik/], ["KONTAKT", /\/kontakt/]]) {
    await page.goto("/");
    await page.waitForTimeout(1000);
    if (isMobile) {
      await page.locator(".nav__burger").click();
      await page.locator(".mobile-menu a", { hasText: label }).click();
    } else {
      await page.locator(".nav__menu a", { hasText: label }).click();
    }
    await expect(page).toHaveURL(url);
  }
});
