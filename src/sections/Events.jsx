import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

// "Heels on the track" events are hidden here — they will live only in the
// (future) calendar. Only "Sport driving experience" style events show on home.
const isHeels = (e) => /heels/i.test(`${e.type || ""} ${e.title_pl || ""} ${e.title_en || ""}`);

export default function Events() {
  const { events: allEvents, L, t } = useStore();
  const events = allEvents.filter((e) => !isHeels(e));
  const [sel, setSel] = useState(0);
  const trackRef = useRef(null);
  const [headRef, headIn] = useReveal();

  if (!events.length) return <section className="section section--paper" id="wydarzenia" />;
  const ev = events[Math.min(sel, events.length - 1)];

  const scroll = (d) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: d * (el.clientWidth * 0.5), behavior: "smooth" });
  };

  return (
    <section className="section section--paper" id="wydarzenia">
      <div className="tex" />
      <div className="container">
        <div className={`events__head reveal ${headIn ? "in" : ""}`} ref={headRef}>
          <EText id="events.title" as="h2" className="h-section" />
        </div>

        <div className="events__grid">
          <div className="events__track" ref={trackRef}>
            {events.map((e, i) => (
              <div key={e.id} className={`ecard ${i === sel ? "sel" : ""}`} onClick={() => setSel(i)}>
                <img src={e.photo} alt={L(e, "title")} loading="lazy" />
                <div className="ecard__scrim" style={e.color ? { boxShadow: `inset 0 0 0 2000px ${hexA(e.color, 0.18)}` } : null} />
                <div className="ecard__top">
                  <div className="ecard__title">{L(e, "title")}</div>
                  <div className="ecard__stage">{L(e, "stage")}</div>
                </div>
                <div className="ecard__bottom">
                  <div className="ecard__wd">{L(e, "weekday")}</div>
                  <div className="ecard__day">{e.day}</div>
                  <div className="ecard__mo">{L(e, "month")}</div>
                  <div className="ecard__time">{e.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="events__panel">
            <AnimatePresence mode="wait">
              <motion.div key={ev.id}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.35 }} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div className="events__loc">{L(ev, "location")}</div>
                <div className="events__ptitle">{L(ev, "title")}</div>
                <div className="events__pstage">{L(ev, "stage")}</div>
                <p className="events__pdesc">{L(ev, "description")}</p>
              </motion.div>
            </AnimatePresence>
            <div className="events__pactions">
              <button className="navbtn" onClick={() => scroll(-1)} aria-label="prev">‹</button>
              <button className="navbtn navbtn--red" onClick={() => scroll(1)} aria-label="next">›</button>
              <Link to={`/rezerwacja?event=${ev.id}`} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                <EText id="events.signup" /> <span className="btn__arrow">›</span>
              </Link>
              <Link to="/kalendarz" className="btn btn--ghost" onClick={() => window.scrollTo({ top: 0 })}>
                <EText id="events.cta" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function hexA(hex, a) {
  const h = (hex || "#000").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(n, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
}
