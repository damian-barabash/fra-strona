import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { cookieChoice } from "./CookieBar";
import { automated } from "../lib/popup";
import { BW_PATH, bwOn, bwSeen, bwMinimise, bwAllowedOn } from "../lib/blackweek";
import "./bwpopup.css";

/* Black Friday Weeks pop-up. Every new visit (new tab session) opens it once, as soon as the cookie
   choice is made. Closing it does not make it disappear: the card shrinks into the bottom-left corner
   and stays there as a small badge for the rest of the visit — one click opens the configurator.
   Off (panel switch), for bots / prerender, in the panel, in checkouts and on the campaign page: nothing. */
const PILL = { left: 16, bottom: 16, w: 232, wM: 172 };

export default function BlackWeekPopup() {
  const { raw, isAdmin, cmsMode } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const on = bwOn(raw);
  const [state, setState] = useState(() => (bwSeen() ? "min" : "wait"));   // wait | open | closing | min
  const [fly, setFly] = useState(null);
  const card = useRef(null);
  const where = useRef(pathname); where.current = pathname;
  const bot = useRef(automated()).current;

  // open once the visitor can see the site (after the cookie choice), on a page where an advert is allowed
  useEffect(() => {
    if (!on || bot || state !== "wait") return;
    let t0 = 0;
    const iv = setInterval(() => {
      if (document.visibilityState !== "visible" || !cookieChoice() || !bwAllowedOn(where.current)) { t0 = 0; return; }
      if (!t0) t0 = Date.now();
      if (Date.now() - t0 >= 700) { clearInterval(iv); setState("open"); }
    }, 150);
    return () => clearInterval(iv);
  }, [on, bot, state]);

  // the picture is fetched in the background so the card never opens empty
  useEffect(() => { if (on && !bot) { const im = new Image(); im.src = window.innerWidth <= 760 ? "/assets/bw/banner-m.webp" : "/assets/bw/banner.webp"; } }, [on, bot]);

  // moved to a checkout while it was open → it goes to the corner
  useEffect(() => { if (state === "open" && !bwAllowedOn(pathname)) { bwMinimise(); setState("min"); } }, [pathname, state]);

  useEffect(() => {
    if (state !== "open") return;
    const key = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    document.documentElement.classList.add("bwp-lock");
    return () => { window.removeEventListener("keydown", key); document.documentElement.classList.remove("bwp-lock"); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* close = the card flies into the corner where the badge appears (FLIP: measured, then one transform) */
  function close() {
    if (state !== "open") return;
    bwMinimise();
    const el = card.current;
    const r = el?.getBoundingClientRect();
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setState("min"); return; }
    const w = window.innerWidth <= 560 ? PILL.wM : PILL.w;
    const s = w / r.width;
    const tx = PILL.left - r.left, ty = window.innerHeight - PILL.bottom - r.height * s - r.top;
    setFly({ transform: `translate(${tx}px, ${ty}px) scale(${s})` });
    setState("closing");
    setTimeout(() => { setState("min"); setFly(null); }, 640);
  }
  const go = () => { bwMinimise(); setState("min"); navigate(BW_PATH); };

  if (!on || bot || (isAdmin && cmsMode)) return null;

  if (state === "min") {
    if (!bwAllowedOn(pathname)) return null;
    return (
      <button type="button" className="bwp-pill" onClick={go} aria-label="Black Friday Weeks — sprawdź ofertę">
        <span className="bwp-pill__img"><img src="/assets/bw/banner-m.webp" alt="" width="960" height="540" decoding="async" /></span>
        <span className="bwp-pill__cta">SPRAWDŹ OFERTĘ <i>›</i></span>
      </button>
    );
  }
  if (state !== "open" && state !== "closing") return null;
  return (
    <div className={`bwp ${state === "closing" ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="Black Friday Weeks">
      <div className="bwp__bg" onClick={close} />
      <div className="bwp__card" ref={card} style={fly || undefined}>
        <div className="bwp__art">
          <picture>
            <source media="(max-width: 760px)" srcSet="/assets/bw/banner-m.webp" />
            <img src="/assets/bw/banner.webp" alt="Black Friday Weeks — Fastline Racing Academy" width="1920" height="1080" decoding="async" />
          </picture>
          <span className="bwp__sweep" aria-hidden="true" />
          <button type="button" className="bwp__cta bw-silver" onClick={go}>SPRAWDŹ OFERTĘ <i>›</i></button>
        </div>
        <button type="button" className="bwp__x" onClick={close} aria-label="Zamknij">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
      </div>
    </div>
  );
}
