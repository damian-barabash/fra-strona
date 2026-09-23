// Shared Flota constants — tracks (drive the pricing tier) + session packages.
// Pricing rule: a term on the Poznań track uses the *_poznan price set; every
// other track uses the base (Łódź) price set. Kept in one place so the page,
// the booking flow and the admin all agree. All prices are NETTO.

export const TRACKS = [
  { slug: "lodz", pl: "Tor Łódź", en: "Łódź Circuit" },
  { slug: "poznan", pl: "Tor Poznań", en: "Poznań Circuit" },
  { slug: "krzywa", pl: "Tor Krzywa", en: "Krzywa Circuit" },
  { slug: "kielce", pl: "Tor Kielce", en: "Kielce Circuit" },
  { slug: "silesia", pl: "Silesia Ring", en: "Silesia Ring" },
  { slug: "modlin", pl: "Tor Modlin", en: "Modlin Circuit" },
  { slug: "inny", pl: "Inny tor", en: "Other circuit" },
];
export const trackLabel = (slug, lang = "pl") => TRACKS.find((t) => t.slug === slug)?.[lang] || slug || "";
export const isPoznan = (slug) => slug === "poznan";

// session packages sold online — 3 / 6 / 9 sessions (the 1 and 5 tiers were dropped from the offer)
export const PACKAGES = [
  { n: 3, pl: "EXPERIENCE", en: "EXPERIENCE", sub_pl: "3 sesje", sub_en: "3 sessions" },
  { n: 6, pl: "SPORT", en: "SPORT", sub_pl: "6 sesji", sub_en: "6 sessions" },
  { n: 9, pl: "PERFORMANCE", en: "PERFORMANCE", sub_pl: "9 sesji", sub_en: "9 sessions" },
];
export const packageOf = (n) => PACKAGES.find((p) => p.n === Number(n));

// price of a car for a package, given the term's track slug
export const carPrice = (car, sessions, track) => {
  if (!car) return 0;
  const k = isPoznan(track) ? `price_${sessions}_poznan` : `price_${sessions}`;
  return Number(car[k]) || Number(car[`price_${sessions}`]) || 0;
};

// custom-car ("własne auto") price — reads content via the store's raw() getter
export const customPrice = (raw, sessions, track) => {
  const key = `flota.custom.p${sessions}${isPoznan(track) ? "_pozn" : ""}`;
  const v = parseInt(String(raw(key).pl || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(v) ? v : 0;
};

export const fmtZl = (n) => `${(Number(n) || 0).toLocaleString("pl-PL")} zł`;
// every price on the site is a net price — the label travels with the number
export const NETTO = "netto";
export const fmtNetto = (n) => `${fmtZl(n)} ${NETTO}`;
