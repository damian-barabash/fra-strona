import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { useRevealOnScroll } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import { fmtEur, iceDateRange } from "../lib/ice";
import "../sections/laponia.css";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

/* Ice Driving Experience — Laponia. Same data model as every other product (CMS-editable
   photos AND video), but its own frozen-lake styling. Packages + dates come from the
   `ice_packages` / `ice_windows` tables, so the CRM drives the configurator directly. */
export default function Laponia({ p }) {
  const { L, t, icePackages, iceWindows, lang, cmsMode, isAdmin } = useStore();
  const nav = useNavigate();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;

  useRevealOnScroll([p.id, icePackages.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [p.id]);

  const intro = lines(L(p, "intro"));
  const learn = lines(L(p, "learn"));
  const includes = lines(L(p, "includes"));
  const gallery = Array.isArray(p.photos) ? p.photos : [];
  const window_ = iceWindows[0];
  const buy = (pkg) => { window.scrollTo({ top: 0 }); nav(`/rezerwacja-ice?pkg=${pkg.id}`); };

  return (
    <div className={editing ? "cms-on lp" : "lp"}>
      <ScrollProgress />
      <Nav />
      <Snow />
      <main>
        {/* ---------------- HERO ---------------- */}
        <section className="lp-hero">
          {p.video
            ? <video className="lp-hero__vid" src={p.video} autoPlay loop muted playsInline poster={p.photo} />
            : <img className="lp-hero__vid" src={p.photo} alt="" />}
          <div className="lp-hero__frost" />
          <div className="lp-hero__scrim" />
          <div className="container lp-hero__inner">
            {/* the product's own icy wordmark stands in for the headline (the h1 stays for screen readers) */}
            {p.logo ? (
              <>
                <img className="lp-hero__logo" src={p.logo} alt={L(p, "title")} />
                <h1 className="sr-only">{L(p, "title")}</h1>
              </>
            ) : (
              <>
                <span className="lp-hero__code">{p.code}</span>
                <h1 className="lp-hero__title">{L(p, "title")}</h1>
              </>
            )}
            <span className="lp-hero__tag">{L(p, "tag")}</span>
            {window_ && (
              <div className="lp-hero__dates">
                <span className="lp-frost-chip">{iceDateRange(window_, lang)}</span>
              </div>
            )}
            <p className="lp-hero__exc">{L(p, "excerpt")}</p>
            <div className="lp-hero__btns">
              <a href="#lp-pakiety" className="btn lp-btn">{t("ice.pickPkg")} <span className="btn__arrow">›</span></a>
              <a href="#lp-o" className="btn lp-btn--ghost">{t("prod.more")}</a>
            </div>
          </div>
          <div className="lp-hero__icicles">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ ["--i"]: i }} />)}</div>
        </section>

        {/* ---------------- INTRO ---------------- */}
        <section className="lp-sec lp-ice-tex lp-intro" id="lp-o">
          <DriftTracks />
          <div className="container lp-intro__grid">
            <div className="lp-intro__side reveal-left">
              <span className="lp-kicker">{t("prod.aboutLabel")}</span>
              <span className="lp-bar" />
              {window_ && (
                <div className="lp-dates">
                  <span className="lp-dates__l">{t("ice.season")}</span>
                  <span className="lp-dates__v">{iceDateRange(window_, lang)}</span>
                </div>
              )}
              {!!lines(L(p, "places")).length && (
                <ul className="lp-place">
                  {lines(L(p, "places")).map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              )}
            </div>
            {/* text sits on a slab of ice so it stays readable over the tracks and cracks */}
            <div className="lp-slab">
              {intro.map((par, i) => (
                <p key={i} className={`lp-p reveal-up rv-d${(i % 3) + 1}`}>{par}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- THEORY / PRACTICE ---------------- */}
        <section className="lp-sec lp-sec--deep lp-parts">
          <DriftTracks />
          <div className="container lp-parts__grid">
            {[
              { n: "01", label: t("prod.theory"), body: L(p, "theory") },
              { n: "02", label: t("prod.practice"), body: L(p, "practice") },
            ].filter((x) => x.body).map((x, i) => (
              <article key={x.n} className={`lp-glass reveal-up rv-d${i + 1}`}>
                <span className="lp-glass__n">{x.n}</span>
                <h3 className="lp-glass__h">{x.label}</h3>
                <p className="lp-glass__b">{x.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------------- LEARN + INCLUDES ---------------- */}
        <section className="lp-sec lp-ice-tex lp-lists">
          <div className="container lp-lists__grid">
            {!!learn.length && (
              <div className="lp-slab">
                <h3 className="lp-h reveal-up">{t("prod.learn")}</h3>
                <ul className="lp-ul">
                  {learn.map((l, i) => (
                    <li key={i} className={`lp-li reveal-up rv-d${(i % 5) + 1}`}><span className="lp-flake">❄</span>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!includes.length && (
              <div className="lp-box">
                <h3 className="lp-h lp-h--light reveal-up">{t("prod.includes")}</h3>
                <ul className="lp-ul">
                  {includes.map((l, i) => (
                    <li key={i} className={`lp-li lp-li--light reveal-up rv-d${(i % 5) + 1}`}><span className="lp-tick">✓</span>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- PACKAGES (straight from the CMS) ---------------- */}
        <section className="lp-sec lp-ice-tex lp-pkgs" id="lp-pakiety">
          <DriftTracks flip />
          <div className="container">
            <h2 className="lp-h2 reveal-up">{t("ice.packages")}</h2>
            {window_ && <p className="lp-pkgs__sub reveal-up rv-d1">{t("ice.windowNote")} <b>{iceDateRange(window_, lang)}</b></p>}

            <div className="lp-pkgs__grid">
              {icePackages.map((pk, i) => (
                <article key={pk.id} className={`lp-pkg reveal-up rv-d${(i % 3) + 1}`}>
                  <span className="lp-pkg__days">{pk.days}<i>{pk.days === 1 ? t("ice.day") : t("ice.days")}</i></span>
                  <h3 className="lp-pkg__name">{L(pk, "name")}</h3>
                  <p className="lp-pkg__sessions">{L(pk, "sessions")}</p>
                  <p className="lp-pkg__desc">{L(pk, "desc")}</p>
                  <div className="lp-pkg__price">{fmtEur(pk.price, pk.currency)}<span>{t("ice.perPerson")}</span></div>
                  <button className="btn lp-btn lp-pkg__btn" onClick={() => buy(pk)}>
                    {t("ice.buy")} <span className="btn__arrow">›</span>
                  </button>
                  <span className="lp-pkg__frost" />
                </article>
              ))}
            </div>

            {L(p, "price_note") && <p className="lp-note lp-slab lp-slab--tight reveal-up">{L(p, "price_note")}</p>}
          </div>
        </section>

        {/* ---------------- GALLERY ---------------- */}
        {!!gallery.length && (
          <section className="lp-gallery">
            {gallery.map((src, i) => (
              <figure key={i} className={`lp-gal zoomable reveal-scale rv-d${(i % 3) + 1}`} onClick={() => openLightbox(gallery, i)}>
                <img src={src} alt="" loading="lazy" />
                <span className="lp-gal__zoom">⤢</span>
              </figure>
            ))}
          </section>
        )}

        {/* ---------------- CTA ---------------- */}
        <section className="lp-sec lp-sec--deep lp-cta">
          <div className="container lp-cta__inner">
            <div>
              <span className="lp-kicker reveal-up">{L(p, "tag")}</span>
              <h2 className="lp-h2 lp-h2--light reveal-up rv-d1">{t("ice.ctaTitle")}</h2>
              <p className="lp-cta__sub reveal-up rv-d2">{t("ice.ctaSub")}</p>
            </div>
            <div className="lp-cta__btns reveal-up rv-d3">
              <a href="#lp-pakiety" className="btn lp-btn">{t("ice.pickPkg")} <span className="btn__arrow">›</span></a>
              <Link to="/produkty" className="btn lp-btn--ghost" onClick={() => window.scrollTo({ top: 0 })}>{t("prod.back")}</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* Tyre tracks left by a car drifting across the frozen lake: two parallel treads that get
   "driven" across the section as you scroll (the SVG is clipped from the left). */
function DriftTracks({ flip = false }) {
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

  // two treads of the same drifting line, offset by the track width of the car
  const inner = "M-30,262 C 210,268 300,132 520,120 C 750,108 830,250 1060,240 C 1245,232 1330,150 1480,116";
  const outer = "M-30,300 C 210,306 300,170 520,158 C 750,146 830,288 1060,278 C 1245,270 1330,188 1480,154";

  return (
    <svg className={`lp-drift ${flip ? "lp-drift--flip" : ""}`} ref={ref}
      viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true">
      <path className="lp-drift__tread" d={inner} pathLength="1" />
      <path className="lp-drift__tread" d={outer} pathLength="1" />
      <path className="lp-drift__spray" d={inner} pathLength="1" />
      <path className="lp-drift__spray" d={outer} pathLength="1" />
    </svg>
  );
}

/* drifting snow — pure CSS particles, disabled for reduced motion via the global rule */
function Snow() {
  const ref = useRef(null);
  return (
    <div className="lp-snow" ref={ref} aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span key={i} style={{
          ["--x"]: `${(i * 37) % 100}%`,
          ["--d"]: `${9 + ((i * 7) % 11)}s`,
          ["--delay"]: `${-((i * 3) % 12)}s`,
          ["--s"]: `${2 + ((i * 5) % 4)}px`,
          ["--o"]: 0.25 + ((i % 5) * 0.13),
        }} />
      ))}
    </div>
  );
}
