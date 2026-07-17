import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { fileToWebpDataUrl, fileToDataUrl } from "../lib/api";
import { MENU, MENU_HREF, hrefKey } from "../lib/menu";
import { TRACKS, trackLabel, fmtZl } from "../lib/flota";
import { TERM_TYPES } from "../lib/kalendarz";
import "./admin.css";

/* ---- field configs per entity ---- */
const CFG = {
  cars: {
    label: "Samochody",
    fields: [
      { k: "name", t: "text", l: "Nazwa (pełna)" },
      { k: "badge", t: "text", l: "Numer / bejd (np. 911)" },
      { k: "color", t: "color", l: "Kolor tła / akcent" },
      { k: "png", t: "image", l: "PNG wycięty (opcjonalnie)" },
      { k: "engine", t: "text", l: "Silnik" },
      { k: "power", t: "text", l: "Moc (np. 530 KM)" },
      { k: "torque", t: "text", l: "Moment (np. 650 NM)" },
      { k: "top_speed", t: "text", l: "Prędkość maks. (np. 330 KM/H)" },
      { k: "description_pl", t: "textarea", l: "Opis (PL — EN tłumaczy się samo)" },
      { k: "photos", t: "images", l: "Zdjęcia (mini-slider)" },
      { k: "price_1", t: "number", l: "💰 Cena 1 sesja — Łódź (zł)" },
      { k: "price_3", t: "number", l: "💰 3 sesje / Experience — Łódź (zł)" },
      { k: "price_5", t: "number", l: "💰 5 sesji — Łódź (zł)" },
      { k: "price_6", t: "number", l: "💰 6 sesji / Sport — Łódź (zł)" },
      { k: "price_9", t: "number", l: "💰 9 sesji / Performance — Łódź (zł)" },
      { k: "price_1_poznan", t: "number", l: "🟠 1 sesja — Poznań (zł)" },
      { k: "price_3_poznan", t: "number", l: "🟠 3 sesje — Poznań (zł)" },
      { k: "price_5_poznan", t: "number", l: "🟠 5 sesji — Poznań (zł)" },
      { k: "price_6_poznan", t: "number", l: "🟠 6 sesji — Poznań (zł)" },
      { k: "price_9_poznan", t: "number", l: "🟠 9 sesji — Poznań (zł)" },
    ],
    note: "Ceny: pakiety 1 / 3 / 5 / 6 / 9 sesji. Termin na torze Poznań używa cen „Poznań”, wszystkie inne tory — cen „Łódź”.",
    title: (r) => r.name,
  },
  terms: {
    label: "Terminy",
    note: "Terminy szkoleń — to z nich buduje się KALENDARZ na stronie oraz lista terminów w rezerwacji. " +
      "Rodzaj decyduje o kolorze i nazwie w kalendarzu („Heels on the track” ma tu swoje terminy i własną rezerwację). " +
      "Wybrany TOR decyduje o cenniku: Poznań → cennik poznański, pozostałe tory → cennik łódzki.",
    fields: [
      { k: "type", t: "select", l: "Rodzaj szkolenia (kolor w kalendarzu)", options: TERM_TYPES.map((ty) => ({ value: ty.slug, label: ty.pl })) },
      { k: "title_pl", t: "text", l: "Nazwa w kalendarzu (puste = nazwa rodzaju)" },
      { k: "track", t: "select", l: "Tor", options: TRACKS.map((tr) => ({ value: tr.slug, label: tr.pl })) },
      { k: "date", t: "date", l: "Data" },
      { k: "time", t: "text", l: "Godziny (np. 09:00–13:00)" },
      { k: "capacity", t: "number", l: "Liczba miejsc" },
      { k: "location_pl", t: "text", l: "Nazwa toru wyświetlana (puste = domyślna nazwa toru)" },
      { k: "description_pl", t: "textarea", l: "Opis szkolenia (widoczny w kalendarzu; PL — EN tłumaczy się samo)" },
      { k: "photo", t: "image", l: "Zdjęcie (karta w kalendarzu, opcjonalnie)" },
    ],
    title: (r) => `${r.date || "—"} · ${r.time || ""} · ${r.title_pl || ""} · ${r.location_pl || trackLabel(r.track)}`,
  },
  instructors: {
    label: "Instruktorzy",
    fields: [
      { k: "name", t: "text", l: "Imię i nazwisko" },
      { k: "label_pl", t: "text", l: "Etykieta górna (np. ZAWODNIK)" },
      { k: "subtitle_pl", t: "text", l: "Podpis (np. KIEROWCA WYŚCIGOWY)" },
      { k: "color", t: "color", l: "Kolor prostokąta" },
      { k: "photo", t: "image", l: "Zdjęcie (PNG sylwetka)" },
      { k: "signature", t: "text", l: "Podpis odręczny (tekst — pusty = brak)" },
      { k: "description_pl", t: "textarea", l: "Opis (opcjonalnie)" },
    ],
    title: (r) => r.name,
  },
  events: {
    label: "Wydarzenia",
    note: "Karty wydarzeń na STRONIE GŁÓWNEJ. „Heels on the track” tu się NIE pokazuje — terminy Heels dodaje się w zakładce „Terminy” (rodzaj: Heels) i widać je w KALENDARZU. " +
      "„Sport driving experience” pokazuje się na głównej, a przycisk „Zapisz się” prowadzi do rezerwacji z wybraną datą i wyborem auta. " +
      "Tor decyduje o cenniku rezerwacji (Poznań → poznański, inne → łódzki).",
    fields: [
      { k: "title_pl", t: "select", l: "Nazwa wydarzenia", options: [
        { value: "SPORT DRIVING EXPERIENCE", label: "Sport driving experience" },
        { value: "HEELS ON THE TRACK", label: "Heels on the track" },
      ] },
      { k: "track", t: "select", l: "Tor (cennik rezerwacji)", options: TRACKS.map((tr) => ({ value: tr.slug, label: tr.pl })) },
      { k: "stage_pl", t: "text", l: "Etap (np. STAGE 1)" },
      { k: "location_pl", t: "text", l: "Lokalizacja (np. TOR ŁÓDŹ)" },
      { k: "weekday_pl", t: "text", l: "Dzień tygodnia" },
      { k: "day", t: "text", l: "Dzień (liczba)" },
      { k: "month_pl", t: "text", l: "Miesiąc" },
      { k: "time", t: "text", l: "Godziny (np. 16:00–20:00)" },
      { k: "color", t: "color", l: "Kolor nakładki" },
      { k: "photo", t: "image", l: "Zdjęcie" },
      { k: "description_pl", t: "textarea", l: "Opis (panel po prawej)" },
      { k: "signup_url", t: "text", l: "Link zapisu (opcjonalnie, nadpisuje rezerwację)" },
    ],
    title: (r) => `${r.day || "?"} · ${r.title_pl || ""}`,
  },
  products: {
    label: "Produkty",
    note: "Produkty ze strony „Produkty” (/produkty). Każdy ma własną podstronę /produkty/<adres>. " +
      "Listy (czego się nauczysz, w pakiecie, miejsca, pakiety) wpisuje się JEDNA POZYCJA W JEDNEJ LINII. " +
      "Jeśli wypełnisz „Link zewnętrzny”, kafelek nie otwiera podstrony, tylko prowadzi na wskazaną stronę (tak działa Heels on the Track).",
    fields: [
      { k: "code", t: "text", l: "Kod / bejd (np. STAGE 1)" },
      { k: "title_pl", t: "text", l: "Nazwa (PL — EN tłumaczy się samo)" },
      { k: "tag_pl", t: "text", l: "Etykieta / poziom (np. DLA KAŻDEGO)" },
      { k: "slug", t: "text", l: "Adres podstrony (np. stage-1)" },
      { k: "color", t: "color", l: "Kolor akcentu" },
      { k: "theme", t: "select", l: "Styl podstrony", options: [
        { value: "default", label: "Standardowy (racing)" },
        { value: "ice", label: "Lodowy (Laponia)" },
        { value: "d2r", label: "Driver2Racer (czerwony)" },
        { value: "wyprawa", label: "Wyprawa (luksusowa — kolor akcentu steruje stroną)" },
      ] },
      // trip-only fields — they appear as soon as „Wyprawa” is chosen as the style
      { k: "trip_status", t: "select", l: "Wyprawa — status", trip: true, options: [
        { value: "upcoming", label: "Jeszcze będzie (pakiety widoczne)" },
        { value: "past", label: "Już się odbyła (pakiety ukryte, pokazuje relację)" },
      ] },
      { k: "trip_dates_pl", t: "text", l: "Wyprawa — daty (np. 6–13 CZERWCA 2026)", trip: true },
      { k: "schedule_pl", t: "textarea", l: "Wyprawa — harmonogram (jeden dzień = jedna linia, np. „Sobota, 06.06 — Przylot”)", trip: true },
      { k: "map_query", t: "text", l: "Wyprawa — nazwa trasy na mapie (np. Monaco)", trip: true },
      { k: "recap_pl", t: "textarea", l: "Wyprawa — relacja (widoczna, gdy wyprawa już się odbyła)", trip: true },
      { k: "recap_photos", t: "images", l: "Wyprawa — zdjęcia z relacji (dopóki puste, na stronie jest tylko napis „wkrótce”)", trip: true },
      { k: "price", t: "number", l: "Cena pakietu (0 = brak ceny stałej)" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "PLN", label: "PLN" }, { value: "EUR", label: "EUR" }] },
      { k: "buy_direct", t: "check", l: "Kup od razu (bez konfiguratora — dane + płatność)" },
      { k: "photo", t: "image", l: "Zdjęcie główne (kafelek + hero podstrony)" },
      { k: "video", t: "video", l: "Wideo hero (opcjonalnie — MP4/WebM, używane np. w Laponii)" },
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
      { k: "logo", t: "image", l: "Logo produktu (opcjonalnie — zastępuje bejd na kafelku, jak Heels)" },
      { k: "external_url", t: "text", l: "Link zewnętrzny (opcjonalnie — zamiast podstrony)" },
      { k: "info_only", t: "check", l: "Strona tylko informacyjna (bez przycisków rezerwacji — jak symulator)" },
    ],
    title: (r) => `${r.code ? r.code + " · " : ""}${r.title_pl || ""}`,
  },
  trip_points: {
    label: "Wyprawy — punkty na mapie",
    note: "Pinezki trasy — miejsca, po których jeździmy podczas wyprawy. Każdy punkt to pinezka na mapie; " +
      "od dwóch punktów w górę Google rysuje między nimi trasę. „Miejsce na mapie” musi być rozpoznawalne przez Google Maps.",
    fields: [
      { k: "product_slug", t: "text", l: "Adres wyprawy (slug produktu, np. monaco)" },
      { k: "title_pl", t: "text", l: "Nazwa punktu (np. COL DE TURINI)" },
      { k: "place", t: "text", l: "Miejsce na mapie Google (np. „Col de Turini, France”)" },
      { k: "note_pl", t: "text", l: "Krótki opis (np. Legendarne serpentyny Rajdu Monte Carlo)" },
    ],
    title: (r) => `${r.title_pl || r.place || "?"}`,
  },
  trip_packages: {
    label: "Wyprawy — pakiety",
    note: "Pakiety wypraw (Monaco…). Może ich być dowolna liczba — dodaj, usuń lub ukryj. " +
      "Cena steruje zakupem (liczona na serwerze). Gdy wyprawa ma status „już się odbyła”, pakiety są ukryte na stronie, ale zostają tutaj.",
    fields: [
      { k: "product_slug", t: "text", l: "Adres wyprawy (slug produktu, np. monaco)" },
      { k: "name_pl", t: "text", l: "Nazwa pakietu (np. SUPERDRIVE)" },
      { k: "price", t: "number", l: "Cena za osobę" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "EUR", label: "EUR" }, { value: "PLN", label: "PLN" }] },
      { k: "includes_pl", t: "textarea", l: "W pakiecie (jedna pozycja = jedna linia)" },
      { k: "note_pl", t: "textarea", l: "Uwagi (np. szacowany koszt lotów — jedna linia = jedna uwaga)" },
    ],
    title: (r) => `${r.product_slug || "?"} · ${r.name_pl || ""} · ${r.price || 0} ${r.currency || "EUR"}`,
  },
  trip_attractions: {
    label: "Wyprawy — atrakcje",
    note: "Sekcja „W programie” na stronie wyprawy. Krótki opis widać na kafelku, pełny po kliknięciu.",
    fields: [
      { k: "product_slug", t: "text", l: "Adres wyprawy (slug produktu, np. monaco)" },
      { k: "title_pl", t: "text", l: "Nazwa atrakcji" },
      { k: "short_pl", t: "textarea", l: "Krótki opis (kafelek)" },
      { k: "body_pl", t: "textarea", l: "Pełny opis (po kliknięciu)" },
      { k: "photo", t: "image", l: "Zdjęcie" },
      { k: "optional", t: "check", l: "Opcja dodatkowa" },
    ],
    title: (r) => `${r.product_slug || "?"} · ${r.title_pl || ""}`,
  },
  ice_packages: {
    label: "Laponia — pakiety",
    note: "Pakiety Ice Driving Experience (Laponia). Cena i liczba dni STERUJĄ KONFIGURATOREM: klient wybiera pakiet, " +
      "a potem pierwszy dzień pobytu — kolejne dni dobierają się automatycznie. Cena jest liczona na serwerze (za osobę).",
    fields: [
      { k: "name_pl", t: "text", l: "Nazwa pakietu (PL — EN tłumaczy się samo)" },
      { k: "days", t: "number", l: "Liczba dni na torze" },
      { k: "sessions_pl", t: "text", l: "Sesje (np. 12 sesji po 30 minut)" },
      { k: "price", t: "number", l: "Cena za osobę" },
      { k: "currency", t: "select", l: "Waluta", options: [{ value: "EUR", label: "EUR" }, { value: "PLN", label: "PLN" }] },
      { k: "desc_pl", t: "textarea", l: "Opis pakietu" },
    ],
    title: (r) => `${r.name_pl || ""} · ${r.days || 0} dni · ${r.price || 0} ${r.currency || "EUR"}`,
  },
  ice_windows: {
    label: "Laponia — terminy",
    note: "Okno sezonu lodowego: klient może wybrać dowolny dzień startu, o ile cały pakiet mieści się w tym zakresie. " +
      "Zmiana dat tutaj od razu zmienia kalendarz w konfiguratorze i daty na stronie Laponii.",
    fields: [
      { k: "label_pl", t: "text", l: "Nazwa sezonu (np. Sezon lodowy 2027)" },
      { k: "date_from", t: "date", l: "Data od" },
      { k: "date_to", t: "date", l: "Data do" },
      { k: "capacity", t: "number", l: "Liczba miejsc" },
    ],
    title: (r) => `${r.label_pl || "Sezon"} · ${r.date_from || "?"} → ${r.date_to || "?"}`,
  },
  programs: {
    label: "Programy",
    fields: [
      { k: "tag_pl", t: "text", l: "Etykieta (np. STAGE ONE)" },
      { k: "title_pl", t: "text", l: "Tytuł" },
      { k: "desc_pl", t: "textarea", l: "Krótki opis" },
      { k: "image", t: "image", l: "Zdjęcie (klocek)" },
      { k: "link", t: "text", l: "Link" },
    ],
    title: (r) => r.title_pl,
  },
  tracks: {
    label: "Tory",
    fields: [
      { k: "name", t: "text", l: "Nazwa toru (np. ŁÓDŹ)" },
      { k: "full_name", t: "text", l: "Pełna nazwa (np. TOR ŁÓDŹ)" },
      { k: "country_pl", t: "text", l: "Państwo (PL — EN tłumaczy się samo)" },
      { k: "turns", t: "text", l: "Liczba zakrętów" },
      { k: "length", t: "text", l: "Długość (metry)" },
      { k: "width", t: "text", l: "Szerokość (metry)" },
      { k: "description_pl", t: "textarea", l: "Opis (PL — EN tłumaczy się samo)" },
      { k: "map", t: "image", l: "Mapa toru (schemat trasy)" },
    ],
    title: (r) => r.full_name || r.name,
  },
  media: {
    label: "Media o nas",
    note: "Artykuły i publikacje prasowe. Każdy element to link do zewnętrznego artykułu. " +
      "Zalecany rozmiar zdjęcia: ok. 1000×560 px (poziome). Kolejność ↑↓ decyduje o układzie na stronie.",
    fields: [
      { k: "title_pl", t: "text", l: "Tytuł (PL — EN tłumaczy się samo)" },
      { k: "tag_pl", t: "text", l: "Kategoria / tag (np. WYWIAD, HEELS ON THE TRACK)" },
      { k: "source", t: "text", l: "Źródło / medium (np. evo Magazine)" },
      { k: "date", t: "text", l: "Data / rok (np. 2023)" },
      { k: "excerpt_pl", t: "textarea", l: "Krótki opis (opcjonalnie)" },
      { k: "url", t: "text", l: "Link do artykułu (https://…)" },
      { k: "photo", t: "image", l: "Zdjęcie / okładka" },
    ],
    title: (r) => `${r.source ? r.source + " · " : ""}${r.title_pl || ""}`,
  },
  banners: {
    label: "Banery",
    note: "Blok reklamowy pod sekcją hero. Jeśli nie ma żadnego banera — blok jest ukryty. " +
      "Zalecane rozmiary: DESKTOP 1600×420 px (szeroki), MOBILNY 900×700 px. Format WebP lub JPG. " +
      "Zdjęcia są automatycznie kompresowane do WebP.",
    fields: [
      { k: "image", t: "image", l: "Baner DESKTOP — zalecane 1600×420 px" },
      { k: "image_mobile", t: "image", l: "Baner MOBILNY (opcjonalnie) — zalecane 900×700 px" },
      { k: "link", t: "text", l: "Link (opcjonalnie, otwiera się w nowej karcie)" },
      { k: "alt", t: "text", l: "Opis / alt (SEO, opcjonalnie)" },
    ],
    title: (r) => r.alt || r.link || "Baner",
  },
};
const TABS = ["products", "ice_packages", "ice_windows", "media", "banners", "cars", "terms", "tracks", "instructors", "events", "programs"];

