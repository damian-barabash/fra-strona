import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { sendContact } from "../lib/api";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText, EMedia, EBg } from "../components/Editable";
import { useReveal, useRevealOnScroll, useCountUp } from "../lib/hooks";
import "../sections/firmy.css";

/* /dla-firm — corporate events. Content merged from the old eventy-firmowe page and the client's
   landing brief, rebuilt in the site's racing style. The configurator estimates a net budget live
   (rates below) and sends the brief to the sales inbox + a copy to the company. */
const RATES = {
  pakiety: { standard: { pl: "Standard", en: "Standard", base: 2200, cars: "Toyota GR Supra, Alpine A110, Mercedes A45 AMG, Toyota GR Yaris" },
    premium: { pl: "Premium (Porsche)", en: "Premium (Porsche)", base: 3200, cars: "Porsche 911 Carrera 4 GTS + flota Standard" },
    vip: { pl: "VIP (supersamochody)", en: "VIP (supercars)", base: 4800, cars: "Maserati MC20 + supersamochody floty Fastline" } },
  org: 6000,
  length: { half: { pl: "Pół dnia", en: "Half a day", k: 0.6, days: 1 }, full: { pl: "Cały dzień", en: "Full day", k: 1, days: 1 }, two: { pl: "Dwa dni", en: "Two days", k: 1.85, days: 2 } },
  extras: {
    raceTaxi: { pl: "Race Taxi z Mistrzem Polski", en: "Race Taxi with the Polish champion", per: "os", v: 250 },
    sim: { pl: "Symulator Virtual GP", en: "Virtual GP simulator", per: "flat", v: 4000 },
    foto: { pl: "Relacja foto/video", en: "Photo/video coverage", per: "flat", v: 2800 },
    after: { pl: "Afterparty", en: "Afterparty", per: "os", v: 350 },
    catering: { pl: "Catering premium", en: "Premium catering", per: "os", v: 150 },
    host: { pl: "Hostessy & Pit-Girls", en: "Hostesses & Pit-Girls", per: "flat", v: 2800 },
    coach: { pl: "Trener psychomotoryczny", en: "Psychomotor coach", per: "flat", v: 2500 },
    hotel: { pl: "Nocleg", en: "Accommodation", per: "os", v: 600 },
    dinner: { pl: "Kolacja", en: "Dinner", per: "os", v: 250 },
    gifts: { pl: "Nagrody i gifty", en: "Prizes and gifts", per: "os", v: 180 },
  },
  goals: { integracja: { pl: "Integracja pracowników", en: "Team integration" }, b2b: { pl: "Event B2B dla klientów", en: "B2B client event" }, szkolenie: { pl: "Szkolenie + team building", en: "Training + team building" }, vip: { pl: "Impreza VIP", en: "VIP event" } },
  tracks: ["Tor Łódź", "Tor Modlin", "Inny tor", "Doradźcie mi"],
};
/* line icons for the offer tiles (one style, red accent) */
const OICON = {
  shield: <svg viewBox="0 0 64 64"><path d="M32 6l20 7v16c0 13-8.6 24-20 29C20.6 53 12 42 12 29V13z" /><path className="a" d="M22 32l7 7 13-14" /></svg>,
  wheel: <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" /><circle cx="32" cy="32" r="7" /><path d="M32 8v17M12 40l13-5M52 40l-13-5" /><path className="a" d="M8 32h8M48 32h8" /></svg>,
  conf: <svg viewBox="0 0 64 64"><rect x="10" y="12" width="44" height="28" rx="2" /><path d="M32 40v10M20 52h24" /><path className="a" d="M18 34l8-10 6 6 8-11 6 8" /></svg>,
  timer: <svg viewBox="0 0 64 64"><circle cx="34" cy="36" r="20" /><path d="M28 8h12M34 8v8M50 18l4-4" /><path className="a" d="M34 24v12l8 6" /><path d="M6 30h10M4 38h12M8 46h8" /></svg>,
  cater: <svg viewBox="0 0 64 64"><path d="M8 44h48" /><path d="M12 44a20 20 0 0 1 40 0" /><path className="a" d="M32 20v-6M28 12h8" /><path d="M6 52h52" /></svg>,
  cup: <svg viewBox="0 0 64 64"><path d="M20 10h24v12a12 12 0 0 1-24 0z" /><path d="M20 14h-8v4a8 8 0 0 0 8 8M44 14h8v4a8 8 0 0 1-8 8" /><path d="M32 34v8M22 54h20M26 42h12v12H26z" /><path className="a" d="M28 20l3 3 6-6" /></svg>,
  taxi: <svg viewBox="0 0 64 64"><path d="M10 40l4-12a4 4 0 0 1 4-3h28a4 4 0 0 1 4 3l4 12v10H10z" /><circle cx="19" cy="48" r="4" /><circle cx="45" cy="48" r="4" /><path className="a" d="M6 40h52M24 16h16v9" /></svg>,
  heli: <svg viewBox="0 0 64 64"><path d="M8 14h48M32 14v10" /><path d="M22 34a10 10 0 0 1 10-10h6a12 12 0 0 1 12 12v4H26a4 4 0 0 1-4-4z" /><path d="M22 34H8l-4-8" /><path className="a" d="M26 48h20M32 40v8M44 40v8" /><circle cx="42" cy="30" r="3" /></svg>,
};
const OFFER = [
  { ic: "shield", pl: ["Bezpieczeństwo", "Pełnowymiarowe szkolenie z bezpiecznej jazdy — reakcje w sytuacjach awaryjnych, hamowanie, test łosia, opanowanie poślizgu."], en: ["Safety", "A full safe-driving course — emergency reactions, braking, the moose test, skid control."] },
  { ic: "wheel", pl: ["Światowy poziom Sport Driving", "Trening 1:1 z instruktorem–zawodnikiem, linia wyścigowa i jazda na limicie samochodu."], en: ["World-class Sport Driving", "1:1 training with a competitor-instructor, the racing line and driving at the car's limit."] },
  { ic: "conf", pl: ["Zaplecze konferencyjne", "Ogrzewane budynki, sale z ekranami LED — miejsce na prezentacje, lunch i rozmowy między sesjami."], en: ["Conference facilities", "Heated buildings and rooms with LED screens — for presentations, lunch and talks between sessions."] },
  { ic: "timer", pl: ["Twoje Grand Prix", "Pomiar czasów, rywalizacja grup i wyniki na żywo na ekranach. Emocje jak w prawdziwych wyścigach."], en: ["Your Grand Prix", "Lap timing, team competition and live results on screens. Emotions like a real race."] },
  { ic: "cater", pl: ["Catering", "Całodniowa przerwa kawowa z przekąskami i ciepły lunch — obsługa na najwyższym poziomie."], en: ["Catering", "All-day coffee break with snacks and a hot lunch — top-level service."] },
  { ic: "cup", pl: ["Nagrody dla uczestników", "Vouchery, gadżety i firmowy branding — pamiątka, która przypomina o wydarzeniu przez długi czas."], en: ["Prizes for participants", "Vouchers, gadgets and corporate branding — a keepsake that recalls the day for a long time."] },
  { ic: "taxi", pl: ["Race Taxi z Mistrzem Polski", "Przejazd z Mariuszem Miękosiem — 9-krotnym Wyścigowym Mistrzem Polski. Realny limit auta na torze."], en: ["Race Taxi with the champion", "A lap with Mariusz Miękoś — 9-time Polish racing champion. The real limit of the car on track."] },
  { ic: "heli", pl: ["Atrakcje towarzyszące", "Symulatory, przeloty helikopterem, off-road, jachty — dla tych, których łączy pasja prędkości."], en: ["Extra attractions", "Simulators, helicopter flights, off-road, yachts — for those who share a passion for speed."] },
];
const DAY = [
  { pl: ["Część teoretyczna", "Wykład instruktorów–zawodników o technikach jazdy bezpiecznej i sportowej — fundament pod praktykę na torze."], en: ["Theory", "A lecture by competitor-instructors on safe and sport driving techniques — the base for the track."] },
  { pl: ["Safe & Eco Driving", "Pozycja za kierownicą, praca pedałami, hamowanie awaryjne, ABS i kontrola trakcji, slalom, test łosia, opanowanie poślizgu."], en: ["Safe & Eco Driving", "Seating position, pedal work, emergency braking, ABS and traction control, slalom, moose test, skid control."] },
  { pl: ["Sport Driving 1:1", "Trening jazdy sportowej po torze w formule 1:1 z instruktorem — linia wyścigowa, jazda na limicie, zarządzanie masą auta."], en: ["Sport Driving 1:1", "Sport driving on the track 1:1 with an instructor — racing line, driving at the limit, managing the car's weight."] },
  { pl: ["Race Taxi", "Przejazd na miejscu pasażera z Wyścigowym Mistrzem Polski w jednym z aut floty Fastline. Czysta adrenalina."], en: ["Race Taxi", "A passenger lap with the Polish racing champion in one of the Fastline fleet cars. Pure adrenaline."] },
  { pl: ["Twoje Grand Prix", "Pomiar czasów, rywalizacja grup i wyniki na żywo. Najlepsi wjeżdżają na podium."], en: ["Your Grand Prix", "Lap timing, team competition and live results. The best step onto the podium."] },
  { pl: ["Podium & certyfikaty", "Podsumowanie w paddocku, certyfikaty Stage 1 sygnowane przez Mariusza Miękosia, nagrody i wspólne świętowanie."], en: ["Podium & certificates", "A wrap-up in the paddock, Stage 1 certificates signed by Mariusz Miękoś, prizes and a celebration."] },
];
const AGENDA = [["11:00–11:15", "Rejestracja uczestników", "Registration"], ["11:15–12:00", "Prezentacja teoretyczna", "Theory presentation"], ["12:00–14:00", "Safe Driving Experience", "Safe Driving Experience"], ["14:00–14:30", "Lunch", "Lunch"], ["14:30–17:15", "Sport Driving Experience", "Sport Driving Experience"], ["17:15–17:45", "Race Taxi", "Race Taxi"], ["17:45–18:00", "Zakończenie, rozdanie certyfikatów", "Closing, certificates"]];
const TRACKS = [
  { pl: ["Centrum Polski · A1/A2", "Tor Łódź", "Świetny obiekt do szkoleń jazdy sportowej — wymagający technicznie, idealny do nauki.", ["Długość 1,5 km, aż 17 zakrętów", "Przy skrzyżowaniu autostrad A1/A2, 2 km od zjazdu Łódź Północ", "Ogrzewany budynek i sala konferencyjna z ekranem LED"]], en: ["Central Poland · A1/A2", "Łódź Circuit", "A great venue for sport driving training — technically demanding, ideal for learning.", ["1.5 km long, 17 corners", "At the A1/A2 junction, 2 km from the Łódź Północ exit", "Heated building and a conference room with an LED screen"]] },
  { pl: ["Pod Warszawą", "Tor Modlin", "Tor sportowo-treningowy o dużych możliwościach aranżacji tras.", ["Długość 1,2 km, aż 22 techniczne zakręty", "Trasy o różnym stopniu trudności — precyzja i wysokie prędkości", "Sala wykładowa, foyer, taras widokowy i trybuny"]], en: ["Near Warsaw", "Modlin Circuit", "A sport and training circuit with many layout options.", ["1.2 km long, 22 technical corners", "Layouts of varying difficulty — precision and high speed", "Lecture room, foyer, viewing terrace and grandstands"]] },
];
const EXTRAS = [["🎮", "Symulator Virtual GP", "Virtual GP simulator"], ["📸", "Relacja foto/video", "Photo/video coverage"], ["🍸", "Afterparty", "Afterparty"], ["🧠", "Trener psychomotoryczny", "Psychomotor coach"], ["💃", "Hostessy & Pit-Girls", "Hostesses & Pit-Girls"], ["🏨", "Nocleg", "Accommodation"], ["🍷", "Kolacja", "Dinner"], ["🎁", "Nagrody i gifty", "Prizes and gifts"]];
const LOGOS = ["orange", "nokia", "orlen", "verva", "brs", "sony", "chiesi", "canon", "vortune", "playstation", "cisco", "samsung", "c2c", "porsche", "bmw", "jaworski", "alpine", "granturismo", "logwin", "pirelli", "nobleplace", "tagheuer", "redbull", "viessmann"];
const fmt = (n) => Math.round(n).toLocaleString("pl-PL");

