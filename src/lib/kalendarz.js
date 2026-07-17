// Shared calendar constants. Terms (admin tab "Terminy") are the single source of
// dates: each one carries a training type, which drives its colour + fallback name.
import { carPrice } from "./flota";

export const TERM_TYPES = [
  { slug: "sport", pl: "SPORT DRIVING EXPERIENCE", en: "SPORT DRIVING EXPERIENCE", short_pl: "SPORT", short_en: "SPORT", color: "#e30613" },
  { slug: "heels", pl: "HEELS ON THE TRACK", en: "HEELS ON THE TRACK", short_pl: "HEELS", short_en: "HEELS", color: "#d81b8c" },
  { slug: "ice", pl: "ICE DRIVING EXPERIENCE", en: "ICE DRIVING EXPERIENCE", short_pl: "ICE", short_en: "ICE", color: "#2f9fe0" },
];
export const typeOf = (term) => TERM_TYPES.find((x) => x.slug === (term?.type || "sport")) || TERM_TYPES[0];
export const typeColor = (term) => typeOf(term).color;
export const typeName = (term, lang = "pl") => typeOf(term)[lang === "en" ? "en" : "pl"];

// local YYYY-MM-DD (never via toISOString — that shifts by the UTC offset)
export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseDate = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

// Monday-first weeks; pads with the neighbouring months' days so rows stay full.
export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;               // Mon = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = lead; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), out: true });
  for (let d = 1; d <= days; d++) cells.push({ date: new Date(year, month, d), out: false });
  let tail = 1;
  while (cells.length % 7) cells.push({ date: new Date(year, month + 1, tail++), out: true });
  return cells;
}

export const WEEKDAYS = {
  pl: ["PN", "WT", "ŚR", "CZ", "PT", "SB", "ND"],
  en: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
};

export const monthLabel = (y, m, lang) =>
  new Date(y, m, 1).toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { month: "long", year: "numeric" }).toUpperCase();

export const longDate = (iso, lang) => {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { day: "numeric", month: "long", year: "numeric" });
};
export const weekdayName = (iso, lang) => {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { weekday: "long" }).toUpperCase();
};

// cheapest entry ticket for a term: the lowest 1-session price across the fleet,
// using the term's track (Poznań has its own price set)
export const priceFrom = (cars, track) => {
  const prices = (cars || []).map((c) => carPrice(c, 1, track)).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
};

/* ---- special multi-day entries (Laponia seasons + trips) ----
   Regular terms are single training days. Ice seasons and trips span a range of dates and
   are shown differently on the board (a coloured band across the days, not a per-day pill). */

// pull every DD.MM.YYYY (or DD-MM-YYYY / DD/MM/YYYY) date out of free text, as sorted ISO strings
export function datesInText(s) {
  const re = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g;
  const out = [];
  let m;
  while ((m = re.exec(String(s || "")))) {
    const [, d, mo, y] = m;
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31)
      out.push(`${y}-${String(+mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`);
  }
  return out.sort();
}

const pick = (row, base, lang) => (lang === "en" ? row?.[`${base}_en`] : null) || row?.[`${base}_pl`] || "";

// Build the special events from the CMS: one per ice-season window + one per trip (wyprawa).
// Trip dates come from the harmonogram (schedule) — the first and last date it mentions.
export function specialEvents(products, iceWindows, lang = "pl") {
  const out = [];
  const laponia = (products || []).find((p) => p.slug === "ice-driving-laponia");

  (iceWindows || []).forEach((w) => {
    if (!w.date_from || !w.date_to) return;
    out.push({
      id: `ice-${w.id}`, kind: "ice", slug: "ice-driving-laponia",
      color: laponia?.color || "#5ec8f0",
      title: pick(w, "label", lang) || pick(laponia, "title", lang) || "Laponia",
      subtitle: pick(laponia, "title", lang) || "ICE DRIVING EXPERIENCE",
      from: w.date_from, to: w.date_to,
    });
  });

  (products || []).filter((p) => p.theme === "wyprawa").forEach((p) => {
    const ds = datesInText(p.schedule_pl);
    const from = ds[0], to = ds[ds.length - 1];
    if (!from || !to) return;
    out.push({
      id: `trip-${p.slug}`, kind: "trip", slug: p.slug,
      color: p.color || "#c9a227",
      title: pick(p, "title", lang) || p.slug,
      subtitle: pick(p, "trip_dates", lang) || "",
      from, to, past: p.trip_status === "past",
    });
  });

  return out.sort((a, b) => a.from.localeCompare(b.from));
}

// specials covering a given ISO day, with position flags so the band can round its ends
export const coversDay = (specials, iso) =>
  (specials || [])
    .filter((s) => iso >= s.from && iso <= s.to)
    .map((s) => ({ ...s, start: iso === s.from, end: iso === s.to }));

// specials that touch a given month (year, 0-based month)
export const specialsInMonth = (specials, y, m) => {
  const first = isoOf(new Date(y, m, 1));
  const last = isoOf(new Date(y, m + 1, 0));
  return (specials || []).filter((s) => s.from <= last && s.to >= first);
};
