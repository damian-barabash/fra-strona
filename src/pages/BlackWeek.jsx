import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import IceCalendar from "../components/IceCalendar";
import InvoiceFields from "../components/InvoiceFields";
import { GiftVoucher } from "../components/GiftVoucher";
import LockerPicker from "../components/LockerPicker";
import { addressOf } from "../lib/inpost";
import { adminCall } from "../lib/api";
import { EMPTY_INVOICE, invoiceProblem, invoicePayload } from "../lib/invoice";
import { PACKAGES, carPrice, fmtZl, isPoznan } from "../lib/flota";
import { startDates, fmtEur } from "../lib/ice";
import { gross, fmtMoney, round2 } from "../lib/vat";
import { usePayRedirect } from "../lib/pay";
import { viewContent, addToCart } from "../lib/pixel";
import { useSeo } from "../lib/seo";
import { BW_PRODUCTS, BW_END, bwProduct, bwOn, GLOVE_COLORS, GLOVE_SIZES, HEELS_PACKAGES, heelsPrice, sdBonus, sessWord } from "../lib/blackweek";
import "../sections/laponia.css";
import "../components/bwpopup.css";
import "../sections/blackweek.css";

/* /black-week — Black Friday Weeks landing page + configurator (traffic from Meta ads and the site pop-up).
   Sections: hero with the countdown → benefits → offers → CONFIGURATOR (#konfigurator) → holiday vouchers →
   how it works → FAQ → final CTA.
   Configurator: PROGRAM → DLA KOGO (me / gift voucher on the holiday template) → SZCZEGÓŁY → (TERMIN) → DANE → PŁATNOŚĆ.
   Normal prices, a gift with every product (handed over by the team; Race Taxi's second voucher and a gift voucher
   are codes e-mailed automatically). The server (booking.createBw) prices everything again and refuses while the
   switch is off. Links: /black-week?produkt=sport-driving|driver2racer|race-taxi|heels-on-the-track|laponia (&forma=prezent) */

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const dmy = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join(".") : "");
const WD = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
const wd = (iso) => WD[new Date(`${iso}T12:00:00`).getDay()];
const parseVariants = (txt) => String(txt || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("## "))
  .map((l) => l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł\s*(?:netto)?\s*[·•]?\s*(.*)$/i)).filter(Boolean)
  .map((m) => ({ name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10), desc: m[3] || "" }));
const LABEL = { program: "Program", dla: "Dla kogo", szczegoly: "Szczegóły", termin: "Termin", dane: "Dane", sum: "Płatność" };
const NAME_TIPS = ["Taty", "Mamy", "Męża", "Żony", "Brata", "Szefa"];

const FAQ = (iceTxt) => [
  ["Do kiedy trwa promocja?", "Do 30 listopada. Potem wracają standardowe warunki."],
  ["Czy muszę wpisywać kod rabatowy?", "Nie. Bonus dolicza się automatycznie przy zakupie."],
  ["Czy promocja obejmuje vouchery?", "Tak, także vouchery świąteczne kupione na prezent. W konfiguratorze wybierz „Na prezent”, a voucher z imieniem osoby obdarowanej przyjdzie na Twój mail."],
  ["Kiedy mogę zrealizować szkolenie lub voucher?", `Szkolenie realizujesz w terminie wybranym z kalendarza albo w terminie, który ustalimy razem telefonicznie. Voucher jest ważny 12 miesięcy od zakupu.${iceTxt ? ` Laponia: ${iceTxt}.` : ""}`],
  ["Czy promocje łączą się ze sobą?", "Bonusów Black Friday nie łączymy z kodami rabatowymi. W Black Friday Weeks zamiast rabatu dostajesz prezent do zakupu."],
  ["Jak dostanę voucher?", "Mailem, od razu po zakupie."],
];

