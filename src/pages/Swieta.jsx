import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { GiftVoucher, SantaHat, Snow, Flake, Bow, GiftIcon } from "../components/GiftVoucher";
import { useRevealOnScroll } from "../lib/hooks";
import { vsrc } from "../lib/video";
import { useSeo } from "../lib/seo";
import "../sections/swieta.css";

/* /swieta-2026 — hidden holiday page (only by the link: not in the menu, sitemap or prerender, noindex).
   Hero with the fleet in Santa hats and the looped campaign film, three steps, final CTA → the configurator. */
export default function Swieta() {
  const { t, lang } = useStore();
  useSeo({ title: "Voucher świąteczny — prezent na torze", path: "/swieta-2026", noindex: true, description: t("sw.lead") });
  useRevealOnScroll([]);
  const go = "/swieta-2026/voucher";

  return (
    <div className="sw">
      <ScrollProgress />
      <Nav />
      <main>
        <section className="sw-hero">
          <div className="sw-velvet" />
          <Snow />
          <span className="sw-spark" style={{ left: "8%", top: "22%" }} /><span className="sw-spark" style={{ left: "46%", top: "12%", animationDelay: "-1.2s" }} /><span className="sw-spark" style={{ left: "90%", top: "30%", animationDelay: "-2.1s" }} />
          <div className="container sw-hero__grid">
            <div className="sw-hero__text">
              <EText id="sw.eyebrow" as="span" className="sw-eyebrow reveal-up" />
              <h1 className="sw-h1 reveal-up rv-d1"><EText id="sw.title1" /><br /><EText id="sw.title2" className="sw-gold" /></h1>
              <EText id="sw.lead" as="p" className="sw-lead reveal-up rv-d2" multiline />
              <EText id="sw.body" as="p" className="sw-body reveal-up rv-d3" multiline />
              <div className="sw-hero__row reveal-up rv-d4">
                <Link to={go} className="sw-btn"><GiftIcon />{t("sw.cta")}<span className="btn__arrow">›</span></Link>
                <span className="sw-fast"><Stopwatch /><EText id="sw.fast" /></span>
              </div>
              <EText id="sw.tag" as="p" className="sw-tag reveal-up rv-d5" />
            </div>
            <div className="sw-hero__cars" aria-hidden="true">
              <Flake className="sw-hero__flake" />
              <div className="sw-car sw-car--back">
                <img src="/assets/swieta/porsche.webp" alt="" width="900" height="300" fetchpriority="high" />
                <SantaHat className="sw-car__hat" style={{ left: "45%", top: "-20%", width: "19%" }} />
              </div>
              <div className="sw-car sw-car--front">
                <img src="/assets/swieta/supra.webp" alt="" width="900" height="283" />
                <SantaHat className="sw-car__hat" style={{ left: "47%", top: "-23%", width: "18%", animationDelay: "-.8s" }} />
              </div>
              <div className="sw-road"><span /></div>
              <div className="sw-gifts"><Gift c="#0e4a2f" /><Gift c="#e30613" big /><Gift c="#d8ae4f" /></div>
            </div>
          </div>

          <div className="container">
            <VideoCard tag={t("sw.videoTag")} />
          </div>
        </section>

        <section className="sw-steps">
          <div className="sw-steps__bg" />
          <Snow count={18} className="snow--soft" />
          <div className="container">
            <div className="sw-steps__head">
              <EText id="sw.stepsEyebrow" as="span" className="sw-eyebrow sw-eyebrow--gold reveal-up" />
              <EText id="sw.stepsTitle" as="h2" className="sw-h2 reveal-up rv-d1" />
            </div>
            <ol className="sw-steps__list">
              {[
                { n: 1, i: <GiftIcon />, tt: "sw.s1t", d: "sw.s1d" },
                { n: 2, i: <PenIcon />, tt: "sw.s2t", d: "sw.s2d" },
                { n: 3, i: <MailIcon />, tt: "sw.s3t", d: "sw.s3d" },
              ].map((s, k) => (
                <li key={s.n} className={`sw-step reveal-up rv-d${k + 1}`}>
                  <span className="sw-step__n">{s.n}</span>
                  <span className="sw-step__ico">{s.i}</span>
                  <EText id={s.tt} as="h3" className="sw-step__t" />
                  <EText id={s.d} as="p" className="sw-step__d" multiline />
                  {k < 2 && <span className="sw-step__link" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sw-final">
          <div className="sw-final__stripes" />
          <Snow count={22} />
          <div className="container sw-final__grid">
            <div className="sw-final__card reveal-scale">
              <Bow className="sw-final__bow" />
              <GiftVoucher lang={lang} name={lang === "en" ? "Your loved one" : "Twojego bliskiego"} title={lang === "en" ? "SPORT DRIVING TRAINING ON TRACK" : "SZKOLENIE JAZDY SPORTOWEJ NA TORZE"} lines={[lang === "en" ? "Tor Łódź" : "Tor Łódź", lang === "en" ? "Package Experience - 3 sessions" : "Pakiet Experience - 3 sesje", "Porsche / Supra / Alpine"]} />
              <span className="sw-final__shine" />
            </div>
            <div className="sw-final__text">
              <EText id="sw.finalEyebrow" as="span" className="sw-eyebrow sw-eyebrow--gold reveal-up" />
              <EText id="sw.finalTitle" as="h2" className="sw-h2 reveal-up rv-d1" />
              <EText id="sw.finalSub" as="p" className="sw-body reveal-up rv-d2" multiline />
              <Link to={go} className="sw-btn sw-btn--gold reveal-up rv-d3"><GiftIcon />{t("sw.cta")}<span className="btn__arrow">›</span></Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* the looped campaign film in a gift-wrapped card: ribbons cross it, a bow on top, tilts flat as it scrolls in */
function VideoCard({ tag }) {
  const ref = useRef(null);
  const vid = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.6)));   // 0 = just below the fold, 1 = well in view
      el.style.setProperty("--vp", p.toFixed(3));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    // the film only plays while it is on screen
    const io = new IntersectionObserver(([e]) => { const v = vid.current; if (!v) return; if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.15 });
    io.observe(el);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="sw-video" ref={ref}>
      <div className="sw-video__frame">
        <video ref={vid} src={vsrc("/assets/swieta/loop.webm")} poster="/assets/swieta/loop-poster.webp" muted loop playsInline autoPlay preload="metadata" />
        <span className="sw-video__rib sw-video__rib--v" /><span className="sw-video__rib sw-video__rib--h" />
        <span className="sw-video__tag">{tag}</span>
      </div>
      <Bow className="sw-video__bow" />
    </div>
  );
}

const Gift = ({ c, big }) => (
  <svg className={`sw-gift ${big ? "is-big" : ""}`} viewBox="0 0 60 60" aria-hidden="true">
    <rect x="6" y="22" width="48" height="34" fill={c} /><rect x="3" y="14" width="54" height="11" fill={c} style={{ filter: "brightness(1.15)" }} />
    <rect x="26" y="14" width="8" height="42" fill="#f3d58a" /><path d="M30 14 C 18 2, 8 8, 16 14 Z M30 14 C 42 2, 52 8, 44 14 Z" fill="#f3d58a" />
  </svg>
);
const PenIcon = () => (
  <svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L16 4.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20zM14.5 6l3.5 3.5M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
);
const MailIcon = () => (
  <svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
);
const Stopwatch = () => (
  <svg className="sw-ico sw-ico--watch" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 3h4M12 3v3M18.5 6.5l1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path className="sw-watch__hand" d="M12 13.5V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
