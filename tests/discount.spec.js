import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

/* Kody rabatowe. The public check and the checkout are mocked (nothing reaches the database or Tpay);
   the catalogue (products, Laponia packages) is read live, like the other tests. */
const ORDER = "00000000-0000-4000-8000-0000000000d1";
const rest = (request, q) => request.get(`${SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }).then((r) => r.json());

const AMOUNT = { code: "LATO-100", kind: "amount", value_type: "amount", value: 100, target: null, valid_to: null, label: "", url: "" };

async function mockApi(page, codes) {
  const sent = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} });
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "discount.check") {
      const c = codes[String(body.payload?.code || "").toUpperCase()];
      return route.fulfill({ json: c ? { ok: true, eur_pln: 4.35, code: c } : { ok: false, reason: "notfound", error: "Nie znamy takiego kodu." } });
    }
    if (/^booking\.create/.test(body.action)) { sent.push(body); return route.fulfill({ json: { ok: true, id: ORDER, number: 77, paid: true, free: true } }); }
    if (body.action === "booking.status") {
      return route.fulfill({ json: { ok: true, order: { id: ORDER, number: 77, kind: "product", status: "paid", total: 999, total_gross: 1228.77, currency: "PLN", amount_pln: 1128.77, discount_code: "LATO-100", discount_pln: 100, car_name: "Race Taxi", email: "jan@example.com" } } });
    }
    return route.continue();
  });
  return sent;
}

test("amount code on a direct purchase: timing board → price drops by 100 zł → the code goes to the checkout", async ({ page, request }) => {
  const [prod] = await rest(request, "products?select=slug,price,packages_pl&visible=eq.true&buy_direct=eq.true&theme=neq.wyprawa&order=sort&limit=1");
  test.skip(!prod, "no direct-purchase product in the CMS");
  const sent = await mockApi(page, { "LATO-100": AMOUNT });
  await page.goto(`/zakup?produkt=${prod.slug}`);

  const field = page.locator(".dsc--strip");
  await expect(field).toBeVisible();
  await field.locator("input").fill("nope 1");
  await field.locator(".dsc-form__btn").click();
  await expect(field.locator(".dsc-board")).toBeVisible();                       // sectors run
  await expect(field.locator(".dsc-msg--err")).toBeVisible({ timeout: 5000 });

  const before = await page.locator(".zk-foot .btn--red").innerText();
  await field.locator("input").fill("lato-100");
  await expect(field.locator("input")).toHaveValue("LATO-100");                   // typed in upper case
  await field.locator(".dsc-form__btn").click();
  await expect(field.locator('.dsc-board[data-state="purple"]')).toBeVisible({ timeout: 5000 });
  await expect(field.locator(".dsc-ticket")).toContainText("LATO-100", { timeout: 5000 });
  await expect(page.locator(".dsc-lines")).toContainText("−100,00 zł");
  await expect(page.locator(".zk-foot .btn--red")).not.toHaveText(before);

  await page.fill(".zk-form input >> nth=0", "Jan Test");
  await page.fill(".zk-form input >> nth=1", "600600600");
  await page.fill(".zk-form input[type=email]", "jan@example.com");
  await page.locator(".zk-foot .btn--red").click();
  await expect(page).toHaveURL(/\/platnosc\?order=/, { timeout: 8000 });
  expect(sent[0].payload.discount_code).toBe("LATO-100");
  await expect(page.locator(".pl-receipt")).toContainText("LATO-100");
  expect(await page.evaluate(() => sessionStorage.getItem("fra_kod"))).toBeNull();  // spent — forgotten
});

test("a product code typed in another configurator takes the customer to its own, preset", async ({ page, request }) => {
  const [pkg] = await rest(request, "ice_packages?select=id,name_pl,days&visible=eq.true&order=sort&limit=1");
  test.skip(!pkg, "no Laponia package in the CMS");
  const code = { code: "LAPONIA-1", kind: "product", value_type: "full", value: 0, target: { kind: "ice", package_id: pkg.id }, valid_to: null,
    label: `Laponia · ${pkg.name_pl}`, url: `/rezerwacja-ice?pkg=${pkg.id}&kod=LAPONIA-1` };
  await mockApi(page, { "LAPONIA-1": code });
  await page.goto("/voucher");
  const field = page.locator(".dsc--strip");
  await field.locator("input").fill("LAPONIA-1");
  await field.locator(".dsc-form__btn").click();
  await expect(field.locator(".dsc-msg--go")).toContainText("Laponia", { timeout: 5000 });
  await expect(page).toHaveURL(new RegExp(`/rezerwacja-ice\\?pkg=${pkg.id}&kod=LAPONIA-1`), { timeout: 8000 });
  // arrives on the date step with the package chosen and the code checked again
  await expect(page.locator(".ri-head__title")).toContainText(pkg.name_pl);
  await expect(page.locator(".dsc--strip .dsc-ticket")).toContainText("LAPONIA-1", { timeout: 6000 });
  await expect(page.locator(".dsc--strip .dsc-ticket__val")).toContainText(/cały produkt/i);
});

test("an amount code entered before choosing says what to choose first", async ({ page }) => {
  await mockApi(page, { "LATO-100": AMOUNT });
  await page.goto("/rezerwacja");
  const field = page.locator(".dsc--strip");
  await field.locator("input").fill("LATO-100");
  await field.locator(".dsc-form__btn").click();
  await expect(field.locator(".dsc-ticket")).toBeVisible({ timeout: 6000 });
  await expect(field.locator(".dsc-msg")).toContainText(/najpierw wybierz auto, termin i pakiet/i);
  await expect(page.locator(".rz-chip--disc")).toContainText("LATO-100");
  // the code stays for the visit; removing it clears the field
  await page.reload();
  await expect(page.locator(".dsc--strip .dsc-ticket")).toBeVisible({ timeout: 6000 });
  await page.locator(".dsc-ticket__x").click();
  await expect(page.locator(".dsc--strip input")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("fra_kod"))).toBeNull();
});

test("percent code on a direct purchase: −10% of the whole gross amount", async ({ page, request }) => {
  const [prod] = await rest(request, "products?select=slug&visible=eq.true&buy_direct=eq.true&theme=neq.wyprawa&order=sort&limit=1");
  test.skip(!prod, "no direct-purchase product in the CMS");
  const PCT = { code: "JESIEN-10", kind: "amount", value_type: "percent", value: 10, target: null, valid_to: null, label: "", url: "" };
  const sent = await mockApi(page, { "JESIEN-10": PCT });
  await page.goto(`/zakup?produkt=${prod.slug}`);

  const field = page.locator(".dsc--strip");
  await field.locator("input").fill("jesien-10");
  await field.locator(".dsc-form__btn").click();
  await expect(field.locator(".dsc-ticket")).toContainText("−10%", { timeout: 6000 });
  const lines = page.locator(".dsc-lines");
  await expect(lines).toBeVisible();
  await page.waitForTimeout(1200);                                               // the price finishes counting down
  const money = (s) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
  const off = money(await lines.locator(".dsc-lines__off").innerText());
  const toPay = money(await lines.locator(".dsc-lines__pay b").innerText());
  expect(off).toBeGreaterThan(0);
  expect(Math.abs(off - Math.round((off + toPay) * 10) / 100)).toBeLessThanOrEqual(0.01);   // 10% of the gross total

  await page.fill(".zk-form input >> nth=0", "Jan Test");
  await page.fill(".zk-form input >> nth=1", "600600600");
  await page.fill(".zk-form input[type=email]", "jan@example.com");
  await page.locator(".zk-foot .btn--red").click();
  await expect(page).toHaveURL(/\/platnosc\?order=/, { timeout: 8000 });
  expect(sent[0].payload.discount_code).toBe("JESIEN-10");
});