export default function Admin() {
  const { isAdmin } = useStore();
  if (!isAdmin) return <Login />;
  return <Shell />;
}

/* ============ LOGIN ============ */
function Login() {
  const { login } = useStore();
  const [l, setL] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await login(l.trim(), p);
    setBusy(false);
    if (!r.ok) setErr("Błędny login lub hasło");
  };
  return (
    <div className="adm-login">
      <form onSubmit={submit} className="adm-login__box">
        <img src="/assets/ui/logo_dark.webp" alt="Fastline Racing Academy" style={{ height: 58, width: "auto", alignSelf: "center", display: "block", marginBottom: 24 }} />
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
// the sidebar grew past the screen — the tabs live in collapsible groups now, and the
// list scrolls inside itself so nothing spills out even with every group expanded
const GROUPS = [
  // trips (packages / attractions / map pins) are edited inside the product itself — no separate tabs
  { id: "oferta", label: "Oferta", tabs: ["products", "ice_packages", "ice_windows", "programs"] },
  { id: "strona", label: "Strona", tabs: ["menu", "banners", "media"] },
  { id: "tor", label: "Tor i zespół", tabs: ["cars", "terms", "tracks", "instructors", "events"] },
  { id: "sprzedaz", label: "Sprzedaż", tabs: ["rezerwacje", "wiadomosci"] },
];
const TAB_LABEL = (t) => (t === "menu" ? "Menu (nawigacja)" : t === "rezerwacje" ? "Rezerwacje"
  : t === "wiadomosci" ? "Wiadomości" : CFG[t].label);
const groupOf = (tab) => GROUPS.find((g) => g.tabs.includes(tab))?.id ?? "oferta";

function Shell() {
  const { admin, logout, setCmsMode } = useStore();
  const [tab, setTab] = useState("products");
  const [open, setOpen] = useState(() => new Set([groupOf("products")]));

  const toggle = (id) => setOpen((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const pick = (t) => { setTab(t); setOpen((s) => new Set(s).add(groupOf(t))); };

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand"><img src="/assets/ui/logo_dark.webp" alt="" /></div>

        <div className="adm-side__scroll">
          <Link to="/" className="adm-nav" onClick={() => setCmsMode(true)}>✎ Strona (edycja inline)</Link>

          {GROUPS.map((g) => {
            const isOpen = open.has(g.id);
            const hasActive = g.tabs.includes(tab);
            return (
              <div className="adm-group" key={g.id}>
                <button className={`adm-group__head ${isOpen ? "open" : ""} ${hasActive ? "has" : ""}`}
                  onClick={() => toggle(g.id)} aria-expanded={isOpen}>
                  <span>{g.label}</span>
                  <i className="adm-group__chev">▾</i>
                </button>
                {isOpen && (
                  <div className="adm-group__body">
                    {g.tabs.map((t) => (
                      <button key={t} className={`adm-nav adm-nav--sub ${tab === t ? "on" : ""}`} onClick={() => pick(t)}>
                        {TAB_LABEL(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="adm-side__foot">
          <div className="adm-user">{admin?.name || admin?.login}</div>
          <button className="adm-nav" onClick={logout}>Wyloguj</button>
        </div>
      </aside>
      <main className="adm-main">
        {tab === "menu" ? <MenuTab />
          : tab === "rezerwacje" ? <RezerwacjeTab />
          : tab === "wiadomosci" ? <WiadomosciTab />
          : <EntityTab key={tab} table={tab} />}
      </main>
    </div>
  );
}

/* ============ MENU TAB ============ */
function MenuTab() {
  const { raw, saveContent } = useStore();
  return (
    <div>
      <div className="adm-head">
        <h2>Menu <span className="adm-count">{MENU.length}</span></h2>
      </div>
      <div className="adm-note">
        Pozycje górnej nawigacji. „Etykieta” to tekst PL (EN tłumaczy się automatycznie).
        „Adres” to dokąd prowadzi link — kotwica na stronie (np. <code>#flota</code>) lub pełny URL (np. <code>https://…</code>).
      </div>
      <div className="adm-menu">
        {MENU.map((id) => (
          <MenuRow key={id} id={id} raw={raw} saveContent={saveContent} />
        ))}
      </div>
    </div>
  );
}

function MenuRow({ id, raw, saveContent }) {
  const [label, setLabel] = useState(raw(id).pl || "");
  const [href, setHref] = useState(raw(hrefKey(id)).pl || MENU_HREF[id] || "");

  const commitLabel = () => {
    const v = label.trim();
    if (v && v !== raw(id).pl) saveContent(id, v, "text");
  };
  const commitHref = () => {
    const v = href.trim();
    if (v && v !== (raw(hrefKey(id)).pl || MENU_HREF[id])) saveContent(hrefKey(id), v, "url");
  };

  return (
    <div className="adm-menu__row">
      <label className="adm-f adm-menu__f">
        <span>Etykieta (PL)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      </label>
      <label className="adm-f adm-menu__f">
        <span>Adres (link)</span>
        <input value={href} onChange={(e) => setHref(e.target.value)} onBlur={commitHref}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="#flota lub https://…" />
      </label>
    </div>
  );
}

/* ============ ENTITY TAB ============ */
function EntityTab({ table }) {
  const store = useStore();
  const items = store.getters[table];
  const cfg = CFG[table];
  const [editing, setEditing] = useState(null); // row being edited (object) or null
  const [busy, setBusy] = useState(false);

  const blank = () => {
    const r = { visible: true, sort: (items.at(-1)?.sort || 0) + 1 };
    cfg.fields.forEach((f) => {
      r[f.k] = f.t === "images" ? [] : f.t === "color" ? "#2b2b2b"
        : f.t === "select" ? (f.options?.[0]?.value ?? "") : f.t === "number" ? "" : "";
    });
    setEditing(r);
  };

  const save = async () => {
    setBusy(true);
    await store.upsertEntity(table, editing);
    setBusy(false); setEditing(null);
  };
  const remove = async (id) => {
    if (!confirm("Usunąć ten element?")) return;
    await store.deleteEntity(table, id);
  };
  const move = async (i, d) => {
    const arr = items.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await store.reorderEntity(table, arr);
  };

  return (
    <div>
      <div className="adm-head">
        <h2>{cfg.label} <span className="adm-count">{items.length}</span></h2>
        <button className="adm-btn adm-btn--red" onClick={blank}>+ Dodaj</button>
      </div>
      {cfg.note && <div className="adm-note">{cfg.note}</div>}

      <div className="adm-list">
        {items.map((r, i) => (
          <div className="adm-row" key={r.id}>
            <div className="adm-row__thumb" style={{ background: r.color || "#222" }}>
              {(r.png || r.photo || r.image || r.photos?.[0]) &&
                <img src={r.png || r.photo || r.image || r.photos?.[0]} alt="" />}
            </div>
            <div className="adm-row__title">{cfg.title(r) || "—"}</div>
            <div className="adm-row__ops">
              <button className="adm-mini" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="adm-mini" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
              <button className="adm-mini" onClick={() => setEditing({ ...r })}>Edytuj</button>
              <button className="adm-mini adm-mini--del" onClick={() => remove(r.id)}>Usuń</button>
            </div>
          </div>
        ))}
        {!items.length && <div className="adm-empty">Brak elementów. Kliknij „+ Dodaj”.</div>}
      </div>

      {editing && (
        <div className="adm-modal" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="adm-form">
            <div className="adm-form__head">
              <h3>{editing.id ? "Edytuj" : "Nowy element"}</h3>
              <button className="adm-x" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="adm-form__body">
              {cfg.fields
                .filter((f) => !f.trip || editing.theme === "wyprawa")   // trip fields only for a trip
                .map((f) => (
                  <Field key={f.k} f={f} value={editing[f.k]}
                    onChange={(v) => setEditing((e) => ({ ...e, [f.k]: v }))} />
                ))}

              {/* everything a trip needs lives here, inside the product itself */}
              {table === "products" && editing.theme === "wyprawa" && <TripEditor slug={editing.slug} />}
            </div>
            <div className="adm-form__foot">
              <label className="adm-check">
                <input type="checkbox" checked={editing.visible !== false}
                  onChange={(e) => setEditing((x) => ({ ...x, visible: e.target.checked }))} />
                Widoczne na stronie
              </label>
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

/* ============ TRIP EDITOR (inside the product form, only when the style is „Wyprawa”) ============
   Packages, attractions and map pins belong to one trip, so they are edited where the trip is —
   not in separate tabs. Every row is saved on its own (the product itself still saves with „Zapisz”). */
const TRIP_TABS = [
  { t: "trip_points", l: "Punkty na mapie" },
  { t: "trip_packages", l: "Pakiety" },
  { t: "trip_attractions", l: "Atrakcje" },
];

function TripEditor({ slug }) {
  const [tab, setTab] = useState("trip_points");
  const store = useStore();
  const cfg = CFG[tab];
  const rows = (store.getters[tab] || []).filter((r) => r.product_slug === slug);
  const [row, setRow] = useState(null);      // row being edited inline (or a blank new one)
  const [busy, setBusy] = useState(false);

  if (!slug) return (
    <div className="adm-trip">
      <div className="adm-note">Najpierw wpisz „Adres podstrony” (slug) i zapisz produkt — potem dodasz tu punkty trasy, pakiety i atrakcje.</div>
    </div>
  );

  const fields = cfg.fields.filter((f) => f.k !== "product_slug");   // slug is set automatically
  const blank = () => {
    const r = { product_slug: slug, visible: true, sort: (rows.at(-1)?.sort || 0) + 1 };
    fields.forEach((f) => { r[f.k] = f.t === "images" ? [] : f.t === "select" ? (f.options?.[0]?.value ?? "") : f.t === "number" ? "" : ""; });
    setRow(r);
  };
  const save = async () => {
    setBusy(true);
    await store.upsertEntity(tab, { ...row, product_slug: slug });
    setBusy(false); setRow(null);
  };
  const remove = async (r) => {
    if (!confirm("Usunąć ten element?")) return;
    await store.deleteEntity(tab, r.id);
  };
  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await store.reorderEntity(tab, ids);
  };

  return (
    <div className="adm-trip">
      <div className="adm-trip__head">
        <span className="adm-trip__lbl">Ustawienia wyprawy</span>
        <div className="adm-trip__tabs">
          {TRIP_TABS.map((x) => (
            <button key={x.t} type="button" className={`adm-trip__tab ${tab === x.t ? "on" : ""}`}
              onClick={() => { setTab(x.t); setRow(null); }}>
              {x.l} <i>{(store.getters[x.t] || []).filter((r) => r.product_slug === slug).length}</i>
            </button>
          ))}
        </div>
      </div>

      <div className="adm-note">{cfg.note}</div>

      <div className="adm-trip__list">
        {rows.map((r, i) => (
          <div className="adm-trip__row" key={r.id}>
            <span className="adm-trip__n">{i + 1}</span>
            <span className="adm-trip__t">{(cfg.title(r) || "—").replace(`${slug} · `, "")}</span>
            <span className="adm-trip__ops">
              <button type="button" className="adm-mini" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-mini" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button>
              <button type="button" className="adm-mini" onClick={() => setRow({ ...r })}>Edytuj</button>
              <button type="button" className="adm-mini adm-mini--del" onClick={() => remove(r)}>Usuń</button>
            </span>
          </div>
        ))}
        {!rows.length && <div className="adm-empty">Brak elementów.</div>}
      </div>

      {row ? (
        <div className="adm-trip__form">
          {fields.map((f) => (
            <Field key={f.k} f={f} value={row[f.k]} onChange={(v) => setRow((x) => ({ ...x, [f.k]: v }))} />
          ))}
          <div className="adm-trip__foot">
            <button type="button" className="adm-btn" onClick={() => setRow(null)}>Anuluj</button>
            <button type="button" className="adm-btn adm-btn--red" onClick={save} disabled={busy}>
              {busy ? "Zapisuję…" : "Zapisz element"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="adm-btn" onClick={blank}>+ Dodaj</button>
      )}
    </div>
  );
}

/* ============ FIELD ============ */
function Field({ f, value, onChange }) {
  const { adminCall } = useStore();
  const [up, setUp] = useState(false);

  // images are converted to WebP in the browser; videos go up as they are
  const upload = async (file) => {
    setUp(true);
    const isVideo = file.type.startsWith("video/");
    const dataUrl = isVideo ? await fileToDataUrl(file) : await fileToWebpDataUrl(file);
    const ext = isVideo ? (file.type === "video/webm" ? "webm" : "mp4") : "webp";
    const path = `${f.k}/${Date.now()}-${Math.round(performance.now())}.${ext}`;
    const r = await adminCall("media.upload", { path, dataUrl });
    setUp(false);
    return r.ok ? r.url : null;
  };

  if (f.t === "video") return (
    <label className="adm-f"><span>{f.l}</span>
      <div className="adm-img">
        {value && <video src={value} muted loop autoPlay playsInline style={{ maxWidth: 220, borderRadius: 2 }} />}
        <input type="file" accept="video/*" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const url = await upload(file); if (url) onChange(url);
        }} />
        {up && <span className="adm-uploading">Wgrywam…</span>}
        {value && <button type="button" className="adm-mini adm-mini--del" onClick={() => onChange("")}>Usuń</button>}
      </div></label>);

  if (f.t === "text") return (
    <label className="adm-f"><span>{f.l}</span>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);

  if (f.t === "textarea") return (
    <label className="adm-f"><span>{f.l}</span>
      <textarea rows={4} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);

  if (f.t === "number") return (
    <label className="adm-f"><span>{f.l}</span>
      <input type="number" min="0" value={value ?? ""} placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} /></label>);

  if (f.t === "check") return (
    <label className="adm-f adm-f--check">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{f.l}</span>
    </label>);

  if (f.t === "date") return (
    <label className="adm-f"><span>{f.l}</span>
      <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>);

  if (f.t === "select") return (
    <label className="adm-f"><span>{f.l}</span>
      <select className="adm-select" value={value || f.options?.[0]?.value || ""} onChange={(e) => onChange(e.target.value)}>
        {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select></label>);

  if (f.t === "color") return (
    <label className="adm-f"><span>{f.l}</span>
      <div className="adm-color">
        <input type="color" value={value || "#2b2b2b"} onChange={(e) => onChange(e.target.value)} />
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="#RRGGBB" />
      </div></label>);

  if (f.t === "image") return (
    <label className="adm-f"><span>{f.l}</span>
      <div className="adm-img">
        {value && <img src={value} alt="" />}
        <input type="file" accept="image/*,video/*" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const url = await upload(file); if (url) onChange(url);
        }} />
        {up && <span className="adm-uploading">Wgrywam…</span>}
        {value && <button type="button" className="adm-mini adm-mini--del" onClick={() => onChange("")}>Usuń</button>}
      </div></label>);

  if (f.t === "images") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <label className="adm-f"><span>{f.l}</span>
        <div className="adm-imgs">
          {arr.map((u, i) => (
            <div className="adm-imgs__item" key={i}>
              <img src={u} alt="" />
              <button type="button" onClick={() => onChange(arr.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <label className="adm-imgs__add">
            {up ? "…" : "+"}
            <input type="file" accept="image/*" hidden multiple onChange={async (e) => {
              const files = [...(e.target.files || [])];
              const urls = [];
              for (const file of files) { const u = await upload(file); if (u) urls.push(u); }
              onChange([...arr, ...urls]);
            }} />
          </label>
        </div></label>);
  }
  return null;
}

/* ============ REZERWACJE (custom-car prices + bookings) ============ */
const CUSTOM_ROWS = [
  { n: 1, l: "1 sesja / Jazda próbna" },
  { n: 3, l: "3 sesje / Experience" },
  { n: 5, l: "5 sesji / Progress" },
  { n: 6, l: "6 sesji / Sport" },
  { n: 9, l: "9 sesji / Performance" },
];

// ice bookings are priced in euro, track bookings in złoty
const bookingTotal = (b) => (b.currency === "EUR" ? `${(Number(b.total) || 0).toLocaleString("pl-PL")} €` : fmtZl(b.total));
// one line describing what was booked (track sessions vs a Laponia package)
const bookingMeta = (b) => (b.kind === "ice"
  ? [b.package_name, b.persons ? `${b.persons} os.` : null, b.date_from ? `${b.date_from}${b.date_to && b.date_to !== b.date_from ? ` – ${b.date_to}` : ""}` : null, "Laponia"]
    .filter(Boolean).join(" · ")
  : `${b.sessions ?? "—"} sesji · ${b.term_label || "—"}`);

function RezerwacjeTab() {
  const { adminCall } = useStore();
  const [bookings, setBookings] = useState(null);
  const [busy, setBusy] = useState("");
  const reload = () => adminCall("bookings.list").then((r) => setBookings(r.ok ? r.rows : []));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const remove = async (b) => {
    if (!confirm(`Usunąć rezerwację?\n\n${b.car_name} · ${b.full_name} · ${bookingTotal(b)}`)) return;
    setBusy(b.id);
    setBookings((list) => list.filter((x) => x.id !== b.id));   // optimistic
    const r = await adminCall("bookings.delete", { id: b.id });
    setBusy("");
    if (!r.ok) { alert("Nie udało się usunąć: " + (r.error || "")); reload(); }
  };

  return (
    <div>
      <div className="adm-head"><h2>Rezerwacje</h2></div>

      <div className="adm-note">
        <b>Ceny za „Własne auto”</b> (klient przyjeżdża swoim samochodem). Poznań = cennik poznański, pozostałe tory = łódzki.
      </div>
      <div className="adm-price-grid">
        <div className="adm-price-grid__head"><span>Pakiet</span><span>Łódź (zł)</span><span>Poznań (zł)</span></div>
        {CUSTOM_ROWS.map((r) => (
          <div className="adm-price-grid__row" key={r.n}>
            <span className="adm-price-grid__l">{r.l}</span>
            <ConfigNumber ckey={`flota.custom.p${r.n}`} />
            <ConfigNumber ckey={`flota.custom.p${r.n}_pozn`} />
          </div>
        ))}
      </div>

      <div className="adm-head" style={{ marginTop: 34 }}>
        <h2>Zamówienia <span className="adm-count">{bookings?.length ?? "…"}</span></h2>
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>
      <div className="adm-note">Rezerwacje ze strony „Flota”. Płatność jest teraz demonstracyjna (status „paid”) — po podłączeniu WooCommerce trafi tu realny status.</div>
      {bookings === null ? <div className="adm-empty">Ładowanie…</div>
        : !bookings.length ? <div className="adm-empty">Brak rezerwacji.</div>
          : (
            <div className="adm-book">
              {bookings.map((b) => (
                <div className="adm-book__row" key={b.id}>
                  <div className="adm-book__main">
                    <div className="adm-book__car">
                      {b.car_name}{b.is_custom ? " (własne)" : ""}
                      {b.kind === "ice" && <span className="adm-book__kind">LAPONIA</span>}
                    </div>
                    <div className="adm-book__meta">{bookingMeta(b)}</div>
                  </div>
                  <div className="adm-book__who">
                    <div>{b.full_name}</div>
                    <div className="adm-book__meta">{b.email} · {b.phone}</div>
                  </div>
                  <div className="adm-book__total">{bookingTotal(b)}<span className={`adm-book__badge adm-book__badge--${b.status}`}>{b.status}</span></div>
                  <button className="adm-mini adm-mini--del" disabled={busy === b.id} onClick={() => remove(b)}>
                    {busy === b.id ? "…" : "Usuń"}
                  </button>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

/* ============ WIADOMOŚCI (contact-form inbox) ============ */
function WiadomosciTab() {
  const { adminCall } = useStore();
  const [rows, setRows] = useState(null);
  const reload = () => adminCall("messages.list").then((r) => setRows(r.ok ? r.rows : []));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const remove = async (m) => {
    if (!confirm(`Usunąć wiadomość od ${m.full_name}?`)) return;
    setRows((l) => l.filter((x) => x.id !== m.id));           // optimistic
    const r = await adminCall("messages.delete", { id: m.id });
    if (!r.ok) { alert("Nie udało się usunąć"); reload(); }
  };
  const markRead = async (m) => {
    setRows((l) => l.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
    await adminCall("messages.read", { id: m.id });
  };

  const unread = (rows || []).filter((m) => !m.is_read).length;

  return (
    <div>
      <div className="adm-head">
        <h2>Wiadomości <span className="adm-count">{rows?.length ?? "…"}{unread ? ` · ${unread} nowe` : ""}</span></h2>
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>
      <div className="adm-note">
        Wiadomości z formularza na stronie <b>Kontakt</b>. Każda jest też wysyłana e-mailem na adres skonfigurowany w systemie
        (Resend). Jeśli e-mail się nie wyśle, wiadomość i tak zostaje tutaj.
      </div>

      {rows === null ? <div className="adm-empty">Ładowanie…</div>
        : !rows.length ? <div className="adm-empty">Brak wiadomości.</div>
          : (
            <div className="adm-msgs">
              {rows.map((m) => (
                <div className={`adm-msg ${m.is_read ? "" : "is-new"}`} key={m.id} onMouseEnter={() => !m.is_read && markRead(m)}>
                  <div className="adm-msg__top">
                    <div>
                      <span className="adm-msg__name">{m.full_name}</span>
                      {m.subject && <span className="adm-msg__subject">{m.subject}</span>}
                      {!m.sent && <span className="adm-msg__warn">e-mail nie wysłany</span>}
                    </div>
                    <div className="adm-msg__ops">
                      <span className="adm-msg__date">{new Date(m.created_at).toLocaleString("pl-PL")}</span>
                      <button className="adm-mini adm-mini--del" onClick={() => remove(m)}>Usuń</button>
                    </div>
                  </div>
                  <div className="adm-msg__meta">
                    <a href={`mailto:${m.email}`}>{m.email}</a>
                    {m.phone && <> · <a href={`tel:${m.phone}`}>{m.phone}</a></>}
                  </div>
                  <p className="adm-msg__body">{m.message}</p>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

/* number bound to a content key (kind "url" → stored as plain number string) */
function ConfigNumber({ ckey }) {
  const { raw, saveContent } = useStore();
  const [v, setV] = useState(raw(ckey).pl || "");
  const commit = () => { const s = String(v).replace(/[^0-9]/g, ""); if (s !== (raw(ckey).pl || "")) saveContent(ckey, s, "url"); };
  return (
    <input className="adm-price-grid__in" type="number" min="0" value={v}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="0" />
  );
}
