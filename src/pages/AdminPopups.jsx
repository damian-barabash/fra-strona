import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../lib/store";
import { processUpload } from "../lib/api";
import UploadStatus from "../components/UploadStatus";
import RichEditor, { normUrl } from "../components/RichEditor";
import PopupView, { popupVars } from "../components/PopupView";
import { richStats } from "../lib/richtext";
import { postDate } from "../lib/blog";
import { POPUP_BTN_COLORS, POPUP_COLORS, POPUP_LAYOUTS, POPUP_LIMITS as LIM, isExternal, popupState } from "../lib/popup";

/* ============ POP-UP REKLAMOWY ============
   Saved layouts of the advertising pop-up. Any number can be kept, one can be switched on — the site
   shows it after the set number of seconds. The form has a live preview (desktop / phone) built from
   the very component the site renders, and a full-screen preview. */
const STATE = { on: ["Włączony", "ok"], scheduled: ["Zaplanowany", "info"], ended: ["Zakończony", "warn"], off: ["Wyłączony", "off"] };
const KEYS = ["name", "active", "delay_sec", "pages", "date_from", "date_to", "layout", "image", "image_mobile", "image_alt", "color", "btn_color",
  "eyebrow_pl", "title_pl", "body_pl", "btn_label_pl", "btn_url", "btn_blank"];
const snap = (r) => JSON.stringify(KEYS.map((k) => r?.[k] ?? ""));
const BLANK = { name: "", active: false, delay_sec: 5, pages: "all", date_from: null, date_to: null, layout: "left", image: "", image_mobile: "", image_alt: "",
  color: "#14161a", btn_color: "#e30613", eyebrow_pl: "", title_pl: "", body_pl: "", btn_label_pl: "", btn_url: "", btn_blank: false, views: 0, clicks: 0, sort: 0 };
const DELAYS = [0, 3, 5, 10, 20, 30, 60];
const SITE_PAGES = [["/rezerwacja", "Kup szkolenie — konfigurator"], ["/voucher", "Kup prezent — voucher"], ["/kalendarz", "Kalendarz"], ["/oferta", "Oferta"], ["/flota", "Flota"],
  ["/cennik", "Cennik"], ["/dla-firm", "Dla firm"], ["/o-szkole", "Szkoła jazdy sportowej"], ["/mariusz-miekos-racing", "Mariusz Miękoś Racing"], ["/blog", "Blog"], ["/kontakt", "Kontakt"], ["/", "Strona główna"]];
// text colours offered in the editor: they have to work on dark and on light blocks alike
const TEXT_COLORS = [["#e30613", "Czerwony"], ["#ffffff", "Biały"], ["#14161a", "Czarny"], ["#d9a521", "Złoty"]];
const pct = (a, b) => (b ? `${((a / b) * 100).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%` : "—");
const delayLabel = (s) => (Number(s) ? `po ${Number(s)} s` : "od razu");

