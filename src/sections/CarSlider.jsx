import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";
import { tint, isLight } from "../lib/util";
import { carPrice, fmtZl } from "../lib/flota";
import { FuelGauge } from "../components/Fuel";

const EASE = [0.16, 0.8, 0.3, 1];
const carVar = {
  enter: (d) => ({ x: d > 0 ? "60%" : "-60%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? "-50%" : "50%", opacity: 0 }),
};
const badgeVar = {
  enter: (d) => ({ x: d > 0 ? "30%" : "-30%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? "-24%" : "24%", opacity: 0 }),
};

/* The big "WYBIERZ TWOJE WYMARZONE AUTO" configurator slider — reused by the
   Flota page and by the booking page's AUTO step.
   props:
     onChoose(car)  — WYBIERAM button (Flota: navigate to booking; booking: select + next)
     onCurrent(car) — fires whenever the displayed car changes (keeps a parent selection in sync)
     jumpTo/onJumped — focus a car by id (from the fleet grid)
     hideHead       — hide the eyebrow + big title
     chooseLabel    — override the WYBIERAM button label
     priceTrack     — track slug for the "od X zł" hint */
export default function CarSlider({ onChoose, onCurrent, jumpTo, onJumped, hideHead = false, chooseLabel, priceTrack = "lodz" }) {
  const { cars, L, t } = useStore();
  const [[idx, dir], setIdx] = useState([0, 0]);
  const stageRef = useRef(null);
  const innerRef = useRef(null);
  const [headRef, headIn] = useReveal();

  const n = cars.length;
  const curId = n ? cars[((idx % n) + n) % n].id : null;

  // keep parent selection in sync with the shown car
  useEffect(() => { if (curId && onCurrent) onCurrent(cars.find((c) => c.id === curId)); }, [curId]); // eslint-disable-line

  // jump to a car chosen from the grid below
  useEffect(() => {
    if (jumpTo == null || !n) return;
    const i = cars.findIndex((c) => c.id === jumpTo);
    if (i >= 0) setIdx(([cur]) => [i, i > cur ? 1 : -1]);
    onJumped?.();
  }, [jumpTo, cars, n, onJumped]);

  // 3D tilt on the stage — eased parallax of badge + car layers
  useEffect(() => {
    const stage = stageRef.current, inner = innerRef.current;
    if (!stage || !inner || window.matchMedia("(hover: none)").matches) return;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5);
      ty = ((e.clientY - r.top) / r.height - 0.5);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const loop = () => {
      raf = 0;
      cx += (tx - cx) * 0.1; cy += (ty - cy) * 0.1;
      inner.style.transform = `perspective(1100px) rotateY(${(cx * 9).toFixed(2)}deg) rotateX(${(-cy * 6).toFixed(2)}deg)`;
      inner.style.setProperty("--mx", (cx * 34).toFixed(1) + "px");
      inner.style.setProperty("--my", (cy * 20).toFixed(1) + "px");
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => { stage.removeEventListener("pointermove", onMove); stage.removeEventListener("pointerleave", onLeave); cancelAnimationFrame(raf); };
  }, [n]);

  if (!n) return <section className="section section--paper" id="flota" />;

  const car = cars[((idx % n) + n) % n];
  const prev = cars[((idx - 1) % n + n) % n];
  const next = cars[((idx + 1) % n + n) % n];
  const go = (d) => setIdx([idx + d, d]);

  const badgeColor = isLight(car.color) ? "rgba(0,0,0,.72)" : "rgba(0,0,0,.8)";
  const fromPrice = carPrice(car, 3, priceTrack);
  const stats = [
    { l: "fleet.l_engine", v: car.engine, u: "" },
    { l: "fleet.l_power", v: car.power?.replace(/\s*KM/i, ""), u: "KM" },
    { l: "fleet.l_torque", v: car.torque?.replace(/\s*NM/i, ""), u: "NM" },
    { l: "fleet.l_speed", v: car.top_speed?.replace(/\s*KM\/H/i, "") || "—", u: car.top_speed ? "KM / H" : "" },
  ];

  return (
    <section className="section fl-slider" id="flota" style={{ background: tint(car.color, 0.12) }}>
      <div className="container">
        {!hideHead && (
          <div className={`fl-slider__top reveal ${headIn ? "in" : ""}`} ref={headRef}>
            <div className="fl-slider__head">
              <EText id="flota.sliderEyebrow" as="span" className="eyebrow" />
              <EText id="flota.sliderTitle" as="h2" className="h-section fl-slider__title" />
            </div>
          </div>
        )}

        <div className="fl-slider__main">
          <div className="fl-slider__side fl-slider__side--prev">
            <span className="fl-slider__neighbor">/// {prev.name}</span>
            <button className="fl-arrow" onClick={() => go(-1)} aria-label="prev">‹‹</button>
          </div>

          <div className="fl-stage" ref={stageRef} style={{ background: car.color }}>
            <div className="fl-stage__inner" ref={innerRef}>
              <AnimatePresence custom={dir} initial={false}>
                <motion.span key={`b-${car.id}`} className="fl-stage__badge" style={{ color: badgeColor }}
                  custom={dir} variants={badgeVar} initial="enter" animate="center" exit="exit" transition={{ duration: 0.6, ease: EASE }}>
                  {car.badge}
                </motion.span>
              </AnimatePresence>
              <div className="fl-stage__model">{car.name}</div>
              {car.png && (
                <AnimatePresence custom={dir} initial={false}>
                  <motion.div key={`c-${car.id}`} className="fl-stage__carlayer"
                    custom={dir} variants={carVar} initial="enter" animate="center" exit="exit" transition={{ duration: 0.55, ease: EASE }}>
                    <img className="fl-stage__car" src={car.png} alt={car.name} />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
            <button className="fl-stage__more" onClick={() => go(1)}><EText id="flota.more" /></button>
          </div>

          <div className="fl-slider__side fl-slider__side--next">
            <span className="fl-slider__neighbor">/// {next.name}</span>
            <button className="fl-arrow fl-arrow--red" onClick={() => go(1)} aria-label="next">››</button>
          </div>
        </div>

        <div className="fl-slider__bottom">
          <div className="fl-slider__stats">
            {stats.map((s, i) => (
              <div key={i} className="fl-stat">
                <div className="fl-stat__l">{t(s.l)}</div>
                <div className="fl-stat__v">{s.v || "—"}<span className="fl-stat__u">{s.u}</span></div>
              </div>
            ))}
          </div>
          <div className="fl-slider__buy">
            <FuelGauge value={0.62} />
            <div className="fl-slider__buywrap">
              {fromPrice > 0 && <span className="fl-slider__from">{t("flota.from")} {fmtZl(fromPrice)}</span>}
              <button className="btn btn--red fl-slider__choose" onClick={() => onChoose?.(car)}>
                {chooseLabel || <><EText id="flota.choose" /> {car.badge}</>} <span className="btn__arrow">›</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
