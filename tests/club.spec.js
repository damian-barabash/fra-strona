import { test, expect } from "@playwright/test";

/* /platnosc after a paid order: the Fastline Racing Club welcome + where the Performance Lab login is.
   booking.status is mocked — nothing reaches the database, Tpay or Performance Lab. */
const ORDER = "00000000-0000-4000-8000-0000000000c1";
const SHOTS = process.env.CLUB_SHOTS || "";

async function mockStatus(page, clubSeq) {
  let n = 0;
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} });
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action !== "booking.status") return route.continue();
    const club = clubSeq[Math.min(n++, clubSeq.length - 1)];
    return route.fulfill({ json: { ok: true, order: {
      id: ORDER, number: 41, kind: "track", status: "paid", total: 2700, total_gross: 3321, currency: "PLN", amount_pln: 3321,
      car_name: "ALPINE A110 S", sessions: 3, term_label: "Tor Łódź · 2026-11-06 · 11:00–16:00", email: "jan.kowalski@example.com", club,
    } } });
  });
}

test("new client: welcome to the club + login details sent to the e-mail", async ({ page }, info) => {
  await mockStatus(page, ["created"]);
  await page.goto(`/platnosc?order=${ORDER}`);
  const club = page.locator(".pl-club");
  await expect(club).toContainText("WITAMY W FASTLINE RACING CLUB", { timeout: 10_000 });
  await expect(club).toContainText("dane do logowania wysłaliśmy");
  await expect(club).toContainText("jan.kowalski@example.com");
  await expect(club.locator("a")).toHaveAttribute("href", /performancelab\.fastlineracingacademy\.pl\/login/);
  await page.waitForTimeout(2300);
  if (SHOTS) await club.screenshot({ path: `${SHOTS}/club-created-${info.project.name}.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("existing client: the purchase is already on the account", async ({ page }, info) => {
  await mockStatus(page, ["existing"]);
  await page.goto(`/platnosc?order=${ORDER}`);
  const club = page.locator(".pl-club");
  await expect(club).toContainText("Zakup jest już na Twoim koncie", { timeout: 10_000 });
  await expect(club).not.toContainText("wysłaliśmy");
  if (SHOTS) { await page.waitForTimeout(2300); await club.screenshot({ path: `${SHOTS}/club-existing-${info.project.name}.png` }); }
});

test("Performance Lab still working: neutral text first, then the real answer", async ({ page }) => {
  await mockStatus(page, [null, null, "invited"]);
  await page.goto(`/platnosc?order=${ORDER}`);
  const club = page.locator(".pl-club");
  await expect(club).toContainText("Jeśli nie masz jeszcze konta", { timeout: 10_000 });
  await expect(club).toContainText("dane do logowania wysłaliśmy", { timeout: 10_000 });
});
