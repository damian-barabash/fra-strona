import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import { tint, isLight } from "../lib/util";

const EASE = [0.16, 0.8, 0.3, 1];
const carVar = {
  enter: (d) => ({ x: d > 0 ? "55%" : "-55%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? "-45%" : "45%", opacity: 0 }),
};
const badgeVar = {
  enter: (d) => ({ x: d > 0 ? "28%" : "-28%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? "-22%" : "22%", opacity: 0 }),
};

export default function Fleet() {
  const { cars, L, t } = useStore();
  const openLightbox = useLightbox();
  const [[idx, dir], setIdx] = useState([0, 0]);
  const [thumb, setThumb] = useState(0);
  const badgeRef = useRef(null);
  const [headRef, headIn] = useReveal();

  // subtle scroll parallax on the badge (hook must run before any early return)
  useEffect(() => {
    const el = badgeRef.current;
    const onScroll = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.setProperty("--pl", `${-p * 40}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!cars.length) return <section className="section section--paper" id="flota" />;
  const n = cars.length;
  const car = cars[((idx % n) + n) % n];
  const prev = cars[((idx - 1) % n + n) % n];
  const next = cars[((idx + 1) % n + n) % n];

  const go = (d) => { setIdx([idx + d, d]); setThumb(0); };

  const badgeColor = isLight(car.color) ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.82)";
  const photos = Array.isArray(car.photos) ? car.photos : [];

  const stats = [
    { l: "fleet.l_engine", v: car.engine, u: "" },
    { l: "fleet.l_power", v: car.power?.replace(/\s*KM/i, ""), u: "KM" },
    { l: "fleet.l_torque", v: car.torque?.replace(/\s*NM/i, ""), u: "NM" },
    { l: "fleet.l_speed", v: car.top_speed?.replace(/\s*KM\/H/i, "") || "—", u: car.top_speed ? "KM / H" : "" },
  ];

  return (
    <section className="section section--paper fleet" id="flota" style={{ backgroundColor: tint(car.color, 0.1) }}>
      <div className="tex" />
      <div className="container">
        <div className={`fleet__head reveal ${headIn ? "in" : ""}`} ref={headRef}>
          <EText id="fleet.eyebrow" as="span" className="eyebrow" />
          <EText id="fleet.title" as="h2" className="h-section" />
        </div>

        <div className="fleet__grid">
          <div className="fleet__stagewrap">
            <div className="fleet__stage" style={{ background: car.color }}>
              <AnimatePresence custom={dir} initial={false}>
                <motion.span key={`b-${car.id}`} ref={badgeRef} className="fleet__badge"
                  style={{ color: badgeColor, x: "var(--pl,0px)" }}
                  custom={dir} variants={badgeVar} initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.6, ease: EASE }}>
                  {car.badge}
                </motion.span>
              </AnimatePresence>

              {car.png && (
                <AnimatePresence custom={dir} initial={false}>
                  <motion.div key={`c-${car.id}`} className="fleet__carlayer"
                    custom={dir} variants={carVar} initial="enter" animate="center" exit="exit"
                    transition={{ duration: 0.55, ease: EASE }}>
                    <img className="fleet__car" src={car.png} alt={car.name} />
                  </motion.div>
                </AnimatePresence>
              )}

              <div className="fleet__model" style={{ zIndex: 3 }}>{car.name}</div>
              <a className="fleet__more" href="#"><EText id="fleet.more" /></a>
            </div>

            <div className="fleet__ctrls">
              <div className="fleet__arrows">
                <button className="navbtn" onClick={() => go(-1)} aria-label="prev">‹</button>
                <button className="navbtn navbtn--red" onClick={() => go(1)} aria-label="next">›</button>
              </div>
              <div className="fleet__neighbors">
                <span className="fleet__neighbor fleet__neighbor--prev">/// {prev.name}</span>
                <span className="fleet__neighbor fleet__neighbor--next">/// {next.name}</span>
              </div>
            </div>
          </div>

          <div className="fleet__side">
            <AnimatePresence mode="wait">
              <motion.p key={car.id} className="fleet__desc"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}>
                {L(car, "description")}
              </motion.p>
            </AnimatePresence>
            <Link to={`/rezerwacja?car=${car.id}`} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
              <EText id="fleet.cta" /> <span className="btn__arrow">›</span>
            </Link>
          </div>
        </div>

        <div className="fleet__bottom">
          <div className="fleet__stats">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="stat__l">{t(s.l)}</div>
                <div className="stat__v">{s.v || "—"}</div>
                {s.u && <div className="stat__u">{s.u}</div>}
              </div>
            ))}
          </div>
          <div className="fleet__thumbs">
            {photos.slice(0, 3).map((p, i) => (
              // click shows the photo in the stage; the ⤢ badge opens it fullscreen
              <span key={i} className="fleet__thumb">
                <img src={p} alt="" onClick={() => setThumb(i)}
                  style={{ outline: thumb === i && car.png ? "2px solid var(--red)" : "none" }} loading="lazy" />
                <button className="fleet__zoom" aria-label="Powiększ"
                  onClick={(e) => { e.stopPropagation(); openLightbox(photos, i); }}>⤢</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
