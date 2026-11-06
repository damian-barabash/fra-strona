import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { adminCall } from "../lib/api";
import Nav from "../sections/Nav";
import CmsBar from "../sections/CmsBar";
import { GiftVoucher, Snow, Bow, Flake, GiftIcon } from "../components/GiftVoucher";
import IceCalendar from "../components/IceCalendar";
import InvoiceFields from "../components/InvoiceFields";
import { DiscountField } from "../components/Discount";
import { EMPTY_INVOICE, invoiceProblem, invoicePayload } from "../lib/invoice";
import { PACKAGES, carPrice, customPrice, fmtZl, isPoznan } from "../lib/flota";
import { startDates, fmtEur } from "../lib/ice";
import { gross, fmtMoney, round2 } from "../lib/vat";
import { useDiscount, valueLabel } from "../lib/discount";
import { viewContent, addToCart, initiateCheckout } from "../lib/pixel";
import { useSeo } from "../lib/seo";
import "../sections/flota.css";
import "../sections/laponia.css";
import "../sections/swieta.css";

/* /swieta-2026/voucher — the holiday voucher configurator.
   PREZENT → OPCJE → (TERMIN: open voucher or a date — training and Laponia) → DLA KOGO (+ e-mail / InPost) → DANE → PODSUMOWANIE.
   Then the voucher is packed into an envelope and flies off. Test mode (app_config gift_mode = test): no payment,
   the server creates the voucher at once and e-mails it to the address typed in. Live: Tpay after the envelope. */

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const parseVariants = (txt) => String(txt || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("## "))
  .map((l) => l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł\s*(?:netto)?\s*[·•]?\s*(.*)$/i)).filter(Boolean)
  .map((m) => ({ name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10), desc: m[3] || "" }));
const dmy = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
const sessWord = (n, en) => (en ? `${n} sessions` : n === 3 ? "3 sesje" : `${n} sesji`);
const NAME_TIPS = ["Taty", "Mamy", "Męża", "Żony", "Brata", "Szefa"];