export default function DlaFirm() {
  const { t, lang, cars, cmsMode, isAdmin } = useStore();
  const editing = cmsMode && isAdmin;
  const L = (o) => o[lang === "en" ? "en" : "pl"];
  useRevealOnScroll([cars.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  return (
    <div className={editing ? "cms-on fr" : "fr"}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---------- HERO ---------- */}
        <EBg id="fir.hero" className="fr-hero">
          <div className="fr-hero__scrim" />
          <div className="fr-hero__streaks">{[0, 1, 2, 3].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
          <div className="container fr-hero__inner">
            <EText id="fir.eyebrow" as="span" className="fr-hero__eyebrow reveal-up" />
            <EText id="fir.title" as="h1" className="fr-hero__title reveal-up rv-d1" />
            <EText id="fir.sub" as="p" className="fr-hero__sub reveal-up rv-d2" multiline />
            <div className="fr-hero__btns reveal-up rv-d3">
              <a href="#konfigurator" className="btn btn--red"><EText id="fir.ctaConfig" /> <span className="btn__arrow">›</span></a>
              <a href="#kontakt-firmy" className="btn btn--ghost fr-ghost"><EText id="fir.ctaTalk" /></a>
            </div>
            <div className="fr-hero__facts reveal-up rv-d4">
              {[1, 2, 3].map((n) => <div key={n} className="fr-fact"><EText id={`fir.h${n}a`} as="b" /><EText id={`fir.h${n}b`} as="span" /></div>)}
            </div>
          </div>
        </EBg>

        {/* ---------- ABOUT ---------- */}
        <section className="section section--paper fr-about">
          <div className="tex" />
          <div className="container fr-about__grid">
            <div className="fr-about__text">
              <EText id="fir.aboutEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="fir.aboutTitle" as="h2" className="h-section reveal-up rv-d1" />
              <EText id="fir.about1" as="p" className="lead fr-about__p reveal-up rv-d2" multiline />
              <EText id="fir.about2" as="p" className="lead fr-about__p reveal-up rv-d3" multiline />
              <div className="fr-aud">
                <div className="fr-aud__card reveal-up rv-d3"><span>B2B</span><EText id="fir.b2bT" as="h3" /><EText id="fir.b2bB" as="p" multiline /></div>
                <div className="fr-aud__card reveal-up rv-d4"><span>HR</span><EText id="fir.hrT" as="h3" /><EText id="fir.hrB" as="p" multiline /></div>
              </div>
            </div>
            <div className="fr-about__media reveal-right">
              <EMedia id="fir.photo1" className="fr-about__img fr-about__img--a" />
              <EMedia id="fir.photo2" className="fr-about__img fr-about__img--b" />
              <span className="fr-about__badge"><b>9×</b>{lang === "en" ? "POLISH CHAMPION" : "MISTRZ POLSKI"}</span>
            </div>
          </div>
          <div className="container fr-stats">{[1, 2, 3, 4].map((n) => <Stat key={n} n={n} t={t} />)}</div>
        </section>

        {/* ---------- OFFER ---------- */}
        <section className="section section--dark fr-offer">
          <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${22 + i * 26}%`, left: "-30%", width: "48%", animationDelay: `${i * 1.05}s` }} />)}</div>
          <div className="container">
            <div className="fr-sec-head"><EText id="fir.offerEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.offerTitle" as="h2" className="h-section reveal-up rv-d1" /></div>
            <div className="fr-offer__grid">
              {OFFER.map((o, i) => (
                <article key={i} className={`fr-tile reveal-up rv-d${(i % 4) + 1}`}>
                  <div className="fr-tile__ic">{OICON[o.ic]}</div>
                  <span className="fr-tile__n">0{i + 1}</span>
                  <h3>{L(o)[0]}</h3><p>{L(o)[1]}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- DAY + AGENDA ---------- */}
        <section className="section section--paper fr-day">
          <div className="tex" />
          <div className="container fr-day__grid">
            <div>
              <div className="fr-sec-head"><EText id="fir.dayEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.dayTitle" as="h2" className="h-section reveal-up rv-d1" /></div>
              <ol className="fr-steps">
                {DAY.map((d, i) => <li key={i} className={`fr-step reveal-up rv-d${(i % 5) + 1}`}><span className="fr-step__n">0{i + 1}</span><div><h3>{L(d)[0]}</h3><p>{L(d)[1]}</p></div></li>)}
              </ol>
            </div>
            <aside className="fr-agenda reveal-right">
              <EText id="fir.agendaEyebrow" as="span" className="fr-agenda__eyebrow" />
              <EText id="fir.agendaTitle" as="h3" className="fr-agenda__title" />
              <ul>{AGENDA.map((a, i) => <li key={i}><b>{a[0]}</b><span>{lang === "en" ? a[2] : a[1]}</span></li>)}</ul>
              <EText id="fir.agendaNote" as="p" className="fr-agenda__note" multiline />
            </aside>
          </div>
        </section>

        {/* ---------- FLEET (from the CMS) ---------- */}
        <section className="section section--dark fr-fleet">
          <div className="container">
            <div className="fr-sec-head"><EText id="fir.fleetEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.fleetTitle" as="h2" className="h-section reveal-up rv-d1" /></div>
            <div className="fr-fleet__grid">
              {cars.map((c, i) => (
                <div key={c.id} className={`fr-car reveal-up rv-d${(i % 4) + 1}`} style={{ ["--cc"]: c.color }}>
                  <div className="fr-car__media">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt={c.name} loading="lazy" />}</div>
                  <b>{c.name}</b>
                  <dl><div><dt>{t("fleet.l_power")}</dt><dd>{c.power || "—"}</dd></div><div><dt>{t("fleet.l_engine")}</dt><dd>{c.engine || "—"}</dd></div></dl>
                </div>
              ))}
            </div>
            <EText id="fir.fleetNote" as="p" className="fr-fleet__note reveal-up" multiline />
          </div>
        </section>

        {/* ---------- TRACKS ---------- */}
        <section className="section section--paper fr-tracks">
          <div className="tex" />
          <div className="container">
            <div className="fr-sec-head"><EText id="fir.tracksEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.tracksTitle" as="h2" className="h-section reveal-up rv-d1" /></div>
            <div className="fr-tracks__grid">
              {TRACKS.map((tr, i) => (
                <article key={i} className={`fr-track reveal-up rv-d${i + 1}`}>
                  <EMedia id={i ? "fir.photo4" : "fir.photo3"} className="fr-track__img" />
                  <div className="fr-track__body">
                    <span className="fr-track__where">{L(tr)[0]}</span>
                    <h3>{L(tr)[1]}</h3>
                    <p>{L(tr)[2]}</p>
                    <ul>{L(tr)[3].map((x, j) => <li key={j}>{x}</li>)}</ul>
                  </div>
                </article>
              ))}
            </div>
            <EText id="fir.tracksNote" as="p" className="fr-tracks__note reveal-up" />
          </div>
        </section>

        {/* ---------- EXTRAS ---------- */}
        <section className="section section--dark fr-extras">
          <div className="container">
            <div className="fr-sec-head"><EText id="fir.extrasEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.extrasTitle" as="h2" className="h-section reveal-up rv-d1" /></div>
            <div className="fr-extras__grid">
              {EXTRAS.map((e, i) => <div key={i} className={`fr-extra reveal-up rv-d${(i % 4) + 1}`}><span>{e[0]}</span><b>{lang === "en" ? e[2] : e[1]}</b></div>)}
            </div>
          </div>
        </section>

        <Configurator t={t} lang={lang} />

        {/* ---------- TEAM + LOGOS ---------- */}
        <section className="section section--paper fr-team">
          <div className="tex" />
          <div className="container fr-team__grid">
            <div className="fr-team__text">
              <EText id="fir.teamEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="fir.teamTitle" as="h2" className="h-section reveal-up rv-d1" />
              <EText id="fir.teamBody" as="p" className="lead reveal-up rv-d2" multiline />
              <Link to="/mariusz-miekos-racing" className="btn btn--dark reveal-up rv-d3" onClick={() => window.scrollTo({ top: 0 })}>Mariusz Miękoś <span className="btn__arrow">›</span></Link>
            </div>
            <div className="fr-team__media reveal-right"><img src="/assets/instructors/instr_0.webp" alt="Mariusz Miękoś" loading="lazy" /><span /></div>
          </div>
          <div className="container fr-logos">
            <EText id="fir.logosEyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="fir.logosTitle" as="h2" className="fr-logos__title reveal-up rv-d1" />
            <div className="fr-logos__grid">
              {LOGOS.map((l, i) => <div key={l} className={`fr-logo reveal-scale rv-d${(i % 6) + 1}`}><img src={`/assets/firmy/logos/${l}.webp`} alt={l} loading="lazy" /></div>)}
            </div>
          </div>
        </section>

        {/* ---------- CONTACT ---------- */}
        <section className="section section--dark fr-contact" id="kontakt-firmy">
          <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${26 + i * 24}%`, left: "-30%", width: "46%", animationDelay: `${i * 1.2}s` }} />)}</div>
          <div className="container fr-contact__grid">
            <div>
              <EText id="fir.contactEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="fir.contactTitle" as="h2" className="h-display fr-contact__title reveal-up rv-d1" />
              <EText id="fir.contactBody" as="p" className="lead fr-contact__body reveal-up rv-d2" multiline />
            </div>
            <div className="fr-contact__card reveal-right">
              <EText id="fir.contactRole" as="span" className="fr-contact__role" />
              <EText id="fir.contactName" as="b" className="fr-contact__name" />
              <a href={`tel:${t("fir.contactPhone").replace(/\s/g, "")}`} className="fr-contact__line"><EText id="fir.contactPhone" /></a>
              <a href={`mailto:${t("fir.contactMail")}`} className="fr-contact__line fr-contact__line--sm"><EText id="fir.contactMail" /></a>
              <a href="#konfigurator" className="btn btn--red">{t("fir.ctaConfig")} <span className="btn__arrow">›</span></a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

