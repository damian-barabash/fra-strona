import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { normCode } from "../lib/discount";
import { fmtMoney } from "../lib/vat";

/* ============ KODY RABATOWE ============
   Single-use codes the customer types in a configurator.
   · KWOTOWY — X zł off the gross amount of any purchase (a cheaper product is covered entirely)
   · NA PRODUKT — bound to a product / package / car: the whole item, a % or an amount; typing it takes
     the customer to that product's configurator with the choice preset
   Codes are added by hand, generated as a series (e.g. 200 × 100 zł) or imported from a file; all three
   share the same settings. A code is reserved while its order waits for the payment, spent when it is paid. */

const STATE = {
  active: ["Aktywny", "ok"], used: ["Wykorzystany", "info"], reserved: ["W płatności", "warn"],
  off: ["Wyłączony", "off"], expired: ["Wygasł", "bad"], early: ["Jeszcze nie działa", "off"],
};
const FILTERS = [["", "Wszystkie"], ["active", "Aktywne"], ["used", "Wykorzystane"], ["reserved", "W płatności"], ["expired", "Wygasłe"], ["off", "Wyłączone"]];
const TKIND = { track: "Szkolenie na torze", ice: "Laponia", product: "Program „kup teraz”", trip: "Wyprawa" };
const PAGE = 150;
// variant lines of a "buy now" product ("Alpine A110S — 999 zł netto · …") — same parsing as /zakup and the checkout
const parseVariants = (txt) => String(txt || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("## "))
  .map((l) => l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł/i)).filter(Boolean).map((m) => ({ name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10) }));
