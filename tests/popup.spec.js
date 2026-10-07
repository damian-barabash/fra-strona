import { test, expect } from "@playwright/test";

/* Advertising pop-up: when the site shows it, how closing behaves across visits, and the panel's
   editor. The `popups` table and admin-api answer from this file — the database is never touched.
   Automated browsers never get the pop-up on their own, so the tests ask for it (`fra_popup_force`). */
const POPUP = {
  id: "00000000-0000-4000-8000-0000000000b1", name: "Laponia — test", active: true, delay_sec: 1, pages: "all", date_from: null, date_to: null, layout: "left",
  image: "/assets/laponia/ice1.webp", image_mobile: "", image_alt: "Alpine na lodzie", color: "#14161a", btn_color: "#e30613",
  eyebrow_pl: "TYLKO DO KOŃCA MIESIĄCA", eyebrow_en: null, title_pl: "LAPONIA 2027 — OSTATNIE MIEJSCA", title_en: null,
  body_pl: '<p>Trzy dni jazdy po lodzie. <strong>Zostało kilka miejsc.</strong></p>\n<p onclick="window.__xss=1">Sprawdź <a href="javascript:window.__xss=1">szczegóły</a>.</p>', body_en: null,
  btn_label_pl: "SPRAWDŹ TERMINY", btn_label_en: null, btn_url: "/kalendarz", btn_blank: false, views: 12, clicks: 3, sort: 0, updated_at: "2026-10-07T10:00:00+00:00",
};
const watch = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
};
async function mockSite(page, rows = [POPUP], { force = true } = {}) {
  const hits = [];
  await page.addInitScript((f) => { try { localStorage.setItem("fra_cookies", "all"); if (f) localStorage.setItem("fra_popup_force", "1"); } catch {} }, force);
  await page.route("**/rest/v1/popups*", (route) => route.fulfill({ json: rows }));
  await page.route("**/rest/v1/rpc/popup_hit*", (route) => { hits.push(JSON.parse(route.request().postData() || "{}").p_kind); return route.fulfill({ status: 204, body: "" }); });
  return hits;
}
const card = (page) => page.locator(".apop:not(.apop--embed) .apop__card");

test("the pop-up appears after its delay, keeps 15 % free on a desktop, and closing lasts for the visit", async ({ page, isMobile }) => {
  const errors = watch(page);
  const hits = await mockSite(page);
  await page.goto("/");
  await expect(card(page)).toBeHidden();                       // not at once
  await expect(card(page)).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".apop__title")).toHaveText("LAPONIA 2027 — OSTATNIE MIEJSCA");
  await expect(page.locator(".apop__btn")).toHaveAttribute("href", "/kalendarz");
  await page.waitForTimeout(900);
  const box = await card(page).boundingBox();
  const vp = page.viewportSize();
  if (!isMobile) {
    expect(Math.abs(box.x - vp.width * 0.15)).toBeLessThan(2);
    expect(Math.abs(box.y - vp.height * 0.15)).toBeLessThan(2);
    expect(Math.abs(box.width - vp.width * 0.7)).toBeLessThan(2);
    expect(Math.abs(box.height - vp.height * 0.7)).toBeLessThan(2);
  } else {
    expect(box.x).toBeGreaterThanOrEqual(10);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width - 10);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  }
  // the text fits its block, and nothing unsafe survives from the editor's HTML
  expect(await page.locator(".apop__panel").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  expect(await page.locator(".apop__body a").count()).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(hits).toEqual(["view"]);

  await page.locator(".apop__x").click();
  await expect(card(page)).toBeHidden();
  // same visit: another page, a reload — it stays closed
  await page.goto("/kontakt");
  await page.waitForTimeout(2500);
  await expect(card(page)).toBeHidden();
  expect(hits).toEqual(["view"]);
  expect(errors).toEqual([]);
});

test("a new visit shows it again — unless it starts within 5 minutes of the previous one", async ({ page }) => {
  await mockSite(page);
  await page.goto("/");
  await expect(card(page)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press("Escape");
  await expect(card(page)).toBeHidden();

  // the tab is closed and the site opened again right away: still the same visit
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(card(page)).toBeHidden();

  // …and again after more than 5 minutes: a new visit, the pop-up is back
  await page.evaluate(() => { sessionStorage.clear(); const k = "fra_popup_last"; const v = JSON.parse(localStorage.getItem(k)); v.at -= 6 * 60 * 1000; localStorage.setItem(k, JSON.stringify(v)); });
  // the page writes its last sign of life while it unloads — put the old stamp back before the next load
  const old = await page.evaluate(() => localStorage.getItem("fra_popup_last"));
  await page.addInitScript((v) => { if (!sessionStorage.getItem("t_once")) { sessionStorage.setItem("t_once", "1"); localStorage.setItem("fra_popup_last", v); } }, old);
  await page.reload();
  await expect(card(page)).toBeVisible({ timeout: 8000 });
});

test("the button leads to its page and counts as closing; checkout pages stay free of adverts", async ({ page }) => {
  const hits = await mockSite(page);
  await page.goto("/rezerwacja");
  await page.waitForTimeout(2600);
  await expect(card(page)).toBeHidden();                       // never in the configurator
  await page.goto("/cennik");
  await expect(card(page)).toBeVisible({ timeout: 8000 });
  await page.locator(".apop__btn").click();
  await expect(page).toHaveURL(/\/kalendarz$/);
  await expect(card(page)).toBeHidden();
  expect(hits).toEqual(["view", "click"]);
});

test("search engines and automated browsers do not get the pop-up; an ended campaign is off", async ({ page }) => {
  await mockSite(page, [POPUP], { force: false });
  await page.goto("/");
  await page.waitForTimeout(2600);
  await expect(card(page)).toBeHidden();
  await page.evaluate(() => localStorage.setItem("fra_popup_force", "1"));
  await page.route("**/rest/v1/popups*", (route) => route.fulfill({ json: [{ ...POPUP, date_to: "2026-01-01" }] }));
  await page.reload();
  await page.waitForTimeout(2600);
  await expect(card(page)).toBeHidden();
});

/* ---- panel ---- */
async function mockPanel(page, rows) {
  const sent = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); localStorage.setItem("fra_admin_token", "test-token"); } catch {} });
  await page.route("**/rest/v1/popups*", (route) => route.fulfill({ json: rows.filter((r) => r.active) }));
  await page.route("**/functions/v1/admin-auth", (route) => route.fulfill({ json: { ok: true, admin: { id: "a1", login: "test", name: "Tester", role: "owner", perms: {} } } }));
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "tables.all") return route.fulfill({ json: { ok: true, tables: { popups: rows } } });
    if (body.action === "media.upload") return route.fulfill({ json: { ok: true, url: "/assets/laponia/ice2.webp" } });
    if (body.action === "popups.upsert") { sent.push(body.payload); return route.fulfill({ json: { ok: true, row: { ...body.payload, id: body.payload.id || "00000000-0000-4000-8000-0000000000b9" } } }); }
    if (/^(stats|me)$/.test(body.action)) return route.fulfill({ json: { ok: true, months: [], byKind: {}, recent: [], messages: {} } });
    return route.fulfill({ json: { ok: true, rows: [] } });
  });
  return sent;
}

