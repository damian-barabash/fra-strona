import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { processUpload } from "../lib/api";
import UploadStatus from "../components/UploadStatus";
import { MENU, MENU_HREF, hrefKey } from "../lib/menu";
import { TRACKS, trackLabel, fmtZl } from "../lib/flota";
import { TERM_TYPES } from "../lib/kalendarz";
import "./admin.css";

/* =====================================================================================
   PANEL FRA — light dashboard: sidebar with icons, KPI cards + charts on the home screen,
   orders & payments (Tpay) as their own module, inbox, settings and all the CMS tabs.
   ===================================================================================== */

/* ---- icons (inline, 18px) ---- */
const I = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>,
  cart: <svg viewBox="0 0 24 24"><path d="M3 4h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.5L22 8H6.2" /><circle cx="10" cy="21" r="1.4" /><circle cx="18" cy="21" r="1.4" /></svg>,
  gift: <svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="5" /><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-7-4-6 0M12 8c2-4 7-4 6 0" /></svg>,
  mail: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7l9 6 9-6" /></svg>,
  biz: <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" /><path d="M8 7V4h8v3M3 12h18" /></svg>,
  cog: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  box: <svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></svg>,
  snow: <svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></svg>,
  cal: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  grid: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  edit: <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>,
  menu: <svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" /></svg>,
  image: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>,
  news: <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></svg>,
  car: <svg viewBox="0 0 24 24"><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5H3z" /><circle cx="7.5" cy="16" r="1.5" /><circle cx="16.5" cy="16" r="1.5" /></svg>,
  track: <svg viewBox="0 0 24 24"><path d="M5 18c-2-6 2-10 7-10s9 4 7 10H5z" /><path d="M9 18v-4M15 18v-4" /></svg>,
  user: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  tag: <svg viewBox="0 0 24 24"><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  logout: <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  ext: <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>,
};

