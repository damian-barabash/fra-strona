import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "../lib/motion";
import { useStore } from "../lib/store";

const LS = "fra_cookies";
export const cookieChoice = () => { try { return localStorage.getItem(LS); } catch { return null; } };

/* pages that stay readable before consent: the policy the card links to, and the admin panel */
const FREE = ["/polityka-prywatnosci", "/regulamin-platnosci", "/admin"];

/* Cookie consent — a full-screen wall: the site stays blocked (no scroll, no clicks) until a choice is made.
   The pit-board card with the checkered edge sits in the middle of a dark blurred scrim. */
export default function CookieBar() {
  const { t } = useStore();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(() => !cookieChoice());
  const open = pending && !FREE.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("ck-lock");
    return () => document.documentElement.classList.remove("ck-lock");
  }, [open]);

  const choose = (v) => { try { localStorage.setItem(LS, v); } catch {} setPending(false); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="ckw" className="ckw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
        <motion.aside className="ckb" role="dialog" aria-modal="true" aria-label={t("ck.title")}
          initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.1 }}>
          <span className="ckb__flag" aria-hidden="true" />
          <div className="ckb__body">
            <span className="ckb__eyebrow">FASTLINE RACING ACADEMY</span>
            <h3 className="ckb__t">{t("ck.title")}</h3>
            <p className="ckb__p">{t("ck.body")} <Link to="/polityka-prywatnosci" className="ckb__more">{t("ck.more")}</Link></p>
            <div className="ckb__btns">
              <button className="btn btn--red ckb__ok" onClick={() => choose("all")}>{t("ck.ok")} <span className="btn__arrow">›</span></button>
              <button className="btn btn--ghost" onClick={() => choose("essential")}>{t("ck.no")}</button>
            </div>
          </div>
        </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
