import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("Monaco sits in the premium group near the top of the wall", async ({ page }) => {
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const titles = await page.locator(".pp__title").allInnerTexts();
  const idx = titles.findIndex((tx) => tx.includes("MONACO"));
  expect(idx).toBeGreaterThanOrEqual(2);   // after Heels + Driver2Racer
  expect(idx).toBeLessThanOrEqual(4);       // still ahead of the Stage trainings (Andaluzja sits next to it)
});

test("the trip page renders in the product's accent colour, with attractions, map and schedule", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // the accent colour set on the product in the CMS must drive the whole trip page
  await page.goto("/produkty");
  await page.waitForSelector(".pp");
  const accent = await page.locator('.pp[href="/produkty/monaco"]')
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--pc").trim());
  expect(accent).toMatch(/^#[0-9a-f]{6}$/i);

  await page.goto("/produkty/monaco");
  await page.waitForSelector(".wy-hero__title", { timeout: 10000 });

  const pc = await page.locator(".wy").evaluate((el) => getComputedStyle(el).getPropertyValue("--pc").trim());
  expect(pc).toBe(accent);

  await expect(page.locator(".wy-hero__vid")).toBeVisible();          // editable hero video
  await expect(page.locator(".wy-hero__dates")).not.toBeEmpty();
  await expect(page.locator(".wy-att")).toHaveCount(6);               // parsed attractions
  await expect(page.locator(".wy-sched__list li")).toHaveCount(8);    // editable schedule
  await expect(page.locator(".wy-map__frame iframe")).toBeVisible();  // branded google map
  await expect(page.locator(".wy-map__tint")).toBeVisible();

  // every stop from the CMS is a pin, and the map asks Google for the route between them
  await expect(page.locator(".wy-pin")).toHaveCount(7);
  const src = await page.locator(".wy-map__frame iframe").getAttribute("src");
  expect(src).toContain("saddr=Nice");
  expect(src).toContain("to:Circuit%20Paul%20Ricard");

  // an attraction opens its detail sheet
  await page.locator(".wy-att").first().click();
  await expect(page.locator(".wy-sheet__box")).toBeVisible();
  await expect(page.locator(".wy-sheet__t")).not.toBeEmpty();
  await page.locator(".wy-sheet__x").click();
  await expect(page.locator(".wy-sheet__box")).toHaveCount(0);

  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("a finished trip hides the packages and shows the recap instead", async ({ page }) => {
  await page.goto("/produkty/monaco");
  await page.waitForSelector(".wy-hero__title");

  const past = await page.locator(".wy--past").count();
  if (past) {
    await expect(page.locator(".wy-sec--recap")).toBeVisible();
    await expect(page.locator(".wy-pkg")).toHaveCount(0);       // nothing to buy any more
    await expect(page.locator(".wy-badge")).toBeVisible();
    // no photos uploaded yet → only the placeholder, never photos borrowed from the gallery
    await expect(page.locator(".wy-recap__ph")).toHaveCount(0);
    await expect(page.locator(".wy-recap__soon")).toBeVisible();
  } else {
    // the CMS switched the trip back to "upcoming": packages come back, the recap goes away
    await expect(page.locator(".wy-sec--recap")).toHaveCount(0);
    expect(await page.locator(".wy-pkg").count()).toBeGreaterThan(0);
  }
});

test("the footer product columns come from the CMS", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".fnav__item");

  const items = page.locator(".fnav__item");
  expect(await items.count()).toBe(10);                                 // one per product
  await expect(items.nth(0)).toHaveAttribute("href", "https://heelsonthetrack.pl/");   // external (Heels)
  // Monaco is generated from the CMS like every other product (its exact slot follows the CMS order)
  const monaco = items.filter({ hasText: "MONACO" });
  await expect(monaco).toHaveCount(1);
  await expect(monaco).toHaveAttribute("href", "/produkty/monaco");
});