/* ---- field configs per entity ---- */
const CFG = {
  cars: {
    label: "Samochody", icon: "car",
    fields: [
      { k: "name", t: "text", l: "Nazwa (pełna)" },
      { k: "slug", t: "text", l: "Adres podstrony (np. toyota-gr-supra → /flota/toyota-gr-supra)" },
      { k: "category", t: "select", l: "Kategoria", options: [{ value: "sport", label: "Samochód sportowy (konfigurator, cennik, voucher)" }, { value: "race", label: "Samochód wyścigowy (tylko zakładka Flota — bez cen, na zamówienie)" }] },
      { k: "badge", t: "text", l: "Numer / bejd (np. 911)" },
      { k: "color", t: "color", l: "Kolor tła / akcent" },
      { k: "png", t: "image", l: "PNG wycięty (opcjonalnie)" },
      { k: "engine", t: "text", l: "Silnik" },
      { k: "power", t: "text", l: "Moc (np. 530 KM)" },
      { k: "torque", t: "text", l: "Moment (np. 650 NM)" },
      { k: "top_speed", t: "text", l: "Prędkość maks. (np. 330 KM/H)" },
      { k: "accel", t: "text", l: "0–100 km/h (np. 3.3 s)" },
      { k: "weight", t: "text", l: "Waga (np. 1595 kg)" },
      { k: "drive", t: "text", l: "Napęd (np. Na 4 koła)" },
      { k: "description_pl", t: "textarea", l: "Opis krótki — slider i karta (PL — EN tłumaczy się samo)" },
      { k: "intro_pl", t: "textarea", l: "Opis rozszerzony — podstrona auta /flota/<adres>" },
      { k: "photos", t: "images", l: "Zdjęcia (mini-slider)" },
      { k: "price_3", t: "number", l: "💰 3 sesje / Experience — Łódź (zł netto)" },
      { k: "price_6", t: "number", l: "💰 6 sesji / Sport — Łódź (zł netto)" },
      { k: "price_9", t: "number", l: "💰 9 sesji / Performance — Łódź (zł netto)" },
      { k: "price_3_poznan", t: "number", l: "🟠 3 sesje — Poznań (zł netto)" },
      { k: "price_6_poznan", t: "number", l: "🟠 6 sesji — Poznań (zł netto)" },
      { k: "price_9_poznan", t: "number", l: "🟠 9 sesji — Poznań (zł netto)" },
    ],
    note: "Każde auto ma swoją podstronę /flota/<adres> („Więcej o modelu”). Ceny NETTO za pakiety 3 / 6 / 9 sesji — Poznań używa cen „Poznań”, inne tory — „Łódź”. Samochody WYŚCIGOWE (kategoria) pokazują się tylko w zakładce Flota, bez cen i bez rezerwacji online.",
    title: (r) => r.name,
  },
  terms: {
    label: "Terminy (kalendarz)", icon: "cal",
    note: "Terminy szkoleń — z nich buduje się KALENDARZ, blok „Nadchodzące wydarzenia” na stronie głównej oraz lista terminów w rezerwacji. " +
      "Rodzaj decyduje o kolorze i nazwie. Wybrany TOR decyduje o cenniku: Poznań → cennik poznański, pozostałe tory → cennik łódzki. " +
      "Sezon Laponii ustawia się w „Laponia — terminy”, daty wypraw — w samym produkcie wyprawy (pola „Data od / do”).",
    fields: [
      { k: "type", t: "select", l: "Rodzaj szkolenia (kolor w kalendarzu)", options: TERM_TYPES.map((ty) => ({ value: ty.slug, label: ty.pl })) },
      { k: "title_pl", t: "text", l: "Nazwa w kalendarzu (puste = nazwa rodzaju)" },
      { k: "track", t: "select", l: "Tor", options: TRACKS.map((tr) => ({ value: tr.slug, label: tr.pl })) },
      { k: "date", t: "date", l: "Data" },
      { k: "time", t: "text", l: "Godziny (np. 09:00–13:00)" },
      { k: "address", t: "text", l: "Adres (np. Kiełmina 78, Kiełmina)" },
      { k: "capacity", t: "number", l: "Liczba miejsc" },
      { k: "location_pl", t: "text", l: "Nazwa toru wyświetlana (puste = domyślna nazwa toru)" },
      { k: "description_pl", t: "textarea", l: "Opis szkolenia (widoczny w kalendarzu; PL — EN tłumaczy się samo)" },
      { k: "photo", t: "image", l: "Zdjęcie (karta w kalendarzu i na głównej, opcjonalnie)" },
    ],
    title: (r) => `${r.date || "—"} · ${r.time || ""} · ${r.title_pl || ""} · ${r.location_pl || trackLabel(r.track)}`,
  },
  instructors: {
    label: "Instruktorzy", icon: "user",
    note: "Slider „Poznaj naszych instruktorów” na głównej. Pierwsza karta jest czerwona. Blok o założycielu (Mariusz) edytuje się na stronie (edycja inline).",
    fields: [
      { k: "name", t: "text", l: "Imię i nazwisko" },
      { k: "label_pl", t: "text", l: "Etykieta górna (np. ZAWODNIK)" },
      { k: "subtitle_pl", t: "text", l: "Podpis (np. KIEROWCA WYŚCIGOWY)" },
      { k: "color", t: "color", l: "Kolor prostokąta" },
      { k: "photo", t: "image", l: "Zdjęcie (PNG sylwetka)" },
      { k: "signature", t: "text", l: "Podpis odręczny (tekst lub adres obrazka — pusty = brak)" },
      { k: "description_pl", t: "textarea", l: "Opis (pokazuje się po kliknięciu karty)" },
    ],
    title: (r) => r.name,
  },
  products: {
    label: "Produkty (oferta)", icon: "box",
    note: "Produkty ze strony „Oferta” (/oferta). Każdy ma własną podstronę /produkty/<adres>. Listy wpisuje się JEDNA POZYCJA W JEDNEJ LINII. " +
      "Wyprawa z datami „od / do” automatycznie pojawia się w kalendarzu i w „Nadchodzących wydarzeniach”. „Link zewnętrzny” — kafelek prowadzi na inną stronę (Heels).",
    fields: [
      { k: "code", t: "text", l: "Kod / bejd (np. STAGE 1)" },
      { k: "title_pl", t: "text", l: "Nazwa (PL — EN tłumaczy się samo)" },
      { k: "tag_pl", t: "text", l: "Etykieta / poziom (np. DLA KAŻDEGO)" },
      { k: "slug", t: "text", l: "Adres podstrony (np. stage-1)" },
      { k: "color", t: "color", l: "Kolor akcentu" },
      { k: "theme", t: "select", l: "Styl podstrony", options: [
        { value: "default", label: "Standardowy (racing)" }, { value: "ice", label: "Lodowy (Laponia)" },
        { value: "d2r", label: "Driver2Racer (czerwony)" }, { value: "wyprawa", label: "Wyprawa (luksusowa — kolor akcentu steruje stroną)" },
      ] },
      { k: "trip_status", t: "select", l: "Wyprawa — status", trip: true, options: [
        { value: "upcoming", label: "Jeszcze będzie (pakiety widoczne)" }, { value: "past", label: "Już się odbyła (pakiety ukryte, pokazuje relację)" },
      ] },
      { k: "date_from", t: "date", l: "Wyprawa — data od (trafia do kalendarza)", trip: true },
      { k: "date_to", t: "date", l: "Wyprawa — data do", trip: true },
      { k: "place_pl", t: "text", l: "Wyprawa — miejsce (np. SEVILLA · HISZPANIA)", trip: true },
      { k: "trip_dates_pl", t: "text", l: "Wyprawa — daty słownie (np. 6–13 CZERWCA 2026)", trip: true },
      { k: "schedule_pl", t: "textarea", l: "Wyprawa — harmonogram (jeden dzień = jedna linia, np. „Sobota, 06.06 — Przylot”)", trip: true },
      { k: "map_query", t: "text", l: "Wyprawa — nazwa trasy na mapie (np. Monaco)", trip: true },
      { k: "recap_pl", t: "textarea", l: "Wyprawa — relacja (widoczna, gdy wyprawa już się odbyła)", trip: true },
      { k: "recap_photos", t: "images", l: "Wyprawa — zdjęcia z relacji", trip: true },
      { k: "price", t: "number", l: "Cena pakietu netto (0 = brak ceny stałej)" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "PLN", label: "PLN" }, { value: "EUR", label: "EUR" }] },
      { k: "buy_direct", t: "check", l: "Kup od razu (bez konfiguratora — dane + płatność)" },
      { k: "photo", t: "image", l: "Zdjęcie główne (kafelek + hero podstrony)" },
      { k: "video", t: "video", l: "Wideo hero (opcjonalnie — MP4/WebM)" },
      { k: "excerpt_pl", t: "textarea", l: "Krótki opis (kafelek na liście)" },
      { k: "intro_pl", t: "textarea", l: "Wstęp na podstronie (każdy akapit w nowej linii)" },
      { k: "theory_pl", t: "textarea", l: "Część teoretyczna" },
      { k: "practice_pl", t: "textarea", l: "Część praktyczna" },
      { k: "learn_pl", t: "textarea", l: "Czego się nauczysz (jedna pozycja = jedna linia)" },
      { k: "includes_pl", t: "textarea", l: "W pakiecie (jedna pozycja = jedna linia)" },
      { k: "places_pl", t: "textarea", l: "Miejsce / tory (jedna pozycja = jedna linia)" },
      { k: "packages_pl", t: "textarea", l: "Pakiety (jedna pozycja = jedna linia, np. „BASIC — 3490 zł”)" },
      { k: "price_note_pl", t: "textarea", l: "Uwaga o cenie / rezerwacji" },
      { k: "photos", t: "images", l: "Galeria zdjęć (pasmo na podstronie)" },
      { k: "logo", t: "image", l: "Logo produktu (opcjonalnie — zastępuje bejd na kafelku)" },
      { k: "external_url", t: "text", l: "Link zewnętrzny (opcjonalnie — zamiast podstrony)" },
      { k: "info_only", t: "check", l: "Strona tylko informacyjna (bez przycisków rezerwacji — jak symulator)" },
    ],
    title: (r) => `${r.code ? r.code + " · " : ""}${r.title_pl || ""}`,
  },
  trip_points: { label: "Wyprawy — punkty na mapie", note: "Pinezki trasy. „Miejsce na mapie” musi być rozpoznawalne przez Google Maps.",
    fields: [{ k: "product_slug", t: "text", l: "Adres wyprawy (slug)" }, { k: "title_pl", t: "text", l: "Nazwa punktu" }, { k: "place", t: "text", l: "Miejsce na mapie Google" }, { k: "note_pl", t: "text", l: "Krótki opis" }],
    title: (r) => `${r.title_pl || r.place || "?"}` },
  trip_packages: { label: "Wyprawy — pakiety", note: "Pakiety wypraw. Cena netto steruje zakupem (liczona na serwerze).",
    fields: [{ k: "product_slug", t: "text", l: "Adres wyprawy (slug)" }, { k: "name_pl", t: "text", l: "Nazwa pakietu" }, { k: "price", t: "number", l: "Cena netto za osobę" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "EUR", label: "EUR" }, { value: "PLN", label: "PLN" }] }, { k: "includes_pl", t: "textarea", l: "W pakiecie (jedna linia = jedna pozycja)" }, { k: "note_pl", t: "textarea", l: "Uwagi" }],
    title: (r) => `${r.product_slug || "?"} · ${r.name_pl || ""} · ${r.price || 0} ${r.currency || "EUR"}` },
  trip_attractions: { label: "Wyprawy — atrakcje", note: "Sekcja „W programie” na stronie wyprawy.",
    fields: [{ k: "product_slug", t: "text", l: "Adres wyprawy (slug)" }, { k: "title_pl", t: "text", l: "Nazwa atrakcji" }, { k: "short_pl", t: "textarea", l: "Krótki opis" }, { k: "body_pl", t: "textarea", l: "Pełny opis" }, { k: "photo", t: "image", l: "Zdjęcie" }, { k: "optional", t: "check", l: "Opcja dodatkowa" }],
    title: (r) => `${r.product_slug || "?"} · ${r.title_pl || ""}` },
  ice_packages: { label: "Laponia — pakiety", icon: "snow",
    note: "Pakiety Ice Driving Experience. Cena (EUR, netto) i liczba dni STERUJĄ KONFIGURATOREM. Kwota do zapłaty w PLN liczona jest po kursie z „Ustawień”.",
    fields: [{ k: "name_pl", t: "text", l: "Nazwa pakietu" }, { k: "days", t: "number", l: "Liczba dni na torze" }, { k: "sessions_pl", t: "text", l: "Sesje (np. 12 sesji po 30 minut)" }, { k: "price", t: "number", l: "Cena netto za osobę" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "EUR", label: "EUR" }, { value: "PLN", label: "PLN" }] }, { k: "desc_pl", t: "textarea", l: "Opis pakietu" }],
    title: (r) => `${r.name_pl || ""} · ${r.days || 0} dni · ${r.price || 0} ${r.currency || "EUR"}` },
  ice_windows: { label: "Laponia — sezon", icon: "snow",
    note: "Okno sezonu lodowego — klient może wybrać dowolny dzień startu, o ile cały pakiet mieści się w zakresie. Sezon automatycznie pokazuje się w kalendarzu i na głównej.",
    fields: [{ k: "label_pl", t: "text", l: "Nazwa sezonu (np. Sezon lodowy 2027 · Kuusamo)" }, { k: "date_from", t: "date", l: "Data od" }, { k: "date_to", t: "date", l: "Data do" }, { k: "capacity", t: "number", l: "Liczba miejsc" }],
    title: (r) => `${r.label_pl || "Sezon"} · ${r.date_from || "?"} → ${r.date_to || "?"}` },
  programs: { label: "Kafelki na głównej", icon: "grid", note: "Sześć kafelków „Poczuj się jak prawdziwy kierowca wyścigowy”. Link może być wewnętrzny (/voucher, /dla-firm, /produkty/stage-3) albo pełnym adresem.",
    fields: [{ k: "tag_pl", t: "text", l: "Etykieta (np. SZKOLENIA)" }, { k: "title_pl", t: "text", l: "Tytuł" }, { k: "desc_pl", t: "textarea", l: "Krótki opis" }, { k: "image", t: "image", l: "Zdjęcie (kafelek)" }, { k: "link", t: "text", l: "Link (np. /voucher)" }],
    title: (r) => r.title_pl },
  tracks: { label: "Tory", icon: "track",
    fields: [{ k: "name", t: "text", l: "Nazwa toru (np. ŁÓDŹ)" }, { k: "full_name", t: "text", l: "Pełna nazwa (np. TOR ŁÓDŹ)" }, { k: "country_pl", t: "text", l: "Państwo" }, { k: "turns", t: "text", l: "Liczba zakrętów" }, { k: "length", t: "text", l: "Długość (metry)" }, { k: "width", t: "text", l: "Szerokość (metry)" }, { k: "description_pl", t: "textarea", l: "Opis" }, { k: "map", t: "image", l: "Mapa toru" }],
    title: (r) => r.full_name || r.name },
  media: { label: "Media o nas", icon: "news", note: "Artykuły i publikacje prasowe. Zalecany rozmiar zdjęcia ok. 1000×560 px.",
    fields: [{ k: "title_pl", t: "text", l: "Tytuł" }, { k: "tag_pl", t: "text", l: "Kategoria / tag" }, { k: "source", t: "text", l: "Źródło / medium" }, { k: "date", t: "text", l: "Data / rok" }, { k: "excerpt_pl", t: "textarea", l: "Krótki opis" }, { k: "url", t: "text", l: "Link do artykułu" }, { k: "photo", t: "image", l: "Zdjęcie / okładka" }],
    title: (r) => `${r.source ? r.source + " · " : ""}${r.title_pl || ""}` },
  banners: { label: "Banery", icon: "image", note: "Blok reklamowy pod hero. Brak banerów = blok ukryty. DESKTOP 1600×420 px, MOBILNY 900×700 px.",
    fields: [{ k: "image", t: "image", l: "Baner DESKTOP" }, { k: "image_mobile", t: "image", l: "Baner MOBILNY (opcjonalnie)" }, { k: "link", t: "text", l: "Link (opcjonalnie)" }, { k: "alt", t: "text", l: "Opis / alt" }],
    title: (r) => r.alt || r.link || "Baner" },
};

