import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { BW_PRODUCTS } from "../lib/blackweek";

/* ============ BLACK FRIDAY WEEKS (/black-week) ============
   The switch (pop-up + configurator), the sales sum, ready links per product and the checklist:
   what each customer gets for free and whether the team has already handed it over.
   Race Taxi's second voucher is ticked by the server (the code is e-mailed automatically). */

const SITE = "https://fastlineracingacademy.pl";
const when = (s) => (s ? new Date(s).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const money2 = (n) => `${(Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const STATUS = { paid: ["Opłacone", "ok"], pending: ["Czeka na płatność", "warn"], cancelled: ["Anulowane", "off"], chargeback: ["Zwrot", "bad"] };
const giftsOf = (b) => b.promo_data?.gifts || [];
const allDone = (b) => giftsOf(b).length > 0 && giftsOf(b).every((g) => g.done);

export default function BlackWeekTab({ OrderDrawer }) {
  const { adminCall, can } = useStore();
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState("todo");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState("");
  const [cfg, setCfg] = useState(null);
  const reload = () => adminCall("bw.list").then((r) => { setD(r.ok ? r : { rows: [], error: r.error }); if (r.ok) setCfg((c) => c || { heels_basic: r.heels_basic, heels_premium: r.heels_premium, bw_to: r.bw_to }); });
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  const rows = d?.rows || [];

  const kpi = useMemo(() => {
    const k = { sum: 0, paid: 0, todo: 0, gifts: 0, pending: 0, test: 0 };
    rows.forEach((b) => {
      if (b.is_test) { k.test++; return; }
      if (b.status === "pending") k.pending++;
      if (b.status !== "paid") return;
      k.paid++; k.sum += Number(b.amount_pln) || 0;
      const open = giftsOf(b).filter((g) => !g.done).length;
      k.gifts += open; if (open) k.todo++;
    });
    return k;
  }, [rows]);

  const list = useMemo(() => rows.filter((b) => {
    if (filter === "test") return b.is_test;
    if (b.is_test) return false;
    if (filter === "todo") return b.status === "paid" && !allDone(b);
    if (filter === "done") return b.status === "paid" && allDone(b);
    if (filter === "paid") return b.status === "paid";
    if (filter === "pending") return b.status === "pending";
    return true;
  }).filter((b) => !q.trim() || `${b.number} ${b.full_name} ${b.email} ${b.phone} ${b.term_label || ""} ${b.promo_data?.title || ""} ${giftsOf(b).map((g) => g.label).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, filter, q]);

  // ticked at once, the server confirms in the background (undone on error)
  const tick = async (b, g) => {
    const done = !g.done;
    const patch = (row, val) => ({ ...row, promo_data: { ...row.promo_data, gifts: giftsOf(row).map((x) => (x.id === g.id ? { ...x, done: val, done_at: val ? new Date().toISOString() : null, done_by: val ? "Ty" : null } : x)) } });
    setD((s) => ({ ...s, rows: s.rows.map((r) => (r.id === b.id ? patch(r, done) : r)) }));
    const r = await adminCall("bw.check", { id: b.id, gift: g.id, done });
    if (r.ok && r.row) setD((s) => ({ ...s, rows: s.rows.map((x) => (x.id === b.id ? r.row : x)) }));
    else { alert(r.error || "Nie zapisano"); setD((s) => ({ ...s, rows: s.rows.map((x) => (x.id === b.id ? patch(x, !done) : x)) })); }
  };
  const toggle = async () => {
    const next = !d?.on;
    if (!confirm(next ? "WŁĄCZYĆ Black Friday Weeks?\nPop-up pojawi się każdemu odwiedzającemu, konfigurator /black-week przyjmuje płatności Tpay." : "WYŁĄCZYĆ Black Friday Weeks?\nPop-up zniknie, a /black-week pokaże „promocja zakończona”.")) return;
    setBusy("mode"); const r = await adminCall("bw.mode", { on: next }); setBusy("");
    if (!r.ok) alert(r.error || "Błąd"); reload();
  };
  const saveCfg = async (e) => {
    e.preventDefault(); setBusy("cfg");
    const r = await adminCall("bw.settings", cfg); setBusy("");
    if (!r.ok) alert(r.error || "Błąd"); else { setCfg(null); reload(); }
  };
  const copy = (txt, k) => { navigator.clipboard?.writeText(txt); setCopied(k); setTimeout(() => setCopied(""), 1600); };

  return (
    <div className="adm-bw">
      <div className="adm-head">
        <div><h2>Black Friday Weeks</h2>
          <p className="adm-sub">Pop-up na stronie i konfigurator <a href="/black-week" target="_blank" rel="noreferrer">/black-week</a>. Klient płaci zwykłą cenę, a prezent wydajecie Wy. Lista poniżej pokazuje, co trzeba dać każdemu klientowi. Drugi voucher Race Taxi wysyła się sam. Po każdej płatności mail idzie na {d?.bw_to || "adres z ustawień"}.</p></div>
        <button className="adm-btn" onClick={reload}>Odśwież</button>
      </div>

      <div className={`adm-bw-switch ${d?.on ? "is-on" : ""}`}>
        <div>
          <b>{d?.on ? "PROMOCJA WŁĄCZONA" : "PROMOCJA WYŁĄCZONA"}</b>
          <small>{d?.on ? "Pop-up widzi każdy odwiedzający (raz na wizytę, potem mała plakietka w lewym dolnym rogu). Płatności Tpay działają." : "Pop-up ukryty, konfigurator pokazuje „promocja zakończona”, serwer nie przyjmuje zamówień."}</small>
        </div>
        {can("settings")
          ? <button className={`adm-bw-toggle ${d?.on ? "on" : ""}`} disabled={busy === "mode" || !d} onClick={toggle} aria-pressed={!!d?.on}><i /><span>{d?.on ? "WŁ." : "WYŁ."}</span></button>
          : <small>Przełącza osoba z uprawnieniem „Ustawienia”.</small>}
      </div>

      <div className="adm-bw-kpis">
        <div className="is-main"><small>Suma sprzedaży (opłacone, brutto)</small><b>{money2(kpi.sum)}</b><em>{kpi.paid} zamówień</em></div>
        <div className={kpi.gifts ? "is-hot" : ""}><small>Prezenty do wydania</small><b>{kpi.gifts}</b><em>klientów: {kpi.todo}</em></div>
        <div><small>Czekają na płatność</small><b>{kpi.pending}</b><em>niezapłacone</em></div>
      </div>

      <details className="adm-bw-links">
        <summary>Linki do konfiguratora z wybranym produktem (do reklam i maili)</summary>
        <div>
          {[{ q: "", title: "Wybór produktu (start)" }, ...BW_PRODUCTS].map((p) => {
            const url = `${SITE}/black-week${p.q ? `?produkt=${p.q}` : ""}`;
            return (
              <div key={p.q || "all"} className="adm-bw-link"><span>{p.title}</span><code>{url}</code>
                <button className="adm-mini" onClick={() => copy(url, p.q || "all")}>{copied === (p.q || "all") ? "Skopiowano ✓" : "Kopiuj"}</button></div>
            );
          })}
        </div>
      </details>

      {can("settings") && cfg && (
        <details className="adm-bw-links">
          <summary>Ustawienia: ceny Heels on the Track, adres powiadomień</summary>
          <form className="adm-bw-cfg" onSubmit={saveCfg}>
            <label><span>Heels — pakiet BASIC (zł netto / osoba)</span><input type="number" min="1" value={cfg.heels_basic || ""} onChange={(e) => setCfg({ ...cfg, heels_basic: e.target.value })} /></label>
            <label><span>Heels — pakiet PREMIUM PORSCHE (zł netto / osoba)</span><input type="number" min="1" value={cfg.heels_premium || ""} onChange={(e) => setCfg({ ...cfg, heels_premium: e.target.value })} /></label>
            <label className="is-wide"><span>Mail „ktoś skorzystał z promocji” — na adres(y)</span><input value={cfg.bw_to || ""} onChange={(e) => setCfg({ ...cfg, bw_to: e.target.value })} placeholder="mariusz.miekos@greywolfgroup.pl" /></label>
            <button className="adm-btn adm-btn--red" disabled={busy === "cfg"}>Zapisz</button>
          </form>
        </details>
      )}

      <div className="adm-toolbar">
        <div className="adm-chips">
          {[["todo", `Do zrobienia${kpi.todo ? ` (${kpi.todo})` : ""}`], ["done", "Wszystko wydane"], ["paid", "Wszystkie opłacone"], ["pending", "Czekają na płatność"], ["all", "Wszystkie"], ["test", `Testowe${kpi.test ? ` (${kpi.test})` : ""}`]].map(([k, l]) => (
            <button key={k} className={`adm-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input className="adm-search" placeholder="Szukaj: klient, e-mail, telefon, prezent…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {d === null ? <div className="adm-empty">Ładowanie…</div> : !list.length ? <div className="adm-empty">{d?.error || (filter === "todo" ? "Nic do zrobienia — wszystkie prezenty wydane." : "Brak zamówień.")}</div> : (
        <div className="adm-bw-list">
          {list.map((b) => {
            const st = STATUS[b.status] || [b.status, "off"];
            const paid = b.status === "paid";
            return (
              <div key={b.id} className={`adm-bw-row ${b.is_test ? "is-test" : ""} ${paid && allDone(b) ? "is-done" : ""}`}>
                <div className="adm-bw-row__head">
                  <span className="adm-bw-row__no">#{b.number}{b.is_test && <i className="adm-badge adm-badge--test">TEST</i>}<small>{when(b.created_at)}</small></span>
                  <span className="adm-bw-row__who"><b>{b.full_name}</b><small><a href={`mailto:${b.email}`}>{b.email}</a> · <a href={`tel:${b.phone}`}>{b.phone}</a></small></span>
                  <span className="adm-bw-row__what"><b>{b.promo_data?.title || b.product_name || b.car_name}{b.promo_data?.voucher ? ` · VOUCHER dla ${b.promo_data.voucher.for}` : ""}</b><small>{(b.term_label || "").replace(/^Black Week · /, "")}</small></span>
                  <span className="adm-bw-row__sum"><b>{money2(b.amount_pln)}</b><small>brutto{b.invoice?.nip ? " · FV" : ""}</small></span>
                  <span><i className={`adm-badge adm-badge--${st[1]}`}>{st[0]}</i></span>
                  {OrderDrawer && <button className="adm-mini" onClick={() => setOpen(b)}>Szczegóły</button>}
                </div>
                <ul className="adm-bw-gifts">
                  {giftsOf(b).map((g) => (
                    <li key={g.id} className={g.done ? "done" : ""}>
                      <label>
                        <input type="checkbox" checked={!!g.done} disabled={!paid || (g.auto && g.done)} onChange={() => tick(b, g)} />
                        <span>{g.label}</span>
                      </label>
                      {g.done && <small>{g.done_by ? `${g.done_by} · ` : ""}{when(g.done_at)}</small>}
                      {!paid && <small>po opłaceniu</small>}
                    </li>
                  ))}
                  {b.note && <li className="adm-bw-note">Uwagi klienta: {b.note}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {open && OrderDrawer && <OrderDrawer id={open.id} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