const TX = {
  pl: {
    head: "TWÓJ VOUCHER ŚWIĄTECZNY", headSub: "Wybierz prezent, wpisz imię — resztę zapakujemy my.",
    steps: { prezent: "Prezent", opcje: "Opcje", termin: "Termin", dla: "Dla kogo", dane: "Dane", sum: "Gotowe" },
    pickT: "WYBIERZ PREZENT", pickS: "Wszystko, co sprzedajemy online — od szkolenia na torze po wyprawę.",
    from: "od", net: "netto", gross: "brutto",
    optT: "SKONFIGURUJ PREZENT", carT: "Samochód", own: "Własne auto", trackT: "Tory", sport: "TORY SPORTOWE", sportH: "np. Tor Łódź, Tor Modlin", race: "TORY WYŚCIGOWE", raceH: "np. Tor Poznań, Tor Silesia", pkgT: "Pakiet",
    variantT: "Wariant", icePkgT: "Pakiet Laponii", tripPkgT: "Pakiet wyprawy",
    termT: "TERMIN", openT: "VOUCHER OTWARTY", openD: "Obdarowana osoba sama wybierze datę — w konfiguratorze lub telefonicznie.", dateT: "WYBIERAM TERMIN", dateD: "Termin będzie na voucherze. Można go później zmienić.",
    noTerms: "Na tym torze nie ma teraz otwartych terminów — wybierz voucher otwarty.", iceStart: "Kliknij pierwszy dzień pobytu",
    forT: "DLA KOGO?", forS: "Wpisz imię tak, jak ma się pojawić na voucherze — po słowie „DLA”, np. Łukasza, Ani, Taty.", forPh: "np. Łukasza", tips: "Podpowiedzi:",
    delT: "JAK DOSTARCZYĆ VOUCHER?", mail: "E-MAIL", mailD: "Voucher z kodem od razu po zamówieniu", mailP: "0 zł", inpost: "WYDRUK + PACZKOMAT", inpostD: "Elegancki wydruk w kopercie do Paczkomatu InPost (plus e-mail od razu)",
    locker: "Kod Paczkomatu", lockerPh: "np. WAW01M", lockerFind: "Znajdź paczkomat ›", lockerPhone: "Telefon do powiadomień InPost", lockerName: "Odbiorca paczki",
    dataT: "TWOJE DANE", dataS: "Na ten adres wyślemy voucher i potwierdzenie.", name: "Imię i nazwisko", email: "E-mail", phone: "Telefon", note: "Uwagi (opcjonalnie)",
    sumT: "SPRAWDŹ I ZAPAKUJ", gift: "Prezent", forW: "Dla", deliv: "Dostawa", valid: "Ważność", validV: "12 miesięcy od zakupu", value: "Wartość", ship: "Wysyłka InPost", vat: "w tym VAT 23%", toPay: "Do zapłaty", disc: "Kod rabatowy",
    packTest: "ZAPAKUJ VOUCHER", packTestSub: "TRYB TESTOWY — bez płatności", packLive: "ZAPAKUJ I ZAPŁAĆ", eurNote: "Kwota w euro zostanie przeliczona na złote po kursie z dnia zakupu.",
    next: "DALEJ", back: "WSTECZ", testStrip: "TRYB TESTOWY · voucher powstaje bez płatności, e-mail trafia tylko na podany adres",
    err: { pick: "Wybierz prezent.", opt: "Wybierz wszystkie opcje.", term: "Wybierz termin albo voucher otwarty.", name: "Wpisz imię osoby obdarowanej.", locker: "Podaj kod paczkomatu i telefon.", data: "Uzupełnij imię i nazwisko, e-mail i telefon." },
    packing: "Pakujemy prezent…", flying: "Leci do Ciebie!", doneT: "WSZYSTKO JEST NA MAILU", doneS: "Dziękujemy! Voucher z kodem właśnie poleciał na", doneCode: "Kod vouchera", doneInpost: "Drukowany voucher wyślemy do Paczkomatu", again: "ZAMÓW KOLEJNY", home: "WRÓĆ NA STRONĘ", fail: "Ups — nie udało się zapakować vouchera.", retry: "SPRÓBUJ PONOWNIE",
  },
  en: {
    head: "YOUR CHRISTMAS VOUCHER", headSub: "Pick a gift, add the name — we will wrap the rest.",
    steps: { prezent: "Gift", opcje: "Options", termin: "Date", dla: "For whom", dane: "Details", sum: "Ready" },
    pickT: "PICK THE GIFT", pickS: "Everything we sell online — from track training to a trip.",
    from: "from", net: "net", gross: "gross",
    optT: "CONFIGURE THE GIFT", carT: "Car", own: "Own car", trackT: "Circuits", sport: "SPORT CIRCUITS", sportH: "e.g. Tor Łódź, Tor Modlin", race: "RACE CIRCUITS", raceH: "e.g. Tor Poznań, Tor Silesia", pkgT: "Package",
    variantT: "Variant", icePkgT: "Lapland package", tripPkgT: "Trip package",
    termT: "DATE", openT: "OPEN VOUCHER", openD: "The recipient picks the date — online or by phone.", dateT: "I PICK A DATE", dateD: "The date goes on the voucher. It can be changed later.",
    noTerms: "No open dates on these circuits right now — choose an open voucher.", iceStart: "Click the first day of the stay",
    forT: "FOR WHOM?", forS: "Type the name exactly as it should appear on the voucher.", forPh: "e.g. Luke", tips: "Ideas:",
    delT: "HOW TO DELIVER IT?", mail: "E-MAIL", mailD: "The voucher with its code right after the order", mailP: "0 zł", inpost: "PRINT + LOCKER", inpostD: "A printed voucher in an envelope to an InPost locker (plus the e-mail right away)",
    locker: "Locker code", lockerPh: "e.g. WAW01M", lockerFind: "Find a locker ›", lockerPhone: "Phone for InPost notifications", lockerName: "Parcel recipient",
    dataT: "YOUR DETAILS", dataS: "We will send the voucher and the confirmation here.", name: "Full name", email: "E-mail", phone: "Phone", note: "Notes (optional)",
    sumT: "CHECK AND WRAP", gift: "Gift", forW: "For", deliv: "Delivery", valid: "Valid", validV: "12 months from purchase", value: "Value", ship: "InPost shipping", vat: "incl. 23% VAT", toPay: "To pay", disc: "Discount code",
    packTest: "WRAP THE VOUCHER", packTestSub: "TEST MODE — no payment", packLive: "WRAP AND PAY", eurNote: "The euro amount is converted to PLN at the rate of the purchase day.",
    next: "NEXT", back: "BACK", testStrip: "TEST MODE · the voucher is created without payment, the e-mail goes only to the address given",
    err: { pick: "Pick a gift.", opt: "Choose all options.", term: "Pick a date or an open voucher.", name: "Type the recipient's name.", locker: "Give the locker code and a phone number.", data: "Fill in your name, e-mail and phone." },
    packing: "Wrapping your gift…", flying: "On its way!", doneT: "IT'S ALL IN YOUR INBOX", doneS: "Thank you! The voucher with its code has just flown to", doneCode: "Voucher code", doneInpost: "The printed voucher goes to locker", again: "ORDER ANOTHER", home: "BACK TO THE PAGE", fail: "Oops — the voucher could not be wrapped.", retry: "TRY AGAIN",
  },
};

