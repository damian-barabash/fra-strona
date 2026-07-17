import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { EMedia, EText } from "../components/Editable";

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
