import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText, EMedia } from "../components/Editable";
import { useReveal, useRevealOnScroll, useCountUp } from "../lib/hooks";
import "../sections/szkola.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function Szkola() {
  const { cmsMode, isAdmin } = useStore();
  useSeo({ title: "O szkole jazdy sportowej i wyścigowej", path: "/o-szkole", description: "Fastline Racing Academy — jak uczymy jazdy po torze: instruktorzy będący czynnymi zawodnikami, treningi 1:1, telemetria, flota aut sportowych i wyścigowych.", jsonld: breadcrumbs([{ name: "O szkole", path: "/o-szkole" }]) });
  const editing = cmsMode && isAdmin;
  useRevealOnScroll([]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  return (
    <div className={editing ? "cms-on sz" : "sz"}>
      <ScrollProgress />
      {!editing && <TelemetryHud />}
      <Nav />
      <main>
        <Hero />
        <Intro />
        <Machines />
        <QuoteScene />
        <Stages />
        <ClosingBand />
        <Cta />
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* ============ persistent racing TELEMETRY HUD (reads page scroll) ============ */
function TelemetryHud() {
  const { t } = useStore();
  const hudRef = useRef(null);
  const speedRef = useRef(null);
  const gearRef = useRef(null);
  const rpmRef = useRef(null);
  const ledsRef = useRef([]);
  ledsRef.current = [];
  const addLed = (el) => { if (el && !ledsRef.current.includes(el)) ledsRef.current.push(el); };

  useEffect(() => {
    let raf = 0;
    // eased values so the needle/speed sweep smoothly instead of snapping per scroll tick
    let curSpeed = 0, curRpm = 0;
    const doc = document.documentElement;
    const loop = () => {
      raf = 0;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const targetSpeed = p * 312;
      const gearF = p * 6;
      const gi = Math.min(5, Math.floor(gearF));
      const within = gi >= 5 ? clamp((gearF - 5), 0, 1) : (gearF - gi); // rev within each gear
      const targetRpm = 0.28 + within * 0.68;
      curSpeed += (targetSpeed - curSpeed) * 0.18;
      curRpm += (targetRpm - curRpm) * 0.18;

      if (speedRef.current) speedRef.current.textContent = String(Math.round(curSpeed));
      if (gearRef.current) gearRef.current.textContent = p < 0.015 ? "N" : String(gi + 1);
      if (rpmRef.current) rpmRef.current.style.width = (curRpm * 100).toFixed(1) + "%";
      const lit = Math.round(curRpm * ledsRef.current.length);
      ledsRef.current.forEach((el, i) => el.classList.toggle("on", i < lit));
      // fade the HUD out as the footer approaches so it never sits on top of it
      if (hudRef.current) hudRef.current.style.opacity = p > 0.965 ? String(clamp((1 - p) / 0.035, 0, 1)) : "1";
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(loop); };
    // keep easing running a few frames after scroll stops
    const tick = () => { loop(); raf2 = requestAnimationFrame(tick); };
    let raf2 = requestAnimationFrame(tick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); cancelAnimationFrame(raf2); };
  }, []);

  return (
    <div className="sz-hud" ref={hudRef} aria-hidden="true">
      <div className="sz-hud__lights">
        {Array.from({ length: 10 }).map((_, i) => <span key={i} ref={addLed} className={`sz-led sz-led--${i < 4 ? "g" : i < 7 ? "y" : "r"}`} />)}
      </div>
      <div className="sz-hud__row">
        <div className="sz-hud__speed">
          <span className="sz-hud__num" ref={speedRef}>0</span>
          <span className="sz-hud__unit">KM/H</span>
        </div>
        <div className="sz-hud__gear">
          <span className="sz-hud__glabel">GEAR</span>
          <span className="sz-hud__gnum" ref={gearRef}>N</span>
        </div>
      </div>
      <div className="sz-hud__rpm"><span ref={rpmRef} /></div>
      <div className="sz-hud__tag">{t("sz.hudLabel")}</div>
    </div>
  );
}

/* ============ HERO — fullscreen video + shift-lights + parallax title ============ */
function Hero() {
  const { t } = useStore();
  const heroRef = useRef(null);
  const plateRef = useRef(null);

  // gentle mouse parallax on the title plate (desktop only)
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(hover: none)").matches) return;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 20;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 14;
      if (!raf) raf = requestAnimationFrame(ease);
    };
    const ease = () => {
      raf = 0;
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      if (plateRef.current) plateRef.current.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(ease);
    };
    hero.addEventListener("pointermove", onMove);
    return () => { hero.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="sz-hero" ref={heroRef}>
      <div className="sz-hero__video">
        <EMedia id="sz.video" kind="video" className="sz-hero__vid" />
      </div>
      <div className="sz-hero__scrim" />
      <div className="sz-hero__grid" />

      {/* F1 start-lights gantry across the top */}
      <div className="sz-hero__gantry">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="sz-gantry" style={{ ["--i"]: i }}><i /><i /></span>
        ))}
      </div>

      <div className="container sz-hero__inner">
        <div className="sz-hero__plate" ref={plateRef}>
          <EText id="sz.eyebrow" as="span" className="sz-hero__eyebrow" />
          <EText id="sz.title" as="h1" className="sz-hero__title" />
          <EText id="sz.sub" as="p" className="sz-hero__sub" multiline />
        </div>
      </div>

      <div className="sz-hero__streaks">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
      <a href="#sz-intro" className="sz-hero__scroll"><span>{t("sz.scrollHint")}</span><i /></a>
    </section>
  );
}

