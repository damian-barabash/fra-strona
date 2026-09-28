import { test, expect } from "@playwright/test";

/* Optimistic admin + sync indicator. Mutations are intercepted (never reach the real database);
   the server is simulated as slow, then failing. Login itself is real. */
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

async function mockMutations(page, opts) {
  const sent = [];
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (!/\.(upsert|delete|reorder)$/.test(body.action || "")) return route.continue();
    sent.push(body);
    await new Promise((r) => setTimeout(r, opts.delay));
    if (opts.fail) return route.fulfill({ json: { ok: false, error: "boom" } });
    const row = body.action.endsWith(".upsert") ? { ...body.payload, id: body.payload.id || 990001 } : undefined;
    return route.fulfill({ json: { ok: true, row } });
  });
  return sent;
}

async function openTracks(page, isMobile) {
  await page.goto("/admin");
  await page.fill('input[placeholder="Login"]', "admin");
  await page.fill('input[placeholder="Hasło"]', "fastline2026");
  await page.locator(".adm-login__box .adm-btn--red").click();
  await expect(page.locator(".adm-side")).toBeVisible({ timeout: 8000 });
  if (isMobile) await page.locator(".adm-burger").click();
  await page.locator(".adm-nav", { hasText: /^Tory$/ }).click();
  await expect(page.locator(".adm-row").first()).toBeVisible();
}

test("save is instant, indicator shows syncing → saved, closing the tab warns meanwhile", async ({ page, isMobile }) => {
  const opts = { delay: 2500, fail: false };
  await mockMutations(page, opts);
  await openTracks(page, isMobile);
  await expect(page.locator(".sync")).toContainText(/zapisane/i);

  await page.locator(".adm-row").first().getByText("Edytuj").click();
  const name = page.locator(".adm-form input[type=text], .adm-form input:not([type])").nth(1);   // "Pełna nazwa" = list title
  await name.fill("TOR TEST SYNC");
  const t0 = Date.now();
  await page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" }).click();
  await expect(page.locator(".adm-form")).toHaveCount(0);
  expect(Date.now() - t0).toBeLessThan(1500);                          // no waiting for the server
  await expect(page.locator(".adm-row").first()).toContainText("TOR TEST SYNC");
  await expect(page.locator(".adm-row").first()).toContainText("zapisuję");
  await expect(page.locator(".sync")).toContainText(/Synchronizuję/i);

  // closing the tab while syncing → the browser's "leave site?" dialog
  let dialog = null;
  page.once("dialog", async (d) => { dialog = d.type(); await d.dismiss(); });
  await page.close({ runBeforeUnload: true }).catch(() => {});
  await expect.poll(() => dialog).toBe("beforeunload");
});

test("indicator settles to saved; a failed save rolls back and can be retried", async ({ page, isMobile }) => {
  const opts = { delay: 800, fail: false };
  await mockMutations(page, opts);
  await openTracks(page, isMobile);
  const first = page.locator(".adm-row").first();
  const original = (await first.locator(".adm-row__title").innerText()).trim();

  await first.getByText("Edytuj").click();
  await page.locator(".adm-form input[type=text], .adm-form input:not([type])").nth(1).fill("TOR OK");
  await page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" }).click();
  await expect(page.locator(".sync")).toContainText(/Zapisano|zapisane/i, { timeout: 5000 });
  await expect(first).not.toContainText("zapisuję");

  opts.fail = true;
  await first.getByText("Edytuj").click();
  await page.locator(".adm-form input[type=text], .adm-form input:not([type])").nth(1).fill("TOR FAIL");
  await page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" }).click();
  await expect(first).toContainText("TOR FAIL");
  await expect(page.locator(".sync--err")).toContainText(/Nie zapisano/i, { timeout: 5000 });
  await expect(first).toContainText("TOR OK");                          // rolled back to the last saved value
  await page.locator(".sync__pill").click();
  await expect(page.locator(".sync__item")).toContainText("Tor");

  opts.fail = false;
  await page.locator(".sync__retry").click();
  await expect(page.locator(".sync")).toContainText(/Zapisano|zapisane/i, { timeout: 5000 });
  await expect(page.locator(".sync--err")).toHaveCount(0);
  expect(original.length).toBeGreaterThan(0);
});

test("a new row is usable at once; editing it before the server answers waits for the real id", async ({ page, isMobile }) => {
  const opts = { delay: 1500, fail: false };
  const sent = await mockMutations(page, opts);
  await openTracks(page, isMobile);
  const before = await page.locator(".adm-row").count();
  await page.locator(".adm-head .adm-btn--red").click();
  await page.locator(".adm-form input[type=text], .adm-form input:not([type])").first().fill("NOWY TOR");
  await page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" }).click();
  await expect(page.locator(".adm-row")).toHaveCount(before + 1);
  const row = page.locator(".adm-row", { hasText: "NOWY TOR" });
  await row.getByText("Edytuj").click();                               // still pending on the server
  await page.locator(".adm-form input[type=text], .adm-form input:not([type])").first().fill("NOWY TOR 2");
  await page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" }).click();
  await expect(page.locator(".sync")).toContainText(/Zapisano|zapisane/i, { timeout: 8000 });
  expect(sent.map((b) => b.action)).toEqual(["tracks.upsert", "tracks.upsert"]);
  expect(sent[0].payload.id).toBeUndefined();                          // create
  expect(sent[1].payload.id).toBe(990001);                             // then edit with the real id
  await expect(page.locator(".adm-row", { hasText: "NOWY TOR 2" })).toHaveCount(1);
});
