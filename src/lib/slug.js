/* "Adres podstrony" (slug) of a product / car — lowercase latin letters, digits and single dashes.
   The same rule lives in the admin-api edge function (the server normalises and checks again). */
const base = (s) => String(s ?? "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 80);

// while typing: a single trailing dash stays, so "race-" can become "race-taxi"
export const slugTyping = base;
export const slugify = (s) => base(s).replace(/-+$/, "");

// which tables have a public page per row, where it lives and which field names the row
export const SLUG_TABLES = {
  products: { base: "/produkty/", from: "title_pl", required: true },
  cars: { base: "/flota/", from: "name", required: false },
  posts: { base: "/blog/", from: "title_pl", required: true },
};
