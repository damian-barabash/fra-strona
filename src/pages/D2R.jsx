import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useReveal, useRevealOnScroll, useCountUp } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import { fmtZl } from "../lib/flota";
import "../sections/d2r.css";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
// "SZYBKOŚĆ — Znacznie poprawisz…" → { head, body }
const split = (l) => {
  const i = l.indexOf("—");
  return i < 0 ? { head: l, body: "" } : { head: l.slice(0, i).trim(), body: l.slice(i + 1).trim() };
};

/* Driver2Racer — the elite program. Its own red-hot racing page; the package is bought
   straight away (no configurator): the CTA jumps to /zakup?produkt=driver2racer. */
export default function D2R({ p }) {
  const { t, L, cmsMode, isAdmin } = useStore();
  const nav = useNavigate();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;

  useRevealOnScroll([p.id]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [p.id]);

  const intro = lines(L(p, "intro"));
  const gains = lines(L(p, "learn")).map(split);          // SZYBKOŚĆ / REAKCJA / TECHNIKA
  const includes = lines(L(p, "includes"));               // what the package holds
  const fleet = lines(L(p, "packages")).map(split);       // race cars
  const tracks = lines(L(p, "places"));
  const gallery = Array.isArray(p.photos) ? p.photos : [];
  const buy = () => { window.scrollTo({ top: 0 }); nav(`/zakup?produkt=${p.slug}`); };

  return (
    <div className={editing ? "cms-on d2" : "d2"}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---------------- HERO ---------------- */}
        <section className="d2-hero">
          {p.video
            ? <video className="d2-hero__vid" src={p.video} autoPlay loop muted playsInline poster={p.photo} />
            : <img className="d2-hero__vid" src={p.photo} alt="" />}
          <div className="d2-hero__scrim" />
          <div className="d2-hero__grid" />
          <div className="d2-hero__streaks">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>

          <div className="container d2-hero__inner">
            <span className="d2-hero__eyebrow">FASTLINE RACING ACADEMY</span>
            {/* the real Driver2Racer wordmark (white version) — the h1 stays for screen readers */}
            <img className="d2-hero__logo" src="/assets/d2r/logo-white.webp" alt={L(p, "title")} />
            <h1 className="sr-only">{L(p, "title")}</h1>
            <p className="d2-hero__sub">{L(p, "excerpt")}</p>

            <div className="d2-hero__stats">
              <HeroStat value="24" label={t("d2r.sSessions")} />
              <HeroStat value="9" label={t("d2r.sTitles")} />
              <HeroStat value="6" label={t("d2r.sSim")} />
            </div>

            <div className="d2-hero__btns">
              <button className="btn btn--red d2-buy" onClick={buy}>
                {t("d2r.buy")} <b>{fmtZl(p.price)}</b> <span className="btn__arrow">›</span>
              </button>
              <a href="#d2-pakiet" className="btn btn--ghost d2-hero__ghost">{t("d2r.seePkg")}</a>
            </div>
          </div>

          <div className="d2-hero__scroll"><span>{t("flota.scrollHint")}</span><i /></div>
        </section>

        <Kerb />

        {/* ---------------- WHAT YOU GAIN ---------------- */}
        {!!gains.length && (
          <section className="section section--dark d2-gains">
            <div className="speedfx">{[0, 1, 2].map((i) => (
              <span key={i} style={{ top: `${22 + i * 26}%`, left: "-30%", width: "48%", animationDelay: `${i * 1.05}s` }} />
            ))}</div>
            <div className="container">
              <EText id="d2r.gainsTitle" as="h2" className="h-section d2-gains__title reveal-up" />
              <div className="d2-gains__grid">
                {gains.map((g, i) => (
                  <Gain key={i} idx={i} head={g.head} body={g.body} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- MARIUSZ ---------------- */}
        <section className="section section--paper d2-coach">
          <div className="tex" />
          <div className="container d2-coach__grid">
            <figure className="d2-coach__photo reveal-left zoomable" onClick={() => openLightbox(gallery, 0)}>
              <img src={gallery[0] || p.photo} alt="" loading="lazy" />
              <span className="d2-coach__badge"><b>9×</b>{t("d2r.champion")}</span>
            </figure>
            <div className="d2-coach__text">
              <EText id="d2r.coachEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="d2r.coachTitle" as="h2" className="h-section d2-coach__title reveal-up rv-d1" />
              {lines(L(p, "practice")).map((par, i, arr) => (
                i === arr.length - 1
                  ? <span key={i} className="d2-coach__sign reveal-up rv-d3">{par}</span>
                  : <p key={i} className={`lead reveal-up rv-d${i + 2}`}>{par}</p>
              ))}
              <img className="d2-coach__signature reveal-up rv-d4" src="/assets/mariusz/signature-red.webp" alt="" />
            </div>
          </div>
        </section>

        {/* ---------------- 24 SESSIONS ---------------- */}
        <section className="section section--dark d2-sessions">
          <div className="container">
            <div className="d2-sessions__head">
              <EText id="d2r.sessTitle" as="h2" className="h-section reveal-up" />
              <EText id="d2r.sessSub" as="p" className="lead d2-sessions__sub reveal-up rv-d1" multiline />
            </div>
            <SessionBar t={t} />
            <Telemetry t={t} />
            <p className="lead d2-sessions__intro reveal-up">{L(p, "theory")}</p>
          </div>
        </section>

        {/* ---------------- FLEET ---------------- */}
        {!!fleet.length && (
          <section className="section section--paper d2-fleet">
            <div className="tex" />
            <div className="container">
              <div className="d2-fleet__head">
                <EText id="d2r.fleetEyebrow" as="span" className="eyebrow reveal-up" />
                <EText id="d2r.fleetTitle" as="h2" className="h-section reveal-up rv-d1" />
              </div>
              <div className="d2-fleet__grid">
                {fleet.map((c, i) => (
                  <div key={i} className={`d2-car reveal-up rv-d${(i % 3) + 1}`}>
                    <span className="d2-car__n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="d2-car__name">{c.head}</span>
                    <span className="d2-car__desc">{c.body}</span>
                    <span className="d2-car__line" />
                  </div>
                ))}
              </div>
              <div className="d2-fleet__band">
                <div className="d2-fleet__aside reveal-left">
                  <img className="d2-fleet__logo" src="/assets/d2r/logo-red.webp" alt="" />
                  <span className="d2-fleet__cap">{t("d2r.fleetCap")}</span>
                  <span className="d2-fleet__bar" />
                  <button className="btn btn--red" onClick={buy}>{t("d2r.buy")} <span className="btn__arrow">›</span></button>
                </div>
                <figure className="d2-fleet__photo reveal-scale zoomable" onClick={() => openLightbox(["/assets/d2r/fleet.webp"])}>
                  <img src="/assets/d2r/fleet.webp" alt="" loading="lazy" />
                  <span className="d2-fleet__zoom">⤢</span>
                </figure>
              </div>
            </div>
          </section>
        )}

        {/* ---------------- TRACKS (marquee) ---------------- */}
        {!!tracks.length && (
          <section className="section section--dark d2-tracks">
            <div className="container d2-tracks__head">
              <EText id="d2r.trackEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="d2r.trackTitle" as="h2" className="h-section reveal-up rv-d1" />
            </div>
            <div className="d2-marquee">
              <div className="d2-marquee__row">
                {[...tracks, ...tracks].map((tr, i) => (
                  <span key={i} className="d2-marquee__i">{tr}<i>●</i></span>
                ))}
              </div>
            </div>
            <div className="container d2-tracks__grid">
              <ul className="d2-tracks__list">
                {tracks.map((tr, i) => (
                  <li key={i} className={`reveal-up rv-d${(i % 5) + 1}`}><i /> {tr}</li>
                ))}
              </ul>
              <figure className="d2-tracks__photo reveal-scale zoomable" onClick={() => openLightbox(["/assets/d2r/tracks.webp"])}>
                <img src="/assets/d2r/tracks.webp" alt="" loading="lazy" />
                <span className="d2-fleet__zoom">⤢</span>
              </figure>
            </div>
          </section>
        )}

        {/* ---------------- STEPS ---------------- */}
        <section className="section section--paper d2-steps">
          <div className="tex" />
          <div className="container">
            <EText id="d2r.stepsTitle" as="h2" className="h-section d2-steps__title reveal-up" />
            <TrackMap />
            <div className="d2-steps__grid">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={`d2-step reveal-up rv-d${n}`}>
                  <span className="d2-step__n">0{n}</span>
                  <EText id={`d2r.step${n}.t`} as="h3" className="d2-step__t" />
                  <EText id={`d2r.step${n}.b`} as="p" className="d2-step__b" multiline />
                </div>
              ))}
            </div>
          </div>
        </section>

        <Kerb flip />

        {/* ---------------- PACKAGE ---------------- */}
        <section className="section section--dark d2-pkg" id="d2-pakiet">
          <div className="speedfx">{[0, 1, 2].map((i) => (
            <span key={i} style={{ top: `${26 + i * 22}%`, left: "-30%", width: "50%", animationDelay: `${i * 0.9}s` }} />
          ))}</div>
          <div className="container d2-pkg__grid">
            <div className="d2-pkg__left">
              <span className="eyebrow reveal-up">DRIVER2RACER</span>
              <EText id="d2r.pkgTitle" as="h2" className="h-display d2-pkg__title reveal-up rv-d1" />
              <ul className="d2-pkg__list">
                {includes.map((l, i) => (
                  <li key={i} className={`reveal-up rv-d${(i % 5) + 1}`}><span>✓</span>{l}</li>
                ))}
              </ul>
              {L(p, "price_note") && <p className="d2-pkg__note reveal-up">{L(p, "price_note")}</p>}
            </div>

            <aside className="d2-price reveal-scale rv-d2">
              <img className="d2-price__logo" src="/assets/d2r/logo-red.webp" alt="" />
              <span className="d2-price__l">{t("d2r.priceLabel")}</span>
              <div className="d2-price__v">{fmtZl(p.price)}<i>{t("d2r.net")}</i></div>
              <div className="d2-price__rows">
                <div><span>{t("d2r.sSessions")}</span><b>24</b></div>
                <div><span>{t("d2r.sSim")}</span><b>6</b></div>
                <div><span>{t("d2r.coach")}</span><b>1:1</b></div>
              </div>
              <button className="btn btn--red d2-price__btn" onClick={buy}>
                {t("d2r.buyNow")} <span className="btn__arrow">›</span>
              </button>
              <span className="d2-price__hint">{t("d2r.buyHint")}</span>
              <span className="d2-price__flag" />
            </aside>
          </div>
        </section>

        <div className="container d2-back">
          <Link to="/produkty" onClick={() => window.scrollTo({ top: 0 })}>‹ {t("prod.back")}</Link>
        </div>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* red-and-white kerb strip — the classic track rumble strip, used as a section divider */
function Kerb({ flip = false }) {
  return <div className={`d2-kerb ${flip ? "d2-kerb--flip" : ""}`} aria-hidden="true" />;
}

/* a speed trace that draws itself as you scroll — like a telemetry overlay */
function Telemetry({ t }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.85)));
        el.style.setProperty("--tp", p.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // speed trace (top) + throttle bars (bottom)
  const speed = "M0,86 L40,40 L86,30 L120,64 L150,88 L190,50 L232,22 L270,26 L300,72 L336,92 L372,58 L410,26 L452,18 L492,44 L530,80 L566,92 L600,54 L640,24 L680,16 L720,40";
  return (
    <div className="d2-tele" ref={ref}>
      <div className="d2-tele__head">
        <span>{t("d2r.telemetry")}</span>
        <i>LAP 1 · SECTOR 1–3</i>
      </div>
      <svg className="d2-tele__svg" viewBox="0 0 720 110" preserveAspectRatio="none">
        <g className="d2-tele__grid">
          {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="720" y1={22 + i * 24} y2={22 + i * 24} />)}
          {[0, 1, 2].map((i) => <line key={`v${i}`} x1={240 * i + 240} x2={240 * i + 240} y1="0" y2="110" className="sector" />)}
        </g>
        <path className="d2-tele__line" d={speed} pathLength="1" />
        <path className="d2-tele__glow" d={speed} pathLength="1" />
      </svg>
    </div>
  );
}

