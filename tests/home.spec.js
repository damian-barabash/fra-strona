import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("homepage renders all sections with no console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/");
  await page.waitForTimeout(1500);

  await expect(page.locator("text=STAJNIA WYJĄTKOWYCH SAMOCHODÓW")).toBeVisible();
  await expect(page.locator("text=POZNAJ NASZYCH INSTRUKTORÓW")).toBeVisible();
  await expect(page.locator("text=NADCHODZĄCE WYDARZENIA")).toBeVisible();
  await expect(page.locator(".pcard")).toHaveCount(6);
  await expect(page.locator(".evrow").first()).toBeVisible();
  await expect(page.locator(".founder__title")).toBeVisible();

  // no horizontal scroll
  const scrollX = await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; });
  expect(scrollX).toBe(0);

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("fleet slider changes car on next", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);
  const first = await page.locator(".fleet__model").innerText();
  await page.locator(".fleet__ctrls .navbtn--red").click();
  await page.waitForTimeout(700);
  const second = await page.locator(".fleet__model").innerText();
  expect(second).not.toBe(first);
});

test("PL/EN language toggle switches static UI", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".fleet__stage", { timeout: 10000 });
  await expect(page.locator("text=NASZA FLOTA")).toBeVisible();
  await page.locator(".lang button", { hasText: "EN" }).first().click();
  await page.waitForTimeout(400);
  await expect(page.locator("text=OUR FLEET")).toBeVisible();
});

test("admin login works", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForTimeout(600);
  await page.fill('input[placeholder="Login"]', "admin");
  await page.fill('input[placeholder="Hasło"]', "fastline2026");
  await page.locator(".adm-login__box .adm-btn--red").click();
  await expect(page.locator(".adm-side")).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".adm-kpi").first()).toBeVisible();   // dashboard KPI cards
});