export default function SwietaVoucher() {
  const S = useStore();
  const { cars, raw, products, icePackages, iceWindows, tripPackages, terms, lang, t, createGiftBooking } = S;
  const en = lang === "en";
  const X = TX[en ? "en" : "pl"];
  useSeo({ title: "Voucher świąteczny — konfigurator", path: "/swieta-2026/voucher", noindex: true });
  const nav = useNavigate();

  const [info, setInfo] = useState({ mode: "test", inpost_net: 50 });
  useEffect(() => { adminCall("", "gift.info", {}).then((r) => r?.ok && setInfo(r)).catch(() => {}); window.scrollTo({ top: 0 }); }, []);

  /* ---- what can be given ---- */
  const cats = useMemo(() => {
    const out = [];
    const minCar = cars.map((c) => carPrice(c, 3, "lodz")).filter(Boolean);
    const stage = products.find((p) => p.slug === "stage-1");
    if (cars.length) out.push({ id: "track", kind: "track", title: en ? "SPORT DRIVING TRAINING" : "SZKOLENIE JAZDY SPORTOWEJ", sub: cars.slice(0, 4).map((c) => c.name.split(" ").slice(0, 2).join(" ")).join(" · "), photo: "/assets/cars/porsche_1.webp", from: Math.min(...minCar), cur: "PLN", color: "#e30613" });
    const ice = products.find((p) => p.theme === "ice");
    const icePk = icePackages.filter((p) => p.visible !== false);
    if (ice && icePk.length && iceWindows.length) out.push({ id: "ice", kind: "ice", title: en ? "ICE DRIVING — LAPLAND" : "ICE DRIVING — LAPONIA", sub: icePk.map((p) => p.name_pl).join(" · "), photo: ice.photo, from: Math.min(...icePk.map((p) => p.price)), cur: icePk[0].currency || "EUR", color: "#2f9fe0" });
    products.filter((p) => p.buy_direct && !p.is_test && p.theme !== "wyprawa" && p.visible !== false).forEach((p) => {
      const v = parseVariants(p.packages_pl);
      out.push({ id: `p:${p.slug}`, kind: "product", slug: p.slug, title: p.title_pl, sub: v.length ? v.map((x) => x.name).join(" · ") : p[en ? "tag_en" : "tag_pl"] || "", photo: p.photo, from: v.length ? Math.min(...v.map((x) => x.price)) : Number(p.price) || 0, cur: p.currency || "PLN", color: p.color || "#e30613", variants: v, price: Number(p.price) || 0 });
    });
    products.filter((p) => p.theme === "wyprawa" && p.buy_direct && p.visible !== false && p.trip_status !== "past" && (!p.date_from || String(p.date_from) >= today())).forEach((p) => {
      const pk = tripPackages.filter((x) => x.product_slug === p.slug && x.visible !== false);
      if (pk.length) out.push({ id: `t:${p.slug}`, kind: "trip", slug: p.slug, title: p.title_pl, sub: pk.map((x) => x.name_pl).join(" · "), photo: p.photo, from: Math.min(...pk.map((x) => x.price)), cur: pk[0].currency || "EUR", color: p.color || "#d8ae4f", packages: pk });
    });
    return out.filter((c) => c.from > 0);
  }, [cars, products, icePackages, iceWindows, tripPackages, en]);

  /* ---- choice ---- */
  const [catId, setCatId] = useState(null);
  const cat = cats.find((c) => c.id === catId) || null;
  const [car, setCar] = useState(null);          // car object | "own"
  const [track, setTrack] = useState("lodz");
  const [sessions, setSessions] = useState(null);
  const [icePkg, setIcePkg] = useState(null);
  const [variant, setVariant] = useState(null);
  const [tripPkg, setTripPkg] = useState(null);
  const [dateMode, setDateMode] = useState("open");
  const [termId, setTermId] = useState(null);
  const [iceStart, setIceStart] = useState("");
  const [forName, setForName] = useState("");
  const [delivery, setDelivery] = useState("email");
  const [inpost, setInpost] = useState({ locker: "", phone: "", name: "" });
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [inv, setInv] = useState(EMPTY_INVOICE);
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState("");
  const [pack, setPack] = useState(null);         // null | { phase, res, error }

  const pickCat = (c) => {
    setCatId(c.id); setErr(""); setCar(null); setSessions(null); setIcePkg(null); setTermId(null); setIceStart(""); setDateMode("open");
    setVariant(c.kind === "product" && c.variants?.length === 1 ? c.variants[0] : null);
    setTripPkg(c.kind === "trip" && c.packages?.length === 1 ? c.packages[0] : null);
    if (c.kind === "ice" && icePackages.length === 1) setIcePkg(icePackages[0]);
  };
  const datable = cat?.kind === "track" || cat?.kind === "ice";
  const noOptions = cat?.kind === "product" && !(cat.variants?.length > 1);
  const STEPS = ["prezent", ...(noOptions ? [] : ["opcje"]), ...(datable ? ["termin"] : []), "dla", "dane", "sum"];
  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];

  const win = iceWindows[0] || null;
  const allowed = useMemo(() => new Set(icePkg && win ? startDates(win, icePkg.days || 1) : []), [icePkg, win]);
  const termList = useMemo(() => terms.filter((x) => x.date && x.date >= today() && !["ice", "heels"].includes(x.type || "sport") && (track === "poznan" ? isPoznan(x.track) : !isPoznan(x.track)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date))), [terms, track]);
  useEffect(() => { if (termId && !termList.some((x) => x.id === termId)) setTermId(null); }, [termList, termId]);
  const term = termList.find((x) => x.id === termId) || null;

  /* ---- price (net, product currency) ---- */
  const own = car === "own";
  const net = !cat ? 0
    : cat.kind === "track" ? (car && sessions ? (own ? customPrice(raw, sessions, track) : carPrice(car, sessions, track)) : 0)
    : cat.kind === "ice" ? (icePkg?.price || 0)
    : cat.kind === "product" ? (variant ? variant.price : cat.variants?.length ? 0 : cat.price)
    : cat.kind === "trip" ? (tripPkg?.price || 0) : 0;
  const cur = cat?.kind === "track" ? "PLN" : cat?.kind === "ice" ? (icePkg?.currency || "EUR") : cat?.kind === "trip" ? (tripPkg?.currency || "EUR") : (cat?.cur || "PLN");
  const fee = delivery === "inpost" ? Number(info.inpost_net) || 0 : 0;
  const money = (n, c = cur) => (c === "EUR" ? fmtEur(n, "EUR") : fmtZl(n));

  const disc = useDiscount({ kind: "voucher", firstStep: stepIdx === 0 });
  const pv = disc.preview({ net, currency: cur });
  const discOn = !!(pv?.ok && pv.ready && pv.off > 0);

  /* ---- what the voucher says ---- */
  const pkgOf = (n) => PACKAGES.find((p) => p.n === n);
  const vText = useMemo(() => {
    if (!cat) return { title: "", lines: [] };
    if (cat.kind === "track") {
      const pk = pkgOf(sessions);
      return {
        title: en ? "SPORT DRIVING TRAINING ON TRACK" : "SZKOLENIE JAZDY SPORTOWEJ NA TORZE",
        lines: [term ? `${term.location_pl || (isPoznan(term.track) ? "Tor Poznań" : "Tor Łódź")} · ${dmy(term.date)}` : track === "poznan" ? "Tor Poznań" : "Tor Łódź",
          pk ? `${en ? "Package" : "Pakiet"} ${(en ? pk.en : pk.pl).replace(/^pakiet\s+/i, "")} - ${sessWord(sessions, en)}` : "",
          own ? X.own : car?.name || ""],
      };
    }
    if (cat.kind === "ice") return { title: "ICE DRIVING EXPERIENCE — LAPONIA", lines: [icePkg?.name_pl || "", iceStart ? `${en ? "from" : "od"} ${dmy(iceStart)}` : "Kuusamo, Finlandia"] };
    if (cat.kind === "product") return { title: cat.title, lines: [variant?.name || ""] };
    return { title: cat.title, lines: [tripPkg?.name_pl || ""] };
  }, [cat, sessions, term, track, own, car, icePkg, iceStart, variant, tripPkg, en]); // eslint-disable-line

  /* ---- validation ---- */
  const validEmail = /.+@.+\..+/.test(form.email);
  const problem = () => {
    if (step === "prezent" && !cat) return X.err.pick;
    if (step === "opcje" && !net) return X.err.opt;
    if (step === "termin" && dateMode === "date" && !(cat.kind === "track" ? termId : iceStart)) return X.err.term;
    if (step === "dla") {
      if (forName.trim().length < 2) return X.err.name;
      if (delivery === "inpost" && !(/^[A-Za-z]{3}\d{1,4}[A-Za-z]{0,3}$/.test(inpost.locker.replace(/\s/g, "")) && inpost.phone.replace(/\D/g, "").length >= 9)) return X.err.locker;
    }
    if (step === "dane") { if (!(form.full_name.trim() && validEmail && form.phone.trim())) return X.err.data; const ip = invoiceProblem(inv); if (ip) return t(ip); }
    return "";
  };
  // a new step: scroll to the step itself (the red header stays above), not to the very top
  const toBody = () => requestAnimationFrame(() => {
    const el = document.querySelector(".sw-cfg__body"); if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - (window.innerWidth <= 900 ? 64 : 80);
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  });
  const goNext = () => {
    const p = problem(); if (p) { setErr(p); return; }
    setErr(""); setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)); toBody();
  };
  const goPrev = () => { setErr(""); if (stepIdx === 0) { nav("/swieta-2026"); return; } setStepIdx((i) => Math.max(0, i - 1)); toBody(); };

  const cartItem = cat ? { name: `Voucher świąteczny · ${vText.title}`, price: net, currency: cur, id: cat.id, category: "voucher" } : null;
  useEffect(() => { if (step === "sum" && cartItem) viewContent(cartItem); }, [step]); // eslint-disable-line

  const payload = () => ({
    gift: {
      kind: cat.kind, car_id: own ? null : car?.id, is_custom: own, sessions, track,
      term_id: cat.kind === "track" && dateMode === "date" ? termId : null,
      package_id: cat.kind === "ice" ? icePkg?.id : cat.kind === "trip" ? tripPkg?.id : null,
      date_from: cat.kind === "ice" && dateMode === "date" ? iceStart : null,
      slug: cat.slug, variant: variant?.name || null,
    },
    voucher_for: forName.trim(), delivery, delivery_data: delivery === "inpost" ? { ...inpost, locker: inpost.locker.toUpperCase().replace(/\s/g, ""), name: inpost.name || form.full_name } : null,
    full_name: form.full_name, email: form.email, phone: form.phone, note: form.note, invoice: invoicePayload(inv),
    discount_code: pv?.ok ? disc.code?.code : undefined,
  });
  const startPack = () => {
    if (pack) return;
    addToCart(cartItem); initiateCheckout();
    setPack({ phase: "lift" });
  };

  const STEP_TITLE = { prezent: X.pickT, opcje: X.optT, termin: X.termT, dla: X.forT, dane: X.dataT, sum: X.sumT };
  const grossPln = discOn ? round2(pv.toPay + gross(fee)) : null;

  return (
    <div className="sw sw-cfg">
      <Nav />
      <main>
        <section className="sw-cfg__head">
          <div className="sw-velvet" />
          <Snow count={26} />
          <div className="container">
            <span className="sw-eyebrow sw-eyebrow--gold">ŚWIĘTA 2026 · FASTLINE RACING ACADEMY</span>
            <h1 className="sw-h2">{X.head}</h1>
            <p className="sw-body">{X.headSub}</p>
            <Garland steps={STEPS} idx={stepIdx} labels={X.steps} onPick={(i) => { if (i < stepIdx) { setStepIdx(i); toBody(); } }} />
          </div>
        </section>
        {info.mode === "test" && <div className="sw-teststrip"><b>TEST</b> {X.testStrip}</div>}

        <section className="sw-cfg__body">
          <div className={`container sw-cfg__grid is-${step}`}>
            <aside className="sw-cfg__side">
              <div className="sw-cfg__preview">
                <GiftVoucher lang={lang} name={forName} title={vText.title} lines={vText.lines} />
                <span className="sw-cfg__previewLbl">{en ? "LIVE PREVIEW" : "PODGLĄD NA ŻYWO"}</span>
              </div>
              {cat && net > 0 && (
                <div className="sw-cfg__price">
                  <span>{X.value}</span>
                  <b>{money(net)} <small>{X.net}</small></b>
                  {fee > 0 && <em>+ {X.ship} {fmtZl(fee)} {X.net}</em>}
                </div>
              )}
            </aside>

            <div className="sw-cfg__main">
              <div className="sw-cfg__card" key={step}>
                <span className="sw-cfg__steptag">{(en ? "STEP" : "KROK")} {stepIdx + 1} / {STEPS.length}</span>
                <h2 className="sw-cfg__t">{STEP_TITLE[step]}</h2>

                {step === "prezent" && (
                  <>
                    <p className="sw-cfg__s">{X.pickS}</p>
                    <div className="sw-cats">
                      {cats.map((c, i) => (
                        <button key={c.id} className={`sw-cat ${catId === c.id ? "on" : ""}`} style={{ ["--cc"]: c.color, animationDelay: `${i * 70}ms` }} onClick={() => pickCat(c)}>
                          <span className="sw-cat__img">{c.photo && <img src={c.photo} alt="" loading="lazy" sizes="(max-width: 900px) 92vw, 320px" />}<i className="sw-cat__ribbon" /></span>
                          <span className="sw-cat__body">
                            <b>{c.title}</b>
                            <small>{c.sub}</small>
                            <em>{X.from} {money(c.from, c.cur)} <i>{X.net}</i></em>
                          </span>
                          <span className="sw-cat__tick">✓</span>
                        </button>
                      ))}
                    </div>
                    <DiscountField d={disc} preview={pv} need={t("disc.needVoucher")} />
                  </>
                )}

                {step === "opcje" && cat?.kind === "track" && (
                  <>
                    <h4 className="sw-cfg__h">{X.carT}</h4>
                    <div className="sw-cars">
                      {cars.map((c) => (
                        <button key={c.id} className={`sw-carpick ${car?.id === c.id ? "on" : ""}`} style={{ ["--cc"]: c.color }} onClick={() => setCar(c)}>
                          <span className="sw-carpick__img">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos[0]} alt="" loading="lazy" sizes="200px" />}</span>
                          <b>{c.name}</b><small>{X.from} {fmtZl(carPrice(c, 3, track))}</small>
                        </button>
                      ))}
                      <button className={`sw-carpick sw-carpick--own ${own ? "on" : ""}`} onClick={() => setCar("own")}>
                        <span className="sw-carpick__img"><span className="sw-carpick__badge">⌁</span></span>
                        <b>{X.own}</b><small>{X.from} {fmtZl(customPrice(raw, 3, track))}</small>
                      </button>
                    </div>
                    <h4 className="sw-cfg__h">{X.trackT}</h4>
                    <div className="sw-switch">
                      {[{ k: "lodz", l: X.sport, h: X.sportH }, { k: "poznan", l: X.race, h: X.raceH }].map((x) => (
                        <button key={x.k} className={track === x.k ? "on" : ""} onClick={() => setTrack(x.k)}>{x.l}<small>{x.h}</small></button>
                      ))}
                    </div>
                    <h4 className="sw-cfg__h">{X.pkgT}</h4>
                    <div className="sw-pkgs">
                      {PACKAGES.map((p) => {
                        const pr = car ? (own ? customPrice(raw, p.n, track) : carPrice(car, p.n, track)) : 0;
                        return (
                          <button key={p.n} className={`sw-pkg ${sessions === p.n ? "on" : ""}`} onClick={() => setSessions(p.n)} disabled={!!car && !pr}>
                            <span className="sw-pkg__n">{p.n}</span>
                            <span className="sw-pkg__w">{sessWord(p.n, en).replace(/^\d+\s*/, "")}</span>
                            <b>{en ? p.en : p.pl}</b>
                            <em>{car ? (pr ? `${fmtZl(pr)} ${X.net}` : "—") : (en ? "pick a car" : "wybierz auto")}</em>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {step === "opcje" && cat?.kind === "ice" && (
                  <div className="sw-opts">
                    {icePackages.filter((p) => p.visible !== false).map((p) => (
                      <button key={p.id} className={`sw-opt ${icePkg?.id === p.id ? "on" : ""}`} onClick={() => { setIcePkg(p); setIceStart(""); }}>
                        <b>{p.name_pl}</b><small>{p[en ? "desc_en" : "desc_pl"] || `${p.days} ${en ? "days" : "dni"}`}</small><em>{fmtEur(p.price, p.currency)} {X.net}</em>
                      </button>
                    ))}
                  </div>
                )}
                {step === "opcje" && cat?.kind === "product" && (
                  <div className="sw-opts">
                    {cat.variants.map((v) => (
                      <button key={v.name} className={`sw-opt ${variant?.name === v.name ? "on" : ""}`} onClick={() => setVariant(v)}>
                        <b>{v.name}</b>{v.desc && <small>{v.desc}</small>}<em>{fmtZl(v.price)} {X.net}</em>
                      </button>
                    ))}
                  </div>
                )}
                {step === "opcje" && cat?.kind === "trip" && (
                  <div className="sw-opts">
                    {cat.packages.map((p) => (
                      <button key={p.id} className={`sw-opt ${tripPkg?.id === p.id ? "on" : ""}`} onClick={() => setTripPkg(p)}>
                        <b>{p.name_pl}</b>{p[en ? "desc_en" : "desc_pl"] && <small>{p[en ? "desc_en" : "desc_pl"]}</small>}<em>{fmtEur(p.price, p.currency)} {X.net}</em>
                      </button>
                    ))}
                  </div>
                )}

                {step === "termin" && (
                  <>
                    <div className="sw-modes">
                      <button className={`sw-mode ${dateMode === "open" ? "on" : ""}`} onClick={() => setDateMode("open")}><GiftIcon /><b>{X.openT}</b><small>{X.openD}</small></button>
                      <button className={`sw-mode ${dateMode === "date" ? "on" : ""}`} onClick={() => setDateMode("date")}><CalIcon /><b>{X.dateT}</b><small>{X.dateD}</small></button>
                    </div>
                    {dateMode === "date" && cat.kind === "track" && (termList.length ? (
                      <div className="sw-terms">
                        {termList.map((x) => (
                          <button key={x.id} className={`sw-term ${termId === x.id ? "on" : ""}`} onClick={() => setTermId(x.id)}>
                            <b>{dmy(x.date)}</b><span>{x.location_pl || (isPoznan(x.track) ? "Tor Poznań" : "Tor Łódź")}</span><small>{x.time}</small>
                          </button>
                        ))}
                      </div>
                    ) : <p className="sw-note">{X.noTerms}</p>)}
                    {dateMode === "date" && cat.kind === "ice" && win && (
                      <div className="sw-ice rz-ice">
                        <p className="sw-cfg__s">{X.iceStart}</p>
                        <IceCalendar win={win} allowed={allowed} days={icePkg?.days || 1} start={iceStart} onPick={setIceStart} lang={lang} t={t} />
                      </div>
                    )}
                  </>
                )}

                {step === "dla" && (
                  <>
                    <p className="sw-cfg__s">{X.forS}</p>
                    <label className="sw-namefield">
                      <span>{en ? "FOR" : "DLA"}</span>
                      <input value={forName} onChange={(e) => setForName(e.target.value.replace(/\s+/g, " ").slice(0, 40))} placeholder={X.forPh} autoFocus maxLength={40} />
                      <i>{forName.length}/40</i>
                    </label>
                    {!en && <div className="sw-tips"><span>{X.tips}</span>{NAME_TIPS.map((n) => <button key={n} onClick={() => setForName(n)}>{n}</button>)}</div>}

                    <h4 className="sw-cfg__h">{X.delT}</h4>
                    <div className="sw-modes">
                      <button className={`sw-mode ${delivery === "email" ? "on" : ""}`} onClick={() => setDelivery("email")}><MailIcon2 /><b>{X.mail}</b><small>{X.mailD}</small><em>{X.mailP}</em></button>
                      <button className={`sw-mode ${delivery === "inpost" ? "on" : ""}`} onClick={() => setDelivery("inpost")}><BoxIcon /><b>{X.inpost}</b><small>{X.inpostD}</small><em>+{fmtZl(info.inpost_net)} {X.net}</em></button>
                    </div>
                    {delivery === "inpost" && (
                      <div className="fl-form sw-inpost">
                        <label className="fl-field"><span className="req">{X.locker}</span><input value={inpost.locker} onChange={(e) => setInpost({ ...inpost, locker: e.target.value.toUpperCase().slice(0, 12) })} placeholder={X.lockerPh} />
                          <a href="https://inpost.pl/znajdz-paczkomat" target="_blank" rel="noreferrer" className="sw-link">{X.lockerFind}</a></label>
                        <label className="fl-field"><span className="req">{X.lockerPhone}</span><input value={inpost.phone} onChange={(e) => setInpost({ ...inpost, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
                        <label className="fl-field fl-field--full"><span>{X.lockerName}</span><input value={inpost.name} onChange={(e) => setInpost({ ...inpost, name: e.target.value })} placeholder={form.full_name || ""} /></label>
                      </div>
                    )}
                  </>
                )}

                {step === "dane" && (
                  <>
                    <p className="sw-cfg__s">{X.dataS}</p>
                    <div className="fl-form">
                      <label className="fl-field"><span className="req">{X.name}</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" /></label>
                      <label className="fl-field"><span className="req">{X.phone}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" /></label>
                      <label className="fl-field fl-field--full"><span className="req">{X.email}</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                      <label className="fl-field fl-field--full"><span>{X.note}</span><textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>
                    <InvoiceFields value={inv} onChange={setInv} f="fl" />
                  </>
                )}

                {step === "sum" && (
                  <>
                    <dl className="sw-sum">
                      <div><dt>{X.gift}</dt><dd>{[vText.title, ...vText.lines].filter(Boolean).join(" · ")}</dd></div>
                      <div><dt>{X.forW}</dt><dd><b>{forName}</b></dd></div>
                      <div><dt>{X.deliv}</dt><dd>{delivery === "inpost" ? `${X.inpost} · ${inpost.locker.toUpperCase()}` : `${X.mail} · ${form.email}`}</dd></div>
                      <div><dt>{X.valid}</dt><dd>{X.validV}</dd></div>
                      <div><dt>{X.value}</dt><dd>{money(net)} {X.net} · {money(gross(net))} {X.gross}</dd></div>
                      {fee > 0 && <div><dt>{X.ship}</dt><dd>{fmtZl(fee)} {X.net} · {fmtMoney(gross(fee))} {X.gross}</dd></div>}
                      {discOn && <div className="is-disc"><dt>{X.disc}</dt><dd>{disc.code.code} · −{fmtMoney(pv.off)}</dd></div>}
                      <div className="is-total"><dt>{X.toPay}</dt><dd data-disc-target="2">
                        {discOn ? fmtMoney(grossPln) : cur === "EUR" ? `${fmtMoney(gross(net), "EUR")}${fee ? ` + ${fmtMoney(gross(fee))}` : ""}` : fmtMoney(gross(net) + gross(fee))}
                        <small>{X.vat}</small></dd></div>
                    </dl>
                    {cur === "EUR" && !discOn && <p className="sw-note">{X.eurNote}</p>}
                    {disc.status === "ok" && !discOn && pv && <p className="sw-note">{t("disc.line")} {valueLabel(disc.code, t)}</p>}
                    <button className="sw-btn sw-btn--gold sw-pack" onClick={startPack} disabled={!!pack}>
                      <GiftIcon />{info.mode === "test" ? X.packTest : X.packLive}
                      {info.mode === "test" ? <small>{X.packTestSub}</small> : <small>{discOn ? fmtMoney(grossPln) : ""}</small>}
                    </button>
                  </>
                )}
              </div>

              {err && <div className="sw-err" role="alert">{err}</div>}
              {step !== "sum" && (
                <div className="sw-foot">
                  <button className="sw-foot__back" onClick={goPrev}><i>‹</i>{X.back}</button>
                  <div className="sw-foot__sum">{net > 0 && <><span>{vText.title}</span><b>{money(net)} <small>{X.net}</small></b></>}</div>
                  <button className={`sw-btn sw-foot__next ${problem() ? "is-locked" : ""}`} onClick={goNext}>{X.next}<span className="btn__arrow">›</span></button>
                </div>
              )}
              {step === "sum" && <div className="sw-foot sw-foot--sum"><button className="sw-foot__back" onClick={goPrev}><i>‹</i>{X.back}</button></div>}
            </div>
          </div>
        </section>
      </main>
      {pack && (
        <PackShow X={X} en={en} lang={lang} forName={forName} vText={vText} email={form.email} delivery={delivery} locker={inpost.locker.toUpperCase()}
          create={() => createGiftBooking(payload())} live={info.mode === "live"} onClose={() => setPack(null)} onAgain={() => { setPack(null); setStepIdx(0); setCatId(null); setForName(""); }} />
      )}
      <CmsBar />
    </div>
  );
}

/* step progress as baubles on a garland — done ones are gold, the current one glows */
function Garland({ steps, idx, labels, onPick }) {
  return (
    <ol className="sw-garland" style={{ ["--n"]: steps.length }}>
      <svg className="sw-garland__wire" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 Q 250 58 500 30 T 1000 8" /></svg>
      {steps.map((k, i) => (
        <li key={k} className={`${i < idx ? "done" : ""} ${i === idx ? "on" : ""}`} style={{ ["--i"]: i }}>
          <button type="button" onClick={() => onPick(i)} disabled={i >= idx} aria-label={labels[k]}>
            <span className="sw-bauble"><i>{i < idx ? "✓" : i + 1}</i></span>
            <small>{labels[k]}</small>
          </button>
        </li>
      ))}
    </ol>
  );
}

/* The finale: the voucher rises, slides into an envelope, the flap closes, a wax seal stamps it and it flies off
   the screen — while the server creates the voucher. Then "it's all in your inbox" (or Tpay in live mode). */
function PackShow({ X, en, lang, forName, vText, email, delivery, locker, create, live, onClose, onAgain }) {
  const [phase, setPhase] = useState("lift");   // lift → insert → close → seal → fly → done | error
  const [res, setRes] = useState(null);
  const reqRef = useRef(null);   // StrictMode runs the effect twice — one request, the second run reuses it
  const timers = useRef([]);
  useEffect(() => {
    document.documentElement.classList.add("sw-lock");
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    const req = (reqRef.current ||= create().catch(() => ({ ok: false, error: "Brak połączenia." })));
    at(500, () => setPhase("insert"));
    at(1500, () => setPhase("close"));
    at(2100, () => setPhase("seal"));
    const minDone = new Promise((r) => at(2900, r));
    let alive = true;
    Promise.all([req, minDone]).then(([r]) => {
      if (!alive) return;
      setRes(r);
      if (!r.ok) { setPhase("error"); return; }
      setPhase("fly");
      at(1150, () => {
        if (live && r.payment_url) { window.location.assign(r.payment_url); return; }
        setPhase("done");
      });
    });
    return () => { timers.current.forEach(clearTimeout); document.documentElement.classList.remove("sw-lock"); };
  }, []); // eslint-disable-line

  return (
    <div className={`sw-pk is-${phase}`} role="dialog" aria-live="polite">
      <div className="sw-pk__bg" />
      <Snow count={30} />
      {phase !== "done" && (
        <div className="sw-pk__stage">
          <div className="sw-env">
            <div className="sw-env__back" />
            <div className="sw-env__letter"><GiftVoucher lang={lang} name={forName} title={vText.title} lines={vText.lines} /></div>
            <div className="sw-env__front"><span className="sw-env__addr">{en ? "FOR" : "DLA"} {forName.toUpperCase()}</span></div>
            <div className="sw-env__flap" />
            <div className="sw-env__seal"><img src="/assets/ui/logo_dark.webp" alt="" sizes="60px" /></div>
            <span className="sw-env__trail" />
          </div>
          <p className="sw-pk__msg">{phase === "error" ? X.fail : phase === "fly" ? X.flying : X.packing}</p>
          {phase === "error" && (
            <div className="sw-pk__err">
              <p>{res?.error}</p>
              <button className="sw-btn sw-btn--gold" onClick={onClose}>{X.retry}</button>
            </div>
          )}
        </div>
      )}
      {phase === "done" && (
        <div className="sw-done">
          <Bow className="sw-done__bow" />
          <Flake className="sw-done__flake" />
          <span className="sw-eyebrow sw-eyebrow--gold">{res?.test ? "TEST · " : ""}{en ? "THANK YOU" : "DZIĘKUJEMY"}</span>
          <h2 className="sw-h2">{X.doneT}</h2>
          <p className="sw-body">{X.doneS} <b>{email}</b>.</p>
          {res?.voucher_code && <div className="sw-done__code"><small>{X.doneCode}</small><b>{res.voucher_code}</b></div>}
          {delivery === "inpost" && <p className="sw-body">📦 {X.doneInpost} <b>{locker}</b>.</p>}
          <div className="sw-done__btns">
            <button className="sw-btn sw-btn--gold" onClick={onAgain}><GiftIcon />{X.again}</button>
            <Link to="/swieta-2026" className="sw-btn sw-btn--ghost">{X.home}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

const CalIcon = () => (<svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
const MailIcon2 = () => (<svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>);
const BoxIcon = () => (<svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>);
