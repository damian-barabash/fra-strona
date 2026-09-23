import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText, EMedia } from "../components/Editable";
import { useReveal, useRevealOnScroll } from "../lib/hooks";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BIO = ["mz.bio1", "mz.bio2", "mz.bio3", "mz.bio4", "mz.bio5", "mz.bio6", "mz.bio7"];

export default function Mariusz() {
  const { cmsMode, isAdmin } = useStore();
  const editing = cmsMode && isAdmin;
  useRevealOnScroll([]);

  // page starts at top on mount
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  return (
    <div className={editing ? "cms-on mz" : "mz"}>
      <ScrollProgress />
      <Nav />
      <main>
        {editing ? <HeroEditor /> : <HeroScene />}
        <BioSection />
        <GalleryBand which="1" />
        <ResultsSection />
        <GalleryBand which="2" alt />
        <CtaSection />
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* ============ HERO — interactive helmet + scroll recede + signature ============ */
function HeroScene() {
  const { media, t } = useStore();
  const sceneRef = useRef(null);
  const pinRef = useRef(null);
  const stageRef = useRef(null);
  const [off, setOff] = useState(true); // helmet hidden until hover/auto
  const idleT = useRef(null);
  const touch = useRef(false);
  const autoRef = useRef(false);            // roaming (idle / touch)
  const target = useRef({ x: 50, y: 44 });  // where the spotlight wants to be (%) — centred on the visor
  const cur = useRef({ x: 50, y: 44 });     // where it is now (lags behind → delay)
  const trail = useRef([]);                 // recent positions → comet trail
  const par = useRef({ x: 0, y: 0 });       // eased counter-parallax offset (px)

  // scroll-linked progress (recede + bg + signature draw)
  useEffect(() => {
    const scene = sceneRef.current, pin = pinRef.current;
    if (!scene || !pin) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const H = scene.offsetHeight - window.innerHeight; // travel distance
      const y = -scene.getBoundingClientRect().top;      // scrolled within the scene
      const p = H > 0 ? clamp(y / H, 0, 1) : 0;
      const sp = clamp((p - 0.5) / 0.42, 0, 1); // signature draws 50%→92%
      // pin the viewport while inside the scene, then release at the bottom
      if (y < H) { pin.style.position = "fixed"; pin.style.top = "0px"; }
      else { pin.style.position = "absolute"; pin.style.top = H + "px"; }
      pin.style.setProperty("--p", p.toFixed(4));
      pin.style.setProperty("--sp", sp.toFixed(4));
      pin.classList.toggle("is-shrunk", p > 0.04);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const armIdle = useCallback(() => {
    clearTimeout(idleT.current);
    idleT.current = setTimeout(() => { autoRef.current = true; setOff(false); }, 6000);
  }, []);

  // touch devices → auto (roaming spotlight); otherwise arm the 6s idle timer
  useEffect(() => {
    touch.current = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
    if (touch.current) { autoRef.current = true; setOff(false); }
    else armIdle();
    return () => clearTimeout(idleT.current);
  }, [armIdle]);

  // single render loop: the spotlight eases toward its target (a slight delay) and
  // leaves a fading comet trail behind it (built as a multi-stop mask on the helmet).
  useEffect(() => {
    let raf = 0, t0 = performance.now();
    const loop = (now) => {
      if (autoRef.current) {
        const t = (now - t0) / 1000; // roam a lazy figure-8 around the head
        target.current = { x: 50 + 16 * Math.sin(t * 0.8), y: 45 + 12 * Math.sin(t * 1.23 + 1) };
      }
      const c = cur.current, tg = target.current;
      c.x += (tg.x - c.x) * 0.072; // slower ease → more lag behind the cursor
      c.y += (tg.y - c.y) * 0.072;
      const tr = trail.current;
      tr.unshift({ x: c.x, y: c.y });
      if (tr.length > 22) tr.pop();
      // head (full) + a few older, smaller, fainter samples = trail
      const pts = [0, 4, 8, 12, 16].map((i) => tr[i]).filter(Boolean);
      const mask = pts
        .map((p, i) => {
          const a = i === 0 ? 1 : Math.max(0, 0.66 - i * 0.16);
          const r = Math.max(7, 18 - i * 1.9);   // a touch bigger spotlight
          const yy = (p.y + 22) / 1.22; // stage-Y → mask-box-Y (box extends 22% above)
          return `radial-gradient(circle ${r}vh at ${p.x.toFixed(1)}% ${yy.toFixed(1)}%, rgba(0,0,0,${a}) 0 38%, rgba(0,0,0,0) 70%)`;
        })
        .join(", ");
      const s = stageRef.current;
      if (s) {
        const k = s.querySelector(".mz-kask");
        if (k) { k.style.webkitMaskImage = mask; k.style.maskImage = mask; }
        // the whole model drifts a touch AGAINST the cursor — very slow, separate easing
        const ptx = -((tg.x - 50) / 50) * 10;
        const pty = -((tg.y - 50) / 50) * 7;
        par.current.x += (ptx - par.current.x) * 0.035;
        par.current.y += (pty - par.current.y) * 0.035;
        s.style.setProperty("--px", par.current.x.toFixed(2) + "px");
        s.style.setProperty("--py", par.current.y.toFixed(2) + "px");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMove = (e) => {
    if (touch.current) return;
    const r = stageRef.current.getBoundingClientRect();
    target.current = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    setOff(false); autoRef.current = false;
    armIdle();
  };
  const onLeave = () => { if (touch.current) return; setOff(true); autoRef.current = false; armIdle(); };

  const stageCls = `mz-stage ${off ? "mz-stage--off" : ""}`;

  return (
    <section className="mz-scene" ref={sceneRef}>
      <div className="mz-pin" ref={pinRef}>
        {/* white world with drifting racing motifs (fades out on scroll) */}
        <div className="mz-white">
          <div className="mz-grid" />
          <div className="mz-flag mz-flag--a" />
          <div className="mz-flag mz-flag--b" />
          <div className="mz-streaks">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
        </div>
        {/* gray studio that arrives on scroll */}
        <div className="mz-gray" />
        <div className="mz-slogan"><EText id="mz.slogan" as="span" /></div>
        <div className="mz-card"><div className="mz-card__flag" /></div>

        {/* interactive portrait + helmet */}
        <div className="mz-figure">
          <div className={stageCls} ref={stageRef} onPointerMove={onMove} onPointerLeave={onLeave}>
            <img className="mz-face" src={media("mz.face")} alt={t("mz.name")} draggable="false" />
            <div className="mz-kask"><img src={media("mz.kask")} alt="" draggable="false" /></div>
          </div>
        </div>

        {/* white scrim under the headline so the name stays readable over the portrait */}
        <div className="mz-hero-scrim" />

        {/* top-state headline (fades out on scroll) */}
        <div className="mz-headline">
          <EText id="mz.eyebrow" as="span" className="mz-eyebrow" />
          <EText id="mz.name" as="h1" className="mz-name" />
          <span className="mz-hint">{t("mz.hint")}</span>
        </div>

        {/* signature drawn on scroll + role */}
        <div className="mz-plate">
          <img className="mz-sign" src={media("mz.sign")} alt={t("mz.name")} />
          <EText id="mz.role" as="span" className="mz-role" />
        </div>

        <a href="#mz-bio" className="mz-scroll"><span>{t("mz.scrollHint")}</span><i /></a>
      </div>
    </section>
  );
}

/* editing mode: swap the effect for a plain, editable panel with the 3 source images */
function HeroEditor() {
  return (
    <section className="section mz-editor">
      <div className="container">
        <EText id="mz.eyebrow" as="span" className="eyebrow" />
        <EText id="mz.name" as="h1" className="h-display" style={{ margin: "6px 0 4px" }} />
        <EText id="mz.role" as="div" className="lead" />
        <p className="mz-editnote">Efekt kasku (kursor / auto) widoczny jest w podglądzie. Poniżej podmienisz grafiki i podpis.</p>
        <div className="mz-editgrid">
          <label><span>Zdjęcie twarzy (PNG na przezroczystym tle)</span>
            <EMedia id="mz.face" imgProps={{ style: { background: "#f0f0f0" } }} /></label>
          <label><span>Kask (PNG na przezroczystym tle)</span>
            <EMedia id="mz.kask" imgProps={{ style: { background: "#f0f0f0" } }} /></label>
          <label><span>Podpis odręczny (czerwony)</span>
            <EMedia id="mz.sign" imgProps={{ style: { background: "#f0f0f0", padding: 16 } }} /></label>
        </div>
        <div className="mz-editgrid" style={{ marginTop: 18 }}>
          <label><span>Eyebrow / podtytuł</span><EText id="mz.eyebrow" as="div" className="mz-editfield" /></label>
          <label><span>Wskazówka (hover)</span><EText id="mz.hint" as="div" className="mz-editfield" /></label>
          <label><span>Napis „przewiń”</span><EText id="mz.scrollHint" as="div" className="mz-editfield" /></label>
        </div>
      </div>
    </section>
  );
}

/* ============ BIO ============ */
function BioSection() {
  const [ref, inView] = useReveal();
  return (
    <section className="section section--paper mz-bio" id="mz-bio" ref={ref}>
      <div className="tex" />
      <div className={`container mz-bio__grid ${inView ? "in" : ""}`}>
        <div className={`reveal mz-bio__head ${inView ? "in" : ""}`}>
          <EText id="mz.bioEyebrow" as="span" className="eyebrow" />
          <EText id="mz.bioTitle" as="h2" className="h-section mz-bio__title" />
          <Trophies inView={inView} />
        </div>
        <div className={`reveal mz-bio__body ${inView ? "in" : ""}`}>
          {BIO.map((k) => <EText key={k} id={k} as="p" className="mz-bio__p" multiline />)}
        </div>
      </div>
    </section>
  );
}

/* nine gold cups — one per Polish champion title — rise onto the shelf as the bio scrolls in */
function Trophy() {
  return (
    <svg viewBox="0 0 64 110" className="mz-cup" aria-hidden="true">
      <defs>
        <linearGradient id="mzGold" x1="0" x2="1"><stop offset="0" stopColor="#f6d77a" /><stop offset=".45" stopColor="#c99a2e" /><stop offset=".7" stopColor="#f3d06a" /><stop offset="1" stopColor="#9e7418" /></linearGradient>
        <linearGradient id="mzGoldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbe7a1" /><stop offset="1" stopColor="#b8862a" /></linearGradient>
        <pattern id="mzChk" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#7a5a12" /><rect x="2" y="2" width="2" height="2" fill="#7a5a12" /></pattern>
      </defs>
      {/* checkered flag wings */}
      <path d="M12 4l8 6-2 18-10-8z" fill="url(#mzGold)" /><path d="M12 4l8 6-2 18-10-8z" fill="url(#mzChk)" opacity=".55" />
      <path d="M52 4l-8 6 2 18 10-8z" fill="url(#mzGold)" /><path d="M52 4l-8 6 2 18 10-8z" fill="url(#mzChk)" opacity=".55" />
      {/* steering wheel */}
      <circle cx="32" cy="14" r="8" fill="none" stroke="url(#mzGold)" strokeWidth="3" /><circle cx="32" cy="14" r="2.2" fill="url(#mzGold)" />
      <path d="M32 16v6M26 12h4M34 12h4" stroke="url(#mzGold)" strokeWidth="2" strokeLinecap="round" />
      {/* laurel */}
      <path d="M20 34c-4-6-4-12 0-16M44 34c4-6 4-12 0-16" fill="none" stroke="url(#mzGold)" strokeWidth="2.4" strokeLinecap="round" />
      {/* cup */}
      <path d="M18 24h28l-3 22c-1 7-6 11-11 11s-10-4-11-11z" fill="url(#mzGoldV)" />
      <path d="M22 28h20l-2 14c-1 5-4 8-8 8s-7-3-8-8z" fill="none" stroke="#fff5cf" strokeWidth="1" opacity=".5" />
      <path d="M18 27H12c0 8 4 13 10 15M46 27h6c0 8-4 13-10 15" fill="none" stroke="url(#mzGold)" strokeWidth="3" strokeLinecap="round" />
      {/* stem + collar */}
      <path d="M29 57h6v8h-6z" fill="url(#mzGoldV)" /><path d="M24 65h16l2 6H22z" fill="url(#mzGold)" />
      <circle cx="32" cy="80" r="6" fill="url(#mzGoldV)" /><circle cx="32" cy="80" r="3.5" fill="none" stroke="#7a5a12" strokeWidth=".8" />
      {/* marble base */}
      <path d="M16 90h32v14H16z" fill="#e9e6df" /><path d="M16 90h32v3H16z" fill="#cfcac0" />
      <rect x="20" y="96" width="24" height="5" fill="url(#mzGold)" />
    </svg>
  );
}
function Trophies({ inView }) {
  const { t } = useStore();
  return (
    <div className={`mz-cups ${inView ? "in" : ""}`} aria-label={t("mz.cupsLabel")}>
      <div className="mz-cups__row">
        {Array.from({ length: 9 }, (_, i) => <span key={i} className="mz-cups__i" style={{ ["--i"]: i }}><Trophy /></span>)}
        <span className="mz-cups__shelf" />
      </div>
      <EText id="mz.cupsLabel" as="span" className="mz-cups__lbl" />
    </div>
  );
}

/* ============ PHOTO BLOCK (contained image + text) ============ */
function GalleryBand({ which, alt }) {
  const [ref, inView] = useReveal();
  return (
    <section className={`section ${alt ? "section--paper" : ""} mz-photoblock`} ref={ref}>
      {alt && <div className="tex" />}
      <div className={`container mz-pb__grid ${alt ? "mz-pb__grid--alt" : ""} ${inView ? "in" : ""}`}>
        <div className="mz-pb__media">
          <EMedia id={`mz.gallery${which}`} className="mz-pb__img" />
        </div>
        <div className="mz-pb__text">
          <EText id="mz.galleryEyebrow" as="span" className={`eyebrow ${alt ? "reveal-right" : "reveal-left"}`} />
          <EText id={`mz.gallery${which}cap`} as="h3" className={`mz-pb__title ${alt ? "reveal-right" : "reveal-left"} rv-d1`} multiline />
          <EText id={`mz.gallery${which}desc`} as="p" className={`mz-pb__desc lead ${alt ? "reveal-right" : "reveal-left"} rv-d2`} multiline />
        </div>
      </div>
    </section>
  );
}

/* ============ RESULTS ============ */
function ResultsSection() {
  const { t, raw, cmsMode, isAdmin, saveContent } = useStore();
  const [ref] = useReveal();
  const editing = cmsMode && isAdmin;
  const rows = (t("mz.results") || "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <section className="section section--dark mz-results" ref={ref}>
      <div className="speedfx">{[0, 1, 2].map((i) => <span key={i} style={{ top: `${20 + i * 26}%`, left: "-30%", width: "44%", animationDelay: `${i * 1.1}s` }} />)}</div>
      <div className="container">
        <div className="mz-results__head reveal-left">
          <EText id="mz.resultsEyebrow" as="span" className="eyebrow" />
          <EText id="mz.resultsTitle" as="h2" className="h-section" />
        </div>
        {editing ? (
          <textarea
            className="mz-results__edit"
            defaultValue={raw("mz.results").pl}
            onBlur={(e) => { const v = e.target.value; if (v !== raw("mz.results").pl) saveContent("mz.results", v, "url"); }}
          />
        ) : (
          <ol className="mz-results__list">
            {rows.map((line, i) => {
              const [year, ...rest] = line.split("·");
              return (
                <li key={i} className={`mz-res reveal-up rv-d${(i % 5) + 1}`}>
                  <span className="mz-res__year">{year.trim()}</span>
                  <span className="mz-res__txt">{rest.join("·").trim()}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function CtaSection() {
  const { t } = useStore();
  return (
    <section className="section mz-cta">
      <div className="tex" />
      <div className="container mz-cta__inner">
        <EText id="mz.ctaTitle" as="h2" className="h-display reveal-scale" />
        <EText id="mz.ctaSub" as="p" className="lead mz-cta__sub reveal-up rv-d1" multiline />
        <a href="/#flota" className="btn btn--red reveal-up rv-d2">{t("mz.ctaBtn")}</a>
      </div>
    </section>
  );
}
