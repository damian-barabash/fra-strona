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

/* InPost points API + map tiles + address search are mocked too (no network to third parties) */
const PT = (name, lat, lng, street) => ({ name, status: "Operating", location: { latitude: lat, longitude: lng }, location_description: "Przy sklepie", opening_hours: "24/7", address_details: { city: "Łódź", post_code: "90-001", street, building_number: "1" } });
const POINTS = [PT("LOD01M", 51.7600, 19.4570, "Piotrkowska"), PT("LOD02M", 51.7620, 19.4600, "Zielona"), PT("POP-LOD9", 51.761, 19.458, "Pop"), PT("WAW01M", 52.24029, 20.91394, "Powstańców Śląskich")];
async function mockInpost(page) {
  await page.route("https://api-shipx-pl.easypack24.net/**", (route) => {
    const u = new URL(route.request().url());
    const name = u.searchParams.get("name");
    const items = name ? POINTS.filter((p) => p.name === name) : POINTS.filter((p) => p.name.startsWith("LOD") || p.name.startsWith("POP"));
    return route.fulfill({ json: { count: items.length, items } });
  });
  await page.route("https://photon.komoot.io/**", (route) => route.fulfill({ json: { features: [{ geometry: { coordinates: [19.456, 51.7592] }, properties: { name: "Piotrkowska", street: "Piotrkowska", housenumber: "100", postcode: "90-001", city: "Łódź", type: "house" } }] } }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") }));
}

test("landing: hidden (noindex), fleet without hats and no falling snow, looped film, CTA opens the configurator", async ({ page }) => {
  await mockApi(page);
  await page.goto("/swieta-2026");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await expect(page.locator(".sw-car__hat")).toHaveCount(0);
  await expect(page.locator(".snow")).toHaveCount(0);
  await expect(page.locator(".sw-hero__flake")).toHaveCount(2);
  await expect(page.locator(".sw-video video")).toHaveAttribute("loop", "");
  await expect(page.locator(".sw-hero h1")).toContainText("NA ŚWIĘTA.");
  await page.evaluate(() => document.querySelector("a[href='#jak-to-dziala']").click());   // "Jak to działa" → scrolls to the steps
  await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById("jak-to-dziala").getBoundingClientRect().top))).toBeLessThan(120);
  await page.locator(".sw-hero .sw-btn:not(.sw-btn--ghost)").click();
  await expect(page).toHaveURL(/\/swieta-2026\/voucher$/);
  await expect(page.locator(".sw-cat").first()).toBeVisible();
});

test("training voucher: name on the live preview, InPost +50, test mode packs the envelope and ends on 'all in your inbox'", async ({ page }) => {
  const sent = await mockApi(page);
  await mockInpost(page);
  await page.goto("/swieta-2026/voucher");
  await expect(page.locator(".sw-teststrip")).toBeVisible();
  await expect(page.locator(".snow")).toHaveCount(0);
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
  await page.locator(".lk-opt").first().click();                // search the list
  await page.fill(".lk-search input", "WAW01M");                  // a locker code finds the locker itself
  await page.locator(".lk-res button").first().click();
  await expect(page.locator(".lk-sel")).toContainText("Powstańców Śląskich 1, 90-001 Łódź");
  await page.locator(".sw-inpost .fl-field input").nth(0).fill("600700800");
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
  expect(sent[0].delivery_data.address).toBe("Powstańców Śląskich 1, 90-001 Łódź");
  expect(sent[0].delivery_data.point).toBeUndefined();
});

test("locker picker: address search lists the nearest real lockers, the map pop-up picks one from a pin", async ({ page }) => {
  await mockApi(page);
  await mockInpost(page);
  await page.goto("/swieta-2026/voucher");
  await page.locator(".sw-cat").first().click();
  await page.locator(".sw-foot__next").click();
  await page.locator(".sw-carpick").first().click();
  await page.locator(".sw-pkg").first().click();
  await page.locator(".sw-foot__next").click();
  await page.locator(".sw-foot__next").click();
  await page.locator(".sw-mode").nth(1).click();
  // 1) list: address → nearest lockers (POP- points are not lockers and are skipped)
  await page.locator(".lk-opt").first().click();
  await page.fill(".lk-search input", "Piotrkowska 100 Łódź");
  await expect(page.locator(".lk-list .lk-res li")).toHaveCount(2);
  await expect(page.locator(".lk-list .lk-res")).not.toContainText("POP-");
  await page.locator(".lk-list .lk-res button").nth(1).click();
  await expect(page.locator(".lk-sel b")).toHaveText("LOD02M");
  // 2) map: pins → card → pick
  await page.locator(".lk-sel__btns button").nth(1).click();
  await expect(page.locator(".lk-modal")).toBeVisible();
  await expect(page.locator(".lk-pin")).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator(".lk-card")).toContainText("LOD02M");   // opens on the picked one
  await page.locator(".lk-card__x").click();
  await page.locator(".leaflet-marker-icon[title=LOD01M]").click();
  await expect(page.locator(".lk-card")).toContainText("LOD01M");
  await page.locator(".lk-card__go").click();
  await expect(page.locator(".lk-modal")).toHaveCount(0);
  await expect(page.locator(".lk-sel b")).toHaveText("LOD01M");
});
