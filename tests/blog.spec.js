import { test, expect } from "@playwright/test";

/* Blog: the wall, an article, its SEO, and the panel's rich editor. Posts are mocked (the `posts` table
   answers from this file) and the panel talks to a fake admin-api — the database is never touched. */
const BODY = [
  "<p>Każdy zakręt składa się z trzech punktów. <strong>Opanowanie ich</strong> to pierwszy krok do szybkiej jazdy.</p>",
  "<h2>Punkt hamowania</h2>",
  '<p>Sprawdź <a href="/kalendarz">najbliższe terminy</a> i przyjedź na tor.</p>',
  "<ul><li>Wzrok daleko przed auto</li><li>Płynne ruchy kierownicą</li></ul>",
  "<blockquote>Wolno wejść, szybko wyjść.</blockquote>",
  '<figure class="rt-fig"><img src="/assets/mariusz/photo1.webp" alt="Mariusz Miękoś na torze" onerror="window.__xss=1"><figcaption>Fot. Fastline</figcaption></figure>',
  '<p class="rt-cta"><a class="rt-btn" href="/rezerwacja">Zarezerwuj termin</a></p>',
  "<script>window.__xss=1</script>",
  '<p><a href="javascript:window.__xss=1">zły link</a></p>',
].join("\n");
const post = (i, over = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, slug: `wpis-testowy-${i}`, title_pl: `Wpis testowy ${i}`, title_en: `Test post ${i}`,
  tag_pl: i % 2 ? "TECHNIKA JAZDY" : "RELACJE", tag_en: null, excerpt_pl: `Zajawka wpisu ${i} — krótko o tym, co w środku.`, excerpt_en: null,
  cover: "/assets/mariusz/photo2.webp", cover_alt: "Okładka", author: "Mariusz Miękoś", published_at: `2026-09-0${i}`, reading_min: 3,
  visible: true, sort: 0, created_at: `2026-09-0${i}T10:00:00+00:00`, updated_at: `2026-09-1${i}T10:00:00+00:00`, ...over,
});
const POSTS = [5, 4, 3, 2, 1].map((i) => post(i));

async function mockPosts(page, posts = POSTS) {
  await page.route("**/rest/v1/posts*", (route) => {
    const u = new URL(route.request().url());
    const slug = (u.searchParams.get("slug") || "").replace(/^eq\./, "");
    if (slug) return route.fulfill({ json: posts.filter((p) => p.slug === slug).map((p) => ({ ...p, body_pl: BODY, body_en: null, seo_title: null, seo_desc: null })) });
    return route.fulfill({ json: posts });
  });
}
const watch = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
};

test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem("fra_cookies", "all"); } catch {} }); });

test("menu has BLOG between KALENDARZ and KONTAKT and it opens the blog", async ({ page, isMobile }) => {
  await mockPosts(page);
  await page.goto("/");
  await page.waitForTimeout(1000);
  const scope = isMobile ? ".mobile-menu" : ".nav__menu";
  if (isMobile) await page.locator(".nav__burger").click();
  const labels = (await page.locator(`${scope} > a`).allTextContents()).map((x) => x.replace(/[›\s]+$/g, "").trim().toUpperCase());
  const i = labels.indexOf("BLOG");
  expect(i).toBeGreaterThan(0);
  expect(labels[i - 1]).toBe("KALENDARZ");
  expect(labels[i + 1]).toBe("KONTAKT");
  await page.locator(`${scope} > a`, { hasText: "BLOG" }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator(".bl-head__title")).toBeVisible({ timeout: 10000 });
  if (!isMobile) {
    // the whole menu stays inside the page container
    const over = await page.evaluate(() => { const m = document.querySelector(".nav__inner"); return document.querySelector(".nav__right").getBoundingClientRect().right - (m.getBoundingClientRect().right - parseFloat(getComputedStyle(m).paddingRight)); });
    expect(over).toBeLessThanOrEqual(1);
  }
});

