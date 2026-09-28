import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "../lib/store";
import { useSync, dismiss } from "../lib/sync";

/* Bottom-right sync badge for logged-in admins (panel and inline editing on the site):
   syncing (spinner + count) · all saved (green check) · not saved (red, click → list with retry). */
export default function SyncIndicator() {
  const { isAdmin } = useStore();
  const { pending, errors, okAt } = useSync();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);

  // "Zapisano" pops for a moment after the last save finishes, then the badge settles down
  useEffect(() => {
    if (!okAt || pending) return;
    setFresh(true);
    const id = setTimeout(() => setFresh(false), 2600);
    return () => clearTimeout(id);
  }, [okAt, pending]);
  useEffect(() => { if (!errors.length) setOpen(false); }, [errors.length]);

  if (!isAdmin) return null;
  const st = errors.length ? "err" : pending ? "sync" : "ok";
  const onSite = !pathname.startsWith("/admin");

  return (
    <div className={`sync sync--${st} ${fresh && st === "ok" ? "sync--fresh" : ""} ${onSite ? "sync--site" : ""}`} role="status" aria-live="polite">
      {open && errors.length > 0 && (
        <div className="sync__list">
          <div className="sync__listhead">Nie zapisano na serwerze</div>
          {errors.map((e) => (
            <div className="sync__item" key={e.id}>
              <div><b>{e.label}</b><span>{e.error}</span></div>
              <button type="button" className="sync__retry" onClick={() => e.retry()}>Ponów</button>
              <button type="button" className="sync__x" onClick={() => dismiss(e.id)} aria-label="Ukryj">×</button>
            </div>
          ))}
          <p className="sync__note">Zmiany cofnięto na ekranie. „Ponów” wyśle je jeszcze raz.</p>
        </div>
      )}
      <button type="button" className="sync__pill" onClick={() => errors.length && setOpen((v) => !v)} title={st === "sync" ? "Zmiany są wysyłane na serwer — nie zamykaj karty" : undefined}>
        <span className="sync__ico" aria-hidden="true">
          {st === "sync" && <span className="sync__spin" />}
          {st === "ok" && <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {st === "err" && <b>!</b>}
        </span>
        <span className="sync__txt">
          {st === "sync" && <>Synchronizuję…{pending > 1 && <em>{pending}</em>}</>}
          {st === "ok" && (fresh ? "Zapisano" : "Wszystko zapisane")}
          {st === "err" && <>Nie zapisano <em>{errors.length}</em>{pending > 0 && <small> · wysyłam {pending}</small>}</>}
        </span>
      </button>
    </div>
  );
}
