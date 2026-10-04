import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

// "back" (the WSTECZ button on the first step, or the browser's) returns to the place the visitor left
const back = (page, how) => (how === "button" ? page.locator(".rz-foot .btn--back").click() : page.goBack());

for (const how of ["button", "browser"]) {
  test(`booking → back returns to the calendar list, same scroll (${how})`, async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('a[href="/kalendarz"]').click());
    await page.waitForSelector(".kal-row", { timeout: 10000 });
    await page.waitForTimeout(900);
    const btn = page.locator(".kal-row__btn").last();
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(300);
    await btn.click();
    await expect(page).toHaveURL(/\/rezerwacja\?term=/);
    await page.waitForSelector(".rz-foot");
    await page.waitForTimeout(900);
    await back(page, how);
    await expect(page).toHaveURL(/\/kalendarz$/);
    await page.waitForSelector(".kal-row");
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(80);
  });

  test(`home events block → booking → back returns to that block (${how})`, async ({ page }) => {
    await page.goto("/");
    const link = page.locator('#wydarzenia a[href^="/rezerwacja?term="], .events a[href^="/rezerwacja?term="]').first();
    await link.waitFor({ state: "attached", timeout: 10000 });
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(300);
    await link.click();
    await expect(page).toHaveURL(/\/rezerwacja\?term=/);
    await page.waitForSelector(".rz-foot");
    await page.waitForTimeout(900);
    await back(page, how);
    await expect(page).toHaveURL(/localhost:5173\/$/);
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(120);
  });
}

test("calendar keeps the month the visitor was on", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('a[href="/kalendarz"]').click());
  await page.waitForSelector(".kal-row", { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.locator(".kal-arrow").last().click();
  await page.waitForTimeout(600);
  const month = await page.evaluate(() => JSON.parse(sessionStorage.getItem("fra_kal")).cur);
  await page.locator(".kal-row__btn").first().click();
  await expect(page).toHaveURL(/\/rezerwacja\?term=/);
  await page.waitForTimeout(900);
  await page.goBack();
  await page.waitForSelector(".kal-row");
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("fra_kal")).cur)).toEqual(month);
});

test("booking opened straight from a link: WSTECZ goes to the calendar", async ({ page }) => {
  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-row", { timeout: 10000 });
  await page.locator(".kal-row__btn").first().click();
  await expect(page).toHaveURL(/\/rezerwacja\?term=/);
  const url = page.url();
  const fresh = await page.context().newPage();
  await fresh.goto(url);
  await fresh.waitForSelector(".rz-foot");
  await fresh.locator(".rz-foot .btn--back").click();
  await expect(fresh).toHaveURL(/\/kalendarz$/);
});
