import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

// helper: page the calendar to a given month label
async function goToMonth(page, re, forward = true) {
  const btn = forward ? ".navbtn--red" : ".navbtn:not(.navbtn--red)";
  for (let i = 0; i < 30; i++) {
    const label = await page.locator(".kal-bar__label").innerText();
    if (re.test(label)) return true;
    await page.locator(btn).first().click();
    await page.waitForTimeout(90);
  }
  return false;
}

test("ice season shows as a special banner + a multi-day band on the board", async ({ page }) => {
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-board");

  expect(await goToMonth(page, /2027/)).toBeTruthy();
  await goToMonth(page, /LUTY|FEBRUARY/i);       // Feb 2027 is fully inside the season
  await page.waitForTimeout(900);

  const season = page.locator(".kal-special--ice");
  await expect(season.first()).toBeVisible();
  await expect(season.first()).toContainText(/SEZON|SEASON/i);
  // the window runs into February → a run of banded days shows on the board
  expect(await page.locator(".kal-cell.in-band").count()).toBeGreaterThanOrEqual(8);   // season opens on 20 Feb

  // clicking the banner opens the Laponia product
  await season.first().click();
  await expect(page).toHaveURL(/\/produkty\/ice-driving-laponia/);
  expect(errs, errs.join("\n")).toHaveLength(0);
});

test("a trip (Monaco) appears on the calendar as its own band with the recap link", async ({ page }) => {
  await page.goto("/kalendarz");
  await page.waitForSelector(".kal-board");

  expect(await goToMonth(page, /CZERWIEC 2026|JUNE 2026/i, false)).toBeTruthy();
  await page.waitForTimeout(900);

  const trip = page.locator(".kal-special--trip");
  await expect(trip.first()).toContainText("MONACO");
  // 6–13 June → 8 banded days
  expect(await page.locator(".kal-cell.in-band").count()).toBe(8);
  // the start day carries the label
  await expect(page.locator(".kal-cell__band b").first()).toContainText("MONACO");
});
