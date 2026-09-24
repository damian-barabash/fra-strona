import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Home from "./pages/Home";
import Mariusz from "./pages/Mariusz";
import MediaPage from "./pages/MediaPage";
import Szkola from "./pages/Szkola";
import Flota from "./pages/Flota";
import Auto from "./pages/Auto";
import Rezerwacja from "./pages/Rezerwacja";
import Kalendarz from "./pages/Kalendarz";
import Produkty from "./pages/Produkty";
import Produkt from "./pages/Produkt";
import RezerwacjaIce from "./pages/RezerwacjaIce";
import Cennik from "./pages/Cennik";
import Kontakt from "./pages/Kontakt";
import Zakup from "./pages/Zakup";
import ZakupWyprawa from "./pages/ZakupWyprawa";
import Legal from "./pages/Legal";
import Platnosc from "./pages/Platnosc";
import Voucher from "./pages/Voucher";
import DlaFirm from "./pages/DlaFirm";
import CookieBar from "./components/CookieBar";
import WhatsAppFab from "./components/WhatsAppFab";

const Admin = lazy(() => import("./pages/Admin"));

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
    if (def === "cover") { setDisplayed(location); window.scrollTo(0, 0); setAnim("reveal"); }
    else if (def === "reveal") setAnim("idle");                    // the effect re-covers if the URL moved on
  };

  const variants = { idle: { x: "-100%" }, cover: { x: "0%" }, reveal: { x: "100%" } };

  return (
    <>
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
        <Route path="/admin" element={<Suspense fallback={<div />}><Admin /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <motion.div
        className="rt-curtain" aria-hidden="true"
        initial="idle" animate={anim} variants={variants}
        transition={anim === "idle" ? { duration: 0 } : { duration: 0.52, ease: [0.76, 0, 0.24, 1] }}
        onAnimationComplete={onComplete}
        style={{ pointerEvents: anim === "idle" ? "none" : "auto" }}
      >
        <div className="rt-curtain__flag" />
        <div className="rt-curtain__streaks">{[0, 1, 2, 3].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
        <img src="/assets/ui/logo_dark.webp" alt="" className="rt-curtain__logo" />
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
      <CookieBar />
    </>
  );
}