/* a circuit outline with a car that laps it as the page scrolls */
const TRACK_D = "M60,150 C60,80 120,40 200,40 L520,40 C610,40 660,80 660,140 C660,190 620,214 560,214 L420,214 C370,214 340,236 340,268 C340,300 312,320 262,320 L150,320 C90,320 60,286 60,236 Z";
function TrackMap() {
  const wrap = useRef(null);
  const path = useRef(null);
  const car = useRef(null);

  useEffect(() => {
    const w = wrap.current, pth = path.current, c = car.current;
    if (!w || !pth || !c) return;
    const len = pth.getTotalLength();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = w.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        const pt = pth.getPointAtLength(p * len);
        const ahead = pth.getPointAtLength(Math.min(len, p * len + 8));
        const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        c.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${ang})`);
        w.style.setProperty("--lap", p.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="d2-track" ref={wrap} aria-hidden="true">
      <svg viewBox="0 0 720 360" preserveAspectRatio="xMidYMid meet">
        <path ref={path} className="d2-track__base" d={TRACK_D} pathLength="1" />
        <path className="d2-track__run" d={TRACK_D} pathLength="1" />
        {/* start/finish */}
        <rect className="d2-track__sf" x="52" y="140" width="16" height="6" />
        <g ref={car} className="d2-track__car">
          <rect x="-9" y="-4.5" width="18" height="9" rx="2" />
          <rect className="d2-track__wing" x="-11" y="-5.5" width="3" height="11" rx="1" />
        </g>
      </svg>
    </div>
  );
}

/* hero counter */
function HeroStat({ value, label }) {
  const [ref, inView] = useReveal();
  const n = useCountUp(value, inView, 1400);
  return (
    <div className="d2-stat" ref={ref}>
      <span className="d2-stat__v">{n}</span>
      <span className="d2-stat__l">{label}</span>
    </div>
  );
}

/* one benefit — the meter fills when it scrolls in */
function Gain({ idx, head, body }) {
  const [ref, inView] = useReveal();
  return (
    <article ref={ref} className={`d2-gain ${inView ? "in" : ""}`} style={{ ["--d"]: `${idx * 0.12}s` }}>
      <span className="d2-gain__n">0{idx + 1}</span>
      <h3 className="d2-gain__h">{head}</h3>
      <div className="d2-gain__meter"><span /></div>
      <p className="d2-gain__b">{body}</p>
    </article>
  );
}

/* the 24 sessions, split by stage — hovering a block highlights its slice */
const SLICES = [
  { key: "s1", n: 10, cls: "a", track: true },
  { key: "s2", n: 10, cls: "b", track: true },
  { key: "s3", n: 4, cls: "c", track: true },
  { key: "sim", n: 6, cls: "d", track: false },
];
function SessionBar({ t }) {
  const [hover, setHover] = useState(null);
  const [ref, inView] = useReveal();
  // the big number is the TRACK sessions (24) — the simulator sits next to it
  const track = SLICES.filter((x) => x.track).reduce((s, x) => s + x.n, 0);
  const sim = SLICES.filter((x) => !x.track).reduce((s, x) => s + x.n, 0);
  const shown = useCountUp(track, inView, 1500);

  return (
    <div className={`d2-sess ${inView ? "in" : ""}`} ref={ref}>
      <div className="d2-sess__total">
        <b>{shown}</b><span>{t("d2r.sessionsWord")}</span>
        <em className="d2-sess__plus">+ {sim} <i>{t("d2r.sSim")}</i></em>
      </div>

      <div className="d2-sess__bar">
        {SLICES.map((s, i) => (
          <motion.button key={s.key}
            className={`d2-sess__slice s-${s.cls} ${hover === i ? "on" : ""} ${hover !== null && hover !== i ? "dim" : ""}`}
            style={{ flex: s.n }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.16, 0.8, 0.3, 1] }}
          >
            <span className="d2-sess__n">{s.n}</span>
          </motion.button>
        ))}
      </div>

      <div className="d2-sess__legend">
        {SLICES.map((s, i) => (
          <button key={s.key} className={`d2-sess__leg s-${s.cls} ${hover === i ? "on" : ""}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i /><b>{s.n}×</b> {t(`d2r.${s.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
