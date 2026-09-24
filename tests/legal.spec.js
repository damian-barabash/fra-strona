import { test, expect } from "@playwright/test";
// the cookie bar is answered up-front so it never sits over a button under test
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

const DOCS = [
  { slug: "polityka-prywatnosci", title: /POLITYKA PRYWATNOŚCI/i, needle: "DEFINICJE" },
  { slug: "regulamin-platnosci", title: /REGULAMIN PŁATNOŚCI/i, needle: "Konsument" },
];

for (const d of DOCS) {
  test(`${d.slug} renders the parsed document under its own path`, async ({ page }) => {
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`/${d.slug}`);
    await page.waitForSelector(".lg-body");

    await expect(page.locator(".lg-head__title")).toHaveText(d.title);
    expect(await page.locator(".lg-body h2").count()).toBeGreaterThan(3);   // section headings
    await expect(page.locator(".lg-body")).toContainText(d.needle);
    await expect(page.locator(".lg-body")).toContainText(/Fastline/i);       // company details survived
    expect(errs, errs.join("\n")).toHaveLength(0);
  });
}

test("footer links to both legal documents", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".footer__legal");
  const links = page.locator(".footer__legal a");
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", "/polityka-prywatnosci");
  await expect(links.nth(1)).toHaveAttribute("href", "/regulamin-platnosci");

  // clicking one opens the document
  await links.nth(0).click();
  await expect(page).toHaveURL(/\/polityka-prywatnosci/);
  await expect(page.locator(".lg-body")).toBeVisible();
});

test("unknown paths go home, old WordPress paths land on the matching page", async ({ page }) => {
  await page.goto("/blabla");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".hero")).toBeVisible();
  await page.goto("/eventy-firmowe/");
  await expect(page).toHaveURL(/\/dla-firm$/);
  await page.goto("/samochody/");
  await expect(page).toHaveURL(/\/flota$/);
  await page.goto("/produkt/mercedes-a45-amg/");
  await expect(page).toHaveURL(/\/oferta$/);
  await page.goto("/oferta/");   // a trailing slash is not an error
  await expect(page.locator(".pp").first()).toBeVisible();
});