const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const day = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const when = (s) => (s ? new Date(s).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function stateOf(c) {
  if (c.used_at) return "used";
  if (c.reserved_until && new Date(c.reserved_until) > new Date()) return "reserved";
  if (!c.active) return "off";
  const d = todayIso();
  if (c.valid_to && d > c.valid_to) return "expired";
  if (c.valid_from && d < c.valid_from) return "early";
  return "active";
}
export const valueOf = (c) => (c.kind === "amount" || c.value_type === "amount" ? `−${Number(c.value).toLocaleString("pl-PL")} zł`
  : c.value_type === "percent" ? `−${Number(c.value).toLocaleString("pl-PL")}%` : "cały produkt");

/* what a product code is for, from the panel's own lists */
function useTargetLabel() {
  const { getters } = useStore();
  return (c) => {
    if (c.kind !== "product") return "Dowolny zakup";
    const t = c.target || {};
    if (t.kind === "track") {
      const car = t.car_id === "own" ? "własne auto" : t.car_id ? ((getters.cars || []).find((x) => x.id === t.car_id)?.name || "auto (usunięte)") : "dowolne auto";
      return `Szkolenie · ${car}${t.sessions ? ` · ${t.sessions} sesji` : " · dowolny pakiet"}`;
    }
    if (t.kind === "ice") return `Laponia · ${t.package_id ? ((getters.ice_packages || []).find((x) => x.id === t.package_id)?.name_pl || "pakiet (usunięty)") : "dowolny pakiet"}`;
    if (t.kind === "product") return `${(getters.products || []).find((x) => x.slug === t.slug)?.title_pl || t.slug}${t.variant ? ` · ${t.variant}` : ""}`;
    if (t.kind === "trip") {
      const pk = t.package_id ? (getters.trip_packages || []).find((x) => x.id === t.package_id) : null;
      const slug = t.slug || pk?.product_slug;
      return `${(getters.products || []).find((x) => x.slug === slug)?.title_pl || slug || "Wyprawa"} · ${pk?.name_pl || "dowolny pakiet"}`;
    }
    return "—";
  };
}

/* Excel-friendly CSV (semicolons, BOM) */
function downloadCsv(rows, label, orders, name) {
  const head = ["kod", "wartość", "dotyczy", "ważny od", "ważny do", "status", "seria", "notatka", "zamówienie", "klient"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((c) => {
    const o = orders?.[c.used_booking || c.reserved_booking];
    return [c.code, valueOf(c), label(c), c.valid_from || "", c.valid_to || "", STATE[stateOf(c)][0], c.batch || "", c.note || "", o ? `#${o.number}` : "", c.used_email || ""].map(q).join(";");
  });
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name || "kody-rabatowe"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function CodesTab() {
  const { adminCall } = useStore();
  const label = useTargetLabel();
  const [rows, setRows] = useState(null);
  const [orders, setOrders] = useState({});
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState("");
  const [batch, setBatch] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [shown, setShown] = useState(PAGE);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => adminCall("discounts.list").then((r) => { if (r.ok) { setRows(r.rows); setOrders(r.orders || {}); } else setRows([]); });
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const all = rows || [];
  const batches = useMemo(() => [...new Set(all.map((c) => c.batch).filter(Boolean))].sort(), [all]);
  const list = useMemo(() => all
    .filter((c) => !filter || stateOf(c) === filter)
    .filter((c) => !kind || c.kind === kind)
    .filter((c) => !batch || c.batch === batch)
    .filter((c) => !q.trim() || `${c.code} ${c.note || ""} ${c.batch || ""} ${c.used_email || ""} ${label(c)}`.toLowerCase().includes(q.trim().toLowerCase())),
  [all, filter, kind, batch, q]); // eslint-disable-line
  useEffect(() => { setShown(PAGE); }, [filter, kind, batch, q]);

  const stats = useMemo(() => {
    const s = { active: 0, used: 0, reserved: 0, dead: 0, given: 0 };
    all.forEach((c) => {
      const st = stateOf(c);
      if (st === "active") s.active++; else if (st === "used") s.used++; else if (st === "reserved") s.reserved++; else s.dead++;
      const o = orders[c.used_booking];
      if (st === "used" && o) s.given += Number(o.discount_pln) || 0;
    });
    return s;
  }, [all, orders]);

  const selected = list.filter((c) => sel.has(c.id));
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = list.length > 0 && list.every((c) => sel.has(c.id));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(list.map((c) => c.id)));

  const copy = (code) => { navigator.clipboard?.writeText(code); setCopied(code); setTimeout(() => setCopied(""), 1400); };
  const patch = async (ids, p) => {
    if (!ids.length) return;
    setRows((l) => l.map((c) => (ids.includes(c.id) ? { ...c, ...p } : c)));
    const r = await adminCall("discounts.update", { ids, patch: p });
    if (!r.ok) { alert("Nie udało się zapisać: " + (r.error || "")); reload(); }
  };
  const remove = async (ids) => {
    const list2 = all.filter((c) => ids.includes(c.id));
    const keep = list2.filter((c) => c.used_at || stateOf(c) === "reserved").length;
    if (!confirm(`Usunąć ${ids.length === 1 ? `kod ${list2[0]?.code}` : `${ids.length} kodów`}?${keep ? `\n\n${keep} z nich jest wykorzystanych lub w trakcie płatności — te zostaną (możesz je wyłączyć).` : ""}`)) return;
    setBusy(true);
    const r = await adminCall("discounts.delete", { ids });
    setBusy(false);
    if (!r.ok) { alert("Nie udało się usunąć: " + (r.error || "")); return; }
    const gone = new Set(r.deleted || []);
    setRows((l) => l.filter((c) => !gone.has(c.id)));
    setSel(new Set());
  };
  const release = async (c) => {
    if (!confirm(`Zwolnić kod ${c.code}? Zamówienie, które go trzyma, nie zostało jeszcze opłacone — po zwolnieniu kod może wykorzystać ktoś inny.`)) return;
    const r = await adminCall("discounts.release", { id: c.id });
    if (r.ok) reload(); else alert(r.error || "Błąd");
  };

  return (
    <div className="dc">
      <div className="adm-head">
        <div><h2>Kody rabatowe <span className="adm-count">{all.length}</span></h2>
          <p className="adm-sub">Klient wpisuje kod w konfiguratorze (pole na dole pierwszego kroku albo przy cenie). <b>Każdy kod działa jeden raz.</b> Kod <b>kwotowy</b> odejmuje kwotę od ceny brutto dowolnego zakupu — gdy produkt jest tańszy, kod pokrywa całość (reszta przepada). Kod <b>na produkt</b> przenosi klienta do konfiguratora tego produktu i obejmuje jedno miejsce. Kod jest zarezerwowany na czas płatności i zużyty dopiero po jej potwierdzeniu.</p></div>
        <button className="adm-btn adm-btn--red" onClick={() => setCreating(true)}>+ Nowe kody</button>
      </div>

      <div className="dc-kpis">
        <button className={filter === "active" ? "on" : ""} onClick={() => setFilter(filter === "active" ? "" : "active")}><b>{stats.active}</b><span>aktywnych</span></button>
        <button className={filter === "used" ? "on" : ""} onClick={() => setFilter(filter === "used" ? "" : "used")}><b>{stats.used}</b><span>wykorzystanych · {fmtMoney(stats.given)} rabatu</span></button>
        <button className={filter === "reserved" ? "on" : ""} onClick={() => setFilter(filter === "reserved" ? "" : "reserved")}><b>{stats.reserved}</b><span>w trakcie płatności</span></button>
        <button className={filter === "expired" || filter === "off" ? "on" : ""} onClick={() => setFilter(filter === "expired" ? "" : "expired")}><b>{stats.dead}</b><span>wygasłych / wyłączonych</span></button>
      </div>

      <div className="adm-toolbar">
        <div className="adm-chips">{FILTERS.map(([k, l]) => <button key={k} className={`adm-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <select className="adm-select dc-sel" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Każdy rodzaj</option><option value="amount">Kwotowe</option><option value="product">Na produkt</option>
        </select>
        {!!batches.length && (
          <select className="adm-select dc-sel" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Każda seria</option>{batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <input className="adm-search" placeholder="Szukaj: kod, seria, notatka, e-mail klienta…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>

      {(selected.length > 0 || batch) && (
        <div className="dc-bulk">
          <span>{selected.length ? <>Zaznaczone: <b>{selected.length}</b></> : <>Seria <b>{batch}</b>: {list.length} kodów</>}</span>
          {(() => { const ids = (selected.length ? selected : list).map((c) => c.id); const free = (selected.length ? selected : list).filter((c) => !c.used_at); return (<>
            <button className="adm-mini" disabled={busy} onClick={() => patch(free.map((c) => c.id), { active: false })}>Wyłącz</button>
            <button className="adm-mini" disabled={busy} onClick={() => patch(free.map((c) => c.id), { active: true })}>Włącz</button>
            <ValidTo onSet={(v) => patch(free.map((c) => c.id), { valid_to: v })} />
            <button className="adm-mini" onClick={() => downloadCsv(selected.length ? selected : list, label, orders, batch || "kody-rabatowe")}>Pobierz CSV</button>
            <button className="adm-mini adm-mini--del" disabled={busy} onClick={() => remove(ids)}>Usuń</button>
            {selected.length > 0 && <button className="adm-mini" onClick={() => setSel(new Set())}>Odznacz</button>}
          </>); })()}
        </div>
      )}

      {rows === null ? <div className="adm-empty">Ładowanie…</div> : !list.length ? (
        <div className="adm-empty">{all.length ? "Brak kodów dla tego filtra." : "Nie ma jeszcze żadnego kodu. Kliknij „+ Nowe kody”."}</div>
      ) : (
        <div className="adm-table dc-table">
          <div className="adm-tr adm-tr--head dc-tr">
            <span><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Zaznacz wszystkie" /></span>
            <span>Kod</span><span>Wartość</span><span>Dotyczy</span><span>Ważność</span><span>Status</span><span />
          </div>
          {list.slice(0, shown).map((c) => {
            const st = stateOf(c);
            const o = orders[c.used_booking || c.reserved_booking];
            return (
              <div key={c.id} className={`adm-tr dc-tr ${sel.has(c.id) ? "is-sel" : ""}`}>
                <span><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={c.code} /></span>
                <span className="dc-code">
                  <button type="button" onClick={() => copy(c.code)} title="Kopiuj">{c.code}<i>{copied === c.code ? "skopiowano" : "kopiuj"}</i></button>
                  {(c.batch || c.note) && <small>{[c.batch, c.note].filter(Boolean).join(" · ")}</small>}
                </span>
                <span className="dc-val"><b>{valueOf(c)}</b><small>{c.kind === "amount" ? "kwotowy · brutto" : "na produkt"}</small></span>
                <span className="dc-target">{label(c)}</span>
                <span className="dc-dates">{c.valid_from || c.valid_to ? <>{c.valid_from ? `od ${day(c.valid_from)}` : ""}{c.valid_from && c.valid_to ? <br /> : ""}{c.valid_to ? `do ${day(c.valid_to)}` : ""}</> : <small>bez limitu</small>}</span>
                <span className="dc-st">
                  <i className={`adm-badge adm-badge--${STATE[st][1]}`}>{STATE[st][0]}</i>
                  {o && <small>#{o.number} · {o.full_name}</small>}
                  {st === "used" && <small>{when(c.used_at)}</small>}
                  {st === "reserved" && <small>do {when(c.reserved_until)}</small>}
                </span>
                <span className="dc-ops">
                  {!c.used_at && <button className="adm-mini" onClick={() => patch([c.id], { active: !c.active })}>{c.active ? "Wyłącz" : "Włącz"}</button>}
                  {st === "reserved" && <button className="adm-mini" onClick={() => release(c)}>Zwolnij</button>}
                  {!c.used_at && st !== "reserved" && <button className="adm-mini adm-mini--del" onClick={() => remove([c.id])}>Usuń</button>}
                </span>
              </div>
            );
          })}
          {list.length > shown && <button className="dc-more" onClick={() => setShown((n) => n + PAGE * 2)}>Pokaż więcej ({list.length - shown})</button>}
        </div>
      )}

      {creating && <CreateCodes onClose={() => setCreating(false)} onDone={(made) => { setRows((l) => [...made, ...(l || [])]); }} label={label} existingBatches={batches} />}
    </div>
  );
}

function ValidTo({ onSet }) {
  const [v, setV] = useState("");
  return (
    <span className="dc-validto">
      <input type="date" value={v} onChange={(e) => setV(e.target.value)} aria-label="Ważny do" />
      <button className="adm-mini" disabled={!v} onClick={() => onSet(v)}>Ustaw „ważny do”</button>
    </span>
  );
}

/* ---------------- new codes: by hand · series · file ---------------- */
const MODES = [["manual", "Wpisz ręcznie"], ["series", "Wygeneruj serię"], ["file", "Import z pliku"]];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const sample = (prefix, len) => {
  const body = Array.from(crypto.getRandomValues(new Uint8Array(len)), (x) => ALPHA[x % ALPHA.length]).join("").match(/.{1,4}/g).join("-");
  return prefix ? `${prefix}-${body}` : body;
};
/* a file → codes: one per line; CSV/TSV → the first column; a header row ("kod", "code") is skipped */
function codesFromText(txt) {
  return String(txt || "").split(/\r?\n/).map((l) => l.split(/[;,\t]/)[0].replace(/^"|"$/g, "").trim()).filter(Boolean)
    .filter((c, i) => !(i === 0 && /^(kod|kody|code|codes|voucher)$/i.test(c)));
}

function CreateCodes({ onClose, onDone, label, existingBatches }) {
  const { adminCall, getters } = useStore();
  const [mode, setMode] = useState("series");
  const [manual, setManual] = useState("");
  const [count, setCount] = useState(50);
  const [prefix, setPrefix] = useState("");
  const [len, setLen] = useState(8);
  const [fileCodes, setFileCodes] = useState(null);   // { name, codes }
  const [s, setS] = useState({ kind: "amount", value_type: "full", value: 100, target: { kind: "track" }, valid_from: "", valid_to: "", batch: "", note: "", active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);             // { rows, skipped }
  const batchTouched = useRef(false);
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setT = (k, v) => setS((x) => ({ ...x, target: { ...x.target, [k]: v } }));

  const products = (getters.products || []).filter((p) => p.buy_direct && p.theme !== "wyprawa");
  const trips = (getters.products || []).filter((p) => p.theme === "wyprawa");
  const variants = s.target.kind === "product" ? parseVariants((getters.products || []).find((p) => p.slug === s.target.slug)?.packages_pl) : [];
  const tripPkgs = (getters.trip_packages || []).filter((p) => p.product_slug === s.target.slug);

  const manualCodes = useMemo(() => manual.split(/[\s,;]+/).map(normCode).filter(Boolean), [manual]);
  const howMany = mode === "manual" ? manualCodes.length : mode === "series" ? Math.min(5000, Math.max(0, parseInt(count, 10) || 0)) : (fileCodes?.codes.length || 0);
  const preview = { kind: s.kind, value_type: s.kind === "amount" ? "amount" : s.value_type, value: Number(s.value) || 0, target: s.target };
  const valueTxt = valueOf(preview);
  const targetTxt = s.kind === "amount" ? "dowolny zakup" : label({ kind: "product", target: s.target }).toLowerCase();
  const examples = useMemo(() => Array.from({ length: 3 }, () => sample(normCode(prefix).slice(0, 12), Math.min(16, Math.max(6, parseInt(len, 10) || 8)))), [prefix, len]);

  // the series gets a name by default — it is how a batch is found, exported or switched off later
  useEffect(() => {
    if (batchTouched.current) return;
    const d = new Date().toLocaleDateString("pl-PL");
    set("batch", mode === "series" ? `${valueTxt.replace("−", "")} · ${normCode(prefix) || "seria"} · ${d}` : mode === "file" && fileCodes ? `import ${fileCodes.name} · ${d}` : "");
  }, [mode, valueTxt, prefix, fileCodes?.name]); // eslint-disable-line

  const readFile = async (f) => {
    if (!f) return;
    const txt = await f.text();
    setFileCodes({ name: f.name.replace(/\.[a-z0-9]+$/i, ""), codes: codesFromText(txt) });
  };

  const submit = async () => {
    setErr("");
    if (!howMany) { setErr(mode === "file" ? "Wybierz plik z kodami." : mode === "manual" ? "Wpisz co najmniej jeden kod." : "Podaj liczbę kodów."); return; }
    setBusy(true);
    const settings = { ...s, value_type: s.kind === "amount" ? "amount" : s.value_type };
    const r = mode === "series"
      ? await adminCall("discounts.generate", { count: howMany, prefix, length: len, settings })
      : await adminCall("discounts.create", { codes: mode === "manual" ? manualCodes : fileCodes.codes, settings });
    setBusy(false);
    if (!r.ok && !r.rows?.length) { setErr(r.error || "Nie udało się utworzyć kodów."); return; }
    onDone(r.rows || []);
    setDone({ rows: r.rows || [], skipped: r.skipped || [], error: r.ok ? "" : r.error });
  };

  if (done) {
    return (
      <div className="adm-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="adm-form dc-form">
          <div className="adm-form__head"><h3>Gotowe</h3><button className="adm-x" onClick={onClose}>×</button></div>
          <div className="adm-form__body">
            <div className="dc-done"><b>{done.rows.length}</b><span>{done.rows.length === 1 ? "nowy kod" : "nowych kodów"} · {valueTxt} · {targetTxt}</span></div>
            {done.error && <div className="adm-note">{done.error}</div>}
            {!!done.rows.length && <div className="dc-codes">{done.rows.slice(0, 60).map((c) => <code key={c.id}>{c.code}</code>)}{done.rows.length > 60 && <em>… i {done.rows.length - 60} więcej w pliku CSV</em>}</div>}
            {!!done.skipped.length && (
              <div className="dc-skip"><b>Pominięte ({done.skipped.length})</b>
                <ul>{done.skipped.slice(0, 40).map((x, i) => <li key={i}><code>{x.code}</code> — {x.why}</li>)}</ul>
                {done.skipped.length > 40 && <em>… i {done.skipped.length - 40} więcej</em>}
              </div>
            )}
          </div>
          <div className="adm-form__foot">
            {!!done.rows.length && <button className="adm-btn" onClick={() => { navigator.clipboard?.writeText(done.rows.map((c) => c.code).join("\n")); }}>Kopiuj kody</button>}
            {!!done.rows.length && <button className="adm-btn" onClick={() => downloadCsv(done.rows, label, {}, (s.batch || "kody").replace(/[^\w.-]+/g, "-"))}>Pobierz CSV</button>}
            <div style={{ flex: 1 }} />
            <button className="adm-btn adm-btn--red" onClick={onClose}>Zamknij</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-modal" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="adm-form dc-form">
        <div className="adm-form__head"><h3>Nowe kody rabatowe</h3><button className="adm-x" onClick={onClose} disabled={busy}>×</button></div>
        <div className="adm-form__body">
          {/* 1 · how */}
          <div className="dc-step"><span>1</span>Skąd kody</div>
          <div className="dc-tabs">{MODES.map(([k, l]) => <button key={k} type="button" className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}</div>
          {mode === "manual" && (
            <label className="adm-f"><span>Kody — jeden w linii (litery, cyfry, myślnik; wielkość liter bez znaczenia)</span>
              <textarea rows={4} value={manual} onChange={(e) => setManual(e.target.value)} placeholder={"LATO100\nDLA-ANNY"} className="dc-mono" />
              <div className="dc-row">
                <button type="button" className="adm-mini" onClick={() => setManual((m) => `${m.trim() ? `${m.trim()}\n` : ""}${sample("", 8)}`)}>+ Losowy kod</button>
                <small>{manualCodes.length} {manualCodes.length === 1 ? "kod" : "kodów"}</small>
              </div>
            </label>
          )}
          {mode === "series" && (
            <div className="dc-grid3">
              <label className="adm-f"><span>Ile kodów (max 5000)</span><input type="number" min="1" max="5000" value={count} onChange={(e) => setCount(e.target.value)} /></label>
              <label className="adm-f"><span>Prefiks (opcjonalnie)</span><input value={prefix} onChange={(e) => setPrefix(normCode(e.target.value).slice(0, 12))} placeholder="np. LATO" className="dc-mono" /></label>
              <label className="adm-f"><span>Długość części losowej</span><select className="adm-select" value={len} onChange={(e) => setLen(Number(e.target.value))}>{[6, 8, 10, 12, 16].map((n) => <option key={n} value={n}>{n} znaków</option>)}</select></label>
              <p className="dc-hint">Przykład: {examples.map((x) => <code key={x}>{x}</code>)} — bez liter I, L, O i cyfr 0, 1, żeby nikt ich nie pomylił.</p>
            </div>
          )}
          {mode === "file" && (
            <label className="adm-f"><span>Plik CSV lub TXT — jeden kod w linii (z CSV brana jest pierwsza kolumna, nagłówek „kod” jest pomijany)</span>
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} />
              {fileCodes && <div className="dc-row"><small>W pliku <b>{fileCodes.codes.length}</b> kodów</small>{fileCodes.codes.slice(0, 6).map((c) => <code key={c}>{normCode(c)}</code>)}</div>}
            </label>
          )}

          {/* 2 · what */}
          <div className="dc-step"><span>2</span>Co daje kod</div>
          <div className="dc-kind">
            <button type="button" className={s.kind === "amount" ? "on" : ""} onClick={() => set("kind", "amount")}><b>Rabat kwotowy</b><small>Kwota odejmowana od ceny brutto dowolnego zakupu. Tańszy produkt = pokryty w całości.</small></button>
            <button type="button" className={s.kind === "product" ? "on" : ""} onClick={() => set("kind", "product")}><b>Na produkt</b><small>Konkretny produkt lub pakiet — klient trafia od razu do jego konfiguratora.</small></button>
          </div>
          {s.kind === "amount" ? (
            <div className="dc-grid3">
              <label className="adm-f"><span>Kwota rabatu (zł brutto)</span><input type="number" min="1" step="1" value={s.value} onChange={(e) => set("value", e.target.value)} /></label>
              <div className="dc-presets">{[50, 100, 200, 300, 500, 1000].map((v) => <button type="button" key={v} className={Number(s.value) === v ? "on" : ""} onClick={() => set("value", v)}>{v} zł</button>)}</div>
            </div>
          ) : (
            <>
              <label className="adm-f"><span>Rodzaj produktu</span>
                <select className="adm-select" value={s.target.kind} onChange={(e) => setS((x) => ({ ...x, target: { kind: e.target.value } }))}>
                  {Object.entries(TKIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              {s.target.kind === "track" && (
                <div className="dc-grid2">
                  <label className="adm-f"><span>Auto</span><select className="adm-select" value={s.target.car_id || ""} onChange={(e) => setT("car_id", e.target.value || null)}>
                    <option value="">Dowolne auto</option>{(getters.cars || []).filter((c) => (c.category || "sport") === "sport").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="own">Własne auto</option></select></label>
                  <label className="adm-f"><span>Pakiet</span><select className="adm-select" value={s.target.sessions || ""} onChange={(e) => setT("sessions", Number(e.target.value) || null)}>
                    <option value="">Dowolny pakiet</option>{[3, 6, 9].map((n) => <option key={n} value={n}>{n} sesji</option>)}</select></label>
                </div>
              )}
              {s.target.kind === "ice" && (
                <label className="adm-f"><span>Pakiet Laponii</span><select className="adm-select" value={s.target.package_id || ""} onChange={(e) => setT("package_id", e.target.value || null)}>
                  <option value="">Dowolny pakiet</option>{(getters.ice_packages || []).map((p) => <option key={p.id} value={p.id}>{p.name_pl} · {p.days} {p.days === 1 ? "dzień" : "dni"} · {p.price} {p.currency}</option>)}</select></label>
              )}
              {s.target.kind === "product" && (
                <div className="dc-grid2">
                  <label className="adm-f"><span>Program</span><select className="adm-select" value={s.target.slug || ""} onChange={(e) => setS((x) => ({ ...x, target: { kind: "product", slug: e.target.value || null } }))}>
                    <option value="">— wybierz —</option>{products.map((p) => <option key={p.slug} value={p.slug}>{p.title_pl}</option>)}</select></label>
                  {variants.length > 0 && <label className="adm-f"><span>Wariant</span><select className="adm-select" value={s.target.variant || ""} onChange={(e) => setT("variant", e.target.value || null)}>
                    <option value="">Dowolny wariant</option>{variants.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.price} zł</option>)}</select></label>}
                </div>
              )}
              {s.target.kind === "trip" && (
                <div className="dc-grid2">
                  <label className="adm-f"><span>Wyprawa</span><select className="adm-select" value={s.target.slug || ""} onChange={(e) => setS((x) => ({ ...x, target: { kind: "trip", slug: e.target.value || null } }))}>
                    <option value="">— wybierz —</option>{trips.map((p) => <option key={p.slug} value={p.slug}>{p.title_pl}</option>)}</select></label>
                  {tripPkgs.length > 0 && <label className="adm-f"><span>Pakiet</span><select className="adm-select" value={s.target.package_id || ""} onChange={(e) => setT("package_id", e.target.value || null)}>
                    <option value="">Dowolny pakiet</option>{tripPkgs.map((p) => <option key={p.id} value={p.id}>{p.name_pl} · {p.price} {p.currency}</option>)}</select></label>}
                </div>
              )}
              <div className="dc-grid3">
                <label className="adm-f"><span>Wartość kodu</span><select className="adm-select" value={s.value_type} onChange={(e) => set("value_type", e.target.value)}>
                  <option value="full">Cały produkt (100%)</option><option value="percent">Procent ceny</option><option value="amount">Kwota (zł brutto)</option></select></label>
                {s.value_type !== "full" && <label className="adm-f"><span>{s.value_type === "percent" ? "Procent (1–100)" : "Kwota (zł brutto)"}</span><input type="number" min="1" max={s.value_type === "percent" ? 100 : undefined} value={s.value} onChange={(e) => set("value", e.target.value)} /></label>}
              </div>
              <p className="dc-hint">Przy zamówieniu na kilka osób kod obejmuje jedno miejsce. Ceny w EUR (Laponia, wyprawy) są przeliczane na złote po kursie z „Ustawień”.</p>
            </>
          )}

          {/* 3 · when */}
          <div className="dc-step"><span>3</span>Ważność i opis</div>
          <div className="dc-grid2">
            <label className="adm-f"><span>Ważny od (opcjonalnie)</span><input type="date" value={s.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></label>
            <label className="adm-f"><span>Ważny do (opcjonalnie, włącznie)</span><input type="date" value={s.valid_to} onChange={(e) => set("valid_to", e.target.value)} /></label>
          </div>
          <label className="adm-f"><span>Nazwa serii (po niej znajdziesz, wyeksportujesz albo wyłączysz całą paczkę)</span>
            <input value={s.batch} list="dc-batches" onChange={(e) => { batchTouched.current = true; set("batch", e.target.value); }} placeholder="np. Targi Poznań 2026" />
            <datalist id="dc-batches">{existingBatches.map((b) => <option key={b} value={b} />)}</datalist></label>
          <label className="adm-f"><span>Notatka (dla kogo, skąd — widać tylko w panelu)</span><input value={s.note} onChange={(e) => set("note", e.target.value)} placeholder="np. konkurs na Instagramie" /></label>
          <label className="adm-check"><input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} />Aktywne od razu</label>

          <div className="dc-sum">
            Utworzysz <b>{howMany}</b> {howMany === 1 ? "kod" : "kodów"}: <b>{valueTxt}</b> · {targetTxt}
            {s.valid_from && <> · od {day(s.valid_from)}</>}{s.valid_to && <> · do {day(s.valid_to)}</>} · jednorazowe
          </div>
          {err && <div className="adm-err">{err}</div>}
        </div>
        <div className="adm-form__foot">
          <div style={{ flex: 1 }} />
          <button className="adm-btn" onClick={onClose} disabled={busy}>Anuluj</button>
          <button className="adm-btn adm-btn--red" onClick={submit} disabled={busy || !howMany}>{busy ? "Tworzę…" : mode === "series" ? `Wygeneruj ${howMany}` : `Dodaj ${howMany}`}</button>
        </div>
      </div>
    </div>
  );
}
