import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import "../sections/lightbox.css";

/* Fullscreen photo viewer shared by every gallery on the site (products, Laponia, cars…).
   Usage:  const open = useLightbox();  open(photos, index)  */
const Ctx = createContext(() => {});
export const useLightbox = () => useContext(Ctx);

export function LightboxProvider({ children }) {
  const [state, setState] = useState(null); // { items: string[], i: number }

  const open = useCallback((items, i = 0) => {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (list.length) setState({ items: list, i: Math.max(0, Math.min(list.length - 1, i)) });
  }, []);
  const close = useCallback(() => setState(null), []);
  const step = useCallback((d) => {
    setState((s) => (s ? { ...s, i: (s.i + d + s.items.length) % s.items.length } : s));
  }, []);

  // keyboard + scroll lock while open
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [state, close, step]);

  const multi = state && state.items.length > 1;

  return (
    <Ctx.Provider value={open}>
      {children}
      {createPortal(
        <AnimatePresence>
          {state && (
            <motion.div className="lbx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }} onClick={close}>
              <button className="lbx__x" onClick={close} aria-label="Zamknij">×</button>
              {multi && (
                <>
                  <button className="lbx__nav lbx__nav--prev" aria-label="Poprzednie"
                    onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>
                  <button className="lbx__nav lbx__nav--next" aria-label="Następne"
                    onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>
                </>
              )}
              <motion.img
                key={state.items[state.i]}
                className="lbx__img"
                src={state.items[state.i]}
                alt=""
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 0.8, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
              />
              {multi && <span className="lbx__count">{state.i + 1} / {state.items.length}</span>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
