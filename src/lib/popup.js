/* Advertising pop-up — the rules of when a visitor sees it (the layout is components/PopupView.jsx).

   A closed pop-up stays closed for the rest of the visit (sessionStorage — one browser tab session).
   A new visit shows it again, unless it started less than 5 minutes after the previous one ended:
   while a visit lasts, the time of its last sign of life is kept in localStorage. */
import { todayIso } from "./blog";

const SS_CLOSED = "fra_popup_closed";   // id of the pop-up closed in this visit
const SS_TIME = "fra_popup_t";          // ms spent on the site in this visit
const SS_SEEN = "fra_popup_seen";       // id already counted as "shown" in this visit
const LS_LAST = "fra_popup_last";       // { id, at } — last sign of life of a visit in which it was closed
export const GAP_MS = 5 * 60 * 1000;

/* text limits — the block has a fixed size, so the copy must fit (panel and editor both use these) */
export const POPUP_LIMITS = { eyebrow: 32, title: 48, body: 300, lines: 6, btn: 24 };
export const POPUP_LAYOUTS = [["left", "Zdjęcie z lewej"], ["right", "Zdjęcie z prawej"], ["cover", "Zdjęcie w tle"]];
export const POPUP_COLORS = [["#14161a", "Czarny"], ["#34373d", "Grafit"], ["#e30613", "Czerwony"], ["#ab153a", "Bordo"], ["#08222f", "Granat lodowy"], ["#f4f5f6", "Jasny szary"], ["#ffffff", "Biały"]];
export const POPUP_BTN_COLORS = [["#e30613", "Czerwony"], ["#14161a", "Czarny"], ["#ffffff", "Biały"], ["#b8860b", "Złoty"]];

const get = (store, k) => { try { return store.getItem(k); } catch { return null; } };
const put = (store, k, v) => { try { store.setItem(k, v); } catch { /* private mode */ } };

export function wasDismissed(id) {
  if (get(sessionStorage, SS_CLOSED) === String(id)) return true;
  try {
    const last = JSON.parse(get(localStorage, LS_LAST) || "null");
    // back within 5 minutes of the previous visit — it counts as the same visit
    if (last && last.id === String(id) && Date.now() - last.at < GAP_MS) { put(sessionStorage, SS_CLOSED, String(id)); return true; }
  } catch { /* broken value: treat as never closed */ }
  return false;
}
export const touch = (id) => put(localStorage, LS_LAST, JSON.stringify({ id: String(id), at: Date.now() }));
export const dismiss = (id) => { put(sessionStorage, SS_CLOSED, String(id)); touch(id); };

export const timeOnSite = () => Number(get(sessionStorage, SS_TIME)) || 0;
export const saveTimeOnSite = (ms) => put(sessionStorage, SS_TIME, String(Math.round(ms)));
/** true the first time the pop-up is shown in a visit (the "views" counter counts visits, not reloads) */
export const firstView = (id) => { if (get(sessionStorage, SS_SEEN) === String(id)) return false; put(sessionStorage, SS_SEEN, String(id)); return true; };

/* never in the panel, in the checkout or on the legal pages — an advert must not interrupt a purchase */
const QUIET = /^\/(admin|platnosc|zakup|zakup-wyprawa|rezerwacja|rezerwacja-ice|voucher|polityka-prywatnosci|regulamin-platnosci)(\/|$)/;
export const popupAllowedOn = (p, pathname) => !QUIET.test(pathname) && (p.pages !== "home" || pathname === "/");

/** on / scheduled (starts later) / ended / off — the campaign window is optional */
export function popupState(p) {
  if (!p.active) return "off";
  const today = todayIso();
  if (p.date_from && String(p.date_from) > today) return "scheduled";
  if (p.date_to && String(p.date_to) < today) return "ended";
  return "on";
}

/* Search engines and automated browsers (prerender, tests) never get the pop-up: a full-screen advert
   in front of the content costs ranking, and a snapshot must not contain it. */
export function automated() {
  try { if (localStorage.getItem("fra_popup_force")) return false; } catch { /* */ }
  return !!navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|prerender/i.test(navigator.userAgent || "");
}

export const isExternal = (url) => /^(https?:)?\/\//i.test(String(url || "")) || /^(mailto:|tel:)/i.test(String(url || ""));

/** readable text colour for a background: "light" text on dark blocks, "dark" text on light ones */
export function toneOf(hex) {
  const m = String(hex || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return "light";
  const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "dark" : "light";
}
