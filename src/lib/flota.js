// Shared Flota constants — tracks (drive the pricing tier) + session packages.
// Pricing rule: a term on the Poznań track uses the *_poznan price set; every
// other track uses the base (Łódź) price set. Kept in one place so the page,
// the booking flow and the admin all agree.

export const TRACKS = [
  { slug: "lodz", pl: "Tor Łódź", en: "Łódź Circuit" },
  { slug: "poznan", pl: "Tor Poznań", en: "Poznań Circuit" },
  { slug: "kielce", pl: "Tor Kielce", en: "Kielce Circuit" },
  { slug: "silesia", pl: "Silesia Ring", en: "Silesia Ring" },
  { slug: "inny", pl: "Inny tor", en: "Other circuit" },
];
export const trackLabel = (slug, lang = "pl") => TRACKS.find((t) => t.slug === slug)?.[lang] || slug || "";
export const isPoznan = (slug) => slug === "poznan";

// session packages — sessions count + tier name (price comes per-car per-track)
export const PACKAGES = [
  { n: 1, pl: "JAZDA PRÓBNA", en: "TASTER DRIVE", sub_pl: "1 sesja", sub_en: "1 session" },
  { n: 3, pl: "EXPERIENCE", en: "EXPERIENCE", sub_pl: "3 sesje", sub_en: "3 sessions" },
  { n: 5, pl: "PROGRESS", en: "PROGRESS", sub_pl: "5 sesji", sub_en: "5 sessions" },
  { n: 6, pl: "SPORT", en: "SPORT", sub_pl: "6 sesji", sub_en: "6 sessions" },
  { n: 9, pl: "PERFORMANCE", en: "PERFORMANCE", sub_pl: "9 sesji", sub_en: "9 sessions" },
];

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
