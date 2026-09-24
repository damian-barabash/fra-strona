import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import { EMedia, EText } from "../components/Editable";

/* Racing quotes under the tagline: a random one first, then another random one every 10 s,
   swapped with a soft blur/slide. Text lives in the CMS key hero.quotes ("Author | Quote" per line). */
function HeroQuotes({ raw }) {
  const quotes = useMemo(() => String(raw || "").split("\n").map((l) => {
    const [a, ...q] = l.split("|"); return { a: (a || "").trim(), q: q.join("|").trim() };
  }).filter((x) => x.q), [raw]);
  const [i, setI] = useState(() => Math.floor(Math.random() * 100));
  useEffect(() => {
    if (quotes.length < 2) return;
    const id = setInterval(() => setI((cur) => { let n; do { n = Math.floor(Math.random() * quotes.length); } while (n === cur % quotes.length); return n; }), 10000);
    return () => clearInterval(id);
  }, [quotes.length]);
  if (!quotes.length) return null;
  const cur = quotes[i % quotes.length];
  return (
    <div className="hero__quote" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.blockquote key={i % quotes.length}
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
          transition={{ duration: 0.8, ease: [0.16, 0.8, 0.3, 1] }}>
          <p>“{cur.q}”</p>
          <cite>{cur.a}</cite>
        </motion.blockquote>
      </AnimatePresence>
    </div>
  );
}

export default function Hero() {
  const { media, cmsMode, isAdmin, t } = useStore();
  const wrapRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const editing = cmsMode && isAdmin;

  const toggle = () => {
    const v = wrapRef.current?.querySelector("video");
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  // parallax on the video for depth
  useEffect(() => {
    const onScroll = () => {
      const v = wrapRef.current?.querySelector("video");
      if (v) v.style.transform = `translateY(${Math.min(window.scrollY * 0.25, 200)}px) scale(1.06)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="hero" id="top">
      <div className="hero__media" ref={wrapRef}>
        {editing
          ? <EMedia id="hero.video" kind="video" className="hero__vid"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <video src={media("hero.video")} autoPlay loop muted playsInline
              style={{ willChange: "transform" }} />}
      </div>
      <div className="hero__scrim" />

      {/* centred wordmark */}
      <div className="hero__center">
        <EText id="hero.eyebrow" as="span" className="hero__eyebrow" />
        <EText id="hero.title" as="h1" className="hero__wordmark" multiline />
        <span className="hero__rule"><i /></span>
        <EText id="hero.tag" as="p" className="hero__tag" />
        <HeroQuotes raw={t("hero.quotes")} />
      </div>

      <div className="hero__controls">
        <button className="hero__playbtn" onClick={toggle} aria-label={playing ? "pauza" : "odtwórz"}>
          {playing ? (
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
              <rect x="1" y="0" width="5" height="18" rx="1" fill="#fff" />
              <rect x="10" y="0" width="5" height="18" rx="1" fill="#fff" />
            </svg>
          ) : (
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
              <path d="M2 1.3v15.4c0 .8.9 1.3 1.6.9l12-7.7a1 1 0 000-1.7l-12-7.7A1 1 0 002 1.3z" fill="#fff" />
            </svg>
          )}
        </button>
      </div>
      <a href="#programy" className="hero__scroll">
        <img src="/assets/ui/mouse.webp" alt="" />
        <span>{t("hero.scrollHint")}</span>
      </a>
    </section>
  );
}
