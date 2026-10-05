import { lazy, createElement } from "react";

/* Route-level code splitting. Every page except the home page lives in its own chunk (JS + CSS),
   so the first visit downloads only what that page needs. `page()` wraps React.lazy so a chunk that
   is already loaded renders synchronously — no Suspense flash when the curtain reveals the page
   or when React boots on top of a prerendered snapshot. */
function page(loader) {
  let C = null;
  let pending = null;
  const load = () => (pending ||= loader().then((m) => { C = m.default; return m; }));
  const L = lazy(load);
  const Page = (props) => createElement(C || L, props);
  Page.preload = load;
  return Page;
}

export const Pages = {
  Mariusz: page(() => import("../pages/Mariusz")),
  MediaPage: page(() => import("../pages/MediaPage")),
  Szkola: page(() => import("../pages/Szkola")),
  Flota: page(() => import("../pages/Flota")),
  Auto: page(() => import("../pages/Auto")),
  Rezerwacja: page(() => import("../pages/Rezerwacja")),
  Kalendarz: page(() => import("../pages/Kalendarz")),
  Produkty: page(() => import("../pages/Produkty")),
  Produkt: page(() => import("../pages/Produkt")),
  RezerwacjaIce: page(() => import("../pages/RezerwacjaIce")),
  Cennik: page(() => import("../pages/Cennik")),
  Kontakt: page(() => import("../pages/Kontakt")),
  Zakup: page(() => import("../pages/Zakup")),
  ZakupWyprawa: page(() => import("../pages/ZakupWyprawa")),
  Legal: page(() => import("../pages/Legal")),
  Platnosc: page(() => import("../pages/Platnosc")),
  Voucher: page(() => import("../pages/Voucher")),
  DlaFirm: page(() => import("../pages/DlaFirm")),
  Blog: page(() => import("../pages/Blog")),
  BlogPost: page(() => import("../pages/BlogPost")),
  Admin: page(() => import("../pages/Admin")),
};

/* pathname → page component (home and unknown paths resolve to null = nothing to load) */
const TABLE = [
  [/^\/mariusz-miekos-racing\/?$/, "Mariusz"],
  [/^\/media-o-nas\/?$/, "MediaPage"],
  [/^\/o-szkole\/?$/, "Szkola"],
  [/^\/flota\/?$/, "Flota"],
  [/^\/flota\/[^/]+\/?$/, "Auto"],
  [/^\/kalendarz\/?$/, "Kalendarz"],
  [/^\/cennik\/?$/, "Cennik"],
  [/^\/kontakt\/?$/, "Kontakt"],
  [/^\/(produkty|oferta)\/?$/, "Produkty"],
  [/^\/dla-firm\/?$/, "DlaFirm"],
  [/^\/voucher\/?$/, "Voucher"],
  [/^\/platnosc\/?$/, "Platnosc"],
  [/^\/produkty\/[^/]+\/?$/, "Produkt"],
  [/^\/rezerwacja\/?$/, "Rezerwacja"],
  [/^\/rezerwacja-ice\/?$/, "RezerwacjaIce"],
  [/^\/zakup\/?$/, "Zakup"],
  [/^\/zakup-wyprawa\/?$/, "ZakupWyprawa"],
  [/^\/(polityka-prywatnosci|regulamin-platnosci)\/?$/, "Legal"],
  [/^\/blog\/?$/, "Blog"],
  [/^\/blog\/[^/]+\/?$/, "BlogPost"],
  [/^\/admin/, "Admin"],
];

/** Loads the chunk for a path; resolves immediately for the home page / unknown paths or on error. */
export function preloadRoute(pathname) {
  const hit = TABLE.find(([re]) => re.test(pathname));
  return hit ? Pages[hit[1]].preload().catch(() => {}) : Promise.resolve();
}

/** After the page has settled, quietly fetch the other public pages so in-app navigation is instant. */
export function prefetchAllWhenIdle() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  const names = Object.keys(Pages).filter((k) => k !== "Admin");
  const next = () => {
    const n = names.shift();
    if (!n) return;
    Pages[n].preload().catch(() => {}).finally(() => idle(next, { timeout: 2000 }));
  };
  const start = () => setTimeout(() => idle(next, { timeout: 2000 }), 2500);
  if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
}
