import { test, expect } from "@playwright/test";

test("products lead with Heels → Driver2Racer, then the premium pair (Monaco + Laponia)", async ({ page }) => {
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const codes = await page.locator(".pp__title").allInnerTexts();
  expect(codes[0]).toContain("HEELS");
  expect(codes[1]).toContain("DRIVER 2 RACER");
  // Monaco and Laponia sit right after (their order relative to each other is CMS-controlled)
  const premium = [codes[2], codes[3]].join(" | ");
  expect(premium).toContain("MONACO");
  expect(premium).toContain("ICE DRIVING");
  expect(await page.locator(".pp").count()).toBe(9);
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

test("ice configurator: package → car → date inside the season window → details → payment", async ({ page }) => {
  await page.goto("/produkty/ice-driving-laponia");
  await page.waitForSelector(".lp-pkg__btn");
  await page.locator(".lp-pkg__btn").first().click();   // 2-day package
  await expect(page).toHaveURL(/\/rezerwacja-ice\?pkg=/);

  // the package is preset, so we start on the car step
  await expect(page.locator(".ri-step.on")).toContainText("AUTO");
  await expect(page.locator(".ri-chips")).toContainText("5450");
  expect(await page.locator(".ri-car").count()).toBeGreaterThan(3);
  await page.locator(".ri-car").first().click();
  await page.locator(".ri-foot .lp-btn").click();       // → TERMIN
  await expect(page.locator(".ri-step.on")).toContainText("TERMIN");
  await expect(page.locator(".ri-chips")).toContainText("PORSCHE");

  // only dates where a 2-day stay fits inside the window are selectable
  const free = page.locator(".ri-day.is-free");
  expect(await free.count()).toBeGreaterThan(20);
  await free.nth(2).click();
  await expect(page.locator(".ri-range")).toContainText("2027");

  await page.locator(".ri-foot .lp-btn").click();       // → DANE
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