export default function BlackWeek() {
  const S = useStore();
  const { cars, products, icePackages, iceWindows, terms, raw, lang, t, isAdmin, createBwBooking } = S;
  const on = bwOn(raw);
  const nav = useNavigate();
  const { search } = useLocation();
  useSeo({ title: "Black Friday Weeks — bonus do każdego doświadczenia na torze", description: "Do 30 listopada więcej jazdy, więcej sesji i prezenty: Sport Driving, Driver2Racer, Race Taxi, Heels on the Track i Ice Driving Laponia. Bonus dolicza się automatycznie, bez kodu.", path: "/black-week", noindex: true, image: "/assets/bw/banner.webp" });

  /* ---- choice ---- */
  const qs = new URLSearchParams(search);
  const preset = bwProduct(qs.get("produkt") || "");
  const presetGift = qs.get("forma") === "prezent";
  const [pid, setPid] = useState(preset?.id || null);
  const P = bwProduct(pid);
  const [stepIdx, setStepIdx] = useState(preset ? 1 : 0);
  const [mode, setMode] = useState(presetGift ? "gift" : "");      // "" | "self" | "gift"
  const [giftFor, setGiftFor] = useState("");
  const [delivery, setDelivery] = useState("email");   // gift voucher: e-mail | printed to an InPost locker
  const [inpost, setInpost] = useState({ locker: "", phone: "", name: "", point: null });
  const [inpostNet, setInpostNet] = useState(50);
  useEffect(() => { adminCall("", "gift.info", {}).then((r) => r?.ok && r.inpost_net != null && setInpostNet(Number(r.inpost_net) || 0)).catch(() => {}); }, []);
  const [car, setCar] = useState(null);
  const [track, setTrack] = useState("lodz");
  const [sessions, setSessions] = useState(null);
  const [glove, setGlove] = useState({ color: "", size: "" });
  const [variant, setVariant] = useState(null);
  const [heelsPkg, setHeelsPkg] = useState(null);
  const [heelsGift, setHeelsGift] = useState("");
  const [friend, setFriend] = useState("");
  const [icePkg, setIcePkg] = useState(null);
  const [persons, setPersons] = useState(1);
  const [iceStart, setIceStart] = useState("");
  const [termMode, setTermMode] = useState("");   // "" | "date" | "later"
  const [termId, setTermId] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [inv, setInv] = useState(EMPTY_INVOICE);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [flash, setFlash] = useState("");          // "Bonus Black Friday dodany: …"
  const bodyRef = useRef(null);
  const [cfgOpen, setCfgOpen] = useState(!!(preset || presetGift));   // the configurator is a full-screen window
  const gift = mode === "gift";

  const d2r = products.find((p) => p.slug === "driver2racer");
  const taxi = products.find((p) => p.slug === "race-taxi");
  const taxiVariants = useMemo(() => parseVariants(taxi?.packages_pl), [taxi]);
  const icePk = icePackages.filter((p) => p.visible !== false);
  const win = iceWindows[0] || null;
  const iceTxt = win ? `w sezonie ${dmy(win.date_from)}–${dmy(win.date_to)} w Kuusamo` : "";
  const allowed = useMemo(() => new Set(icePkg && win ? startDates(win, icePkg.days || 1) : []), [icePkg, win]);
  useEffect(() => { if (iceStart && !allowed.has(iceStart)) setIceStart(""); }, [allowed, iceStart]);
  useEffect(() => { if (pid === "taxi" && !variant && taxiVariants.length === 1) setVariant(taxiVariants[0]); }, [pid, variant, taxiVariants]);
  useEffect(() => { if (pid === "ice" && !icePkg && icePk.length === 1) setIcePkg(icePk[0]); }, [pid, icePkg, icePk]);

  const termList = useMemo(() => {
    const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
    if (pid === "sd") return terms.filter((x) => x.date && x.date >= today() && !["ice", "heels"].includes(x.type || "sport") && (track === "poznan" ? isPoznan(x.track) : !isPoznan(x.track))).sort(byDate);
    if (pid === "heels") return terms.filter((x) => x.date && x.date >= today() && x.type === "heels").sort(byDate);
    return [];
  }, [terms, pid, track]);
  useEffect(() => { if (termId && !termList.some((x) => x.id === termId)) { setTermId(null); if (termMode === "date") setTermMode(""); } }, [termList, termId, termMode]);
  const term = termList.find((x) => x.id === termId) || null;

  const STEPS = ["program", "dla", "szczegoly", ...(["sd", "heels", "ice"].includes(pid) ? ["termin"] : []), "dane", "sum"];
  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];
  const cartStep = STEPS[STEPS.indexOf("dane") - 1];   // its "next" adds to the cart

  /* the window: page scroll locked, Esc closes it */
  useEffect(() => {
    if (!cfgOpen) return;
    const key = (e) => e.key === "Escape" && !paying && setCfgOpen(false);
    document.documentElement.classList.add("bwp-lock");
    window.addEventListener("keydown", key);
    return () => { document.documentElement.classList.remove("bwp-lock"); window.removeEventListener("keydown", key); };
  }, [cfgOpen, paying]);

  /* ---- price (net, product currency) ---- */
  const hp = heelsPkg ? heelsPrice(raw, heelsPkg) : 0;
  const net = pid === "sd" ? (car && sessions ? carPrice(car, sessions, track) : 0)
    : pid === "d2r" ? Number(d2r?.price) || 0
    : pid === "taxi" ? (variant?.price || (taxiVariants.length ? 0 : Number(taxi?.price) || 0))
    : pid === "heels" ? (hp && heelsGift ? (heelsGift === "friend" ? Math.round(hp * 1.5) : hp) : 0)
    : pid === "ice" ? (icePkg ? (Number(icePkg.price) || 0) * persons : 0) : 0;
  const cur = pid === "ice" ? (icePkg?.currency || "EUR") : "PLN";
  const money = (n, c = cur) => (c === "EUR" ? fmtEur(n, "EUR") : fmtZl(n));
  const fee = gift && delivery === "inpost" ? inpostNet : 0;   // net PLN, on top of the product
  const toPay = cur === "EUR" ? `${fmtMoney(gross(net), "EUR")}${fee ? ` + ${fmtMoney(gross(fee))}` : ""}` : fmtMoney(round2(gross(net) + gross(fee)));

  /* ---- what the customer gets for free ---- */
  const gifts = useMemo(() => {
    if (pid === "sd") return sessions ? [`+${sdBonus(sessions)} ${sessWord(sdBonus(sessions))} gratis${car ? ` w ${car.name}` : ""}`] : ["Do 3 sesji gratis: 3 → +1, 6 → +2, 9 → +3"];
    if (pid === "d2r") return ["+2 sesje w Porsche 911", `Rękawice OMP${glove.color ? ` — ${glove.color.toLowerCase()}` : ""}${glove.size ? `, rozmiar ${glove.size}` : ""}`];
    if (pid === "taxi") return [`Drugi voucher Race Taxi${variant ? ` (${variant.name})` : ""} — do podarowania`];
    if (pid === "heels") return heelsGift === "friend" ? [`Koleżanka za pół ceny${friend ? `: ${friend}` : ""}`] : heelsGift === "golf" ? ["Golf FIERI w prezencie"] : ["Koleżanka za pół ceny albo golf FIERI"];
    if (pid === "ice") return [`2 sesje Sport Driving na Torze Łódź gratis${persons > 1 ? ` × ${persons} os.` : ""}`];
    return [];
  }, [pid, sessions, car, glove, variant, heelsGift, friend, persons]);

  const what = useMemo(() => {
    if (pid === "sd") return [car?.name, sessions && `${sessions} ${sessWord(sessions)} + ${sdBonus(sessions)} gratis`, track === "poznan" ? "Tory wyścigowe (Poznań)" : "Tory sportowe (Łódź)"].filter(Boolean);
    if (pid === "d2r") return ["24 sesje na torze, coaching 1:1, telemetria, symulator"];
    if (pid === "taxi") return [variant?.name, "2 vouchery (jeden dla Ciebie, drugi do podarowania)"].filter(Boolean);
    if (pid === "heels") return [heelsPkg && `Pakiet ${heelsPkg.name}`, heelsGift === "friend" ? "2 osoby" : heelsGift ? "1 osoba" : ""].filter(Boolean);
    if (pid === "ice") return [icePkg?.name_pl, `${persons} ${persons === 1 ? "osoba" : persons < 5 ? "osoby" : "osób"}`].filter(Boolean);
    return [];
  }, [pid, car, sessions, track, variant, heelsPkg, heelsGift, icePkg, persons]);
  const openTxt = gift ? "Voucher otwarty — termin wybierze osoba obdarowana" : "Termin ustalimy telefonicznie";
  const when = pid === "ice" ? (iceStart ? `od ${dmy(iceStart)}` : termMode === "later" ? openTxt : "")
    : termMode === "later" ? openTxt : term ? `${dmy(term.date)} · ${term.location_pl || (isPoznan(term.track) ? "Tor Poznań" : "Tor Łódź")}${term.time ? ` · ${term.time}` : ""}` : "";
  // the voucher on the holiday template (same as /swieta-2026)
  const vTitle = P ? (P.id === "sd" ? "SZKOLENIE JAZDY SPORTOWEJ NA TORZE" : P.id === "ice" ? "ICE DRIVING EXPERIENCE — LAPONIA" : P.title) : "";
  const vLines = [...what.slice(0, 2), when && !/Voucher otwarty|ustalimy/.test(when) ? when : ""].filter(Boolean);

  /* ---- navigation ---- */
  const validEmail = /.+@.+\..+/.test(form.email);
  const problem = () => {
    if (step === "program" && !P) return "Wybierz program.";
    if (step === "dla") {
      if (!mode) return "Wybierz: dla siebie czy na prezent.";
      if (gift && giftFor.trim().length < 2) return "Wpisz imię osoby obdarowanej.";
      if (gift && delivery === "inpost" && !(/^[A-Za-z]{3}\d{1,4}[A-Za-z]{0,3}$/.test(inpost.locker.replace(/\s/g, "")) && inpost.phone.replace(/\D/g, "").length >= 9)) return "Wybierz Paczkomat i podaj telefon do powiadomień.";
    }
    if (step === "szczegoly") {
      if (pid === "sd" && !car) return "Wybierz auto.";
      if (pid === "sd" && !sessions) return "Wybierz liczbę sesji.";
      if (pid === "d2r" && !(glove.color && glove.size)) return "Wybierz kolor i rozmiar rękawic OMP.";
      if (pid === "taxi" && !net) return "Wybierz auto Race Taxi.";
      if (pid === "heels" && !heelsPkg) return "Wybierz pakiet.";
      if (pid === "heels" && !heelsGift) return "Wybierz swój bonus.";
      if (pid === "heels" && heelsGift === "friend" && friend.trim().length < 2) return "Wpisz imię i nazwisko koleżanki.";
      if (pid === "ice" && !icePkg) return "Wybierz pakiet Laponii.";
    }
    if (step === "termin") {
      if (pid === "ice" && !(iceStart || (gift && termMode === "later"))) return "Kliknij pierwszy dzień pobytu w kalendarzu.";
      if (pid !== "ice" && !(termMode === "later" || (termMode === "date" && termId))) return gift ? "Wybierz termin albo voucher otwarty." : "Wybierz termin albo „ustalimy później”.";
    }
    if (step === "dane") { if (!(form.full_name.trim() && validEmail && form.phone.trim())) return "Uzupełnij imię i nazwisko, e-mail i telefon."; const ip = invoiceProblem(inv); if (ip) return t(ip); }
    return "";
  };
  // a new step starts at the top of the window's content (the window itself never scrolls the page)
  const toCfg = () => { setCfgOpen(true); requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 })); };
  const goNext = () => {
    const p = problem(); if (p) { setErr(p); return; }
    setErr("");
    if (step === cartStep) { setFlash(gifts.join(" · ")); addToCart(cartItem); }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)); toCfg();
  };
  const goPrev = () => { setErr(""); if (stepIdx === 0) return; setStepIdx((i) => Math.max(0, i - 1)); toCfg(); };
  const pick = (p, scroll = true) => {
    if (p.id !== pid) { setCar(null); setSessions(null); setVariant(null); setHeelsPkg(null); setHeelsGift(""); setIcePkg(null); setIceStart(""); setTermMode(""); setTermId(null); setFlash(""); }
    setPid(p.id); setErr(""); setStepIdx(1); if (scroll) toCfg();
    viewContent({ name: `Black Week · ${p.title}`, id: `bw-${p.q}`, category: "black-week" });
  };
  const startGift = () => { setMode("gift"); setStepIdx(pid ? 1 : 0); toCfg(); };
  const startAny = () => toCfg();
  // a link with ?produkt= (or opened from the pop-up later in the same tab)
  useEffect(() => {
    if (preset && preset.id !== pid) pick(preset, false);
    if (presetGift) setMode("gift");
    if (preset || presetGift) setCfgOpen(true);
  }, [search]); // eslint-disable-line

  const cartItem = P ? { name: `Black Week · ${P.title}${gift ? " (voucher)" : ""}`, price: net, currency: cur, id: `bw-${P.q}`, category: "black-week" } : null;
  useEffect(() => { if (step === "sum" && cartItem) viewContent(cartItem); }, [step]); // eslint-disable-line

  const payload = () => ({
    bw: {
      product: pid, mode: gift ? "gift" : "self", gift_for: gift ? giftFor.trim() : "",
      car_id: car?.id, sessions, track, term_id: termMode === "date" ? termId : null,
      glove_color: glove.color, glove_size: glove.size, variant: variant?.name || null,
      package: heelsPkg?.id, gift: heelsGift, friend_name: friend.trim(),
      package_id: icePkg?.id, window_id: win?.id, persons, date_from: pid === "ice" ? iceStart : "",
    },
    delivery: gift ? delivery : "email",
    delivery_data: gift && delivery === "inpost" ? { locker: inpost.locker.toUpperCase().replace(/\s/g, ""), phone: inpost.phone, name: inpost.name || form.full_name, address: addressOf(inpost.point) } : null,
    full_name: form.full_name, email: form.email, phone: form.phone, note: form.note, invoice: invoicePayload(inv),
  });
  const pay = () => { if (paying) return; setPaying(true); };

  if (!on && !isAdmin) return <Closed />;
  const nextLabel = step === cartStep ? "DODAJ DO KOSZYKA" : "DALEJ";

  return (
    <div className="bwc">
      <Nav />
      <main>
        {/* ---------- HERO ---------- */}
        <section className="bwc-hero">
          <div className="bwc-hero__art" aria-hidden="true"><img src="/assets/bw/car.webp" alt="" width="790" height="520" fetchpriority="high" /></div>
          <div className="container bwc-hero__in">
            <p className="bwc-hero__over">Fastline Racing Academy</p>
            <h1 className="bwc-metal bwc-hero__t"><span>BLACK</span><span>FRIDAY</span><span>WEEKS</span></h1>
            <p className="bwc-hero__s">U nas Black Friday to nie jeden dzień i nie zwykłe rabaty. Do 30 listopada dostajesz więcej jazdy, więcej sesji i prezenty do każdego doświadczenia na torze.</p>
            <div className="bwc-hero__meta">
              <span className="bwc-badge">Tylko do 30 listopada</span>
              <Countdown />
            </div>
            <div className="bwc-hero__ctas">
              <button type="button" className="bw-silver bwc-hero__cta" onClick={startAny}>Wybierz swoje doświadczenie <i>›</i></button>
              <button type="button" className="bwc-ghost" onClick={startGift}><GiftIco />Kup voucher na prezent</button>
            </div>
          </div>
        </section>
        {!on && <div className="bwc-off"><b>PROMOCJA WYŁĄCZONA</b> Widzisz tę stronę, bo jesteś zalogowany jako administrator. Klienci widzą „promocja zakończona”, a płatność jest zablokowana.</div>}

        {/* ---------- BENEFITS ---------- */}
        <section className="bwc-perks">
          <div className="container bwc-perks__in">
            {[["bolt", "Bonusy dodają się automatycznie, bez kodu."], ["gift", "Promocja obejmuje też vouchery świąteczne."], ["mail", "Voucher od razu trafia na Twój mail."]].map(([i, txt], n) => (
              <div key={i} className="bwc-perk" style={{ ["--i"]: n }}><PerkIco k={i} /><span>{txt}</span></div>
            ))}
          </div>
        </section>

        {/* ---------- OFFERS ---------- */}
        <section className="bwc-sec" id="oferty">
          <div className="container">
            <h2 className="bwc-h2">Wybierz, ile adrenaliny chcesz w tym roku</h2>
            <p className="bwc-lead">Każde doświadczenie na torze ma w Black Friday Weeks swój bonus. Wybierz program, a prezent doliczymy automatycznie w koszyku.</p>
            <div className="bwc-prods">
              {BW_PRODUCTS.map((p, i) => (
                <article key={p.id} className={`bwc-prod ${pid === p.id ? "on" : ""}`} style={{ ["--i"]: i }}>
                  <button type="button" className="bwc-prod__img" onClick={() => pick(p)} aria-label={p.title}>
                    <img src={p.img} alt={`Black Friday Weeks — ${p.title}`} width="1080" height="1080" loading="eager" decoding="async" />
                  </button>
                  <div className="bwc-prod__body">
                    <h3>{p.title}</h3>
                    <p className="bwc-prod__gift">{p.headline}</p>
                    <p className="bwc-prod__desc">{p.desc}</p>
                    <button type="button" className="bw-silver bwc-prod__cta" onClick={() => pick(p)}>{p.cta} <i>›</i></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CONFIGURATOR (teaser — the configurator itself is a full-screen window) ---------- */}
        <section className="bwc-sec bwc-cfg" id="konfigurator">
          <div className="container">
            <h2 className="bwc-h2">Skonfiguruj swoje doświadczenie</h2>
            <p className="bwc-lead">Trzy kroki i gotowe. Bonus Black Friday pojawi się w koszyku automatycznie.</p>
            <ol className="bwc-how bwc-how--cfg">
              {[["Wybierz program", "Sport Driving, Driver2Racer, Race Taxi, Heels on the Track czy Ice Driving?"], ["Dla kogo?", "Dla siebie albo na prezent. Na prezent dostajesz voucher na mail."], ["Dopasuj szczegóły", "Auto, liczba sesji, tor i termin, zależnie od programu."]].map(([b, d], i) => (
                <li key={b} style={{ ["--i"]: i }}><span className="bwc-metal">{i + 1}</span><b>{b}</b><p>{d}</p></li>
              ))}
            </ol>
            <button type="button" className="bw-silver bwc-hero__cta bwc-cfg__open" onClick={startAny}>Otwórz konfigurator <i>›</i></button>
          </div>
        </section>

        {/* ---------- HOLIDAY VOUCHERS ---------- */}
        <section className="bwc-sec bwc-xmas">
          <div className="container bwc-xmas__in">
            <div>
              <h2 className="bwc-h2">Prezent dla kogoś, kto „ma wszystko”</h2>
              <p className="bwc-lead">Promocja Black Friday obejmuje też vouchery świąteczne. Kupujesz teraz, dostajesz więcej, a wręczasz pod choinką. Voucher kupisz online i od razu masz go na mailu. Możesz też zrobić prezent sobie, nikt nie musi wiedzieć.</p>
              <ul className="bwc-ticks">
                <li>Voucher na mail od razu po zakupie</li>
                <li>Gotowy do wydruku albo wysłania</li>
                <li>Ważny 12 miesięcy</li>
              </ul>
              <button type="button" className="bw-silver bwc-xmas__cta" onClick={startGift}>Kup voucher świąteczny <i>›</i></button>
            </div>
            <div className="bwc-xmas__v"><GiftVoucher lang="pl" name="Ciebie" title="SZKOLENIE JAZDY SPORTOWEJ NA TORZE" lines={["Black Friday Weeks", "+ bonus do każdego programu"]} /></div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="bwc-sec">
          <div className="container">
            <h2 className="bwc-h2">Jak to działa</h2>
            <ol className="bwc-how">
              {[["Wybierasz.", "Program z bonusem Black Friday."], ["Kupujesz.", "Bonus dolicza się automatycznie, bez kodów."], ["Jedziesz albo dajesz w prezencie.", "Termin wybierasz sam, a voucher od razu ląduje na mailu."]].map(([b, s], i) => (
                <li key={b} style={{ ["--i"]: i }}><span className="bwc-metal">{i + 1}</span><b>{b}</b><p>{s}</p></li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="bwc-sec">
          <div className="container bwc-faq">
            <h2 className="bwc-h2">FAQ</h2>
            {FAQ(iceTxt).map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        {/* ---------- FINAL CTA ---------- */}
        <section className="bwc-final">
          <div className="bwc-final__art" aria-hidden="true"><img src="/assets/bw/car.webp" alt="" width="790" height="520" loading="lazy" /></div>
          <div className="container bwc-final__in">
            <h2 className="bwc-metal bwc-final__t">Potem wracają standardowe warunki</h2>
            <p className="bwc-lead">Black Friday Weeks kończy się 30 listopada. Nie czekaj, wybierz swoje doświadczenie i zgarnij bonus.</p>
            <button type="button" className="bw-silver bwc-hero__cta" onClick={startAny}>Sprawdź ofertę Black Friday <i>›</i></button>
          </div>
        </section>
      </main>
      <Footer />
      {cfgOpen && (
        <div className="bwm" role="dialog" aria-modal="true" aria-label="Konfigurator Black Friday Weeks">
          <div className="bwm__head">
            <b className="bwc-metal bwm__brand">BLACK FRIDAY WEEKS</b>
            <Steps steps={STEPS} idx={stepIdx} onPick={(i) => { if (i < stepIdx) { setStepIdx(i); setErr(""); toCfg(); } }} />
            <button type="button" className="bwm__x" onClick={() => setCfgOpen(false)} aria-label="Zamknij konfigurator"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button>
          </div>
          <div className={`bwm__body bwc-grid is-${step}`} ref={bodyRef}>
            <div className="bwc-main">
              <div className="bwc-card" key={step}>
                <span className="bwc-steptag">KROK {stepIdx + 1} / {STEPS.length}</span>

                {step === "program" && (
                  <>
                    <h3 className="bwc-t">WYBIERZ PROGRAM</h3>
                    <p className="bwc-s">Sport Driving, Driver2Racer, Race Taxi, Heels on the Track czy Ice Driving?</p>
                    <div className="bwc-tiles">
                      {BW_PRODUCTS.map((p, i) => (
                        <button key={p.id} type="button" className={`bwc-tile ${pid === p.id ? "on" : ""}`} style={{ ["--i"]: i }} onClick={() => pick(p)}>
                          <img src={p.img} alt="" width="1080" height="1080" decoding="async" />
                          <span><b>{p.title}</b><small>{p.headline}</small></span>
                          <i>›</i>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {step === "dla" && P && (
                  <>
                    <h3 className="bwc-t">DLA KOGO?</h3>
                    <p className="bwc-s">Dla siebie albo na prezent. Na prezent dostajesz voucher na mail.</p>
                    <div className="bwc-opts bwc-opts--2">
                      <button type="button" className={`bwc-opt bwc-mode ${mode === "self" ? "on" : ""}`} onClick={() => setMode("self")}>
                        <UserIco /><b>DLA SIEBIE</b><small>Potwierdzenie zamówienia i bonusu przyjdzie na Twój mail.</small>
                      </button>
                      <button type="button" className={`bwc-opt bwc-mode ${gift ? "on" : ""}`} onClick={() => setMode("gift")}>
                        <GiftIco /><b>NA PREZENT</b><small>Voucher z imieniem osoby obdarowanej, od razu na mail. Ważny 12 miesięcy.</small>
                      </button>
                    </div>
                    {gift && (
                      <div className="bwc-giftbox">
                        <label className="bwc-namefield">
                          <span>DLA</span>
                          <input value={giftFor} onChange={(e) => setGiftFor(e.target.value.replace(/\s+/g, " ").slice(0, 40))} placeholder="np. Łukasza" autoFocus maxLength={40} />
                          <i>{giftFor.length}/40</i>
                        </label>
                        <p className="bwc-note">Wpisz imię tak, jak ma się pojawić na voucherze, po słowie „DLA”.</p>
                        <div className="bwc-tips"><span>Podpowiedzi:</span>{NAME_TIPS.map((n) => <button key={n} type="button" onClick={() => setGiftFor(n)}>{n}</button>)}</div>
                        <div className="bwc-vprev"><GiftVoucher lang="pl" name={giftFor} title={vTitle} lines={vLines} /><span>PODGLĄD NA ŻYWO</span></div>
                        <h4 className="bwc-h">Jak dostarczyć voucher?</h4>
                        <div className="bwc-opts bwc-opts--2">
                          <button type="button" className={`bwc-opt bwc-mode ${delivery === "email" ? "on" : ""}`} onClick={() => setDelivery("email")}>
                            <MailIco /><b>E-MAIL</b><small>Voucher i kod od razu po płatności.</small><em>0 zł</em>
                          </button>
                          <button type="button" className={`bwc-opt bwc-mode ${delivery === "inpost" ? "on" : ""}`} onClick={() => setDelivery("inpost")}>
                            <BoxIco /><b>WYDRUK + PACZKOMAT</b><small>Elegancki wydruk w kopercie do Paczkomatu InPost, a e-mail z kodem od razu.</small><em>+{fmtZl(inpostNet)} netto</em>
                          </button>
                        </div>
                        {delivery === "inpost" && (
                          <div className="bwc-inpost">
                            <div className="bwc-lockerbox"><span className="bwc-lockerbox__l req">Paczkomat</span>
                              <LockerPicker en={false} value={inpost.point} onPick={(pt) => { setInpost((o) => ({ ...o, point: pt, locker: pt.code })); setErr(""); }} /></div>
                            <div className="bwc-form">
                              <label className="bwc-field"><span className="req">Telefon do powiadomień InPost</span><input value={inpost.phone} onChange={(e) => setInpost({ ...inpost, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
                              <label className="bwc-field"><span>Odbiorca paczki</span><input value={inpost.name} onChange={(e) => setInpost({ ...inpost, name: e.target.value })} placeholder={form.full_name || "imię i nazwisko"} /></label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {step === "szczegoly" && P && <h3 className="bwc-t">{P.title}</h3>}
                {step === "szczegoly" && P && <p className="bwc-gifthead">🎁 {P.headline}</p>}

                {step === "szczegoly" && pid === "sd" && (
                  <>
                    <h4 className="bwc-h">Auto z naszej floty</h4>
                    <div className="bwc-cars">
                      {cars.map((c) => (
                        <button key={c.id} type="button" className={`bwc-car ${car?.id === c.id ? "on" : ""}`} onClick={() => setCar(c)}>
                          <span className="bwc-car__img">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos[0]} alt="" loading="lazy" decoding="async" />}</span>
                          <b>{c.name}</b><small>od {fmtZl(carPrice(c, 3, track))} netto</small>
                        </button>
                      ))}
                    </div>
                    <h4 className="bwc-h">Tory</h4>
                    <div className="bwc-switch">
                      {[["lodz", "TORY SPORTOWE", "np. Tor Łódź, Tor Modlin"], ["poznan", "TORY WYŚCIGOWE", "np. Tor Poznań, Tor Silesia"]].map(([k, l, h]) => (
                        <button key={k} type="button" className={track === k ? "on" : ""} onClick={() => setTrack(k)}>{l}<small>{h}</small></button>
                      ))}
                    </div>
                    <h4 className="bwc-h">Liczba sesji</h4>
                    <div className="bwc-pkgs">
                      {PACKAGES.map((p) => {
                        const pr = car ? carPrice(car, p.n, track) : 0;
                        return (
                          <button key={p.n} type="button" className={`bwc-pkg ${sessions === p.n ? "on" : ""}`} onClick={() => setSessions(p.n)} disabled={!!car && !pr}>
                            <span className="bwc-pkg__n">{p.n}<em>+{sdBonus(p.n)}</em></span>
                            <span className="bwc-pkg__w">{sessWord(p.n)} + {sdBonus(p.n)} gratis</span>
                            <b>{p.pl}</b>
                            <i>{car ? (pr ? `${fmtZl(pr)} netto` : "—") : "wybierz auto"}</i>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {step === "szczegoly" && pid === "d2r" && (
                  <>
                    <p className="bwc-s">Driver2Racer: 24 sesje na torze, coaching 1:1 z 9-krotnym Mistrzem Polski, telemetria i symulator. W Black Friday Weeks dokładamy <b>2 sesje w Porsche 911</b> i <b>rękawice OMP</b>.</p>
                    <div className="bwc-price"><span>Cena programu</span><b>{fmtZl(net)} <small>netto</small></b></div>
                    <h4 className="bwc-h">Kolor rękawic OMP</h4>
                    <div className="bwc-colors">
                      {GLOVE_COLORS.map(([n, hex]) => (
                        <button key={n} type="button" className={`bwc-color ${glove.color === n ? "on" : ""}`} onClick={() => setGlove((g) => ({ ...g, color: n }))}>
                          <span className="bwc-color__sw" style={{ background: hex, color: hex === "#f4f5f6" ? "#111214" : "#fff" }}><GloveIcon /></span><b>{n}</b>
                        </button>
                      ))}
                    </div>
                    <h4 className="bwc-h">Rozmiar</h4>
                    <div className="bwc-sizes">
                      {GLOVE_SIZES.map((s) => <button key={s} type="button" className={glove.size === s ? "on" : ""} onClick={() => setGlove((g) => ({ ...g, size: s }))}>{s}</button>)}
                    </div>
                    <p className="bwc-note">Nie znasz rozmiaru? Wybierz najbliższy, a na torze przymierzysz i w razie potrzeby wymienimy.</p>
                  </>
                )}

                {step === "szczegoly" && pid === "taxi" && (
                  <>
                    <p className="bwc-s">Kupujesz jeden przejazd, dostajesz <b>dwa vouchery</b>. Drugi kod przyjdzie mailem zaraz po płatności, możesz go komuś podarować.</p>
                    <h4 className="bwc-h">Wybierz auto</h4>
                    <div className="bwc-opts">
                      {taxiVariants.map((v) => (
                        <button key={v.name} type="button" className={`bwc-opt ${variant?.name === v.name ? "on" : ""}`} onClick={() => setVariant(v)}>
                          <b>{v.name}</b>{v.desc && <small>{v.desc}</small>}
                          <em>{fmtZl(v.price)} netto <span className="bwc-x2">× 2 VOUCHERY</span></em>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {step === "szczegoly" && pid === "heels" && (
                  <>
                    <h4 className="bwc-h">Pakiet</h4>
                    <div className="bwc-opts bwc-opts--2">
                      {HEELS_PACKAGES.map((p) => (
                        <button key={p.id} type="button" className={`bwc-opt ${heelsPkg?.id === p.id ? "on" : ""}`} onClick={() => setHeelsPkg(p)}>
                          <b>PAKIET {p.name}</b>
                          <ul>{p.items.map((x) => <li key={x}>{x}</li>)}</ul>
                          <em>{fmtZl(heelsPrice(raw, p))} netto / osoba</em>
                        </button>
                      ))}
                    </div>
                    <h4 className="bwc-h">Twój bonus</h4>
                    <div className="bwc-opts bwc-opts--2">
                      <button type="button" className={`bwc-opt bwc-opt--gift ${heelsGift === "friend" ? "on" : ""}`} onClick={() => setHeelsGift("friend")}>
                        <b>KOLEŻANKA ZA PÓŁ CENY</b><small>Zabierasz przyjaciółkę, jej miejsce kosztuje 50%.</small>
                        <em>{hp ? `${fmtZl(Math.round(hp * 1.5))} netto za 2 osoby` : "wybierz pakiet"}</em>
                      </button>
                      <button type="button" className={`bwc-opt bwc-opt--gift ${heelsGift === "golf" ? "on" : ""}`} onClick={() => setHeelsGift("golf")}>
                        <b>GOLF FIERI W PREZENCIE</b><small>Jedziesz sama, a na torze dostajesz golf FIERI.</small>
                        <em>{hp ? `${fmtZl(hp)} netto` : "wybierz pakiet"}</em>
                      </button>
                    </div>
                    {heelsGift === "friend" && (
                      <label className="bwc-field bwc-field--full bwc-friend"><span className="req">Imię i nazwisko koleżanki</span>
                        <input value={friend} onChange={(e) => setFriend(e.target.value.slice(0, 80))} autoFocus /></label>
                    )}
                  </>
                )}

                {step === "szczegoly" && pid === "ice" && (
                  <>
                    <p className="bwc-s">Ice Driving Experience w Kuusamo, w fińskiej Laponii. W prezencie dostajesz rozgrzewkę na Torze Łódź: <b>2 sesje Sport Driving dla każdej osoby</b>.</p>
                    <h4 className="bwc-h">Pakiet</h4>
                    <div className="bwc-opts bwc-opts--2">
                      {icePk.map((p) => (
                        <button key={p.id} type="button" className={`bwc-opt ${icePkg?.id === p.id ? "on" : ""}`} onClick={() => { setIcePkg(p); setIceStart(""); }}>
                          <b>{p.name_pl}</b><small>{p.desc_pl || `${p.days} ${p.days === 1 ? "dzień" : "dni"} na lodzie`}</small><em>{fmtEur(p.price, p.currency)} netto / osoba</em>
                        </button>
                      ))}
                    </div>
                    <h4 className="bwc-h">Liczba osób</h4>
                    <div className="bwc-count">
                      <button type="button" onClick={() => setPersons((n) => Math.max(1, n - 1))} aria-label="mniej">−</button>
                      <b>{persons}</b>
                      <button type="button" onClick={() => setPersons((n) => Math.min(8, n + 1))} aria-label="więcej">+</button>
                    </div>
                  </>
                )}

                {step === "termin" && (
                  <>
                    <h3 className="bwc-t">{pid === "ice" ? "KIEDY NA LÓD?" : "TERMIN"}</h3>
                    {pid === "ice" && win && (
                      <div className="bwc-ice rz-ice">
                        <p className="bwc-s">Kliknij pierwszy dzień pobytu. Pakiet zajmie kolejne {icePkg?.days || 1} {(icePkg?.days || 1) === 1 ? "dzień" : "dni"}.</p>
                        <IceCalendar win={win} allowed={allowed} days={icePkg?.days || 1} start={iceStart} onPick={(d) => { setIceStart(d); setTermMode("date"); }} lang={lang} t={t} />
                      </div>
                    )}
                    {pid !== "ice" && (termList.length > 0 ? (
                      <div className="bwc-terms">
                        {termList.map((x) => (
                          <button key={x.id} type="button" className={`bwc-term ${termMode === "date" && termId === x.id ? "on" : ""}`} onClick={() => { setTermId(x.id); setTermMode("date"); }}>
                            <b>{dmy(x.date)}</b><span>{wd(x.date)}</span>
                            <small>{x.location_pl || (isPoznan(x.track) ? "Tor Poznań" : "Tor Łódź")}{x.time ? ` · ${x.time}` : ""}</small>
                          </button>
                        ))}
                      </div>
                    ) : <p className="bwc-note">Na {pid === "heels" ? "Heels on the Track" : "tych torach"} nie ma teraz otwartych terminów. Wybierz opcję poniżej, a zadzwonimy z propozycją.</p>)}
                    {(pid !== "ice" || gift) && (
                      <button type="button" className={`bwc-later ${termMode === "later" ? "on" : ""}`} onClick={() => { setTermMode("later"); setTermId(null); setIceStart(""); }}>
                        <CalIcon />
                        <b>{gift ? "VOUCHER OTWARTY" : "TERMIN USTALIMY PÓŹNIEJ"}</b>
                        <small>{gift ? "Osoba obdarowana sama wybierze datę, w konfiguratorze albo telefonicznie." : "Kupujesz teraz, a datę dobierzemy razem telefonicznie."}</small>
                      </button>
                    )}
                  </>
                )}

                {step === "dane" && (
                  <>
                    {flash && <div className="bwc-flash" role="status"><b>Bonus Black Friday dodany:</b> {flash}</div>}
                    <h3 className="bwc-t">TWOJE DANE</h3>
                    <p className="bwc-s">Na ten adres wyślemy potwierdzenie{gift ? " i voucher" : ""}{pid === "taxi" ? " oraz kod drugiego vouchera Race Taxi" : ""}.</p>
                    <div className="bwc-form">
                      <label className="bwc-field"><span className="req">Imię i nazwisko</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" /></label>
                      <label className="bwc-field"><span className="req">Telefon</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
                      <label className="bwc-field bwc-field--full"><span className="req">E-mail</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                      <label className="bwc-field bwc-field--full"><span>Uwagi (opcjonalnie)</span><textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>
                    <InvoiceFields value={inv} onChange={setInv} f="bwc" />
                  </>
                )}

                {step === "sum" && P && (
                  <>
                    <h3 className="bwc-t">TWÓJ KOSZYK</h3>
                    {gift && <div className="bwc-vprev bwc-vprev--sum"><GiftVoucher lang="pl" name={giftFor} title={vTitle} lines={vLines} /></div>}
                    <dl className="bwc-sum">
                      <div><dt>Program</dt><dd><b>{P.title}</b>{what.length > 0 && ` · ${what.join(" · ")}`}</dd></div>
                      <div><dt>Forma</dt><dd>{gift ? <>Voucher prezentowy dla <b>{giftFor}</b> · kod na mail, ważny 12 miesięcy</> : "Dla siebie"}</dd></div>
                      {gift && <div><dt>Dostawa</dt><dd>{delivery === "inpost" ? `Wydruk w kopercie · Paczkomat ${inpost.locker.toUpperCase()}${inpost.point ? ` (${addressOf(inpost.point)})` : ""} + e-mail` : `E-mail · ${form.email}`}</dd></div>}
                      {when && <div><dt>Termin</dt><dd>{when}</dd></div>}
                      <div className="is-gift"><dt>Bonus Black Friday</dt><dd>{gifts.join(" · ")}</dd></div>
                      <div className="is-who"><dt>Zamawia</dt><dd>{form.full_name} · {form.email} · {form.phone}</dd></div>
                      {inv.want && <div><dt>Faktura</dt><dd>{inv.company} · NIP {inv.nip}</dd></div>}
                      <div><dt>Cena</dt><dd>{money(net)} netto</dd></div>
                      {fee > 0 && <div><dt>Wysyłka InPost</dt><dd>{fmtZl(fee)} netto · {fmtMoney(gross(fee))} brutto</dd></div>}
                      <div className="is-total"><dt>Do zapłaty</dt><dd>{toPay}<small>brutto, w tym VAT 23%</small></dd></div>
                    </dl>
                    {cur === "EUR" && <p className="bwc-note">Kwota w euro zostanie przeliczona na złote po kursie z dnia zakupu.</p>}
                    <p className="bwc-note">Bonus nie zmienia ceny: płacisz zwykłą cenę programu, a prezent dokładamy my.{gift || pid === "taxi" ? " Kody voucherów przyjdą mailem od razu po płatności." : " Skontaktujemy się, żeby go przekazać."}</p>
                    <button type="button" className="bw-silver bwc-pay" onClick={pay} disabled={paying || !on}>
                      {on ? <>ZAPŁAĆ {toPay} <i>›</i></> : "PROMOCJA WYŁĄCZONA"}
                    </button>
                    <p className="bwc-secure"><LockIcon /> Bezpieczna płatność Tpay: BLIK, karta, przelew. Zapłacisz brutto, w tym VAT 23%.</p>
                  </>
                )}
              </div>

              {err && <div className="bwc-err" role="alert">{err}</div>}
            </div>

            {P && step !== "program" && (
              <aside className="bwc-side">
                <div className={`bwc-sidecard ${gift ? "is-gift" : ""}`}>
                  {gift ? <div className="bwc-side__v"><GiftVoucher lang="pl" name={giftFor} title={vTitle} lines={vLines} /></div>
                    : <img className="bwc-side__img" src={P.img} alt="" width="1080" height="1080" decoding="async" />}
                  <div className="bwc-side__body">
                    <b className="bwc-side__t">{P.title}</b>
                    {gift && <span className="bwc-side__l">Voucher prezentowy{giftFor ? ` dla ${giftFor}` : ""}</span>}
                    {what.map((x) => <span key={x} className="bwc-side__l">{x}</span>)}
                    {when && <span className="bwc-side__l">{when}</span>}
                    <div className={`bwc-side__gift ${flash ? "is-added" : ""}`}><small>{flash ? "BONUS BLACK FRIDAY DODANY ✓" : "BONUS BLACK FRIDAY"}</small>{gifts.map((g) => <span key={g}>🎁 {g}</span>)}</div>
                    {net > 0 && <div className="bwc-side__price"><b>{money(net)} <small>netto</small></b>{fee > 0 && <span>+ wysyłka InPost {fmtZl(fee)} netto</span>}<span>{toPay} brutto</span></div>}
                  </div>
                </div>
              </aside>
            )}
          </div>
          <div className="bwc-foot">
            {stepIdx > 0 ? <button type="button" className="bwc-foot__back" onClick={goPrev}><i>‹</i>WSTECZ</button>
              : <button type="button" className="bwc-foot__back" onClick={() => setCfgOpen(false)}><i>‹</i>ZAMKNIJ</button>}
            <div className="bwc-foot__sum">{net > 0 && <><span>{P?.title}{gift ? " · voucher" : ""}</span><b>{money(net)} <small>netto</small></b></>}</div>
            {step !== "sum" && step !== "program" && <button type="button" className={`bw-silver bwc-foot__next ${problem() ? "is-locked" : ""}`} onClick={goNext}>{nextLabel} <i>›</i></button>}
          </div>
        </div>
      )}
      {paying && <PayOverlay create={() => createBwBooking(payload())} onClose={() => setPaying(false)} />}
      <CmsBar />
    </div>
  );
}

/* DD : GG : MM until the end of 30 November (Warsaw) */
function Countdown() {
  const end = useMemo(() => new Date(BW_END).getTime(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const left = Math.max(0, end - now);
  const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div className="bwc-count2" aria-label={`Do końca promocji zostało ${d} dni, ${h} godzin, ${m} minut`}>
      <small>Do końca promocji zostało:</small>
      <div>
        {[[d, "DNI"], [h, "GODZ"], [m, "MIN"]].map(([v, l], i) => (
          <span key={l}>{i > 0 && <i>:</i>}<b className="bwc-metal" key={v}>{pad(v)}</b><em>{l}</em></span>
        ))}
      </div>
    </div>
  );
}

/* the progress as a row of silver segments — done ones are lit, the current one shines */
function Steps({ steps, idx, onPick }) {
  return (
    <ol className="bwc-steps" style={{ ["--n"]: steps.length }}>
      {steps.map((k, i) => (
        <li key={k} className={`${i < idx ? "done" : ""} ${i === idx ? "on" : ""}`}>
          <button type="button" onClick={() => onPick(i)} disabled={i >= idx}><span>{i < idx ? "✓" : i + 1}</span><small>{LABEL[k]}</small></button>
        </li>
      ))}
    </ol>
  );
}

/* create the order (prices checked again on the server) and go to Tpay */
function PayOverlay({ create, onClose }) {
  const { phase, fill, err, retry } = usePayRedirect(create, null, { dur: 1600 });
  useEffect(() => { document.documentElement.classList.add("bwp-lock"); return () => document.documentElement.classList.remove("bwp-lock"); }, []);
  return (
    <div className={`bwc-payov is-${phase}`} role="dialog" aria-live="polite">
      <div className="bwc-payov__in">
        <h3 className="bwc-metal">{phase === "error" ? "COŚ POSZŁO NIE TAK" : "BLACK FRIDAY WEEKS"}</h3>
        {phase !== "error" ? (
          <>
            <div className="bwc-payov__bar"><i style={{ width: `${fill}%` }} /></div>
            <p>{phase === "redirect" ? "Przechodzimy do bezpiecznej płatności Tpay…" : "Przygotowujemy zamówienie i Twój bonus…"}</p>
          </>
        ) : (
          <>
            <p className="bwc-payov__err">{err}</p>
            <div className="bwc-payov__btns">
              <button type="button" className="bw-silver" onClick={retry}>SPRÓBUJ PONOWNIE</button>
              <button type="button" className="bwc-foot__back" onClick={onClose}><i>‹</i>WRÓĆ</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Closed() {
  return (
    <div className="bwc">
      <Nav />
      <main className="bwc-closed">
        <div className="bwc-hero__art" aria-hidden="true"><img src="/assets/bw/car.webp" alt="" width="790" height="520" /></div>
        <div className="container bwc-closed__in">
          <h1 className="bwc-metal bwc-hero__t"><span>BLACK</span><span>FRIDAY</span><span>WEEKS</span></h1>
          <p className="bwc-hero__s">Black Friday Weeks już się zakończyły. Zajrzyj do naszej oferty: szkolenia, Race Taxi i Laponia czekają przez cały rok.</p>
          <Link to="/oferta" className="bw-silver bwc-closed__btn">ZOBACZ OFERTĘ <i>›</i></Link>
        </div>
      </main>
      <CmsBar />
    </div>
  );
}

const CalIcon = () => (<svg className="bwc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
const LockIcon = () => (<svg className="bwc-ico bwc-ico--s" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>);
const GiftIco = () => (<svg className="bwc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8c-2-4-7-4-6 0M12 8c2-4 7-4 6 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>);
const MailIco = () => (<svg className="bwc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>);
const BoxIco = () => (<svg className="bwc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>);
const UserIco = () => (<svg className="bwc-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>);
const GloveIcon = () => (<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21v-6L4.5 11.5a1.6 1.6 0 0 1 2.4-2L9 11.5V4.5a1.3 1.3 0 0 1 2.6 0V10V3.3a1.3 1.3 0 0 1 2.6 0V10V4.3a1.3 1.3 0 0 1 2.6 0V11V6.6a1.3 1.3 0 0 1 2.6 0V15c0 3-2 6-5 6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>);
function PerkIco({ k }) {
  const d = { bolt: "M13 2 4 14h7l-1 8 9-12h-7z", gift: "M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8c-2-4-7-4-6 0M12 8c2-4 7-4 6 0", mail: "M3 6h18v12H3zM3 7l9 7 9-7" }[k];
  return <svg className="bwc-perk__ico" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
