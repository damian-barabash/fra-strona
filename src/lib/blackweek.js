/* Black Friday Weeks 2026 — the campaign pop-up (components/BlackWeekPopup.jsx) and the configurator
   (/black-week, pages/BlackWeek.jsx). The switch lives in content `bw.on` ("1" = on), set in the panel →
   Sprzedaż → Black Week. Prices are the normal ones; every product comes with a gift (no discount).
   The server keeps the same lists in supabase/functions/_shared/blackweek.ts. */

export const BW_PATH = "/black-week";
export const bwOn = (raw) => String(raw("bw.on")?.pl ?? "") === "1";

/* order on the product step = order of the campaign copy; `q` is the value of ?produkt= in links */
export const BW_PRODUCTS = [
  {
    id: "sd", q: "sport-driving", title: "SPORT DRIVING", img: "/assets/bw/sport-driving.webp",
    headline: "Nawet 3 sesje gratis",
    desc: "Szkolenie jazdy sportowej z instruktorem 1:1 w aucie z naszej floty. Więcej okrążeń to więcej czasu, żeby naprawdę poczuć auto i swoje tempo.",
    cta: "Skonfiguruj szkolenie",
  },
  {
    id: "d2r", q: "driver2racer", title: "DRIVER2RACER", img: "/assets/bw/d2r.webp",
    headline: "+2 sesje w Porsche 911 + rękawice OMP",
    desc: "Nasz najbardziej kompleksowy program: 24 sesje na torze, coaching 1:1 z 9-krotnym Mistrzem Polski, telemetria i symulator. Teraz z jeszcze większą dawką Porsche i rękawicami OMP w wybranym kolorze.",
    cta: "Wejdź do programu",
  },
  {
    id: "taxi", q: "race-taxi", title: "RACE TAXI", img: "/assets/bw/race-taxi.webp",
    headline: "2 vouchery w cenie 1",
    desc: "Siadasz w fotelu pasażera, za kierownicą jest kierowca wyścigowy, a tor pokonujecie na limicie. Jeden voucher dajesz w prezencie, drugi zostawiasz sobie.",
    cta: "Odbierz 2 w cenie 1",
  },
  {
    id: "heels", q: "heels-on-the-track", title: "HEELS ON THE TRACK", img: "/assets/bw/heels.webp",
    headline: "Koleżanka za pół ceny albo golf FIERI w prezencie",
    desc: "Szkolenie jazdy sportowej tylko dla kobiet, z instruktorem 1:1 i race taxi z kierowcą wyścigowym. Razem na torze emocji jest podwójnie.",
    cta: "Zabierz koleżankę",
  },
  {
    id: "ice", q: "laponia", title: "ICE DRIVING LAPONIA", img: "/assets/bw/laponia.webp",
    headline: "2 sesje Sport Driving na Torze Łódź gratis",
    desc: "Kontrolowany poślizg na zamarzniętych jeziorach fińskiej Laponii, na oponach z kolcami i z coachem 1:1. A przed wyjazdem rozgrzewka na Torze Łódź w prezencie.",
    cta: "Zarezerwuj Laponię",
  },
];
/* the campaign ends with 30 November (Warsaw time) — the countdown on the page */
export const BW_END = "2026-11-30T23:59:59+01:00";
export const bwProduct = (idOrQ) => BW_PRODUCTS.find((p) => p.id === idOrQ || p.q === idOrQ) || null;

export const GLOVE_COLORS = [["Czarne", "#111214"], ["Czerwone", "#d0121b"], ["Niebieskie", "#1f4fd1"], ["Białe", "#f4f5f6"]];
export const GLOVE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const HEELS_PACKAGES = [
  { id: "basic", name: "BASIC", key: "bw.heels.basic", fallback: 3200,
    items: ["Wykład teoretyczny jazdy bezpiecznej i sportowej", "Sesje na torze: Mercedes AMG, Alpine A110, Toyota Supra GR", "Catering", "Trening psychomotoryczny", "Race taxi z kierowcą wyścigowym"] },
  { id: "premium", name: "PREMIUM PORSCHE", key: "bw.heels.premium", fallback: 4500,
    items: ["Wykład teoretyczny jazdy bezpiecznej i sportowej", "Sesje na torze: 2× Porsche 911, Alpine A110, Mercedes A45 AMG", "Catering", "Trening psychomotoryczny", "Race taxi z kierowcą wyścigowym", "Sportowe rękawiczki"] },
];
export const heelsPrice = (raw, pkg) => Number(String(raw(pkg.key)?.pl || "").replace(/\D/g, "")) || pkg.fallback;

/** bonus sessions for Sport Driving: 3 → +1, 6 → +2, 9 → +3 */
export const sdBonus = (n) => (n ? n / 3 : 0);
export const sessWord = (n) => (n === 1 ? "sesja" : n < 5 ? "sesje" : "sesji");

/* ---- the pop-up: shown once per visit (sessionStorage = this tab's visit), then it lives minimised ---- */
const SS = "fra_bw";
export const bwSeen = () => { try { return sessionStorage.getItem(SS) === "min"; } catch { return false; } };
export const bwMinimise = () => { try { sessionStorage.setItem(SS, "min"); } catch { /* private mode */ } };
/* never over a purchase, the panel or the legal pages — and not on the campaign page itself */
const QUIET = /^\/(admin|platnosc|zakup|zakup-wyprawa|rezerwacja|rezerwacja-ice|voucher|swieta-2026|black-week|polityka-prywatnosci|regulamin-platnosci)(\/|$)/;
export const bwAllowedOn = (pathname) => !QUIET.test(pathname);