const GROUPS = [
  { id: "pulpit", label: "Pulpit", tabs: [{ t: "dashboard", l: "Pulpit", i: "home" }] },
  { id: "sprzedaz", label: "Sprzedaż", tabs: [
    { t: "zamowienia", l: "Zamówienia i płatności", i: "cart" }, { t: "vouchery", l: "Vouchery", i: "gift" },
    { t: "wiadomosci", l: "Wiadomości", i: "mail" }, { t: "firmy", l: "Zapytania firmowe", i: "biz" }, { t: "ustawienia", l: "Ustawienia", i: "cog" },
  ] },
  { id: "oferta", label: "Oferta", tabs: [{ t: "products", l: "Produkty", i: "box" }, { t: "ice_packages", l: "Laponia — pakiety", i: "snow" }, { t: "ice_windows", l: "Laponia — sezon", i: "snow" }, { t: "programs", l: "Kafelki na głównej", i: "grid" }] },
  { id: "strona", label: "Strona", tabs: [{ t: "inline", l: "Edycja wizualna", i: "edit", link: "/" }, { t: "menu", l: "Menu (nawigacja)", i: "menu" }, { t: "banners", l: "Banery", i: "image" }, { t: "media", l: "Media o nas", i: "news" }] },
  { id: "tor", label: "Tor i zespół", tabs: [{ t: "cars", l: "Samochody i ceny", i: "car" }, { t: "terms", l: "Terminy (kalendarz)", i: "cal" }, { t: "tracks", l: "Tory", i: "track" }, { t: "instructors", l: "Instruktorzy", i: "user" }] },
];
const TAB_LABEL = (t) => GROUPS.flatMap((g) => g.tabs).find((x) => x.t === t)?.l || CFG[t]?.label || t;

const KIND = { track: ["Szkolenie", "#e30613"], ice: ["Laponia", "#2f9fe0"], product: ["Program", "#8b5cf6"], trip: ["Wyprawa", "#f0a500"], voucher: ["Voucher", "#21b573"] };
const STATUS = { paid: ["Opłacone", "ok"], pending: ["Oczekuje", "warn"], cancelled: ["Anulowane", "off"], chargeback: ["Zwrot", "bad"] };
const money = (b) => (b.currency === "EUR" ? `${(Number(b.total) || 0).toLocaleString("pl-PL")} €` : fmtZl(b.total));
const when = (s) => (s ? new Date(s).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function Admin() {
  const { isAdmin } = useStore();
  if (!isAdmin) return <Login />;
  return <Shell />;
}

/* ============ LOGIN ============ */
function Login() {
  const { login } = useStore();
  const [l, setL] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(""); const r = await login(l.trim(), p); setBusy(false); if (!r.ok) setErr("Błędny login lub hasło"); };
  return (
    <div className="adm-login">
      <form onSubmit={submit} className="adm-login__box">
        <img src="/assets/ui/logo.webp" alt="Fastline Racing Academy" style={{ height: 52, width: "auto", alignSelf: "center", display: "block", marginBottom: 20 }} />
        <h1>Panel FRA</h1>
        <input placeholder="Login" value={l} onChange={(e) => setL(e.target.value)} autoFocus />
        <input placeholder="Hasło" type="password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <div className="adm-err">{err}</div>}
        <button className="adm-btn adm-btn--red" disabled={busy}>{busy ? "…" : "Zaloguj"}</button>
        <Link to="/" className="adm-link">← Powrót na stronę</Link>
      </form>
    </div>
  );
}

