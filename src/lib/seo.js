import { useEffect } from "react";

/* Per-page SEO: title, description, canonical, Open Graph, Twitter, robots and JSON-LD.
   No dependency — we patch <head> directly, so the same tags exist in the prerendered snapshot
   (scripts/postbuild.mjs) that non-JS crawlers and chat bots read, and in the live app for Google. */

export const SITE = "https://fastlineracingacademy.pl";
export const BRAND = "Fastline Racing Academy";
export const OG_DEFAULT = `${SITE}/og.jpg`;

const ORG = {
  "@type": "SportsActivityLocation",
  "@id": `${SITE}/#organization`,
  name: BRAND,
  url: SITE,
  logo: `${SITE}/favicon.png`,
  image: OG_DEFAULT,
  telephone: "+48 603 102 665",
  email: "racingacademy@fastline.pl",
  founder: { "@type": "Person", name: "Mariusz Miękoś", url: `${SITE}/mariusz-miekos-racing` },
  sameAs: [
    "https://www.facebook.com/fastlineracingacademy",
    "https://www.instagram.com/fastline_racing_academy",
    "https://www.linkedin.com/showcase/fastline-racing-academy",
  ],
  areaServed: ["PL", "FI", "ES", "MC"],
  address: { "@type": "PostalAddress", streetAddress: "ul. Wita Stwosza 48", addressLocality: "Warszawa", addressCountry: "PL" },
};

export const abs = (u) => (!u ? OG_DEFAULT : /^https?:/i.test(u) ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`);

const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/** "SZKOLENIE JAZDY SPORTOWEJ" → "Szkolenie jazdy sportowej" (CMS titles are shouted; <title> should not be) */
export const nice = (s) => {
  const t = strip(s);
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[—–\-:]\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(gt3|gts|rs|amg|bmw|m2|d2r|r6|r4|r3)\b/gi, (m) => m.toUpperCase());
};
export const clip = (s, n = 158) => {
  const t = strip(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 80))}…`;
};

function meta(sel, attrs) {
  let el = document.head.querySelector(sel);
  if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}
function link(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

/** Build the breadcrumb list for a path like /produkty/stage-1 with human labels */
export function breadcrumbs(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Strona główna", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE}${it.path}`,
    })),
  };
}

/**
 * useSeo({ title, description, path, image, type, lang, noindex, jsonld })
 *  - title: page title without the brand (brand appended); description: ≤160 chars
 *  - jsonld: object or array of schema.org nodes (the Organization node is always included)
 */
export function useSeo({ title, description, path, image, type = "website", lang = "pl", noindex = false, jsonld } = {}) {
  const fullTitle = title ? `${title} | ${BRAND}` : `${BRAND} — szkolenia jazdy sportowej i wyścigowej`;
  const desc = clip(description || "Poczuj się jak prawdziwy kierowca wyścigowy. Szkolenia na torze 1:1 z instruktorem, Laponia, wyprawy, vouchery i eventy firmowe.");
  const url = `${SITE}${path || window.location.pathname}`.replace(/\/+$/, "") || SITE;
  const img = abs(image);
  const ldKey = JSON.stringify(jsonld || null);

  useEffect(() => {
    document.title = fullTitle;
    document.documentElement.lang = lang;
    meta('meta[name="description"]', { name: "description", content: desc });
    meta('meta[name="robots"]', { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" });
    link("canonical", url);
    meta('meta[property="og:type"]', { property: "og:type", content: type });
    meta('meta[property="og:url"]', { property: "og:url", content: url });
    meta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    meta('meta[property="og:description"]', { property: "og:description", content: desc });
    meta('meta[property="og:image"]', { property: "og:image", content: img });
    meta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: img });
    meta('meta[property="og:locale"]', { property: "og:locale", content: lang === "en" ? "en_US" : "pl_PL" });
    meta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    meta('meta[name="twitter:description"]', { name: "twitter:description", content: desc });
    meta('meta[name="twitter:image"]', { name: "twitter:image", content: img });

    let ld = document.getElementById("ld-page");
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "ld-page"; document.head.appendChild(ld); }
    const nodes = [ORG, { "@type": "WebPage", "@id": `${url}#webpage`, url, name: fullTitle, description: desc, inLanguage: lang, isPartOf: { "@id": `${SITE}/#website` }, primaryImageOfPage: img }];
    const extra = jsonld ? (Array.isArray(jsonld) ? jsonld : [jsonld]) : [];
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": [...nodes, ...extra] });
  }, [fullTitle, desc, url, img, type, lang, noindex, ldKey]);
}
