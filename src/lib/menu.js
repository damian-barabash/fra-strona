// Shared nav-menu config. Labels live in content keys `nav.*` (translated PL→EN),
// hrefs in content keys `nav.*.href` (kind "url", NOT translated). Both are editable
// in the admin "Menu" tab; labels are also inline-editable on the page.
// "nav.forYou" is rendered as the red KUP SZKOLENIE button (see Nav.jsx).
export const MENU_A = ["nav.forBiz"];
export const MENU_B = ["nav.products", "nav.fleet", "nav.about", "nav.pricing", "nav.calendar", "nav.blog", "nav.contact"];
// The order of these links is kept in the database: content key "nav.order" (comma-separated ids,
// changed with the arrows in the admin "Menu" tab). MENU_B is only the fallback order.
export const ORDER_KEY = "nav.order";
export const menuOrder = (saved) => {
  const ids = String(saved || "").split(",").map((x) => x.trim()).filter((x, i, a) => MENU_B.includes(x) && a.indexOf(x) === i);
  // a link the saved order does not know yet (added to the site later) takes its default place:
  // right before the link that follows it in MENU_B
  const out = [...ids];
  MENU_B.forEach((x, i) => {
    if (out.includes(x)) return;
    const after = MENU_B.slice(i + 1).find((y) => out.includes(y));
    if (after) out.splice(out.indexOf(after), 0, x); else out.push(x);
  });
  return out;
};
export const MENU_CTA = "nav.forYou";
// "nav.gift" is the second (black) button — KUP PREZENT → voucher configurator
export const MENU_CTA2 = "nav.gift";
export const MENU = [MENU_CTA, MENU_CTA2, ...MENU_A, ...MENU_B];

// default href per menu id (fallback when no content override exists)
export const MENU_HREF = {
  "nav.forYou": "/rezerwacja",
  "nav.gift": "/voucher",
  "nav.forBiz": "/dla-firm",
  "nav.products": "/oferta",
  "nav.calendar": "/kalendarz",
  "nav.pricing": "/cennik",
  "nav.about": "#instruktorzy",
  "nav.fleet": "/flota",
  "nav.blog": "/blog",
  "nav.contact": "/kontakt",
};

export const hrefKey = (id) => `${id}.href`;

// "O NAS" dropdown — 3 fixed internal pages. Labels/eyebrows live in content keys
// (inline-editable + auto-translated); the route is fixed per item.
export const ABOUT_ITEMS = [
  { key: "about.mariusz", to: "/mariusz-miekos-racing" },
  { key: "about.media", to: "/media-o-nas" },
  { key: "about.szkola", to: "/o-szkole" },
];