export default function PopupsTab() {
  const store = useStore();
  const items = store.getters.popups || [];
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(null);   // full-screen preview from the list
  const list = useMemo(() => [...items].sort((a, b) => Number(!!b.active) - Number(!!a.active) || String(b.updated_at || "").localeCompare(String(a.updated_at || ""))), [items]);
  const on = items.find((p) => p.active);

  if (editing) return <PopupEditor row={editing} onClose={() => setEditing(null)} />;

  const toggle = (r) => {
    if (!r.active && on && on.id !== r.id && !confirm(`Teraz włączony jest „${on.name || on.title_pl || "pop-up"}”. Włączyć zamiast niego „${r.name || r.title_pl || "ten pop-up"}”?`)) return;
    store.upsertEntity("popups", { ...r, active: !r.active });
  };
  const copy = (r) => {
    const c = { ...BLANK };
    KEYS.forEach((k) => { c[k] = r[k] ?? BLANK[k]; });
    setEditing({ ...c, name: `${r.name || r.title_pl || "Pop-up"} (kopia)`, active: false });
  };
  const remove = (r) => { if (confirm(`Usunąć pop-up „${r.name || r.title_pl || ""}”? Tej operacji nie da się cofnąć.`)) store.deleteEntity("popups", r.id); };

  return (
    <div>
      <div className="adm-head"><div><h2>Pop-up reklamowy <span className="adm-count">{items.length}</span></h2>
        <p className="adm-sub">Okno reklamowe, które pojawia się odwiedzającemu po kilku sekundach na stronie. Możesz przygotować dowolnie wiele wersji — <b>włączona może być tylko jedna</b>. Zamknięty pop-up nie wraca do końca wizyty; przy następnej wizycie pokaże się znowu (chyba że klient wrócił w ciągu 5 minut). Nie pokazuje się w konfiguratorze, przy płatności ani w panelu.</p></div>
        <button className="adm-btn adm-btn--red" onClick={() => setEditing({ ...BLANK })}>+ Nowy pop-up</button></div>
      {!on && items.length > 0 && <div className="adm-note">Żaden pop-up nie jest teraz włączony — na stronie nic się nie wyświetla.</div>}
      <div className="pop-list">
        {list.map((r) => {
          const st = popupState(r);
          return (
            <div className={`pop-item ${r.active ? "is-on" : ""}`} key={r.id}>
              <button type="button" className="pop-item__thumb" onClick={() => setShow(r)} title="Podgląd na pełnym ekranie" style={popupVars(r).style}>
                {r.image ? <img src={r.image} alt="" loading="lazy" /> : <span>{(r.title_pl || "POP-UP").slice(0, 26)}</span>}
                <em>Podgląd</em>
              </button>
              <div className="pop-item__main">
                <div className="pop-item__top">
                  <button type="button" className="blg-row__ttl" onClick={() => setEditing({ ...r })}>{r.name || r.title_pl || "(bez nazwy)"}</button>
                  <span className={`adm-badge adm-badge--${STATE[st][1]}`}>{STATE[st][0]}</span>
                  {r._pending && <span className="adm-badge adm-badge--sync">zapisuję…</span>}
                </div>
                <small className="blg-row__meta">{r.title_pl || "—"}</small>
                <small className="blg-row__meta">
                  Pojawia się {delayLabel(r.delay_sec)} · {r.pages === "home" ? "tylko strona główna" : "cała strona"}
                  {r.date_from || r.date_to ? ` · ${r.date_from ? `od ${postDate(r.date_from)}` : ""}${r.date_to ? ` do ${postDate(r.date_to)}` : ""}` : ""}
                  {r.btn_url ? ` · przycisk → ${r.btn_url}` : " · bez przycisku"}
                </small>
                <small className="pop-item__stats"><b>{r.views || 0}</b> wyświetleń · <b>{r.clicks || 0}</b> kliknięć · skuteczność <b>{pct(r.clicks || 0, r.views || 0)}</b></small>
              </div>
              <div className="pop-item__ops">
                <button className={`adm-mini ${r.active ? "" : "adm-mini--dark"}`} onClick={() => toggle(r)}>{r.active ? "Wyłącz" : "Włącz"}</button>
                <button className="adm-mini" onClick={() => setShow(r)}>Podgląd</button>
                <button className="adm-mini" onClick={() => setEditing({ ...r })}>Edytuj</button>
                <button className="adm-mini" onClick={() => copy(r)}>Duplikuj</button>
                <button className="adm-mini adm-mini--del" onClick={() => remove(r)}>Usuń</button>
              </div>
            </div>
          );
        })}
        {!items.length && <div className="adm-empty">Nie ma jeszcze żadnego pop-upu. Kliknij „+ Nowy pop-up”.</div>}
      </div>
      {show && <FullPreview p={show} onClose={() => setShow(null)} />}
    </div>
  );
}

