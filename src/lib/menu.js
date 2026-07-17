// Shared nav-menu config. Labels live in content keys `nav.*` (translated PL→EN),
// hrefs in content keys `nav.*.href` (kind "url", NOT translated). Both are editable
// in the admin "Menu" tab; labels are also inline-editable on the page.
export const MENU_A = ["nav.forYou", "nav.forBiz"];
export const MENU_B = ["nav.products", "nav.calendar", "nav.pricing", "nav.about", "nav.fleet", "nav.contact"];
export const MENU = [...MENU_A, ...MENU_B];

// default href per menu id (fallback when no content override exists)
export const MENU_HREF = {
  "nav.forYou": "/rezerwacja",
  "nav.forBiz": "#programy",
  "nav.products": "/produkty",
  "nav.calendar": "/kalendarz",
  "nav.pricing": "/cennik",
  "nav.about": "#instruktorzy",
  "nav.fleet": "/flota",
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
