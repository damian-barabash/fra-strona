import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { cookieChoice } from "./CookieBar";
import { automated, dismiss, firstView, isExternal, popupAllowedOn, saveTimeOnSite, timeOnSite, touch, wasDismissed } from "../lib/popup";

// the layout (and the text sanitiser it needs) is fetched only when there is a pop-up to show
const PopupView = lazy(() => import("./PopupView"));
const hit = (id, kind) => { try { supabase.rpc("popup_hit", { p_id: id, p_kind: kind }).then(() => {}, () => {}); } catch { /* counters are best-effort */ } };

/* The advertising pop-up on the site. The one switched on in the panel appears after its delay —
   counted as time actually spent on the site (tab visible, cookie choice made), across pages and
   reloads of one visit. Closing it (cross, dark area, Esc, or following its button) keeps it closed
   for the rest of the visit; see lib/popup.js for what counts as a new visit. */
export default function SitePopup() {
  const { popup, lang, cmsMode, isAdmin } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState(false);
  const [closed, setClosed] = useState(false);
  const where = useRef(pathname); where.current = pathname;
  const quiet = useRef(cmsMode); quiet.current = cmsMode;
  const id = popup?.id;

  useEffect(() => { setOpen(false); setOut(false); setClosed(!id || automated() || wasDismissed(id)); }, [id]);

  // wait: the clock runs only while the visitor can actually see the site
  useEffect(() => {
    if (!id || closed || open) return;
    const need = Math.max(0, Number(popup.delay_sec) || 0) * 1000;
    // the photo is fetched during the wait, so the block never opens half-empty
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    const src = (narrow && popup.image_mobile) || popup.image || popup.image_mobile;
    let imgReady = !src;
    if (src) { const im = new Image(); im.onload = im.onerror = () => { imgReady = true; }; im.src = src; }
    import("./PopupView");
    let spent = timeOnSite(), last = Date.now(), n = 0;
    const iv = setInterval(() => {
      const now = Date.now(), dt = Math.min(now - last, 1000); last = now;
      if (document.visibilityState !== "visible" || !cookieChoice()) return;
      spent += dt;
      if ((n += 1) % 4 === 0) saveTimeOnSite(spent);
      if (spent >= need && imgReady && !quiet.current && popupAllowedOn(popup, where.current)) {
        saveTimeOnSite(spent); setOpen(true);
      }
    }, 250);
    return () => { clearInterval(iv); saveTimeOnSite(spent); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, closed, open, popup?.delay_sec, popup?.image, popup?.image_mobile, popup?.pages]);

  useEffect(() => { if (open && id && !isAdmin && firstView(id)) hit(id, "view"); }, [open, id, isAdmin]);

  // a closed pop-up stays closed while the visit lasts: its last sign of life is refreshed until the tab goes away
  useEffect(() => {
    if (!id || !closed || automated() || !wasDismissed(id)) return;
    const beat = () => touch(id);
    const iv = setInterval(beat, 20000);
    const vis = () => { if (document.visibilityState === "hidden") beat(); };
    window.addEventListener("pagehide", beat); document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); window.removeEventListener("pagehide", beat); document.removeEventListener("visibilitychange", vis); };
  }, [id, closed]);

  const close = () => {
    if (!open || out) return;
    dismiss(id); setOut(true);
    setTimeout(() => { setOpen(false); setOut(false); setClosed(true); }, 280);
  };
  const go = (e, href, kind) => {
    if (!isAdmin && kind === "button") hit(id, "click");
    // a page of this site opens through the router (with the curtain); anything else is left to the browser
    const inApp = !isExternal(href) && href.startsWith("/") && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.target.closest?.("a")?.target !== "_blank";
    if (inApp) { e.preventDefault(); navigate(href); }
    close();
  };

  if (!popup || !open) return null;
  return <Suspense fallback={null}><PopupView p={popup} lang={lang} onClose={close} onGo={go} out={out} /></Suspense>;
}
