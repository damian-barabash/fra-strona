import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

/* Faktura VAT na firmę in the DANE step. The NIP look-up and the checkout are mocked (nothing reaches the
   MF register, the database or Tpay); the catalogue is read live, like the other tests. */
const ORDER = "00000000-0000-4000-8000-0000000000f1";
const rest = (request, q) => request.get(`${SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }).then((r) => r.json());
const MF = { ok: true, nip: "5260250274", company: "MINISTERSTWO FINANSÓW", vat_status: "Czynny", street: "ŚWIĘTOKRZYSKA 12", postal: "00-916", city: "WARSZAWA" };

async function mockApi(page) {
  const sent = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} });
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "nip.lookup") return route.fulfill({ json: body.payload?.nip === MF.nip ? MF : { ok: false, reason: "notfound" } });
    if (/^booking\.create/.test(body.action)) { sent.push(body); return route.fulfill({ json: { ok: false, error: "mock — stop before Tpay" } }); }
    return route.continue();
  });
  return sent;
}
const payer = async (scope) => {
  const inputs = scope.locator("input:not([type=checkbox]):not([type=number])");
  await inputs.nth(0).fill("Jan Testowy");
  await inputs.nth(1).fill("500600700");
  await inputs.nth(2).fill("jan@example.com");
};

test("direct purchase: NIP fills the company from the register, bad data blocks, the invoice goes to checkout", async ({ page, request }) => {
  const [prod] = await rest(request, "products?select=slug&visible=eq.true&buy_direct=eq.true&theme=neq.wyprawa&order=sort&limit=1");
  test.skip(!prod, "no direct-purchase product in the CMS");
  const sent = await mockApi(page);
  await page.goto(`/zakup?produkt=${prod.slug}`);
  await payer(page.locator(".zk-form"));

  const inv = page.locator(".inv");
  await expect(inv).toBeVisible();
  await expect(inv.locator(".inv-grid input").first()).not.toBeInViewport({ ratio: 0.5 });   // closed panel
  await inv.locator(".inv-toggle").click();
  await expect(inv).toHaveClass(/is-on/);

  // a NIP with a wrong checksum: message + the pay button refuses
  await inv.getByPlaceholder(/526-025-02-74/).fill("526-025-02-75");
  await expect(inv.locator(".inv-msg.is-bad")).toBeVisible();
  await page.locator(".zk-foot .btn--red").click();
  await expect(page.locator(".zk-err")).toContainText(/NIP/);

  // a good NIP → company + address from the register
  await inv.getByPlaceholder(/526-025-02-74/).fill("PL 526-025-02-74");
  await expect(inv.locator(".inv-msg.is-ok")).toBeVisible();
  const fields = inv.locator(".inv-grid input");
  await expect(fields.nth(1)).toHaveValue("MINISTERSTWO FINANSÓW");
  await expect(fields.nth(2)).toHaveValue("ŚWIĘTOKRZYSKA 12");
  await expect(fields.nth(3)).toHaveValue("00-916");
  await expect(fields.nth(4)).toHaveValue("WARSZAWA");

  // postal code formats itself
  await fields.nth(3).fill("02661");
  await expect(fields.nth(3)).toHaveValue("02-661");

  await page.locator(".zk-foot .btn--red").click();
  await expect.poll(() => sent.length, { timeout: 8000 }).toBe(1);
  expect(sent[0].payload.invoice).toEqual({ nip: "5260250274", company: "MINISTERSTWO FINANSÓW", street: "ŚWIĘTOKRZYSKA 12", postal: "02-661", city: "WARSZAWA" });
});

test("track configurator: invoice off = no invoice in checkout; on and incomplete = blocked", async ({ page, request }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [term] = await rest(request, `terms?select=id&visible=eq.true&date=gte.${today}&type=neq.ice&order=date&limit=1`);
  const [car] = await rest(request, "cars?select=id&visible=eq.true&category=eq.sport&order=sort&limit=1");
  test.skip(!term || !car, "no future term / car in the CMS");
  const sent = await mockApi(page);
  await page.goto(`/rezerwacja?car=${car.id}&term=${term.id}&sessions=3`);
  await page.locator(".rz-foot .btn--red").click();                   // PAKIET (preset) → PRODUKT
  await page.locator(".rz-foot .btn--red").click();                   // PRODUKT → DANE
  await payer(page.locator(".fl-form"));

  const inv = page.locator(".inv");
  await inv.locator(".inv-toggle").click();
  await inv.getByPlaceholder(/526-025-02-74/).fill("1234563218");    // valid checksum, not in the register
  await expect(inv.locator(".inv-msg.is-bad")).toBeVisible();
  await page.locator(".rz-foot .btn--red").click();
  await expect(page.locator(".rz-err")).toContainText(/nazwę firmy/i);

  await inv.locator(".inv-toggle").click();                           // changed their mind — no invoice
  await expect(inv).not.toHaveClass(/is-on/);
  await page.locator(".rz-foot .btn--red").click();
  await expect.poll(() => sent.length, { timeout: 8000 }).toBe(1);
  expect(sent[0].payload.invoice).toBeNull();
});