function Stat({ n, t }) {
  const [ref, inView] = useReveal();
  const v = useCountUp(t(`fir.st${n}v`), inView, 1600);
  return <div className="fr-stat" ref={ref}><b>{v.toLocaleString("pl-PL")}{n === 4 ? "×" : ""}</b><EText id={`fir.st${n}l`} as="span" /></div>;
}

/* the live brief → programme + indicative net budget → inquiry to the sales inbox */
function Configurator({ t, lang }) {
  const [s, setS] = useState({ goal: "integracja", persons: 30, track: "Tor Łódź", length: "full", cars: "standard", extras: [], date: "" });
  const [c, setC] = useState({ company: "", full_name: "", email: "", phone: "", message: "" });
  const [phase, setPhase] = useState("idle");
  const [err, setErr] = useState("");
  const L = (o) => o[lang === "en" ? "en" : "pl"];

  const total = useMemo(() => {
    const base = RATES.pakiety[s.cars].base * RATES.length[s.length].k * s.persons + RATES.org * RATES.length[s.length].days;
    return s.extras.reduce((sum, k) => sum + (RATES.extras[k].per === "os" ? RATES.extras[k].v * s.persons : RATES.extras[k].v), base);
  }, [s]);
  const program = useMemo(() => {
    const p = [lang === "en" ? "Registration and welcome" : "Rejestracja uczestników i powitanie", lang === "en" ? "Theory with a competitor-instructor" : "Część teoretyczna z instruktorem–zawodnikiem"];
    if (s.length !== "half") p.push(lang === "en" ? "Safe & Eco Driving Experience" : "Safe & Eco Driving Experience — trening bezpiecznej jazdy");
    p.push(`Sport Driving Experience — 1:1 (${L(RATES.pakiety[s.cars])})`, lang === "en" ? "Your Grand Prix — timing and competition" : "Twoje Grand Prix — pomiar czasów i rywalizacja grup", lang === "en" ? "Podium, Stage 1 certificates, wrap-up" : "Podium, certyfikaty Stage 1 i podsumowanie");
    if (s.length === "two") p.push(lang === "en" ? "Day 2: extended track sessions + analysis" : "Dzień 2: rozszerzone sesje na torze + sesje analityczne");
    return p;
  }, [s, lang]);
  const estimate = `${fmt(total * 0.9)} – ${fmt(total * 1.1)} zł netto (ok. ${fmt(total / s.persons)} zł/os.)`;
  const toggle = (k) => setS((x) => ({ ...x, extras: x.extras.includes(k) ? x.extras.filter((y) => y !== k) : [...x.extras, k] }));
  const valid = c.company.trim() && c.full_name.trim() && /.+@.+\..+/.test(c.email) && c.phone.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) { setErr(t("fir.errFill")); return; }
    setErr(""); setPhase("sending");
    const r = await sendContact({
      kind: "firma", company: c.company, full_name: c.full_name, email: c.email, phone: c.phone, message: c.message, subject: "Event firmowy",
      meta: { goal: L(RATES.goals[s.goal]), persons: s.persons, track: s.track, length: L(RATES.length[s.length]), cars: `${L(RATES.pakiety[s.cars])} (${RATES.pakiety[s.cars].cars})`, extras: s.extras.map((k) => RATES.extras[k].pl), date: s.date, estimate, program },
    });
    if (r?.ok) setPhase("done"); else { setPhase("idle"); setErr(r?.error || t("fir.errSend")); }
  };

  return (
    <section className="section section--paper fr-cfg" id="konfigurator">
      <div className="tex" />
      <div className="container">
        <div className="fr-sec-head fr-sec-head--c"><EText id="fir.cfgEyebrow" as="span" className="eyebrow reveal-up" /><EText id="fir.cfgTitle" as="h2" className="h-section reveal-up rv-d1" /><EText id="fir.cfgSub" as="p" className="lead reveal-up rv-d2" multiline /></div>
        <form className="fr-cfg__grid reveal-up" onSubmit={submit} noValidate>
          <div className="fr-cfg__form">
            <Group label={t("fir.cfgGoal")}>{Object.entries(RATES.goals).map(([k, v]) => <Chip key={k} on={s.goal === k} onClick={() => setS({ ...s, goal: k })}>{L(v)}</Chip>)}</Group>
            <Group label={`${t("fir.cfgPersons")}: ${s.persons}`}><input className="fr-range" type="range" min="10" max="200" step="5" value={s.persons} onChange={(e) => setS({ ...s, persons: +e.target.value })} /></Group>
            <Group label={t("fir.cfgTrack")}>{RATES.tracks.map((k) => <Chip key={k} on={s.track === k} onClick={() => setS({ ...s, track: k })}>{k}</Chip>)}</Group>
            <Group label={t("fir.cfgLength")}>{Object.entries(RATES.length).map(([k, v]) => <Chip key={k} on={s.length === k} onClick={() => setS({ ...s, length: k })}>{L(v)}</Chip>)}</Group>
            <Group label={t("fir.cfgCars")}>{Object.entries(RATES.pakiety).map(([k, v]) => <Chip key={k} on={s.cars === k} onClick={() => setS({ ...s, cars: k })}>{L(v)}</Chip>)}</Group>
            <Group label={t("fir.cfgExtras")}>{Object.entries(RATES.extras).map(([k, v]) => <Chip key={k} on={s.extras.includes(k)} onClick={() => toggle(k)}>{L(v)}</Chip>)}</Group>
            <Group label={t("fir.cfgDate")}><input className="fr-in" type="text" placeholder="np. czerwiec 2027" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} /></Group>
            <div className="fr-cfg__contact">
              <label><span className="req">{t("fir.cfgCompany")}</span><input className="fr-in" value={c.company} onChange={(e) => setC({ ...c, company: e.target.value })} /></label>
              <label><span className="req">{t("fir.cfgPerson")}</span><input className="fr-in" value={c.full_name} onChange={(e) => setC({ ...c, full_name: e.target.value })} /></label>
              <label><span className="req">E-mail</span><input className="fr-in" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
              <label><span className="req">{t("flota.bk.phone")}</span><input className="fr-in" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
              <label className="fr-cfg__full"><span>{t("fir.cfgMsg")}</span><textarea className="fr-in" rows={3} value={c.message} onChange={(e) => setC({ ...c, message: e.target.value })} /></label>
            </div>
            {err && <div className="fr-err">{err}</div>}
            <div className="fr-cfg__foot">
              <span>{t("fir.cfgRodo")}</span>
              <button className={`btn btn--red ${!valid ? "is-locked" : ""}`} disabled={phase === "sending"}>{phase === "sending" ? t("fir.cfgSending") : t("fir.cfgSend")} <span className="btn__arrow">›</span></button>
            </div>
          </div>

          <aside className="fr-cfg__result">
            <span className="fr-cfg__eyebrow">{t("fir.cfgResult")}</span>
            <b className="fr-cfg__sum">{L(RATES.goals[s.goal])} · {s.persons} os. · {L(RATES.length[s.length])} · {s.track}</b>
            <span className="fr-cfg__lbl">{t("fir.cfgProgram")}</span>
            <ol className="fr-cfg__prog">
              {program.map((p, i) => <li key={i}>{p}</li>)}
              {s.extras.map((k) => <li key={k} className="fr-cfg__extra">+ {L(RATES.extras[k])}</li>)}
            </ol>
            <span className="fr-cfg__lbl">{t("fir.cfgEstimate")}</span>
            <div className="fr-cfg__price">{fmt(total * 0.9)} – {fmt(total * 1.1)} zł</div>
            <div className="fr-cfg__per">netto · ok. {fmt(total / s.persons)} zł / {lang === "en" ? "person" : "osoba"}</div>
            <p className="fr-cfg__note">{t("fir.cfgEstimateNote")}</p>
          </aside>

          <AnimatePresence>
            {phase === "done" && (
              <motion.div className="fr-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="fr-done__box" initial={{ y: 22, scale: .96 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
                  <div className="fr-done__board"><span /><span /><span /><span /><span /></div>
                  <h3>{t("fir.doneTitle")}</h3>
                  <p>{t("fir.doneSub")}</p>
                  <button type="button" className="btn btn--dark" onClick={() => setPhase("idle")}>{t("fir.doneBtn")}</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </section>
  );
}
const Group = ({ label, children }) => <div className="fr-group"><span className="fr-group__l">{label}</span><div className="fr-group__b">{children}</div></div>;
const Chip = ({ on, onClick, children }) => <button type="button" className={`fr-chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