/* ============ SHELL ============ */
function Shell() {
  const { admin, logout, setCmsMode } = useStore();
  const [tab, setTab] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const pick = (t) => { setTab(t); setNavOpen(false); window.scrollTo({ top: 0 }); };
  const initials = (admin?.name || admin?.login || "A").slice(0, 2).toUpperCase();

  return (
    <div className="adm">
      <aside className={`adm-side ${navOpen ? "open" : ""}`}>
        <div className="adm-brand"><img src="/assets/ui/logo.webp" alt="" /><span>PANEL</span></div>
        <div className="adm-side__scroll">
          {GROUPS.map((g) => (
            <div className="adm-group" key={g.id}>
              <span className="adm-group__lbl">{g.label}</span>
              {g.tabs.map((x) => x.link
                ? <Link key={x.t} to={x.link} className="adm-nav" onClick={() => setCmsMode(true)}><i>{I[x.i]}</i>{x.l}<em>{I.ext}</em></Link>
                : <button key={x.t} className={`adm-nav ${tab === x.t ? "on" : ""}`} onClick={() => pick(x.t)}><i>{I[x.i]}</i>{x.l}</button>)}
            </div>
          ))}
        </div>
        <div className="adm-side__foot">
          <div className="adm-me"><span className="adm-me__av">{initials}</span><span><b>{admin?.name || admin?.login}</b><small>administrator</small></span></div>
          <button className="adm-nav" onClick={logout}><i>{I.logout}</i>Wyloguj</button>
        </div>
      </aside>
      <div className="adm-top">
        <button className="adm-burger" onClick={() => setNavOpen((v) => !v)} aria-label="menu"><span /></button>
        <span className="adm-top__crumb">Panel <i>/</i> {TAB_LABEL(tab)}</span>
        <Link to="/" className="adm-top__site">Zobacz stronę {I.ext}</Link>
      </div>
      <main className="adm-main">
        {tab === "dashboard" ? <Dashboard go={pick} />
          : tab === "zamowienia" ? <OrdersTab />
          : tab === "vouchery" ? <OrdersTab only="voucher" />
          : tab === "wiadomosci" ? <MessagesTab kind="contact" />
          : tab === "firmy" ? <MessagesTab kind="firma" />
          : tab === "ustawienia" ? <SettingsTab />
          : tab === "menu" ? <MenuTab />
          : <EntityTab key={tab} table={tab} />}
      </main>
    </div>
  );
}

