import { useSyncExternalStore } from "react";

/* Admin sync tracker — the panel is optimistic: every change shows up immediately and is sent to the
   server in the background. This module counts what is still in flight, keeps failed operations
   (with a retry), serialises operations on the same record, and warns before the tab is closed while
   something is unsaved. The <SyncIndicator> in the corner renders its state. */

let state = { pending: 0, errors: [], okAt: 0 };
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export const useSync = () => useSyncExternalStore(subscribe, () => state, () => state);
export const hasUnsaved = () => state.pending > 0;

// admin-api actions that change data (mirrors MUTATING in the edge function); reads are not tracked
export const isMutation = (action) => /\.(upsert|delete|reorder|set|save|upload|markPaid|resendMail|cancel|create|update)$/.test(action || "");

let seq = 0;
/** Runs `run()` (→ admin-api result `{ ok, … }`) as a tracked operation. On failure `rollback()` undoes
 *  the optimistic change and the error is listed with a retry. Always resolves to the API result. */
export async function track(label, run, rollback) {
  emit({ pending: state.pending + 1 });
  let r;
  try { r = await run(); } catch (e) { r = { ok: false, error: e?.message || "network" }; }
  if (!r || r.ok === false) {
    try { rollback?.(); } catch {}
    const id = ++seq;
    const retry = () => { dismiss(id); return track(label, run, rollback); };
    emit({ pending: state.pending - 1, errors: [...state.errors, { id, label, error: humanError(r?.error), retry }] });
  } else {
    emit({ pending: state.pending - 1, okAt: Date.now() });
  }
  return r || { ok: false };
}

export const dismiss = (id) => emit({ errors: state.errors.filter((e) => e.id !== id) });

/* operations on the same key (e.g. "cars:12", "content:hero.title") run one after another, in order */
const chains = new Map();
export function chain(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  chains.set(key, next);
  next.finally(() => { if (chains.get(key) === next) chains.delete(key); });
  return next;
}

function humanError(e) {
  if (!e) return "brak odpowiedzi serwera";
  if (e === "forbidden") return "brak uprawnień";
  if (/network|fetch|Failed/i.test(e)) return "brak połączenia";
  return String(e).slice(0, 120);
}

// closing / reloading the tab while something is still being saved → the browser's "leave site?" dialog
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (state.pending > 0) { e.preventDefault(); e.returnValue = ""; return ""; }
  });
}
