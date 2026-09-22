import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";

const LS = "fra_cookies";
export const cookieChoice = () => { try { return localStorage.getItem(LS); } catch { return null; } };

/* Cookie consent — a pit-board card sliding in from the bottom-left, with the checkered edge. */
export default function CookieBar() {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (cookieChoice()) return;
    const id = setTimeout(() => setOpen(true), 1400);
    return () => clearTimeout(id);
  }, []);
  const choose = (v) => { try { localStorage.setItem(LS, v); } catch {} setOpen(false); };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside className="ckb" role="dialog" aria-label={t("ck.title")}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}>
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
      )}
    </AnimatePresence>
  );
}
