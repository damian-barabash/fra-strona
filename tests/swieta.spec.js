import { test, expect } from "@playwright/test";

/* /swieta-2026 — hidden holiday voucher page + configurator. gift.info and booking.createGift are mocked
   (nothing is created, no e-mail); the catalogue (cars, products) is read live like the other tests. */
async function mockApi(page, mode = "test") {
  const sent = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); sessionStorage.setItem("fra_pre", "1"); } catch {} });
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "gift.info") return route.fulfill({ json: { ok: true, mode, inpost_net: 50 } });
    if (body.action === "booking.createGift") { sent.push(body.payload); return route.fulfill({ json: { ok: true, id: "00000000-0000-4000-8000-0000000000a1", number: 1, paid: true, test: true, voucher_code: "FRA-MOCK-0001" } }); }
    return route.continue();
  });
  return sent;
}

test("landing: hidden (noindex), fleet in Santa hats, looped film, CTA opens the configurator", async ({ page }) => {
  await mockApi(page);
  await page.goto("/swieta-2026");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await expect(page.locator(".sw-car__hat")).toHaveCount(2);
  await expect(page.locator(".sw-video video")).toHaveAttribute("loop", "");
  await page.locator(".sw-hero .sw-btn").click();
  await expect(page).toHaveURL(/\/swieta-2026\/voucher$/);
  await expect(page.locator(".sw-cat").first()).toBeVisible();
});

test("training voucher: name on the live preview, InPost +50, test mode packs the envelope and ends on 'all in your inbox'", async ({ page }) => {
  const sent = await mockApi(page);
  await page.goto("/swieta-2026/voucher");
  await expect(page.locator(".sw-teststrip")).toBeVisible();
  await page.locator(".sw-foot__next").click();
  await expect(page.locator(".sw-err")).toBeVisible();          // nothing picked yet
  await page.locator(".sw-cat").first().click();
  await page.locator(".sw-foot__next").click();
  await page.locator(".sw-carpick").first().click();
  await page.locator(".sw-pkg").first().click();
  await page.locator(".sw-foot__next").click();
  await page.locator(".sw-foot__next").click();                 // open voucher (default)
  await page.fill(".sw-namefield input", "Łukasza");
  await expect(page.locator(".sw-cfg__preview .gvc__name")).toHaveText("ŁUKASZA");
  await page.locator(".sw-mode").nth(1).click();                 // print + locker
  await page.locator(".sw-foot__next").click();
  await expect(page.locator(".sw-err")).toBeVisible();          // locker code missing
  await page.locator(".sw-inpost input").nth(0).fill("WAW01M");
  await page.locator(".sw-inpost input").nth(1).fill("600700800");
  await page.locator(".sw-foot__next").click();
  const f = page.locator(".fl-form input");
  await f.nth(0).fill("Jan Testowy"); await f.nth(1).fill("600700800"); await f.nth(2).fill("jan@example.com");
  await page.locator(".sw-foot__next").click();
  await expect(page.locator(".sw-sum")).toContainText("WAW01M");
  await page.locator(".sw-pack").click();
  await expect(page.locator(".sw-done")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".sw-done__code")).toContainText("FRA-MOCK-0001");
  expect(sent).toHaveLength(1);
  expect(sent[0].gift.kind).toBe("track");
  expect(sent[0].gift.sessions).toBe(3);
  expect(sent[0].gift.term_id).toBeNull();
  expect(sent[0].voucher_for).toBe("Łukasza");
  expect(sent[0].delivery).toBe("inpost");
  expect(sent[0].delivery_data.locker).toBe("WAW01M");
});