test("blog wall: newest post featured, cards, category filter, no errors", async ({ page }) => {
  const errors = watch(page);
  await mockPosts(page);
  await page.goto("/blog");
  await expect(page.locator(".bl-feat__title")).toHaveText(/Wpis testowy 5/i);
  await expect(page.locator(".bl-card")).toHaveCount(4);
  await page.locator(".bl-card").first().scrollIntoViewIfNeeded();
  await expect(page.locator(".bl-card").first()).toHaveClass(/\bin\b/);            // the card slides in when reached
  await expect(page.locator(".bl-card").first()).toHaveAttribute("href", "/blog/wpis-testowy-4");

  await page.locator(".bl-chip", { hasText: "RELACJE" }).click();
  await expect(page.locator(".bl-feat")).toHaveCount(0);
  await expect(page.locator(".bl-card")).toHaveCount(2);
  await page.locator(".bl-card").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".bl-card.in")).toHaveCount(2);

  await expect(page).toHaveTitle(/^Blog — .* \| Fastline Racing Academy$/);
  const ld = JSON.parse(await page.locator("#ld-page").textContent());
  const blog = ld["@graph"].find((n) => n["@type"] === "Blog");
  expect(blog.blogPost).toHaveLength(5);
  expect(await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; })).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("article: rich content rendered safely, article SEO, internal link goes through the router", async ({ page }) => {
  const errors = watch(page);
  await mockPosts(page);
  await page.goto("/blog/wpis-testowy-3");
  await expect(page.locator(".bp-hero__title")).toHaveText(/Wpis testowy 3/i);
  const body = page.locator(".bp-body");
  await expect(body.locator("h2")).toHaveText("Punkt hamowania");
  await expect(body.locator("li")).toHaveCount(2);
  await expect(body.locator("blockquote")).toBeVisible();
  await expect(body.locator("figure img")).toHaveAttribute("alt", "Mariusz Miękoś na torze");
  await expect(body.locator("a.rt-btn")).toHaveAttribute("href", "/rezerwacja");
  // nothing executable survives: no script, no inline handler, no javascript: link
  expect(await body.locator("script").count()).toBe(0);
  expect(await body.locator("[onerror]").count()).toBe(0);
  expect(await body.locator('a[href^="javascript"]').count()).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  await expect(page).toHaveTitle("Wpis testowy 3 | Fastline Racing Academy");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://fastlineracingacademy.pl/blog/wpis-testowy-3");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute("content", "2026-09-03");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  const ld = JSON.parse(await page.locator("#ld-page").textContent());
  const art = ld["@graph"].find((n) => n["@type"] === "BlogPosting");
  expect(art.headline).toBe("Wpis testowy 3");
  expect(art.datePublished).toBe("2026-09-03");
  expect(art.author.name).toBe("Mariusz Miękoś");
  expect(ld["@graph"].some((n) => n["@type"] === "BreadcrumbList")).toBe(true);

  // older / newer neighbours and "read next"
  await expect(page.locator(".bp-nav__item").first()).toHaveAttribute("href", "/blog/wpis-testowy-2");
  await expect(page.locator(".bp-also .bl-card")).toHaveCount(3);

  await body.locator('a[href="/kalendarz"]').click();
  await expect(page).toHaveURL(/\/kalendarz$/);
  // leaving the article drops its article:* meta
  await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0, { timeout: 10000 });
  expect(await page.evaluate(() => { window.scrollTo(400, 0); return window.scrollX; })).toBe(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("unknown post: a noindex 'not found' page with a way back", async ({ page }) => {
  await mockPosts(page);
  await page.goto("/blog/nie-ma-takiego");
  await expect(page.locator(".bp-404 h1")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.locator(".bp-404 .btn").click();
  await expect(page).toHaveURL(/\/blog$/);
});

/* ---- panel ---- */
async function mockPanel(page, posts) {
  const sent = [];
  await page.addInitScript(() => { try { localStorage.setItem("fra_admin_token", "test-token"); } catch {} });
  await page.route("**/functions/v1/admin-auth", (route) => route.fulfill({ json: { ok: true, admin: { id: "a1", login: "test", name: "Tester", role: "owner", perms: {} } } }));
  await page.route("**/functions/v1/admin-api", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.action === "tables.all") return route.fulfill({ json: { ok: true, tables: { posts } } });
    if (body.action === "media.upload") return route.fulfill({ json: { ok: true, url: "/assets/mariusz/photo1.webp" } });
    if (body.action === "posts.upsert") { sent.push(body.payload); return route.fulfill({ json: { ok: true, row: { ...body.payload, id: body.payload.id || "00000000-0000-4000-8000-0000000000aa" } } }); }
    if (/^(stats|me)$/.test(body.action)) return route.fulfill({ json: { ok: true, months: [], byKind: {}, recent: [], messages: {} } });
    return route.fulfill({ json: { ok: true, rows: [] } });
  });
  return sent;
}

test("panel: a post is written with the rich editor and saved as clean HTML", async ({ page, isMobile }) => {
  test.skip(isMobile, "the editor is exercised with a keyboard on desktop");
  const errors = watch(page);
  await mockPosts(page, []);
  const sent = await mockPanel(page, []);
  await page.goto("/admin");
  await page.locator(".adm-nav", { hasText: /^Blog$/ }).click();
  await page.locator("button", { hasText: "+ Nowy wpis" }).click();

  await page.locator(".blg-title").fill("Pierwszy wpis na blogu");
  await expect(page.locator(".adm-slug input")).toHaveValue("pierwszy-wpis-na-blogu");     // the address follows the title
  await page.locator(".rte__area").click();
  await page.keyboard.type("Akapit wstępu.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Nagłówek");
  await page.locator('.rte__b[title^="Nagłówek duży"]').dispatchEvent("mousedown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Zobacz kalendarz");
  await page.keyboard.down("Shift"); for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowLeft"); await page.keyboard.up("Shift");
  await page.locator('.rte__b[title^="Pogrubienie"]').dispatchEvent("mousedown");
  await page.locator('.rte__b[title^="Link"]').dispatchEvent("mousedown");
  await page.locator(".rte__in--url").fill("/kalendarz");
  await page.keyboard.press("Enter");
  await page.keyboard.type("już dziś.");
  // a photo, a button and a video
  await page.locator(".rte input[type=file]").setInputFiles("public/assets/mariusz/photo1.webp");
  await expect(page.locator(".rte__area figure img")).toBeVisible({ timeout: 20000 });
  await page.locator(".rte__area figure").click();
  await page.locator(".rte__dlg--fig input").first().fill("Auto na torze");
  await page.locator(".rte__dlg--fig button", { hasText: "Gotowe" }).click();
  await page.locator(".rte__area > p").last().click();
  await page.locator('.rte__b[title="Wstaw przycisk"]').dispatchEvent("mousedown");
  await page.locator(".rte__dlg input").first().fill("Kup szkolenie");
  await page.locator(".rte__in--url").fill("www.example.com/oferta");
  await page.locator(".rte__dlg button", { hasText: "Wstaw" }).click();
  await page.locator('.rte__b[title^="Wstaw film"]').dispatchEvent("mousedown");
  await page.locator(".rte__in--url").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.locator(".rte__dlg button", { hasText: "Wstaw" }).click();

  // draft first: nothing public yet
  await page.locator(".blg-top button", { hasText: "Zapisz szkic" }).click();
  await expect(page.locator(".blg-saved")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0].visible).toBe(false);
  expect(sent[0].id).toBeUndefined();

  await page.locator(".blg-top button", { hasText: "Opublikuj" }).click();
  await expect.poll(() => sent.length).toBe(2);
  const p = sent[1];
  expect(p.id).toBe("00000000-0000-4000-8000-0000000000aa");                               // the second save updates the same post
  expect(p.visible).toBe(true);
  expect(p.slug).toBe("pierwszy-wpis-na-blogu");
  const blocks = p.body_pl.split("\n");
  expect(blocks[0]).toBe("<p>Akapit wstępu.</p>");
  expect(blocks[1]).toBe("<h2>Nagłówek</h2>");
  expect(blocks[2]).toMatch(/^<p>Zobacz <strong><a href="\/kalendarz">kalendarz<\/a><\/strong> już dziś\.<\/p>$/);
  expect(p.body_pl).toMatch(/<figure class="rt-fig"><img [^>]*alt="Auto na torze"/);
  expect(p.body_pl).toContain('<p class="rt-cta"><a class="rt-btn" href="https://www.example.com/oferta" target="_blank" rel="noopener noreferrer">Kup szkolenie</a></p>');
  expect(p.body_pl).toContain('<figure class="rt-video"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
  expect(blocks.every((b) => /^<(p|h2|h3|h4|ul|ol|blockquote|figure|hr)[ >]/.test(b))).toBe(true);   // one block per line
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("panel: drafts and scheduled posts are listed with their state; the site shows only published ones", async ({ page, isMobile }) => {
  const all = [post(1), post(2, { visible: false }), post(3, { published_at: "2099-01-01" })];
  await mockPosts(page, [post(1)]);
  await mockPanel(page, all);
  await page.goto("/admin");
  if (isMobile) await page.locator(".adm-burger").click();
  await page.locator(".adm-nav", { hasText: /^Blog$/ }).click();
  await expect(page.locator(".blg-row")).toHaveCount(3);
  await expect(page.locator(".blg-row", { hasText: "Wpis testowy 2" })).toContainText("Szkic");
  await expect(page.locator(".blg-row", { hasText: "Wpis testowy 3" })).toContainText("Zaplanowany");
  await expect(page.locator(".blg-row", { hasText: "Wpis testowy 1" })).toContainText("Opublikowany");
  // the same session on the public wall: only the published post
  await page.goto("/blog");
  await expect(page.locator(".bl-feat__title")).toHaveText(/Wpis testowy 1/i);
  await expect(page.locator(".bl-card")).toHaveCount(0);
  // …while the admin can preview the draft, marked as such and kept out of Google
  await page.goto("/blog/wpis-testowy-2");
  await expect(page.locator(".bp-draft")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
