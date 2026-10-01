import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

/* Hidden rows stay in the panel (they used to vanish from the list while still holding their slug),
   and the page address is checked while it is typed. Nothing is written: saves are intercepted and the
   panel's "all rows" answer is the live product list plus one made-up hidden product. */
const HIDDEN = { id: "00000000-0000-4000-8000-00000000aaaa", slug: "ukryty-test", title_pl: "UKRYTY TEST", code: "TEST", theme: "default", visible: false, sort: 999 };

test.beforeEach(async ({ page, request }) => {
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} });
  const live = await (await request.get(`${SUPABASE_URL}/rest/v1/products?select=*&order=sort`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } })).json();
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "tables.all") return route.fulfill({ json: { ok: true, tables: { products: [...live, HIDDEN] } } });
    if (/\.(upsert|delete|reorder)$/.test(body.action || "")) return route.fulfill({ json: { ok: false, error: "blocked in test" } });
    return route.continue();
  });
  // a product only the database knows about (added by another admin a moment ago)
  await page.route(/\/rest\/v1\/products\?.*slug=eq\.tylko-w-bazie/, (route) => route.fulfill({ json: [{ id: "00000000-0000-4000-8000-00000000bbbb", title_pl: "Z BAZY", visible: false }] }));
});

async function openProducts(page, isMobile) {
  await page.goto("/admin");
  await page.fill('input[placeholder="Login"]', "admin");
  await page.fill('input[placeholder="Hasło"]', "fastline2026");
  await page.locator(".adm-login__box .adm-btn--red").click();
  await expect(page.locator(".adm-side")).toBeVisible({ timeout: 8000 });
  if (isMobile) await page.locator(".adm-burger").click();
  await page.locator(".adm-nav", { hasText: /^Produkty/ }).click();
  await expect(page.locator(".adm-row").first()).toBeVisible();
}

test("a hidden product stays in the panel list, but not on the site", async ({ page, isMobile }) => {
  await openProducts(page, isMobile);
  const row = page.locator(".adm-row", { hasText: "UKRYTY TEST" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("ukryte");
  await page.goto("/oferta");
  await expect(page.locator("main")).toContainText(/MONACO/i);
  await expect(page.locator("body")).not.toContainText("UKRYTY TEST");
});

test("page address is normalised and checked while typing; a taken one blocks saving", async ({ page, isMobile }) => {
  await openProducts(page, isMobile);
  await page.locator(".adm-btn--red", { hasText: "Dodaj" }).click();
  const slug = page.locator(".adm-slug input");
  const status = page.locator(".adm-slug__st");
  const save = page.locator(".adm-form .adm-btn--red", { hasText: "Zapisz" });
  await expect(save).toBeDisabled();                                   // no address yet

  // the address follows the name — and the name of the hidden product gives a taken address
  await page.locator(".adm-form__body > label.adm-f input").nth(1).fill("Ukryty Test");
  await expect(slug).toHaveValue("ukryty-test");
  await expect(status).toContainText("zajęty");
  await expect(status).toContainText("UKRYTY TEST");
  await expect(status).toContainText("ukryty");
  await expect(save).toBeDisabled();

  await slug.fill("Zażółć Gęślą 2027!");
  await expect(slug).toHaveValue("zazolc-gesla-2027-");
  await expect(status).toContainText("/produkty/zazolc-gesla-2027");
  await expect(status).toContainText("wolny");
  await expect(save).toBeEnabled();

  await slug.fill("monaco");                                           // a visible product
  await expect(status).toContainText("zajęty");
  await expect(save).toBeDisabled();

  await slug.fill("tylko-w-bazie");                                    // known to the database only
  await expect(status).toContainText("Z BAZY");
  await expect(save).toBeDisabled();

  // "open the existing one" jumps to the product that holds the address
  await slug.fill("ukryty-test");
  await page.locator(".adm-slug__open").click();
  await expect(page.locator(".adm-form__head h3")).toHaveText(/Edytuj/i);
  await expect(status).toContainText("wolny");
  await expect(save).toBeEnabled();
});
