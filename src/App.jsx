import { Suspense, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { motion } from "./lib/motion";
import Home from "./pages/Home";
import { Pages, preloadRoute } from "./lib/routes";
import CookieBar from "./components/CookieBar";
import WhatsAppFab from "./components/WhatsAppFab";
import SyncIndicator from "./components/SyncIndicator";

const { Mariusz, MediaPage, Szkola, Flota, Auto, Rezerwacja, Kalendarz, Produkty, Produkt, RezerwacjaIce,
  Cennik, Kontakt, Zakup, ZakupWyprawa, Legal, Platnosc, Voucher, DlaFirm, Blog, BlogPost, Admin } = Pages;

/* Old WordPress paths (still in Google and in old links) land on the matching new page; anything
   else that does not exist goes to the home page instead of a blank screen. */
const OLD_PATHS = [
  [/^\/eventy-firmowe/, "/dla-firm"],
  [/^\/samochody/, "/flota"],
  [/^\/produkt(y)?\/?$/, "/oferta"],
  [/^\/produkt\//, "/oferta"],
  [/^\/tory/, "/"],
  [/^\/instruktorzy/, "/"],
  [/^\/o-nas/, "/o-szkole"],
  [/^\/voucher(y)?/, "/voucher"],
  [/^\/(aktualnosci|news|category|tag|author)(\/|$)/, "/blog"],
];
function NotFound() {
  const { pathname } = useLocation();
  const hit = OLD_PATHS.find(([re]) => re.test(pathname));
  return <Navigate to={hit ? hit[1] : "/"} replace />;
}

/* Racing "curtain" between pages: a checkered-flag panel wipes in from the left to
   cover the old page, then flies off to the right revealing the new one. It only
   plays on in-app navigation (route change) — never on a direct hit / reload. */
function AnimatedRoutes() {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(location);
  const [anim, setAnim] = useState("idle"); // idle | cover | reveal
  const first = useRef(true);

  // Going back (browser button or WSTECZ) lands where the visitor left that page, not at its top:
  // the scroll offset is remembered per history entry and put back once the page is rendered again.
  const navType = useNavigationType();
  const scrolls = useRef(new Map());
  const shown = useRef(displayed);
  shown.current = displayed;
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    // the URL changes before the curtain swaps pages — from then on the old page's offset is frozen
    const save = () => { if (window.location.pathname === shown.current.pathname) scrolls.current.set(shown.current.key, window.scrollY); };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);
  const restoreScroll = (y) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!y) return;
    let n = 0;
    const tick = () => {
      // wait until the page is tall enough (content lands a frame or two after the route swap)
      const ok = document.documentElement.scrollHeight - window.innerHeight >= y;
      if (ok || n > 60) window.scrollTo({ top: y, behavior: "instant" });
      if ((!ok && n <= 60) || n < 3) { n += 1; requestAnimationFrame(tick); }
    };
    requestAnimationFrame(tick);
  };

  // Reconciles on every change of location/displayed/anim, so a click that lands *while* the
  // curtain is still flying off can't strand the app on the previous route: whenever the URL
  // and the rendered route disagree and we're not already covering, we cover again.
  useEffect(() => {
    if (first.current) { first.current = false; return; }         // direct entry → no wipe
    if (location.pathname === displayed.pathname) {
      if (location !== displayed) setDisplayed(location);          // hash / query on the same page
      return;
    }
    if (anim !== "cover") setAnim("cover");
  }, [location, displayed, anim]);

  const onComplete = (def) => {
    // the curtain stays down until the next page's chunk is in (usually already prefetched)
    if (def === "cover") {
      const target = location;
      const y = navType === "POP" ? scrolls.current.get(target.key) : 0;
      preloadRoute(target.pathname).then(() => { setDisplayed(target); restoreScroll(y); setAnim("reveal"); });
    }
    else if (def === "reveal") setAnim("idle");                    // the effect re-covers if the URL moved on
  };

  const variants = { idle: { x: "-100%" }, cover: { x: "0%" }, reveal: { x: "100%" } };

  return (
    <>
      <Suspense fallback={null}>
      <Routes location={displayed}>
        <Route path="/" element={<Home />} />
        <Route path="/mariusz-miekos-racing" element={<Mariusz />} />
        <Route path="/media-o-nas" element={<MediaPage />} />
        <Route path="/o-szkole" element={<Szkola />} />
        <Route path="/flota" element={<Flota />} />
        <Route path="/flota/:slug" element={<Auto />} />
        <Route path="/kalendarz" element={<Kalendarz />} />
        <Route path="/cennik" element={<Cennik />} />
        <Route path="/kontakt" element={<Kontakt />} />
        <Route path="/produkty" element={<Produkty />} />
        <Route path="/oferta" element={<Produkty />} />
        <Route path="/dla-firm" element={<DlaFirm />} />
        <Route path="/voucher" element={<Voucher />} />
        <Route path="/platnosc" element={<Platnosc />} />
        <Route path="/produkty/:slug" element={<Produkt />} />
        <Route path="/rezerwacja" element={<Rezerwacja />} />
        <Route path="/rezerwacja-ice" element={<RezerwacjaIce />} />
        <Route path="/zakup" element={<Zakup />} />
        <Route path="/zakup-wyprawa" element={<ZakupWyprawa />} />
        {/* legal docs — kept under the exact old-site paths so links survive the domain switch */}
        <Route path="/polityka-prywatnosci" element={<Legal slug="polityka-prywatnosci" />} />
        <Route path="/regulamin-platnosci" element={<Legal slug="regulamin-platnosci" />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      <motion.div
        className="rt-curtain" aria-hidden="true"
        initial="idle" animate={anim} variants={variants}
        transition={anim === "idle" ? { duration: 0 } : { duration: 0.52, ease: [0.76, 0, 0.24, 1] }}
        onAnimationComplete={onComplete}
        style={{ pointerEvents: anim === "idle" ? "none" : "auto" }}
      >
        <div className="rt-curtain__flag" />
        <div className="rt-curtain__streaks">{[0, 1, 2, 3].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
        <img src="/assets/ui/logo_dark.webp" alt="" className="rt-curtain__logo" decoding="async" />
        <span className="rt-curtain__edge" />
      </motion.div>
    </>
  );
}

export default function App() {
  return (
    <>
      <AnimatedRoutes />
      <WhatsAppFab />
      <SyncIndicator />
      <CookieBar />
    </>
  );
}
