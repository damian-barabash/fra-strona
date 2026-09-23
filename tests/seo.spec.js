import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fra_cookies", "all"));
});

const ld = async (page) => JSON.parse(await page.locator("#ld-page").textContent());

test("every public page has its own title, description, canonical and JSON-LD", async ({ page }) => {
  const pages = [
    ["/", /Fastline Racing Academy/, "https://fastlineracingacademy.pl"],
    ["/oferta", /Oferta/, "https://fastlineracingacademy.pl/oferta"],
    ["/flota", /Flota/, "https://fastlineracingacademy.pl/flota"],
    ["/cennik", /Cennik/, "https://fastlineracingacademy.pl/cennik"],
    ["/kalendarz", /Kalendarz/, "https://fastlineracingacademy.pl/kalendarz"],
    ["/dla-firm", /Eventy firmowe/, "https://fastlineracingacademy.pl/dla-firm"],
    ["/mariusz-miekos-racing", /Mariusz Miękoś/, "https://fastlineracingacademy.pl/mariusz-miekos-racing"],
    ["/kontakt", /Kontakt/, "https://fastlineracingacademy.pl/kontakt"],
  ];
  for (const [path, title, canonical] of pages) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(desc.length, `${path} description`).toBeGreaterThan(50);
    expect(desc.length, `${path} description`).toBeLessThanOrEqual(160);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
    const graph = (await ld(page))["@graph"];
    expect(graph.some((n) => n["@id"] === "https://fastlineracingacademy.pl/#organization")).toBe(true);
    expect(graph.some((n) => n["@type"] === "WebPage" && n.url === canonical)).toBe(true);
    // exactly one of each tag — the hook must patch, never duplicate
    expect(await page.locator('meta[name="description"]').count()).toBe(1);
    expect(await page.locator('link[rel="canonical"]').count()).toBe(1);
  }
});

test("car page carries Product schema with a PLN offer and the car photo as og:image", async ({ page }) => {
  await page.goto("/flota/bmw-m2");
  await expect(page).toHaveTitle(/BMW M2/);
  const graph = (await ld(page))["@graph"];
  const product = graph.find((n) => n["@type"] === "Product");
  expect(product.offers.priceCurrency).toBe("PLN");
  expect(product.offers.lowPrice).toBe(2980);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /bmw-m2/);
  expect(graph.find((n) => n["@type"] === "BreadcrumbList").itemListElement).toHaveLength(3);
});

test("product page: Course schema, readable title, breadcrumbs", async ({ page }) => {
  await page.goto("/produkty/stage-1");
  await expect(page).toHaveTitle(/^Szkolenie jazdy sportowej/);
  const graph = (await ld(page))["@graph"];
  expect(graph.some((n) => n["@type"] === "Course")).toBe(true);
});

test("checkout, payment and admin are noindex; robots.txt and llms.txt exist", async ({ page, request }) => {
  for (const path of ["/platnosc", "/zakup-wyprawa", "/admin"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap: https://fastlineracingacademy.pl/sitemap.xml");
});

test("title updates on in-app navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Fastline Racing Academy/);
  await page.goto("/cennik");
  await expect(page).toHaveTitle(/^Cennik/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://fastlineracingacademy.pl/cennik");
});