/* the real pop-up over the panel — exactly what a visitor gets on this screen */
function FullPreview({ p, onClose }) {
  const { lang } = useStore();
  return createPortal(<PopupView p={p} lang={lang} onClose={onClose} onGo={(e) => e.preventDefault()} />, document.body);
}

/* live preview: a virtual screen (desktop 1440×900 or a phone 390×844) scaled to the column's width */
const SCREENS = { desktop: [1440, 900], mobile: [390, 844] };
function Preview({ p, device, lang, replay }) {
  const box = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [sw, sh] = SCREENS[device];
  const scale = w ? Math.min(w / sw, device === "mobile" ? 600 / sh : 1) : 0;
  return (
    <div className={`pop-prev pop-prev--${device}`} ref={box} style={{ height: sh * scale || undefined }}>
      {scale > 0 && (
        <div className="pop-prev__screen" style={{ width: sw, height: sh, transform: `scale(${scale})`, marginLeft: (w - sw * scale) / 2 }}>
          <div className="pop-prev__site" aria-hidden="true"><i /><b>FASTLINE RACING ACADEMY</b><span /><span /><span /></div>
          <PopupView key={`${device}${replay}`} p={p} lang={lang} embed device={device} onGo={(e) => e.preventDefault()} />
        </div>
      )}
    </div>
  );
}

function ImgField({ label, hint, value, onChange, dir }) {
  const { adminCall } = useStore();
  const [st, setSt] = useState(null);
  const pickFile = async (ev) => {
    const file = ev.target.files?.[0]; ev.target.value = "";
    if (!file) return;
    const url = await processUpload(file, `popup/${dir}-${Date.now()}`, adminCall, setSt);
    if (url) onChange(url);
    setTimeout(() => setSt((x) => (x && (x.stage === "done" || x.stage === "error") ? null : x)), 5000);
  };
  return (
    <div className="adm-f"><span>{label}</span>
      <div className="pop-img">
        {value ? <img src={value} alt="" /> : <div className="pop-img__none">brak</div>}
        <div className="pop-img__ops">
          <label className="adm-mini adm-mini--dark">{value ? "Zmień zdjęcie" : "Wybierz zdjęcie"}<input type="file" accept="image/*" hidden onChange={pickFile} /></label>
          {value && <button type="button" className="adm-mini adm-mini--del" onClick={() => onChange("")}>Usuń</button>}
          <UploadStatus st={st} />
        </div>
      </div>
      {hint && <p className="blg-hint">{hint}</p>}
    </div>
  );
}

