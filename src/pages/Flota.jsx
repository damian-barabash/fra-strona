import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import CarSlider from "../sections/CarSlider";
import { EText, EMedia } from "../components/Editable";
import { useReveal, useRevealOnScroll } from "../lib/hooks";
import { carPrice, fmtZl } from "../lib/flota";
import { FuelGauge } from "../components/Fuel";
import "../sections/flota.css";

export default function Flota() {
  const { cmsMode, isAdmin, cars } = useStore();
  const nav = useNavigate();
  const editing = cmsMode && isAdmin;
  const sliderRef = useRef(null);
  const [jumpTo, setJumpTo] = useState(null); // car id to focus in slider (from grid)
  // re-scan reveals when cars finish loading (grid cards mount async)
  useRevealOnScroll([cars.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const focusCar = (id) => {
    setJumpTo(id);
    sliderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const bookCar = (car) => { window.scrollTo({ top: 0 }); nav(`/rezerwacja?car=${car.id}`); };
  const bookCustom = () => { window.scrollTo({ top: 0 }); nav(`/rezerwacja?custom=1`); };

  return (
    <div className={editing ? "cms-on fl" : "fl"}>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <Intro />
        <div ref={sliderRef} />
        <CarSlider onChoose={bookCar} jumpTo={jumpTo} onJumped={() => setJumpTo(null)} />
        <Grid onPick={focusCar} />
        <RaceCars />
        <CustomCta onChoose={bookCustom} />
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* ================= HERO ================= */
function Hero() {
  const { t } = useStore();
  return (
    <section className="fl-hero">
      <div className="fl-hero__video"><EMedia id="flota.video" kind="video" className="fl-hero__vid" /></div>
      <div className="fl-hero__scrim" />
      <div className="fl-hero__streaks">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
      <div className="container fl-hero__inner">
        <div className="fl-hero__plate">
          <EText id="flota.eyebrow" as="span" className="fl-hero__eyebrow" />
          <EText id="flota.title" as="h1" className="fl-hero__title" />
          <EText id="flota.sub" as="p" className="fl-hero__sub" multiline />
        </div>
      </div>
      <a href="#fl-intro" className="fl-hero__scroll"><span>{t("flota.scrollHint")}</span><i /></a>
    </section>
  );
}

/* ================= INTRO (first text block) ================= */
function Intro() {
  const [ref, inView] = useReveal();
  const { cars } = useStore();
  return (
    <section className="section section--paper fl-intro" id="fl-intro" ref={ref}>
      <div className="tex" />
      <div className={`container fl-intro__grid ${inView ? "in" : ""}`}>
        <div className="fl-intro__text">
          <EText id="flota.introEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="flota.introTitle" as="h2" className="h-section fl-intro__title reveal-up rv-d1" />
        </div>
        <div className="fl-intro__body">
          <EText id="flota.introBody" as="p" className="lead reveal-up rv-d2" multiline />
          <div className="fl-intro__count reveal-up rv-d3">
            <span className="fl-intro__num">{cars.length}</span>
            <span className="fl-intro__lbl">AUT W STAJNI</span>
          </div>
        </div>
      </div>
    </section>
  );
}
/* ================= FLEET GRID (full stable list) ================= */
function Grid({ onPick }) {
  const { cars, t } = useStore();
  return (
    <section className="section section--paper fl-grid">
      <div className="tex" />
      <div className="container">
        <div className="fl-grid__head">
          <EText id="flota.gridEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="flota.gridTitle" as="h2" className="h-section reveal-up rv-d1" />
          <EText id="flota.gridSub" as="p" className="lead reveal-up rv-d2" />
        </div>
        <div className="fl-grid__cards">
          {cars.map((c, i) => (
            <div key={c.id} role="button" tabIndex={0} className={`fl-card reveal-up rv-d${(i % 5) + 1}`} onClick={() => onPick(c.id)} onKeyDown={(e) => e.key === "Enter" && onPick(c.id)} style={{ ["--cc"]: c.color }}>
              <div className="fl-card__media">
                {(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt={c.name} loading="lazy" />}
                <span className="fl-card__badge">{c.badge}</span>
              </div>
              <div className="fl-card__foot">
                <span className="fl-card__name">{c.name}</span>
                <span className="fl-card__from">{t("flota.from")} {fmtZl(carPrice(c, 3, "lodz"))}</span>
              </div>
              <Link to={`/flota/${c.slug}`} className="fl-card__more" onClick={(e) => { e.stopPropagation(); window.scrollTo({ top: 0 }); }}>{t("flota.details")} ›</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= RACE CARS (read-only, on request) ================= */
function RaceCars() {
  const { raceCars, t, L } = useStore();
  if (!raceCars.length) return null;
  return (
    <section className="section section--dark fl-race" id="wyscigowe">
      <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${22 + i * 26}%`, left: "-30%", width: "48%", animationDelay: `${i * 1.05}s` }} />)}</div>
      <div className="container">
        <div className="fl-race__head">
          <EText id="flota.raceEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="flota.raceTitle" as="h2" className="h-section reveal-up rv-d1" />
          <EText id="flota.raceSub" as="p" className="lead fl-race__sub reveal-up rv-d2" multiline />
        </div>
        <div className="fl-race__grid">
          {raceCars.map((c, i) => (
            <Link key={c.id} to={`/flota/${c.slug}`} className={`fl-racecard reveal-up rv-d${(i % 3) + 1}`} style={{ ["--cc"]: c.color }} onClick={() => window.scrollTo({ top: 0 })}>
              <span className="fl-racecard__media">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt={c.name} loading="lazy" />}<span className="fl-racecard__badge">{c.badge}</span></span>
              <span className="fl-racecard__body">
                <b>{c.name}</b>
                <span className="fl-racecard__spec">{[c.power, c.engine, c.weight].filter(Boolean).join(" · ")}</span>
                <span className="fl-racecard__desc">{L(c, "description")}</span>
                <span className="fl-racecard__go">{t("flota.details")} ›</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= CUSTOM CAR CTA ================= */
function CustomCta({ onChoose }) {
  const { t } = useStore();
  return (
    <section className="section section--dark fl-custom">
      <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${24 + i * 26}%`, left: "-30%", width: "48%", animationDelay: `${i * 1.1}s` }} />)}</div>
      <div className="container fl-custom__inner">
        <div className="fl-custom__text">
          <EText id="flota.customEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="flota.customName" as="h2" className="h-display fl-custom__title reveal-up rv-d1" />
          <EText id="flota.customDesc" as="p" className="lead fl-custom__desc reveal-up rv-d2" multiline />
          <button className="btn btn--red reveal-up rv-d3" onClick={onChoose}>{t("flota.customBtn")} <span className="btn__arrow">›</span></button>
        </div>
        <div className="fl-custom__gauge reveal-scale rv-d2"><FuelGauge value={0.4} big /></div>
      </div>
    </section>
  );
}
