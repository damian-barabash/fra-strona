import { useState, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "../lib/motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

let _canvas;
function measureTextWidth(text, fontPx) {
  _canvas = _canvas || document.createElement("canvas");
  const ctx = _canvas.getContext("2d");
  ctx.font = `900 ${fontPx}px Montserrat, sans-serif`;
  return ctx.measureText(text).width;
}

/* prev / next control: big chevrons + a thumbnail of the track it leads to + its name. Every part has a
   fixed size, so the control never moves when the slide (and the neighbour's name) changes. */
function TrackNav({ dir, track, label, onClick }) {
  return (
    <button type="button" className={`tnav tnav--${dir < 0 ? "prev" : "next"}`} onClick={onClick} aria-label={`${label}: ${track.name}`}>
      <span className="tnav__ico">
        <svg viewBox="0 0 24 24" aria-hidden="true">{dir < 0 ? <path d="M12 4l-8 8 8 8M20 4l-8 8 8 8" /> : <path d="M12 4l8 8-8 8M4 4l8 8-8 8" />}</svg>
      </span>
      <span className="tnav__thumb">{track.map && <img src={track.map} alt="" loading="lazy" decoding="async" />}</span>
      <span className="tnav__txt"><small>{label}</small><b>{track.name}</b></span>
    </button>
  );
}

export default function Tracks() {
  const { tracks, L, t } = useStore();
  const [[idx, dir], setIdx] = useState([0, 0]);
  const nameBoxRef = useRef(null);
  const [availW, setAvailW] = useState(0);
  const [headRef, headIn] = useReveal();
  const n = tracks.length;

  useLayoutEffect(() => {
    const measure = () => {
      const el = nameBoxRef.current;
      if (!el) return;
      const padL = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      setAvailW(Math.max(80, el.clientWidth - padL - 6));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [n]);

  const tr = n ? tracks[((idx % n) + n) % n] : null;
  const fn = (tr?.full_name || tr?.name || "").trim();
  const main = /^TOR\s+/i.test(fn) ? fn.replace(/^TOR\s+/i, "") : (fn || tr?.name || "");

  // font-size computed synchronously in-render -> applied inline -> no size animation on switch
  const idealMax = Math.min(128, (typeof window !== "undefined" ? window.innerWidth : 1440) * 0.085);
  let nameFs = idealMax;
  if (availW && main) {
    const w = measureTextWidth(main, idealMax);
    if (w > availW) nameFs = Math.max(24, Math.floor(idealMax * (availW / w)));
  }

  if (!n) return null;
  const prev = tracks[((idx - 1) % n + n) % n];
  const next = tracks[((idx + 1) % n + n) % n];
  const go = (d) => setIdx([idx + d, d]);
  const desc = (x) => L(x, "description") || "Wymagający tor, który dostarczy Ci prawdziwych emocji z jazdy sportowej pod okiem naszych instruktorów.";

  const statsOf = (x) => [
    { l: "tracks.l_country", v: L(x, "country"), u: "" },
    { l: "tracks.l_turns", v: x.turns, u: "", small: /[a-ząćęłńóśźż]/i.test(x.turns || "") },
    { l: "tracks.l_length", v: x.length, u: x.length ? t("tracks.u_meters") : "" },
    { l: "tracks.l_width", v: x.width, u: x.width ? t("tracks.u_meters") : "" },
  ];
  const statList = (x, ghost) => (
    <div className={`tracks__stats ${ghost ? "tracks__stats--ghost" : ""}`} key={ghost ? x.id : "live"} aria-hidden={ghost ? "true" : undefined}>
      {statsOf(x).map((s, i) => (
        <div className="tstat" key={i}>
          <div className="tstat__l">{t(s.l)}</div>
          <div className={`tstat__v ${s.small ? "tstat__v--sm" : ""}`}>{s.v || "—"}</div>
          {s.u && <div className="tstat__u">{s.u}</div>}
        </div>
      ))}
    </div>
  );

  return (
    <section className="section section--paper tracks" id="tory">
      <div className="tex" />
      <div className="container">
        <div className="tracks__grid">
          {/* left: title + prev arrow + description */}
          <div className={`tracks__left reveal ${headIn ? "in" : ""}`} ref={headRef}>
            <EText id="tracks.title" as="h2" className="tracks__title" />
            <div className="tracks__ctrl">
              <TrackNav dir={-1} track={prev} label={t("tracks.prev")} onClick={() => go(-1)} />
            </div>
            {/* every description sits (invisibly) in the same grid cell, so the box is always as tall as
                the longest one and nothing below it moves when the slide changes */}
            <div className="tracks__descbox">
              {tracks.map((x) => <p key={x.id} className="tracks__desc tracks__desc--ghost" aria-hidden="true">{desc(x)}</p>)}
              <AnimatePresence mode="wait">
                <motion.p key={tr.id} className="tracks__desc"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}>
                  {desc(tr)}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* center: name + map */}
          <div className="tracks__center">
            <div className="tracks__name" ref={nameBoxRef}>
              <EText id="tracks.pre" as="span" className="tracks__pre" />
              <span className="tracks__main" style={{ height: Math.ceil(idealMax * 0.9) }}>
                <span className="tracks__maintxt" style={{ fontSize: nameFs }}>{main}</span>
              </span>
            </div>
            {/* phones: both arrows in one row under the name (the column controls are hidden there) */}
            <div className="tracks__mctrl">
              <TrackNav dir={-1} track={prev} label={t("tracks.prev")} onClick={() => go(-1)} />
              <TrackNav dir={1} track={next} label={t("tracks.next")} onClick={() => go(1)} />
            </div>
            <div className="tracks__mapbox">
              <AnimatePresence custom={dir} mode="wait">
                <motion.img key={tr.id} className="tracks__map" src={tr.map} alt={main}
                  custom={dir}
                  initial={{ opacity: 0, x: dir > 0 ? 24 : -24 }}
                  animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir > 0 ? -18 : 18 }}
                  transition={{ duration: 0.22, ease: "easeOut" }} loading="lazy" />
              </AnimatePresence>
            </div>
          </div>

          {/* right: next arrow + stats */}
          <div className="tracks__right">
            <div className="tracks__ctrl">
              <TrackNav dir={1} track={next} label={t("tracks.next")} onClick={() => go(1)} />
            </div>
            {/* same trick as the description: the box is as tall as the tallest track's figures */}
            <div className="tracks__statbox">
              {tracks.map((x) => statList(x, true))}
              {statList(tr, false)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