function Swatches({ label, value, onChange, presets }) {
  const cur = String(value || "").toLowerCase();
  return (
    <div className="adm-f"><span>{label}</span>
      <div className="pop-sw">
        {presets.map(([c, l]) => <button type="button" key={c} title={l} aria-label={l} className={`pop-sw__b ${cur === c ? "on" : ""}`} style={{ background: c }} onClick={() => onChange(c)} />)}
        <label className={`pop-sw__own ${presets.some(([c]) => c === cur) ? "" : "on"}`} title="Własny kolor"><input type="color" value={/^#[0-9a-f]{6}$/.test(cur) ? cur : "#14161a"} onChange={(ev) => onChange(ev.target.value)} /><i style={{ background: cur }} />własny</label>
      </div>
    </div>
  );
}

const Cnt = ({ v, max }) => <em className={`blg-cnt ${String(v || "").length >= max ? "bad" : ""}`}>{String(v || "").length}/{max}</em>;

function PopupEditor({ row, onClose }) {
  const store = useStore();
  const [e, setE] = useState(row);
  const [savedSnap, setSavedSnap] = useState(() => (row.id ? snap(row) : ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState(false);
  const [device, setDevice] = useState("desktop");
  const [replay, setReplay] = useState(0);
  const [full, setFull] = useState(false);
  const [plang, setPlang] = useState("pl");
  const dirty = snap(e) !== savedSnap;
  const set = (k, v) => { setErr(""); setE((x) => ({ ...x, [k]: v })); };

  // where the button leads: a page of this site (list or own path), or an outside address
  const url = String(e.btn_url || "");
  const [linkMode, setLinkMode] = useState(() => (!url ? "site" : isExternal(url) ? "ext" : "site"));
  const pages = useMemo(() => {
    const prods = (store.getters.products || []).filter((p) => p.slug && !p.external_url && p.visible !== false).map((p) => [`/produkty/${p.slug}`, p.title_pl || p.slug]);
    const posts = (store.posts || []).slice(0, 30).map((p) => [`/blog/${p.slug}`, p.title_pl || p.slug]);
    return { main: SITE_PAGES, prods, posts };
  }, [store.getters.products, store.posts]);
  const known = [...pages.main, ...pages.prods, ...pages.posts].some(([u]) => u === url);
  const [ownPath, setOwnPath] = useState(() => !!url && !isExternal(url) && !known);

  useEffect(() => {
    if (!dirty) return;
    const warn = (ev) => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const close = () => { if (dirty && !confirm("Masz niezapisane zmiany w pop-upie. Wyjść bez zapisywania?")) return; onClose(); };

  const stats = richStats(e.body_pl);
  const bodyOver = stats.chars > LIM.body || stats.blocks > LIM.lines;
  const others = (store.getters.popups || []).filter((p) => p.active && p.id !== e.id);

  const save = async (patch = {}) => {
    const r = { ...e, ...patch };
    const label = String(r.btn_label_pl || "").trim();
    let link = String(r.btn_url || "").trim();
    if (linkMode === "ext" && link) link = normUrl(link);
    else if (link && !isExternal(link) && !link.startsWith("/")) link = `/${link}`;
    if (bodyOver) { setErr(`Tekst jest za długi (najwyżej ${LIM.body} znaków i ${LIM.lines} linii) — nie zmieści się w bloku.`); return; }
    if (!!label !== !!link) { setErr(label ? "Przycisk ma napis, ale nie ma adresu — wybierz, dokąd prowadzi." : "Przycisk ma adres, ale nie ma napisu."); return; }
    if (linkMode === "ext" && String(r.btn_url || "").trim() && !link) { setErr("Adres przycisku jest nieprawidłowy — wpisz np. https://heelsonthetrack.pl"); return; }
    if (r.date_from && r.date_to && r.date_from > r.date_to) { setErr("Data „od” jest późniejsza niż data „do”."); return; }
    if (!String(r.title_pl || "").trim() && !stats.chars && !r.image) { setErr("Pop-up jest pusty — dodaj zdjęcie, tytuł albo tekst."); return; }
    if (r.active && others.length && !e.active && !confirm(`Teraz włączony jest „${others[0].name || others[0].title_pl || "inny pop-up"}”. Włączyć ten zamiast niego?`)) return;
    const payload = { ...r, name: String(r.name || "").trim() || String(r.title_pl || "").trim() || "Pop-up", btn_label_pl: label, btn_url: link,
      eyebrow_pl: String(r.eyebrow_pl || "").trim(), title_pl: String(r.title_pl || "").trim(), date_from: r.date_from || null, date_to: r.date_to || null,
      delay_sec: Math.min(600, Math.max(0, Math.round(Number(r.delay_sec) || 0))), sort: r.sort ?? 0 };
    setE(payload); setBusy(true); setErr("");
    const res = await store.upsertEntity("popups", payload);
    setBusy(false);
    if (!res?.ok) { setErr(res?.error || "Nie udało się zapisać — spróbuj ponownie."); return; }
    if (res.row?.id) setE((x) => ({ ...x, id: res.row.id }));
    setSavedSnap(snap(payload));
    setFlash(true); setTimeout(() => setFlash(false), 2600);
  };

  const st = popupState(e);
  const vars = popupVars(e);
  const live = (store.getters.popups || []).find((p) => p.id === e.id);   // counters and the English texts come from the saved row
  const shown = { ...e, ...(live ? { title_en: live.title_en, eyebrow_en: live.eyebrow_en, body_en: live.body_en, btn_label_en: live.btn_label_en } : {}) };
  const hasEn = !!(live && (live.title_en || live.body_en));

  return (
    <div className="blg pop">
      <div className="blg-top">
        <button type="button" className="adm-btn adm-btn--sm" onClick={close}>‹ Lista pop-upów</button>
        <h2>{e.id ? "Edycja pop-upu" : "Nowy pop-up"}</h2>
        <span className={`adm-badge adm-badge--${STATE[st][1]}`}>{STATE[st][0]}</span>
        {flash && !dirty && <span className="blg-saved">✓ Zapisano</span>}
        {dirty && !busy && <span className="blg-dirty">● niezapisane zmiany</span>}
        <div style={{ flex: 1 }} />
        <button type="button" className="adm-btn adm-btn--sm" onClick={() => setFull(true)}>Podgląd na pełnym ekranie ⤢</button>
        <button type="button" className={`adm-btn ${e.active ? "adm-btn--red" : ""}`} onClick={() => save()} disabled={busy || (!dirty && !!e.id)}>{busy ? "Zapisuję…" : "Zapisz"}</button>
        {!e.active && <button type="button" className="adm-btn adm-btn--red" onClick={() => save({ active: true })} disabled={busy}>Zapisz i włącz</button>}
      </div>
      {err && <div className="adm-note blg-err" role="alert">{err}</div>}

      <div className="pop-grid">
        <div className="pop-form">
          <div className="blg-card">
            <h4>Treść</h4>
            <label className="adm-f"><span>Nazwa robocza — widoczna tylko w panelu</span><input value={e.name || ""} maxLength={80} placeholder="np. Laponia 2027 — przedsprzedaż" onChange={(ev) => set("name", ev.target.value)} /></label>
            <label className="adm-f"><span>Nadtytuł <Cnt v={e.eyebrow_pl} max={LIM.eyebrow} /></span><input value={e.eyebrow_pl || ""} maxLength={LIM.eyebrow} placeholder="np. TYLKO DO KOŃCA PAŹDZIERNIKA" onChange={(ev) => set("eyebrow_pl", ev.target.value)} /></label>
            <label className="adm-f"><span>Tytuł <Cnt v={e.title_pl} max={LIM.title} /></span><input className="pop-title" value={e.title_pl || ""} maxLength={LIM.title} placeholder="np. LAPONIA 2027 — OSTATNIE MIEJSCA" onChange={(ev) => set("title_pl", ev.target.value)} /></label>
            <div className="adm-f"><span>Tekst</span>
              <RichEditor value={e.body_pl || ""} onChange={(html) => set("body_pl", html)} compact limit={{ chars: LIM.body, blocks: LIM.lines }} colors={TEXT_COLORS}
                areaClass="apop-rt" areaStyle={{ ...vars.style, background: e.color, color: vars.style["--pt2"] }} label="Tekst pop-upu"
                placeholder="Krótko: co, dla kogo, do kiedy. Pogrubienia, kolory, listy i linki dodasz z paska powyżej." />
              <p className="blg-hint">Blok ma stały rozmiar, dlatego tekst ma limit — tyle mieści się też na telefonie. Wersja angielska tłumaczy się sama po zapisie.</p>
            </div>
          </div>

          <div className="blg-card">
            <h4>Przycisk</h4>
            <label className="adm-f"><span>Napis na przycisku <Cnt v={e.btn_label_pl} max={LIM.btn} /></span><input value={e.btn_label_pl || ""} maxLength={LIM.btn} placeholder="np. SPRAWDŹ TERMINY" onChange={(ev) => set("btn_label_pl", ev.target.value)} /></label>
            <div className="adm-f"><span>Dokąd prowadzi</span>
              <div className="adm-chips">
                <button type="button" className={`adm-chip ${linkMode === "site" ? "on" : ""}`} onClick={() => { setLinkMode("site"); if (isExternal(url)) set("btn_url", ""); set("btn_blank", false); }}>Podstrona naszej strony</button>
                <button type="button" className={`adm-chip ${linkMode === "ext" ? "on" : ""}`} onClick={() => { setLinkMode("ext"); if (url && !isExternal(url)) set("btn_url", ""); set("btn_blank", true); }}>Inna strona (adres zewnętrzny)</button>
              </div>
            </div>
            {linkMode === "site" ? (
              <>
                <label className="adm-f"><span>Podstrona</span>
                  <select className="adm-select" value={ownPath ? "__own" : known ? url : ""} onChange={(ev) => { const v = ev.target.value; if (v === "__own") { setOwnPath(true); return; } setOwnPath(false); set("btn_url", v); }}>
                    <option value="">— wybierz —</option>
                    <optgroup label="Strony">{pages.main.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</optgroup>
                    {pages.prods.length > 0 && <optgroup label="Oferta">{pages.prods.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</optgroup>}
                    {pages.posts.length > 0 && <optgroup label="Blog">{pages.posts.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</optgroup>}
                    <option value="__own">Inny adres na naszej stronie…</option>
                  </select></label>
                {ownPath && <label className="adm-f"><span>Adres na stronie</span><input value={url} placeholder="/flota/bmw-m2" onChange={(ev) => set("btn_url", ev.target.value.trim())} /></label>}
              </>
            ) : (
              <label className="adm-f"><span>Adres zewnętrzny</span><input value={url} placeholder="https://heelsonthetrack.pl" onChange={(ev) => set("btn_url", ev.target.value)} /></label>
            )}
            <label className="adm-f adm-f--check"><input type="checkbox" checked={!!e.btn_blank} onChange={(ev) => set("btn_blank", ev.target.checked)} /><span>Otwórz w nowej karcie</span></label>
            <p className="blg-hint">Bez napisu i adresu pop-up nie ma przycisku — zostaje sam komunikat.</p>
          </div>

          <div className="blg-card">
            <h4>Zdjęcie i wygląd</h4>
            <ImgField label="Zdjęcie banera" dir="d" value={e.image} onChange={(v) => set("image", v)} hint="Najlepiej poziome lub kwadratowe, min. 1400 px szerokości. Zdjęcie jest kadrowane do połowy bloku — najważniejsze trzymaj na środku." />
            <ImgField label="Zdjęcie na telefon (opcjonalnie)" dir="m" value={e.image_mobile} onChange={(v) => set("image_mobile", v)} hint="Na telefonie zdjęcie jest niskim pasem u góry. Puste = to samo zdjęcie." />
            <label className="adm-f"><span>Opis zdjęcia (alt)</span><input value={e.image_alt || ""} maxLength={140} placeholder="Co widać na zdjęciu" onChange={(ev) => set("image_alt", ev.target.value)} /></label>
            <div className="adm-f"><span>Układ</span>
              <div className="pop-layouts">{POPUP_LAYOUTS.map(([v, l]) => <button type="button" key={v} className={`pop-layout pop-layout--${v} ${(e.layout || "left") === v ? "on" : ""}`} onClick={() => set("layout", v)}><i /><span>{l}</span></button>)}</div>
            </div>
            <Swatches label="Kolor bloku z tekstem" value={e.color} onChange={(v) => set("color", v)} presets={POPUP_COLORS} />
            <Swatches label="Kolor przycisku i akcentów" value={e.btn_color} onChange={(v) => set("btn_color", v)} presets={POPUP_BTN_COLORS} />
            <p className="blg-hint">Kolor tekstu dobiera się sam — biały na ciemnym bloku, czarny na jasnym.</p>
          </div>

          <div className="blg-card">
            <h4>Kiedy i gdzie się pokazuje</h4>
            <label className="adm-f adm-f--check"><input type="checkbox" checked={!!e.active} onChange={(ev) => set("active", ev.target.checked)} /><span>Włączony — pokazuj na stronie</span></label>
            {e.active && others.length > 0 && <p className="blg-hint pop-warn">Po zapisaniu wyłączy się „{others[0].name || others[0].title_pl}” — włączony może być tylko jeden pop-up.</p>}
            <div className="adm-f"><span>Po ilu sekundach na stronie</span>
              <div className="pop-delay">
                <input type="number" min={0} max={600} value={e.delay_sec ?? 5} onChange={(ev) => set("delay_sec", ev.target.value === "" ? "" : Number(ev.target.value))} /><b>s</b>
                <div className="adm-chips">{DELAYS.map((d) => <button type="button" key={d} className={`adm-chip ${Number(e.delay_sec) === d ? "on" : ""}`} onClick={() => set("delay_sec", d)}>{d ? `${d} s` : "od razu"}</button>)}</div>
              </div>
              <p className="blg-hint">Liczy się czas faktycznie spędzony na stronie w czasie jednej wizyty (także po przejściu na inną podstronę), od zamknięcia okna cookies.</p>
            </div>
            <label className="adm-f"><span>Gdzie</span>
              <select className="adm-select" value={e.pages || "all"} onChange={(ev) => set("pages", ev.target.value)}>
                <option value="all">Na całej stronie</option><option value="home">Tylko na stronie głównej</option>
              </select></label>
            <div className="pop-dates">
              <label className="adm-f"><span>Pokazuj od (opcjonalnie)</span><input type="date" value={e.date_from || ""} onChange={(ev) => set("date_from", ev.target.value || null)} /></label>
              <label className="adm-f"><span>Pokazuj do (opcjonalnie)</span><input type="date" value={e.date_to || ""} onChange={(ev) => set("date_to", ev.target.value || null)} /></label>
            </div>
            <p className="blg-hint">Daty pozwalają zaplanować kampanię: włączony pop-up zacznie i przestanie się pokazywać sam.</p>
          </div>
        </div>

        <aside className="pop-side">
          <div className="blg-card">
            <div className="pop-side__head">
              <h4>Podgląd na żywo</h4>
              <div className="adm-chips">
                <button type="button" className={`adm-chip ${device === "desktop" ? "on" : ""}`} onClick={() => setDevice("desktop")}>Komputer</button>
                <button type="button" className={`adm-chip ${device === "mobile" ? "on" : ""}`} onClick={() => setDevice("mobile")}>Telefon</button>
                {hasEn && <button type="button" className={`adm-chip ${plang === "en" ? "on" : ""}`} onClick={() => setPlang((l) => (l === "pl" ? "en" : "pl"))} title="Wersja angielska (tłumaczenie automatyczne)">EN</button>}
              </div>
            </div>
            <Preview p={shown} device={device} lang={plang} replay={replay} />
            <div className="pop-side__foot">
              <button type="button" className="adm-mini" onClick={() => setReplay((n) => n + 1)}>↻ Odtwórz animację</button>
              <button type="button" className="adm-mini adm-mini--dark" onClick={() => setFull(true)}>Pełny ekran ⤢</button>
            </div>
          </div>
          {e.id && (
            <div className="blg-card">
              <h4>Statystyki</h4>
              <div className="pop-stats">
                <div><b>{live?.views || 0}</b><span>wyświetleń</span></div>
                <div><b>{live?.clicks || 0}</b><span>kliknięć w przycisk</span></div>
                <div><b>{pct(live?.clicks || 0, live?.views || 0)}</b><span>skuteczność</span></div>
              </div>
              <p className="blg-hint">Wyświetlenie liczy się raz na wizytę. Podglądy w panelu i wejścia zalogowanych administratorów nie są liczone.</p>
            </div>
          )}
        </aside>
      </div>
      {full && createPortal(<PopupView p={shown} lang={plang} onClose={() => setFull(false)} onGo={(ev) => ev.preventDefault()} />, document.body)}
    </div>
  );
}