/* ============ DASHBOARD ============ */
function Dashboard({ go }) {
  const { adminCall, terms } = useStore();
  const [s, setS] = useState(null);
  useEffect(() => { adminCall("stats").then((r) => setS(r.ok ? r : {})); /* eslint-disable-next-line */ }, []);
  if (!s) return <div className="adm-empty">Ładowanie pulpitu…</div>;
  const months = s.months || [];
  const max = Math.max(1, ...months.map((m) => m.revenue));
  const thisM = months[months.length - 1] || { revenue: 0, orders: 0 };
  const prevM = months[months.length - 2] || { revenue: 0, orders: 0 };
  const delta = prevM.revenue ? Math.round(((thisM.revenue - prevM.revenue) / prevM.revenue) * 100) : null;
  const kinds = Object.entries(s.byKind || {});
  const kindTotal = kinds.reduce((a, [, v]) => a + v.revenue, 0) || 1;
  const monthName = (m) => new Date(m + "-01").toLocaleDateString("pl-PL", { month: "short" }).replace(".", "");

  return (
    <div>
      <div className="adm-head"><div><h2>Pulpit</h2><p className="adm-sub">Sprzedaż, płatności Tpay, skrzynka i kalendarz — w jednym miejscu.</p></div></div>

      <div className="adm-kpis">
        <Kpi label="Przychód w tym miesiącu" value={fmtZl(thisM.revenue)} sub={delta == null ? "brak danych z poprzedniego" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs poprzedni`} ring={Math.min(1, thisM.revenue / max)} color="#e30613" icon="cart" onClick={() => go("zamowienia")} />
        <Kpi label="Opłacone zamówienia (12 mies.)" value={s.paidCount ?? 0} sub={`${fmtZl(s.revenue || 0)} łącznie`} ring={Math.min(1, (s.paidCount || 0) / 50)} color="#21b573" icon="gift" onClick={() => go("zamowienia")} />
        <Kpi label="Oczekujące płatności" value={s.pending ?? 0} sub="rozpoczęte, nieopłacone" ring={Math.min(1, (s.pending || 0) / 10)} color="#f0a500" icon="cog" onClick={() => go("zamowienia")} />
        <Kpi label="Nowe wiadomości" value={s.messages?.unread ?? 0} sub={`${s.messages?.firma ?? 0} zapytań firmowych`} ring={Math.min(1, (s.messages?.unread || 0) / 10)} color="#2f9fe0" icon="mail" onClick={() => go("wiadomosci")} />
      </div>

      <div className="adm-grid2">
        <div className="adm-card">
          <div className="adm-card__head"><b>Przychód miesięcznie</b><span>ostatnie 12 miesięcy · PLN netto</span></div>
          <div className="adm-chart">
            {months.map((m) => (
              <div key={m.month} className="adm-chart__col" title={`${m.month}: ${fmtZl(m.revenue)} · ${m.orders} zam.`}>
                <span className="adm-chart__v">{m.revenue ? Math.round(m.revenue / 1000) + "k" : ""}</span>
                <i style={{ height: `${Math.max(3, (m.revenue / max) * 100)}%` }} />
                <em>{monthName(m.month)}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card__head"><b>Struktura sprzedaży</b><span>wg rodzaju</span></div>
          <div className="adm-donut">
            <Donut parts={kinds.map(([k, v]) => ({ v: v.revenue, c: KIND[k]?.[1] || "#999" }))} total={kindTotal} />
            <ul>
              {kinds.length ? kinds.map(([k, v]) => (
                <li key={k}><i style={{ background: KIND[k]?.[1] }} /><span>{KIND[k]?.[0] || k}</span><b>{v.orders}</b><em>{Math.round((v.revenue / kindTotal) * 100)}%</em></li>
              )) : <li className="adm-muted">Jeszcze brak opłaconych zamówień.</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="adm-grid2">
        <div className="adm-card">
          <div className="adm-card__head"><b>Ostatnie opłacone</b><button className="adm-btn adm-btn--sm" onClick={() => go("zamowienia")}>Wszystkie</button></div>
          {!(s.recent || []).length ? <div className="adm-empty adm-empty--sm">Brak zamówień.</div> : (
            <div className="adm-mini-list">
              {(s.recent || []).map((b) => (
                <div key={b.id} className="adm-mini-row">
                  <span className="adm-kind" style={{ background: KIND[b.kind]?.[1] }}>{KIND[b.kind]?.[0]}</span>
                  <span className="adm-mini-row__t"><b>#{b.number} · {b.car_name}</b><small>{b.full_name} · {when(b.paid_at || b.created_at)}</small></span>
                  <b>{fmtZl(b.amount_pln)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="adm-card">
          <div className="adm-card__head"><b>Kalendarz</b><button className="adm-btn adm-btn--sm" onClick={() => go("terms")}>Terminy</button></div>
          <div className="adm-calstats">
            <div><b>{s.upcomingTerms ?? 0}</b><span>nadchodzących terminów</span></div>
            <div><b>{s.nextTerm?.date || "—"}</b><span>najbliższy termin{s.nextTerm ? ` · ${trackLabel(s.nextTerm.track)}` : ""}</span></div>
            <div><b>{terms.filter((x) => (x.type || "sport") === "heels").length}</b><span>terminów Heels</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Kpi({ label, value, sub, ring, color, icon, onClick }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <button className="adm-kpi" onClick={onClick} style={{ ["--kc"]: color }}>
      <svg className="adm-kpi__ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} /><circle cx="32" cy="32" r={r} strokeDasharray={`${c * Math.max(0.02, ring)} ${c}`} transform="rotate(-90 32 32)" /></svg>
      <i className="adm-kpi__ic">{I[icon]}</i>
      <span className="adm-kpi__v">{value}</span>
      <span className="adm-kpi__l">{label}</span>
      <span className="adm-kpi__s">{sub}</span>
    </button>
  );
}
function Donut({ parts, total }) {
  const r = 40, c = 2 * Math.PI * r; let off = 0;
  return (
    <svg viewBox="0 0 100 100" className="adm-donut__svg">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef0f2" strokeWidth="14" />
      {parts.map((p, i) => { const len = (p.v / total) * c; const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={p.c} strokeWidth="14" strokeDasharray={`${len} ${c}`} strokeDashoffset={-off} transform="rotate(-90 50 50)" />; off += len; return el; })}
    </svg>
  );
}

/* ============ ORDERS & PAYMENTS ============ */
function OrdersTab({ only }) {
  const { adminCall } = useStore();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const reload = () => adminCall("bookings.list").then((r) => setRows(r.ok ? r.rows : []));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const list = useMemo(() => (rows || [])
    .filter((b) => (only ? b.kind === only : true))
    .filter((b) => filter === "all" ? true : filter === "paid" || filter === "pending" ? b.status === filter : b.kind === filter)
    .filter((b) => !q.trim() || `${b.number} ${b.full_name} ${b.email} ${b.car_name} ${b.voucher_code || ""} ${b.tpay_title || ""}`.toLowerCase().includes(q.toLowerCase())), [rows, filter, q, only]);
  const sumPaid = list.filter((b) => b.status === "paid").reduce((s, b) => s + (b.amount_pln || 0), 0);

  return (
    <div>
      <div className="adm-head">
        <div><h2>{only === "voucher" ? "Vouchery" : "Zamówienia i płatności"} <span className="adm-count">{list.length}</span></h2>
          <p className="adm-sub">Każde zamówienie ma swój dokument płatności z Tpay — kliknij „Szczegóły”. Status „Opłacone” ustawia wyłącznie potwierdzenie z bramki (albo ręcznie tutaj, np. po przelewie).</p></div>
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>
      <div className="adm-toolbar">
        <div className="adm-chips">
          {[["all", "Wszystkie"], ["paid", "Opłacone"], ["pending", "Oczekujące"], ...(only ? [] : [["track", "Szkolenia"], ["ice", "Laponia"], ["trip", "Wyprawy"], ["product", "Programy"], ["voucher", "Vouchery"]])].map(([k, l]) => (
            <button key={k} className={`adm-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input className="adm-search" placeholder="Szukaj: numer, klient, e-mail, kod…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="adm-toolbar__sum">Opłacone: <b>{fmtZl(sumPaid)}</b></span>
      </div>

      {rows === null ? <div className="adm-empty">Ładowanie…</div> : !list.length ? <div className="adm-empty">Brak zamówień.</div> : (
        <div className="adm-table">
          <div className="adm-tr adm-tr--head"><span>#</span><span>Data</span><span>Klient</span><span>Zamówienie</span><span>Kwota</span><span>Status</span><span /></div>
          {list.map((b) => (
            <div key={b.id} className={`adm-tr ${b.status === "pending" ? "is-pending" : ""}`}>
              <span className="adm-tr__no">#{b.number}</span>
              <span className="adm-tr__date">{when(b.created_at)}</span>
              <span className="adm-tr__who"><b>{b.full_name}</b><small>{b.email}</small></span>
              <span className="adm-tr__what"><span className="adm-kind" style={{ background: KIND[b.kind]?.[1] }}>{KIND[b.kind]?.[0]}</span><b>{b.car_name || b.product_name}</b><small>{b.sessions ? `${b.sessions} sesji · ` : ""}{b.term_label || b.package_name || ""}{b.voucher_code ? ` · ${b.voucher_code}` : ""}</small></span>
              <span className="adm-tr__sum"><b>{money(b)}</b>{b.currency === "EUR" && <small>{fmtZl(b.amount_pln)}</small>}</span>
              <span><i className={`adm-badge adm-badge--${STATUS[b.status]?.[1] || "off"}`}>{STATUS[b.status]?.[0] || b.status}</i>{b.payment_error && <small className="adm-tr__err" title={b.payment_error}>⚠</small>}</span>
              <span><button className="adm-mini adm-mini--dark" onClick={() => setOpen(b)}>Szczegóły</button></span>
            </div>
          ))}
        </div>
      )}
      {open && <OrderDrawer id={open.id} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

/* the payment document for one order — the Tpay transaction pulled live + our record */
function OrderDrawer({ id, onClose, onChanged }) {
  const { adminCall } = useStore();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => adminCall("bookings.tpay", { id }).then((r) => setD(r.ok ? r : { error: r.error }));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  const o = d?.order, tp = d?.tpay;
  const act = async (action, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(action);
    const r = await adminCall(action, { id });
    setBusy("");
    if (!r.ok) { alert("Nie udało się: " + (r.error || "")); return; }
    if (action === "bookings.delete") { onChanged(); onClose(); return; }
    await load(); onChanged();
  };
  const attempts = tp?.payments?.attempts || [];
  const lastAttempt = attempts[attempts.length - 1];

  return (
    <div className="adm-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-drawer">
        <div className="adm-form__head"><h3>Zamówienie {o ? `#${o.number}` : ""}</h3><div className="adm-drawer__ops"><button className="adm-mini" onClick={() => window.print()}>Drukuj</button><button className="adm-x" onClick={onClose}>×</button></div></div>
        {!d ? <div className="adm-empty">Ładowanie…</div> : d.error ? <div className="adm-empty">{d.error}</div> : (
          <div className="adm-doc">
            <div className="adm-doc__head">
              <div><span className="adm-doc__eyebrow">FASTLINE RACING ACADEMY · DOKUMENT PŁATNOŚCI</span><h4>Zamówienie #{o.number}</h4><small>utworzone {when(o.created_at)}{o.paid_at ? ` · opłacone ${when(o.paid_at)}` : ""}</small></div>
              <i className={`adm-badge adm-badge--${STATUS[o.status]?.[1] || "off"} adm-badge--lg`}>{STATUS[o.status]?.[0] || o.status}</i>
            </div>
            <div className="adm-doc__grid">
              <section>
                <h5>Klient</h5>
                <dl><div><dt>Imię i nazwisko</dt><dd>{o.full_name}</dd></div><div><dt>E-mail</dt><dd><a href={`mailto:${o.email}`}>{o.email}</a></dd></div><div><dt>Telefon</dt><dd><a href={`tel:${o.phone}`}>{o.phone}</a></dd></div>{o.note && <div><dt>Uwagi</dt><dd>{o.note}</dd></div>}</dl>
              </section>
              <section>
                <h5>Przedmiot</h5>
                <dl>
                  <div><dt>Rodzaj</dt><dd><span className="adm-kind" style={{ background: KIND[o.kind]?.[1] }}>{KIND[o.kind]?.[0]}</span></dd></div>
                  <div><dt>{o.kind === "track" || o.kind === "voucher" ? "Samochód" : "Produkt"}</dt><dd>{o.car_name || o.product_name}</dd></div>
                  {o.sessions && <div><dt>Pakiet</dt><dd>{o.sessions} sesji</dd></div>}
                  {o.package_name && <div><dt>Pakiet</dt><dd>{o.package_name}</dd></div>}
                  {o.persons > 1 && <div><dt>Osób</dt><dd>{o.persons}</dd></div>}
                  {o.term_label && <div><dt>Termin</dt><dd>{o.term_label}</dd></div>}
                  {o.date_from && <div><dt>Daty</dt><dd>{o.date_from}{o.date_to && o.date_to !== o.date_from ? ` – ${o.date_to}` : ""}</dd></div>}
                  {o.voucher_code && <div><dt>Kod vouchera</dt><dd><b className="adm-code">{o.voucher_code}</b></dd></div>}
                  {o.voucher_for && <div><dt>Voucher dla</dt><dd>{o.voucher_for}</dd></div>}
                  {o.voucher_message && <div><dt>Dedykacja</dt><dd>{o.voucher_message}</dd></div>}
                </dl>
              </section>
              <section>
                <h5>Kwoty</h5>
                <dl>
                  <div><dt>Wartość netto</dt><dd><b>{money(o)}</b></dd></div>
                  {o.currency === "EUR" && <div><dt>Do zapłaty (PLN)</dt><dd><b>{fmtZl(o.amount_pln)}</b></dd></div>}
                  <div><dt>Zapłacono</dt><dd>{o.paid_amount != null ? fmtZl(o.paid_amount) : "—"}</dd></div>
                  <div><dt>Metoda</dt><dd>{o.tpay_method || lastAttempt?.paymentMethod || "—"}</dd></div>
                  {o.payment_error && <div><dt>Uwaga</dt><dd className="adm-doc__err">{o.payment_error}</dd></div>}
                </dl>
              </section>
              <section className="adm-doc__tpay">
                <h5>Tpay — transakcja</h5>
                {!o.tpay_id ? <p className="adm-muted">Brak transakcji Tpay (zamówienie ręczne lub testowe).</p> : (
                  <dl>
                    <div><dt>Tytuł</dt><dd><b>{o.tpay_title}</b></dd></div>
                    <div><dt>ID</dt><dd><code>{o.tpay_id}</code></dd></div>
                    <div><dt>Status w Tpay</dt><dd>{tp ? <i className={`adm-badge adm-badge--${tp.status === "correct" || tp.status === "paid" ? "ok" : tp.status === "pending" ? "warn" : "off"}`}>{tp.status}</i> : (d.tpayError ? <span className="adm-doc__err">{d.tpayError}</span> : "—")}</dd></div>
                    {tp?.date?.creation && <div><dt>Utworzona</dt><dd>{tp.date.creation}</dd></div>}
                    {tp?.date?.realization && <div><dt>Zrealizowana</dt><dd>{tp.date.realization}</dd></div>}
                    {tp?.amount != null && <div><dt>Kwota w Tpay</dt><dd>{tp.amount} {tp.currency}</dd></div>}
                    {tp?.payer?.email && <div><dt>Płatnik</dt><dd>{tp.payer.name || ""} · {tp.payer.email}</dd></div>}
                    {!!attempts.length && <div><dt>Próby płatności</dt><dd>{attempts.map((a, i) => <span key={i} className="adm-attempt">{a.date?.creation || ""} · {a.paymentMethod || a.channelId || "—"} · {a.paymentError?.errorMessage || "ok"}</span>)}</dd></div>}
                    {o.payment_url && o.status === "pending" && <div><dt>Link do płatności</dt><dd><a href={o.payment_url} target="_blank" rel="noreferrer">{o.payment_url}</a></dd></div>}
                    <div><dt>Panel Tpay</dt><dd><a href="https://panel.tpay.com/" target="_blank" rel="noreferrer">panel.tpay.com ↗</a></dd></div>
                  </dl>
                )}
              </section>
            </div>
            <div className="adm-doc__foot">
              {o.status !== "paid" && <button className="adm-btn adm-btn--green" disabled={!!busy} onClick={() => act("bookings.markPaid", "Oznaczyć zamówienie jako OPŁACONE (np. po przelewie)? Wyśle to potwierdzenie e-mail do klienta.")}>{busy === "bookings.markPaid" ? "…" : "Oznacz jako opłacone"}</button>}
              {o.status === "paid" && <button className="adm-btn" disabled={!!busy} onClick={() => act("bookings.resendMail")}>{busy === "bookings.resendMail" ? "…" : "Wyślij ponownie e-maile"}</button>}
              {o.status === "pending" && <button className="adm-btn" disabled={!!busy} onClick={() => act("bookings.cancel", "Anulować zamówienie?")}>Anuluj</button>}
              <span style={{ flex: 1 }} />
              <button className="adm-btn adm-btn--danger" disabled={!!busy} onClick={() => act("bookings.delete", "Usunąć zamówienie bezpowrotnie?")}>Usuń</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ MESSAGES (contact / company inquiries) ============ */
function MessagesTab({ kind }) {
  const { adminCall } = useStore();
  const [rows, setRows] = useState(null);
  const reload = () => adminCall("messages.list").then((r) => setRows(r.ok ? r.rows.filter((m) => (m.kind || "contact") === kind) : []));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [kind]);
  const remove = async (m) => { if (!confirm(`Usunąć wiadomość od ${m.full_name}?`)) return; setRows((l) => l.filter((x) => x.id !== m.id)); const r = await adminCall("messages.delete", { id: m.id }); if (!r.ok) { alert("Nie udało się usunąć"); reload(); } };
  const markRead = async (m) => { setRows((l) => l.map((x) => (x.id === m.id ? { ...x, is_read: true } : x))); await adminCall("messages.read", { id: m.id }); };
  const unread = (rows || []).filter((m) => !m.is_read).length;
  const title = kind === "firma" ? "Zapytania firmowe" : "Wiadomości";
  return (
    <div>
      <div className="adm-head"><div><h2>{title} <span className="adm-count">{rows?.length ?? "…"}{unread ? ` · ${unread} nowe` : ""}</span></h2>
        <p className="adm-sub">{kind === "firma" ? "Briefy z konfiguratora eventów (/dla-firm). Każdy jest też wysyłany e-mailem do działu sprzedaży i z autoodpowiedzią do firmy." : "Formularz ze strony Kontakt. Każda wiadomość jest też wysyłana e-mailem na adresy z „Ustawień”."}</p></div>
        <button className="adm-btn" onClick={reload}>Odśwież</button></div>
      {rows === null ? <div className="adm-empty">Ładowanie…</div> : !rows.length ? <div className="adm-empty">Brak wiadomości.</div> : (
        <div className="adm-msgs">
          {rows.map((m) => (
            <div className={`adm-msg ${m.is_read ? "" : "is-new"}`} key={m.id} onMouseEnter={() => !m.is_read && markRead(m)}>
              <div className="adm-msg__top">
                <div><span className="adm-msg__name">{m.company ? `${m.company} · ` : ""}{m.full_name}</span>{m.subject && <span className="adm-msg__subject">{m.subject}</span>}{!m.sent && <span className="adm-msg__warn">e-mail nie wysłany</span>}</div>
                <div className="adm-msg__ops"><span className="adm-msg__date">{when(m.created_at)}</span><button className="adm-mini adm-mini--del" onClick={() => remove(m)}>Usuń</button></div>
              </div>
              <div className="adm-msg__meta"><a href={`mailto:${m.email}`}>{m.email}</a>{m.phone && <> · <a href={`tel:${m.phone}`}>{m.phone}</a></>}</div>
              {m.meta && (
                <dl className="adm-msg__brief">
                  {[["Cel", m.meta.goal], ["Osób", m.meta.persons], ["Lokalizacja", m.meta.track], ["Długość", m.meta.length], ["Auta", m.meta.cars], ["Termin", m.meta.date], ["Dodatki", Array.isArray(m.meta.extras) ? m.meta.extras.join(", ") : ""], ["Wycena", m.meta.estimate]]
                    .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              )}
              {m.message && <p className="adm-msg__body">{m.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ SETTINGS ============ */
const CONFIG_FIELDS = [
  { k: "order_to", l: "E-maile o nowych zamówieniach (szkolenia, Laponia, wyprawy, programy)", hint: "kilka adresów po przecinku" },
  { k: "voucher_to", l: "E-maile o sprzedanych voucherach" },
  { k: "contact_to", l: "E-maile z formularza Kontakt" },
  { k: "firma_to", l: "E-maile z zapytań firmowych" },
  { k: "contact_from", l: "Nadawca wiadomości (Resend)", hint: "np. Fastline Racing Academy <kontakt.na.stronie@fastlineracingacademy.pl>" },
  { k: "eur_pln", l: "Kurs EUR → PLN do płatności (Laponia, wyprawy)", hint: "np. 4.35 — kwota w euro × kurs = kwota do zapłaty w Tpay" },
];
function SettingsTab() {
  const { adminCall } = useStore();
  const [vals, setVals] = useState(null);
  const [saved, setSaved] = useState("");
  useEffect(() => { adminCall("config.get").then((r) => { const m = {}; (r.rows || []).forEach((x) => { m[x.key] = x.value; }); setVals(m); }); /* eslint-disable-next-line */ }, []);
  const save = async (k) => { const r = await adminCall("config.set", { key: k, value: vals[k] ?? "" }); setSaved(r.ok ? k : ""); setTimeout(() => setSaved(""), 1500); };
  if (!vals) return <div className="adm-empty">Ładowanie…</div>;
  return (
    <div>
      <div className="adm-head"><div><h2>Ustawienia</h2><p className="adm-sub">Adresy odbiorców i kurs waluty. Klucze (Tpay, Resend, AI) są w sekretach serwera — nie tutaj.</p></div></div>
      <div className="adm-card adm-settings">
        {CONFIG_FIELDS.map((f) => (
          <label key={f.k} className="adm-f">
            <span>{f.l}</span>
            <div className="adm-settings__row">
              <input value={vals[f.k] ?? ""} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} onBlur={() => save(f.k)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
              <i className={`adm-settings__ok ${saved === f.k ? "on" : ""}`}>✓ zapisano</i>
            </div>
            {f.hint && <small className="adm-hint">{f.hint}</small>}
          </label>
        ))}
        <div className="adm-note" style={{ marginTop: 6 }}>
          Hasło administratora, klucze Tpay i Resend zmienia się po stronie serwera (Supabase). Prosimy o kontakt z administratorem technicznym.
        </div>
      </div>
    </div>
  );
}

/* ============ MENU TAB ============ */
function MenuTab() {
  const { raw, saveContent } = useStore();
  return (
    <div>
      <div className="adm-head"><div><h2>Menu <span className="adm-count">{MENU.length}</span></h2>
        <p className="adm-sub">Pozycje górnej nawigacji. Pierwsza pozycja („KUP SZKOLENIE”) jest czerwonym przyciskiem. „Etykieta” to tekst PL (EN tłumaczy się automatycznie), „Adres” — dokąd prowadzi link.</p></div></div>
      <div className="adm-menu">{MENU.map((id) => <MenuRow key={id} id={id} raw={raw} saveContent={saveContent} />)}</div>
      <div className="adm-head" style={{ marginTop: 30 }}><div><h2>Social media</h2><p className="adm-sub">Linki do profili (ikony w nagłówku i stopce). Pusty adres = ikona znika.</p></div></div>
      <div className="adm-menu">{["facebook", "instagram", "linkedin", "youtube", "tiktok"].map((k) => <SocialRow key={k} k={k} raw={raw} saveContent={saveContent} />)}</div>
    </div>
  );
}
function MenuRow({ id, raw, saveContent }) {
  const [label, setLabel] = useState(raw(id).pl || "");
  const [href, setHref] = useState(raw(hrefKey(id)).pl || MENU_HREF[id] || "");
  const commitLabel = () => { const v = label.trim(); if (v && v !== raw(id).pl) saveContent(id, v, "text"); };
  const commitHref = () => { const v = href.trim(); if (v && v !== (raw(hrefKey(id)).pl || MENU_HREF[id])) saveContent(hrefKey(id), v, "url"); };
  return (
    <div className="adm-menu__row">
      <label className="adm-f adm-menu__f"><span>Etykieta (PL)</span><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} /></label>
      <label className="adm-f adm-menu__f"><span>Adres (link)</span><input value={href} onChange={(e) => setHref(e.target.value)} onBlur={commitHref} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="/oferta lub https://…" /></label>
    </div>
  );
}

function SocialRow({ k, raw, saveContent }) {
  const [href, setHref] = useState(raw(`soc.${k}`).pl || "");
  const commit = () => { const v = href.trim(); if (v !== (raw(`soc.${k}`).pl || "")) saveContent(`soc.${k}`, v || " ", "url"); };
  return (
    <div className="adm-menu__row">
      <label className="adm-f adm-menu__f"><span>{k}</span><input value={href} onChange={(e) => setHref(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="https://…" /></label>
    </div>
  );
}

/* ============ ENTITY TAB ============ */
function EntityTab({ table }) {
  const store = useStore();
  const items = store.getters[table] || [];
  const cfg = CFG[table];
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const blank = () => {
    const r = { visible: true, sort: (items.at(-1)?.sort || 0) + 1 };
    cfg.fields.forEach((f) => { r[f.k] = f.t === "images" ? [] : f.t === "color" ? "#2b2b2b" : f.t === "select" ? (f.options?.[0]?.value ?? "") : f.t === "number" ? "" : ""; });
    setEditing(r);
  };
  const save = async () => { setBusy(true); await store.upsertEntity(table, editing); setBusy(false); setEditing(null); };
  const remove = async (id) => { if (!confirm("Usunąć ten element?")) return; await store.deleteEntity(table, id); };
  const move = async (i, d) => { const arr = items.map((x) => x.id); const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; await store.reorderEntity(table, arr); };

  return (
    <div>
      <div className="adm-head"><div><h2>{cfg.label} <span className="adm-count">{items.length}</span></h2>{cfg.note && <p className="adm-sub">{cfg.note}</p>}</div><button className="adm-btn adm-btn--red" onClick={blank}>+ Dodaj</button></div>
      <div className="adm-list">
        {items.map((r, i) => (
          <div className="adm-row" key={r.id}>
            <div className="adm-row__thumb" style={{ background: r.color || "#e9eaec" }}>{(r.png || r.photo || r.image || r.photos?.[0]) && <img src={r.png || r.photo || r.image || r.photos?.[0]} alt="" />}</div>
            <div className="adm-row__title">{cfg.title(r) || "—"}{r.visible === false && <span className="adm-badge adm-badge--off" style={{ marginLeft: 8 }}>ukryte</span>}</div>
            <div className="adm-row__ops">
              <button className="adm-mini" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="adm-mini" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button className="adm-mini adm-mini--dark" onClick={() => setEditing({ ...r })}>Edytuj</button>
              <button className="adm-mini adm-mini--del" onClick={() => remove(r.id)}>Usuń</button>
            </div>
          </div>
        ))}
        {!items.length && <div className="adm-empty">Brak elementów. Kliknij „+ Dodaj”.</div>}
      </div>
      {editing && (
        <div className="adm-modal" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="adm-form">
            <div className="adm-form__head"><h3>{editing.id ? "Edytuj" : "Nowy element"}</h3><button className="adm-x" onClick={() => setEditing(null)}>×</button></div>
            <div className="adm-form__body">
              {cfg.fields.filter((f) => !f.trip || editing.theme === "wyprawa").map((f) => <Field key={f.k} f={f} value={editing[f.k]} onChange={(v) => setEditing((e) => ({ ...e, [f.k]: v }))} />)}
              {table === "products" && editing.theme === "wyprawa" && <TripEditor slug={editing.slug} />}
            </div>
            <div className="adm-form__foot">
              <label className="adm-check"><input type="checkbox" checked={editing.visible !== false} onChange={(e) => setEditing((x) => ({ ...x, visible: e.target.checked }))} />Widoczne na stronie</label>
              <div style={{ flex: 1 }} />
              <button className="adm-btn" onClick={() => setEditing(null)}>Anuluj</button>
              <button className="adm-btn adm-btn--red" onClick={save} disabled={busy}>{busy ? "Zapisuję…" : "Zapisz"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ TRIP EDITOR (inside the product form) ============ */
const TRIP_TABS = [{ t: "trip_points", l: "Punkty na mapie" }, { t: "trip_packages", l: "Pakiety" }, { t: "trip_attractions", l: "Atrakcje" }];
function TripEditor({ slug }) {
  const [tab, setTab] = useState("trip_packages");
  const store = useStore();
  const cfg = CFG[tab];
  const rows = (store.getters[tab] || []).filter((r) => r.product_slug === slug);
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!slug) return <div className="adm-trip"><div className="adm-note">Najpierw wpisz „Adres podstrony” (slug) i zapisz produkt — potem dodasz tu pakiety, punkty trasy i atrakcje.</div></div>;
  const fields = cfg.fields.filter((f) => f.k !== "product_slug");
  const blank = () => { const r = { product_slug: slug, visible: true, sort: (rows.at(-1)?.sort || 0) + 1 }; fields.forEach((f) => { r[f.k] = f.t === "images" ? [] : f.t === "select" ? (f.options?.[0]?.value ?? "") : ""; }); setRow(r); };
  const save = async () => { setBusy(true); await store.upsertEntity(tab, { ...row, product_slug: slug }); setBusy(false); setRow(null); };
  const remove = async (r) => { if (!confirm("Usunąć ten element?")) return; await store.deleteEntity(tab, r.id); };
  const move = async (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const ids = rows.map((x) => x.id); [ids[i], ids[j]] = [ids[j], ids[i]]; await store.reorderEntity(tab, ids); };
  return (
    <div className="adm-trip">
      <div className="adm-trip__head"><span className="adm-trip__lbl">Ustawienia wyprawy</span>
        <div className="adm-trip__tabs">{TRIP_TABS.map((x) => <button key={x.t} type="button" className={`adm-trip__tab ${tab === x.t ? "on" : ""}`} onClick={() => { setTab(x.t); setRow(null); }}>{x.l} <i>{(store.getters[x.t] || []).filter((r) => r.product_slug === slug).length}</i></button>)}</div></div>
      <div className="adm-note">{cfg.note}</div>
      <div className="adm-trip__list">
        {rows.map((r, i) => (
          <div className="adm-trip__row" key={r.id}><span className="adm-trip__n">{i + 1}</span><span className="adm-trip__t">{(cfg.title(r) || "—").replace(`${slug} · `, "")}</span>
            <span className="adm-trip__ops"><button type="button" className="adm-mini" onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button type="button" className="adm-mini" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button><button type="button" className="adm-mini adm-mini--dark" onClick={() => setRow({ ...r })}>Edytuj</button><button type="button" className="adm-mini adm-mini--del" onClick={() => remove(r)}>Usuń</button></span></div>
        ))}
        {!rows.length && <div className="adm-empty adm-empty--sm">Brak elementów.</div>}
      </div>
      {row ? (
        <div className="adm-trip__form">{fields.map((f) => <Field key={f.k} f={f} value={row[f.k]} onChange={(v) => setRow((x) => ({ ...x, [f.k]: v }))} />)}
          <div className="adm-trip__foot"><button type="button" className="adm-btn" onClick={() => setRow(null)}>Anuluj</button><button type="button" className="adm-btn adm-btn--red" onClick={save} disabled={busy}>{busy ? "Zapisuję…" : "Zapisz element"}</button></div></div>
      ) : <button type="button" className="adm-btn" onClick={blank}>+ Dodaj</button>}
    </div>
  );
}

/* ============ FIELD ============ */
function Field({ f, value, onChange }) {
  const { adminCall } = useStore();
  const [st, setSt] = useState(null);     // upload status: convert → upload → done / error
  const up = !!st && (st.stage === "convert" || st.stage === "upload");
  // every picked image is re-encoded to WebP in the browser first; the chip shows each stage and the size win
  const upload = async (file) => {
    const url = await processUpload(file, `${f.k}/${Date.now()}-${Math.round(performance.now())}`, adminCall, setSt);
    setTimeout(() => setSt((x) => (x && (x.stage === "done" || x.stage === "error") ? null : x)), 6000);
    return url;
  };
  if (f.t === "video") return (<label className="adm-f"><span>{f.l}</span><div className="adm-img">{value && <video src={value} muted loop autoPlay playsInline style={{ maxWidth: 220 }} />}<input type="file" accept="video/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const url = await upload(file); if (url) onChange(url); }} /><UploadStatus st={st} />{value && <button type="button" className="adm-mini adm-mini--del" onClick={() => onChange("")}>Usuń</button>}</div></label>);
  if (f.t === "text") return (<label className="adm-f"><span>{f.l}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);
  if (f.t === "textarea") return (<label className="adm-f"><span>{f.l}</span><textarea rows={4} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);
  if (f.t === "number") return (<label className="adm-f"><span>{f.l}</span><input type="number" min="0" value={value ?? ""} placeholder="0" onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} /></label>);
  if (f.t === "check") return (<label className="adm-f adm-f--check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{f.l}</span></label>);
  if (f.t === "date") return (<label className="adm-f"><span>{f.l}</span><input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);
  if (f.t === "select") return (<label className="adm-f"><span>{f.l}</span><select className="adm-select" value={value || f.options?.[0]?.value || ""} onChange={(e) => onChange(e.target.value)}>{(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>);
  if (f.t === "color") return (<label className="adm-f"><span>{f.l}</span><div className="adm-color"><input type="color" value={value || "#2b2b2b"} onChange={(e) => onChange(e.target.value)} /><input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#RRGGBB" /></div></label>);
  if (f.t === "image") return (<label className="adm-f"><span>{f.l}</span><div className="adm-img">{value && <img src={value} alt="" />}<input type="file" accept="image/*,video/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const url = await upload(file); if (url) onChange(url); }} /><UploadStatus st={st} />{value && <button type="button" className="adm-mini adm-mini--del" onClick={() => onChange("")}>Usuń</button>}</div></label>);
  if (f.t === "images") {
    const arr = Array.isArray(value) ? value : [];
    return (<label className="adm-f"><span>{f.l}</span><div className="adm-imgs">{arr.map((u, i) => <div className="adm-imgs__item" key={i}><img src={u} alt="" /><button type="button" onClick={() => onChange(arr.filter((_, j) => j !== i))}>×</button></div>)}
      <label className="adm-imgs__add">{up ? "…" : "+"}<input type="file" accept="image/*" hidden multiple onChange={async (e) => { const files = [...(e.target.files || [])]; const urls = []; for (const file of files) { const u = await upload(file); if (u) urls.push(u); } onChange([...arr, ...urls]); }} /></label>
      <UploadStatus st={st} /></div></label>);
  }
  return null;
}
