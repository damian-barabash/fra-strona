// Shared helpers for the Ice Driving (Laponia) product: packages, date windows, money.
export const fmtEur = (n, currency = "EUR") =>
  `${(Number(n) || 0).toLocaleString("pl-PL")} ${currency === "EUR" ? "€" : currency}`;

export const parseISO = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

export const fmtDay = (iso, lang = "pl") => {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { day: "numeric", month: "long", year: "numeric" });
};

export const iceDateRange = (w, lang = "pl") => {
  if (!w) return "";
  const a = parseISO(w.date_from), b = parseISO(w.date_to);
  if (!a || !b) return "";
  const loc = lang === "en" ? "en-GB" : "pl-PL";
  const short = (d) => d.toLocaleDateString(loc, { day: "numeric", month: "long" });
  return `${short(a)} – ${short(b)} ${b.getFullYear()}`;
};

/** Days marked in the panel as sold out entirely (`ice_windows.sold_out`, ISO dates). */
export const soldOutSet = (w) => new Set((Array.isArray(w?.sold_out) ? w.sold_out : []).map((d) => String(d).slice(0, 10)));

/** Every start date inside the window where a `days`-long stay still fits and touches no sold-out day. */
export const startDates = (w, days) => {
  if (!w) return [];
  const sold = soldOutSet(w);
  const n = Math.max(1, days);
  const out = [];
  let cur = w.date_from;
  while (cur <= w.date_to) {
    const last = addDays(cur, n - 1);
    let free = last <= w.date_to;
    for (let i = 0; free && i < n; i++) if (sold.has(addDays(cur, i))) free = false;
    if (free) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
};

/** First-of-month dates for every month the window touches. */
export const windowMonths = (w) => {
  const from = parseISO(w?.date_from), to = parseISO(w?.date_to);
  if (!from || !to) return [];
  const out = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) { out.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  return out;
};
