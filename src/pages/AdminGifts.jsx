import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { normCode } from "../lib/discount";

/* ============ VOUCHERY ŚWIĄTECZNE (/swieta-2026) ============
   Every holiday voucher with its code state (from discount_codes — the code IS the redemption),
   InPost shipping (to send → sent with a parcel number) and offline redemption (marked here).
   The page mode lives here too: TEST = no payment, LIVE = Tpay. */

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const when = (s) => (s ? new Date(s).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const day = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join(".") : "");
const money2 = (n) => `${(Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

function stateOf(b) {
  if (b.status === "cancelled") return "cancelled";
  if (b.status !== "paid") return "pending";
  const c = b.code_state;
  if (c?.used_at) return "used";
  if (c && c.active === false) return "off";
  if ((c?.valid_to || b.voucher_valid_to) && todayIso() > (c?.valid_to || b.voucher_valid_to)) return "expired";
  return "active";
}
const STATE = { active: ["Aktywny", "ok"], used: ["Wykorzystany", "info"], expired: ["Wygasł", "bad"], off: ["Wyłączony", "off"], pending: ["Czeka na płatność", "warn"], cancelled: ["Anulowany", "off"] };
const toShip = (b) => b.status === "paid" && b.delivery === "inpost" && !b.shipped_at;

export default function GiftsTab({ OrderDrawer }) {
  const { adminCall, can } = useStore();
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [check, setCheck] = useState("");
  const reload = () => adminCall("gifts.list").then((r) => setD(r.ok ? r : { rows: [], error: r.error }));
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  const rows = d?.rows || [];

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, toShip: 0, used: 0, test: 0, sum: 0 };
    rows.forEach((b) => {
      if (b.status !== "paid") return;
      if (!b.is_test) { c.all++; c.sum += Number(b.amount_pln) || 0; } else c.test++;
      const s = stateOf(b);
      if (s === "active" && !b.is_test) c.active++;
      if (s === "used" && !b.is_test) c.used++;
      if (toShip(b) && !b.is_test) c.toShip++;
    });
    return c;
  }, [rows]);

  const list = useMemo(() => rows.filter((b) => {
    const s = stateOf(b);
    if (filter === "test") return b.is_test;
    if (filter === "all") return true;
    if (b.is_test) return false;
    if (filter === "toShip") return toShip(b);
    if (filter === "shipped") return b.delivery === "inpost" && !!b.shipped_at;
    return s === filter;
  }).filter((b) => !q.trim() || `${b.number} ${b.voucher_for} ${b.full_name} ${b.email} ${b.voucher_code || ""} ${b.term_label || ""} ${b.delivery_data?.locker || ""}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, filter, q]);

  const act = async (action, b, payload = {}) => {
    setBusy(`${action}:${b.id}`);
    const r = await adminCall(action, { id: b.id, ...payload });
    setBusy("");
    if (!r.ok) alert(r.error || "Błąd");
    reload();
  };
  const ship = (b) => { const no = prompt(`Voucher #${b.number} dla ${b.voucher_for} — numer przesyłki InPost (opcjonalnie):`, ""); if (no === null) return; act("gifts.ship", b, { shipping_no: no }); };
  const use = (b) => { const note = prompt(`Wykorzystanie vouchera ${b.voucher_code} (${b.voucher_for}) na miejscu.\nGdzie / kiedy / uwagi:`, "Na torze"); if (note === null) return; act("gifts.use", b, { note }); };
  const unuse = (b) => { if (confirm(`Cofnąć wykorzystanie vouchera ${b.voucher_code}? Kod znowu zadziała.`)) act("gifts.unuse", b); };
  const unship = (b) => { if (confirm("Cofnąć oznaczenie „wysłane”?")) act("gifts.unship", b); };
  const setMode = async (mode) => {
    if (mode === "live" && !confirm("Włączyć PŁATNOŚCI na stronie świątecznej?\nOd teraz każdy voucher idzie przez Tpay.")) return;
    if (mode === "test" && !confirm("Włączyć TRYB TESTOWY?\nVouchery będą powstawać bez płatności (oznaczone TEST).")) return;
    setBusy("mode"); const r = await adminCall("gifts.mode", { mode }); setBusy("");
    if (!r.ok) alert(r.error || "Błąd"); reload();
  };

  // quick check at the desk: type / paste a code, see what it is for and whether it still works
  const hit = useMemo(() => { const c = normCode(check); return c.length >= 6 ? rows.find((b) => (b.voucher_code || "") === c) : null; }, [check, rows]);

  return (
    <div className="adm-gifts">
      <div className="adm-head">
        <div><h2>Vouchery świąteczne <span className="adm-count">{counts.all}</span></h2>
          <p className="adm-sub">Vouchery ze strony <a href="/swieta-2026" target="_blank" rel="noreferrer">/swieta-2026</a> (tylko z linku). Kod vouchera działa jak jednorazowy kod „na cały produkt” — klient wpisuje go w konfiguratorze. Wykorzystanie na miejscu zaznaczasz tutaj.</p></div>
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>

      <div className="adm-gift-mode">
        <span>Strona świąteczna:</span>
        <b className={`adm-badge adm-badge--${d?.mode === "live" ? "ok" : "warn"}`}>{d?.mode === "live" ? "PŁATNOŚCI WŁĄCZONE (Tpay)" : "TRYB TESTOWY — bez płatności"}</b>
        {can("settings") && (d?.mode === "live"
          ? <button className="adm-mini" disabled={busy === "mode"} onClick={() => setMode("test")}>Przełącz na test</button>
          : <button className="adm-mini adm-mini--dark" disabled={busy === "mode"} onClick={() => setMode("live")}>Włącz płatności</button>)}
        <small>Wydruk + Paczkomat: {d?.inpost_net ?? 50} zł netto</small>
      </div>

      <div className="adm-gift-kpis">
        <div><small>Sprzedane</small><b>{counts.all}</b><em>{money2(counts.sum)}</em></div>
        <div><small>Aktywne</small><b>{counts.active}</b><em>do wykorzystania</em></div>
        <div className={counts.toShip ? "is-hot" : ""}><small>Do wysłania</small><b>{counts.toShip}</b><em>Paczkomat InPost</em></div>
        <div><small>Wykorzystane</small><b>{counts.used}</b><em>online i na miejscu</em></div>
      </div>

      <div className="adm-gift-check">
        <label><span>Sprawdź kod</span><input value={check} onChange={(e) => setCheck(e.target.value.toUpperCase())} placeholder="FRA-XXXX-XXXX" /></label>
        {normCode(check).length >= 6 && (hit ? (
          <div className={`adm-gift-hit is-${stateOf(hit)}`}>
            <b>{STATE[stateOf(hit)][0].toUpperCase()}{hit.is_test ? " · TEST" : ""}</b>
            <span>#{hit.number} · dla <b>{hit.voucher_for}</b> · {hit.term_label}</span>
            <small>ważny do {day(hit.code_state?.valid_to || hit.voucher_valid_to)}{hit.code_state?.used_at ? ` · wykorzystany ${when(hit.code_state.used_at)}${hit.code_state.used_order ? ` (zamówienie #${hit.code_state.used_order.number})` : hit.code_state.used_note ? ` (${hit.code_state.used_note})` : ""}` : ""}</small>
            {stateOf(hit) === "active" && <button className="adm-mini adm-mini--dark" onClick={() => use(hit)}>Oznacz jako wykorzystany</button>}
          </div>
        ) : <div className="adm-gift-hit is-none"><b>NIE ZNALEZIONO</b><span>Takiego kodu nie ma wśród voucherów świątecznych.</span></div>)}
      </div>

      <div className="adm-toolbar">
        <div className="adm-chips">
          {[["all", "Wszystkie"], ["active", "Aktywne"], ["toShip", `Do wysłania${counts.toShip ? ` (${counts.toShip})` : ""}`], ["shipped", "Wysłane"], ["used", "Wykorzystane"], ["expired", "Wygasłe"], ["pending", "Czekają na płatność"], ["test", `Testowe${counts.test ? ` (${counts.test})` : ""}`]].map(([k, l]) => (
            <button key={k} className={`adm-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input className="adm-search" placeholder="Szukaj: kod, imię, klient, paczkomat…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {d === null ? <div className="adm-empty">Ładowanie…</div> : !list.length ? <div className="adm-empty">{d?.error || "Brak voucherów."}</div> : (
        <div className="adm-table adm-gift-table">
          <div className="adm-tr adm-tr--head"><span>#</span><span>Dla / kupujący</span><span>Prezent</span><span>Kod</span><span>Odbiór</span><span>Stan</span><span /></div>
          {list.map((b) => {
            const s = stateOf(b);
            return (
              <div key={b.id} className={`adm-tr ${b.is_test ? "is-test" : ""} ${toShip(b) ? "is-ship" : ""}`}>
                <span className="adm-tr__no">#{b.number}{b.is_test && <i className="adm-badge adm-badge--test">TEST</i>}<small>{when(b.created_at)}</small></span>
                <span className="adm-tr__who"><b>{b.voucher_for}</b><small>{b.full_name} · {b.email}</small></span>
                <span className="adm-tr__what"><b>{b.term_label}</b><small>{Number(b.amount_pln) ? money2(b.amount_pln) : "0 zł"}{b.discount_code ? ` · kod ${b.discount_code}` : ""}{b.invoice?.nip ? " · FV" : ""}</small></span>
                <span className="adm-gift-code">{b.voucher_code ? <><b>{b.voucher_code}</b><small>do {day(b.code_state?.valid_to || b.voucher_valid_to)}</small></> : <small>—</small>}</span>
                <span className="adm-gift-del">{b.delivery === "inpost"
                  ? <><b>InPost {b.delivery_data?.locker}</b><small>{b.shipped_at ? `wysłane ${when(b.shipped_at)}${b.shipping_no ? ` · ${b.shipping_no}` : ""}` : <i className="adm-badge adm-badge--warn">DO WYSŁANIA</i>}</small><small>{b.delivery_data?.name} · {b.delivery_data?.phone}</small></>
                  : <b>E-mail</b>}</span>
                <span><i className={`adm-badge adm-badge--${STATE[s][1]}`}>{STATE[s][0]}</i>
                  {s === "used" && <small className="adm-gift-used">{b.code_state?.used_order ? `online · #${b.code_state.used_order.number}` : b.code_state?.used_note || ""}</small>}</span>
                <span className="adm-gift-acts">
                  {toShip(b) && <button className="adm-mini adm-mini--dark" disabled={!!busy} onClick={() => ship(b)}>Wysłane ✓</button>}
                  {b.delivery === "inpost" && b.shipped_at && <button className="adm-mini" disabled={!!busy} onClick={() => unship(b)}>Cofnij wysyłkę</button>}
                  {s === "active" && <button className="adm-mini" disabled={!!busy} onClick={() => use(b)}>Wykorzystany</button>}
                  {s === "used" && !b.code_state?.used_booking && <button className="adm-mini" disabled={!!busy} onClick={() => unuse(b)}>Cofnij</button>}
                  {OrderDrawer && <button className="adm-mini" onClick={() => setOpen(b)}>Szczegóły</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {open && OrderDrawer && <OrderDrawer id={open.id} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