test("panel: a pop-up is written with limits, previewed live and only one stays switched on", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is exercised with a keyboard on desktop");
  const errors = watch(page);
  const second = { ...POPUP, id: "00000000-0000-4000-8000-0000000000b2", name: "Heels — test", title_pl: "HEELS ON THE TRACK", active: false, views: 0, clicks: 0 };
  const sent = await mockPanel(page, [POPUP, second]);
  await page.goto("/admin");
  await page.locator(".adm-nav", { hasText: "Pop-up reklamowy" }).click();
  await expect(page.locator(".pop-item")).toHaveCount(2);
  await expect(page.locator(".pop-item.is-on")).toHaveCount(1);
  await expect(page.locator(".pop-item.is-on .pop-item__stats")).toContainText("25%");   // 3 clicks of 12 views

  // full-screen preview from the list: the real pop-up, closed with its cross
  await page.locator(".pop-item").nth(1).locator("button", { hasText: "Podgląd" }).last().click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator(".apop__title")).toHaveText("HEELS ON THE TRACK");
  await page.locator(".apop:not(.apop--embed) .apop__x").click();
  await expect(card(page)).toBeHidden();

  // switching the second one on switches the first one off
  page.once("dialog", (d) => d.accept());
  await page.locator(".pop-item").nth(1).locator("button", { hasText: /^Włącz$/ }).click();
  await expect(page.locator(".pop-item.is-on")).toHaveCount(1);
  await expect(page.locator(".pop-item.is-on")).toContainText("Heels — test");
  expect(sent.at(-1)).toMatchObject({ id: second.id, active: true });

  // a new one
  await page.locator("button", { hasText: "+ Nowy pop-up" }).click();
  const title = page.locator(".pop-title");
  await title.fill("X".repeat(80));
  expect((await title.inputValue()).length).toBe(48);                                 // the title has a hard limit
  await title.fill("ZIMOWA PROMOCJA");
  await expect(page.locator(".pop-prev .apop__title")).toHaveText("ZIMOWA PROMOCJA"); // live preview follows the form
  await page.locator(".rte__area").click();
  await page.keyboard.insertText("a".repeat(299));
  await page.keyboard.type("bcd");                                                    // typing stops at 300 characters
  await expect(page.locator(".rte__limit")).toContainText("300/300");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Rabat na pakiety 6 i 9 sesji.");
  await expect(page.locator(".pop-prev .apop__body")).toHaveText("Rabat na pakiety 6 i 9 sesji.");
  await expect(page.locator(".rte__b[title^='Wstaw zdjęcie']")).toHaveCount(0);       // no photos / video inside the text

  await page.locator("input[placeholder^='np. SPRAWDŹ']").fill("ZOBACZ CENNIK");
  await page.locator("button", { hasText: "Zapisz i włącz" }).click();
  await expect(page.locator(".blg-err")).toContainText("nie ma adresu");              // a button needs a target
  await page.locator(".pop select.adm-select").first().selectOption("/cennik");
  await page.locator(".pop-layout--right").click();
  await expect(page.locator(".pop-prev .apop")).toHaveAttribute("data-layout", "text"); // no photo yet → text-only block
  await page.locator(".adm-chip", { hasText: /^10 s$/ }).click();
  await page.locator(".adm-chip", { hasText: "Telefon" }).click();
  await expect(page.locator(".pop-prev--mobile .apop__card")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.locator("button", { hasText: "Zapisz i włącz" }).click();
  await expect(page.locator(".blg-saved")).toBeVisible();
  expect(sent.at(-1)).toMatchObject({ title_pl: "ZIMOWA PROMOCJA", name: "ZIMOWA PROMOCJA", body_pl: "<p>Rabat na pakiety 6 i 9 sesji.</p>", btn_label_pl: "ZOBACZ CENNIK", btn_url: "/cennik", layout: "right", delay_sec: 10, active: true });

  await page.locator("button", { hasText: "‹ Lista pop-upów" }).click();
  await expect(page.locator(".pop-item")).toHaveCount(3);
  await expect(page.locator(".pop-item.is-on")).toHaveCount(1);
  await expect(page.locator(".pop-item.is-on")).toContainText("ZIMOWA PROMOCJA");
  expect(errors).toEqual([]);
});