/* ============ INTRO / MANIFEST ============ */
function Intro() {
  const { t } = useStore();
  const [ref, inView] = useReveal();
  const val = useCountUp(t("sz.statValue"), inView);
  return (
    <section className="section section--paper sz-intro" id="sz-intro" ref={ref}>
      <div className="tex" />
      <div className={`container sz-intro__grid ${inView ? "in" : ""}`}>
        <div className="sz-intro__text">
          <EText id="sz.introEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="sz.introTitle" as="h2" className="h-section sz-intro__title reveal-up rv-d1" />
          <EText id="sz.p1" as="p" className="lead sz-intro__p reveal-up rv-d2" multiline />
          <EText id="sz.p2" as="p" className="lead sz-intro__p reveal-up rv-d3" multiline />
        </div>
        <div className="sz-intro__media reveal-right rv-d2">
          <div className="sz-intro__frame">
            <EMedia id="sz.introPhoto" className="sz-intro__img" />
            <span className="sz-intro__corner" />
          </div>
          <div className="sz-intro__stat">
            <span className="sz-intro__statnum">{val}</span>
            <EText id="sz.statLabel" as="span" className="sz-intro__statlbl" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ TWO MACHINES ============ */
function Machines() {
  const [ref, inView] = useReveal();
  const cards = [
    { name: "sz.car1name", sub: "sz.car1sub", n: "01" },
    { name: "sz.car2name", sub: "sz.car2sub", n: "02" },
  ];
  const tags = ["sz.tag1", "sz.tag2", "sz.tag3"];
  return (
    <section className="section section--dark sz-mach" ref={ref}>
      <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${18 + i * 30}%`, left: "-30%", width: "50%", animationDelay: `${i * 1.2}s` }} />)}</div>
      <div className={`container ${inView ? "in" : ""}`}>
        <div className="sz-mach__head">
          <EText id="sz.carsEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="sz.carsTitle" as="h2" className="h-section sz-mach__title reveal-up rv-d1" />
          <EText id="sz.carsBody" as="p" className="lead sz-mach__body reveal-up rv-d2" multiline />
        </div>
        <div className="sz-mach__cards">
          {cards.map((c, i) => (
            <article key={c.name} className={`sz-card reveal-up rv-d${i + 2}`} tabIndex={0}>
              <span className="sz-card__n">{c.n}</span>
              <div className="sz-card__body">
                <EText id={c.name} as="h3" className="sz-card__name" />
                <EText id={c.sub} as="span" className="sz-card__sub" />
                <div className="sz-card__tags">
                  {tags.map((tk) => <EText key={tk} id={tk} as="span" className="sz-card__tag" />)}
                </div>
              </div>
              <span className="sz-card__glow" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ COLIN McRAE QUOTE — racing line draws on scroll ============ */
function QuoteScene() {
  const sceneRef = useRef(null);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 as the section enters from the bottom → 1 once it's scrolled through the middle
      const p = clamp((vh - r.top) / (vh * 0.9), 0, 1);
      el.style.setProperty("--qp", p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="sz-quote" ref={sceneRef}>
      <svg className="sz-quote__line" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength="1" d="M-20 250 C 220 250 300 60 520 60 S 820 250 1040 250 S 1240 90 1240 90" />
      </svg>
      <div className="container sz-quote__inner">
        <blockquote className="sz-quote__text">
          <span className="sz-quote__mark">“</span>
          <EText id="sz.quotePre" as="span" />{" "}
          <EText id="sz.quoteRed1" as="span" className="sz-quote__red" />
          <EText id="sz.quoteMid" as="span" />{" "}
          <EText id="sz.quoteRed2" as="span" className="sz-quote__red" />
          <span className="sz-quote__mark">”</span>
        </blockquote>
        <EText id="sz.quoteAuthor" as="span" className="sz-quote__author" />
      </div>
    </section>
  );
}

/* ============ STAGES — interactive gearbox selector ============ */
function Stages() {
  const { t } = useStore();
  const [ref, inView] = useReveal();
  const [active, setActive] = useState(0);
  const STAGES = [
    { name: "sz.s1name", tag: "sz.s1tag", desc: "sz.s1desc", g: "1" },
    { name: "sz.s2name", tag: "sz.s2tag", desc: "sz.s2desc", g: "2" },
    { name: "sz.s3name", tag: "sz.s3tag", desc: "sz.s3desc", g: "3" },
    { name: "sz.s4name", tag: "sz.s4tag", desc: "sz.s4desc", g: "❄" },
  ];
  const cur = STAGES[active];
  return (
    <section className="section section--paper sz-stages" ref={ref}>
      <div className="tex" />
      <div className={`container ${inView ? "in" : ""}`}>
        <div className="sz-stages__head">
          <EText id="sz.stagesEyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="sz.stagesTitle" as="h2" className="h-section reveal-up rv-d1" />
          <span className="sz-stages__hint reveal-up rv-d2">{t("sz.stagesHint")}</span>
        </div>

        <div className="sz-stages__box reveal-up rv-d2">
          <div className="sz-stages__gears" role="tablist">
            {STAGES.map((s, i) => (
              <button
                key={s.name}
                role="tab"
                aria-selected={active === i}
                className={`sz-gear ${active === i ? "on" : ""}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
              >
                <span className="sz-gear__num">{s.g}</span>
                <span className="sz-gear__label">
                  <EText id={s.name} as="strong" className="sz-gear__name" />
                  <EText id={s.tag} as="span" className="sz-gear__tag" />
                </span>
                <span className="sz-gear__bar" />
              </button>
            ))}
          </div>

          <div className="sz-stages__panel" key={active}>
            <div className="sz-stages__pn">STAGE {active + 1} / {STAGES.length}</div>
            <EText id={cur.name} as="h3" className="sz-stages__pname" />
            <EText id={cur.tag} as="span" className="sz-stages__ptag" />
            <EText id={cur.desc} as="p" className="lead sz-stages__pdesc" multiline />
            <a href="/#programy" className="btn btn--red sz-stages__cta">{t("sz.stagesCta")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ CLOSING PHOTO BAND — parallax ============ */
function ClosingBand() {
  const bandRef = useRef(null);
  const bgRef = useRef(null);
  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1); // 0..1 across viewport
      if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${((p - 0.5) * 16).toFixed(2)}%, 0) scale(1.16)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <section className="sz-band" ref={bandRef}>
      <div className="sz-band__bg" ref={bgRef}>
        <EMedia id="sz.bandPhoto" className="sz-band__img" />
      </div>
      <div className="sz-band__scrim" />
      <div className="container sz-band__inner">
        <EText id="sz.bandEyebrow" as="span" className="eyebrow reveal-up" />
        <EText id="sz.bandTitle" as="h2" className="h-display sz-band__title reveal-up rv-d1" />
        <EText id="sz.bandBody" as="p" className="lead sz-band__body reveal-up rv-d2" multiline />
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function Cta() {
  const { t } = useStore();
  return (
    <section className="section sz-cta">
      <div className="tex" />
      <div className="container sz-cta__inner">
        <EText id="sz.ctaEyebrow" as="span" className="eyebrow reveal-up" />
        <EText id="sz.ctaTitle" as="h2" className="h-display reveal-up rv-d1" />
        <EText id="sz.ctaSub" as="p" className="lead sz-cta__sub reveal-up rv-d2" multiline />
        <div className="sz-cta__btns reveal-up rv-d3">
          <a href="/#programy" className="btn btn--red">{t("sz.ctaBuy")}</a>
          <a href="/#kontakt" className="btn btn--ghost">{t("sz.ctaContact")}</a>
        </div>
      </div>
    </section>
  );
}
