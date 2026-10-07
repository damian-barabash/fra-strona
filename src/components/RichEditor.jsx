import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { processUpload } from "../lib/api";
import { sanitizeRich, embedUrl, plainText, wordCount, readingMinutes, richStats } from "../lib/richtext";
import UploadStatus from "./UploadStatus";
import "../sections/richtext.css";
import "./richeditor.css";

/* Rich content editor of the panel (blog posts). A contentEditable area styled exactly like the
   article page (.rt), with a toolbar: headings, bold / italic / underline / strike, lists, quote,
   alignment, accent colour, links, photos (converted to WebP and uploaded), buttons, YouTube / Vimeo
   video, divider, undo / redo and an HTML view. Whatever leaves the editor went through sanitizeRich.

   `compact` is the same editor for a short text in a block of fixed size (the advertising pop-up):
   no photos, video, buttons or big headings, and a `limit` ({ chars, blocks }) — typing stops at the
   limit, a longer paste is flagged in the counter (the form refuses to save it). `areaClass` /
   `areaStyle` dress the writing area like the block the text will sit in. */

const ic = (d) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
const IC = {
  ul: ic(<><path d="M9 6h12M9 12h12M9 18h12" /><path d="M3.5 6h1M3.5 12h1M3.5 18h1" strokeWidth="3" /></>),
  ol: ic(<><path d="M10 6h11M10 12h11M10 18h11" /><path d="M3.5 4.5L5 4v4M3.5 15h2l-2 3h2.2" strokeWidth="1.5" /></>),
  quote: ic(<path d="M4 17c0-5 1-8 5-10M13 17c0-5 1-8 5-10M4 17h4v-4H4.4M13 17h4v-4h-3.6" />),
  left: ic(<path d="M3 6h18M3 11h11M3 16h18M3 21h11" />),
  center: ic(<path d="M3 6h18M7 11h10M3 16h18M7 21h10" />),
  right: ic(<path d="M3 6h18M10 11h11M3 16h18M10 21h11" />),
  link: ic(<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></>),
  unlink: ic(<><path d="M13 5.8l.9-.9a4.5 4.5 0 0 1 6.4 6.4l-.9.9M11 18.2l-.9.9a4.5 4.5 0 0 1-6.4-6.4l.9-.9" /><path d="M4 4l16 16" /></>),
  image: ic(<><rect x="3" y="4" width="18" height="16" rx="1" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 8" /></>),
  button: ic(<><rect x="2.5" y="7" width="19" height="10" /><path d="M7 12h7M13 10l2 2-2 2" /></>),
  video: ic(<><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M10 9.2v5.6l5-2.8z" /></>),
  hr: ic(<path d="M3 12h18M7 6h10M7 18h10" />),
  undo: ic(<path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -3)" />),
  redo: ic(<path d="M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12" transform="translate(0 -3)" />),
  clear: ic(<path d="M5 5h14M12 5l-3 14M5 19h8M15 15l5 5M20 15l-5 5" />),
  code: ic(<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />),
  trash: ic(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />),
};
const COLORS = [["#e30613", "Czerwony"], ["#14161a", "Czarny"], ["#6c7075", "Szary"], ["#b8860b", "Złoty"]];
const FIG_SIZES = [["rt-fig", "Na szerokość tekstu"], ["rt-fig rt-fig--wide", "Szersze niż tekst"], ["rt-fig rt-fig--left", "Do lewej, tekst obok"], ["rt-fig rt-fig--right", "Do prawej, tekst obok"]];
const BTN_STYLES = [["", "Czerwony"], ["rt-btn--dark", "Czarny"], ["rt-btn--ghost", "Obrys"]];

// what was typed in an address field → a usable href ("www.x.pl" → https://, an e-mail → mailto:, a phone → tel:)
export function normUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(s)) return s;
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^\+?\d[\d\s-]{6,}$/.test(s)) return `tel:${s.replace(/[\s-]/g, "")}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "";            // javascript:, data: and friends
  return `https://${s}`;
}
// a toolbar button acts on mousedown, so the selection in the text is never lost
function B({ on, title, onHit, children, cls = "" }) {
  return <button type="button" className={`rte__b ${on ? "on" : ""} ${cls}`} title={title} aria-label={title} aria-pressed={on ? "true" : undefined} onMouseDown={(e) => { e.preventDefault(); onHit(); }}>{children}</button>;
}
const isBlank = (el) => !el.textContent.replace(/[\s ​]/g, "") && !el.querySelector("img, iframe");

export default function RichEditor({ value, onChange, placeholder = "Zacznij pisać…", compact = false, limit = null, colors = COLORS, areaClass = "rt", areaStyle, label = "Treść wpisu" }) {
  const { adminCall } = useStore();
  const area = useRef(null);
  const last = useRef(null);       // the HTML last handed to onChange
  const saved = useRef(null);      // last selection inside the area (dialogs and file pickers take the focus)
  const fileRef = useRef(null);
  const [st, setSt] = useState(null);
  const [dlg, setDlg] = useState(null);   // { type: "link" | "button" | "video", … }
  const [fig, setFig] = useState(null);   // selected figure (element) + its editable values
  const [act, setAct] = useState({});
  const [source, setSource] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* old browsers */ } }, []);
  // The area is filled once, when the editor opens. From then on the text lives in the DOM and only
  // flows out through onChange — writing `value` back while someone types would move the caret.
  useEffect(() => {
    area.current.innerHTML = value || "<p><br></p>";
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    const html = sanitizeRich(area.current.innerHTML);
    last.current = html;
    onChange(html);
  };

  const refresh = () => {
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    let block = ""; try { block = String(document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, ""); } catch { /* */ }
    const n = saved.current?.startContainer;
    const host = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
    const next = { bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"),
      center: q("justifyCenter"), right: q("justifyRight"), block: host?.closest?.("blockquote") ? "blockquote" : block, link: !!host?.closest?.("a:not(.rt-btn)") };
    setAct((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  };
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !area.current) return;
      const r = sel.getRangeAt(0);
      if (!area.current.contains(r.commonAncestorContainer)) return;
      saved.current = r.cloneRange();
      refresh();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  // The browser does not report every caret move (typing does not always fire selectionchange), so the
  // selection is also read at the moment it is needed: a toolbar button is pressed while it is still in the text.
  const grab = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !area.current) return;
    const r = sel.getRangeAt(0);
    if (area.current.contains(r.commonAncestorContainer)) saved.current = r.cloneRange();
  };
  const restore = () => {
    const el = area.current; el.focus();
    const r = saved.current;
    if (r && el.contains(r.commonAncestorContainer)) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  };
  const exec = (cmd, val = null, css = false) => {
    grab(); restore();
    document.execCommand("styleWithCSS", false, css);
    document.execCommand(cmd, false, val);
    emit(); refresh();
  };
  // a text with a limit: the next character or line is simply not taken once the limit is reached
  useEffect(() => {
    const el = area.current;
    if (!limit || !el) return;
    const guard = (e) => {
      const type = e.inputType || "";
      if (!type.startsWith("insert") || type === "insertFromPaste" || type === "insertFromDrop") return;
      const st = richStats(el.innerHTML);
      const sel = window.getSelection();
      const replacing = sel && sel.rangeCount && !sel.isCollapsed;
      if (type === "insertParagraph" || type === "insertLineBreak") { if (limit.blocks && st.blocks >= limit.blocks) e.preventDefault(); return; }
      if (!replacing && limit.chars && st.chars >= limit.chars) e.preventDefault();
    };
    el.addEventListener("beforeinput", guard);
    return () => el.removeEventListener("beforeinput", guard);
  }, [limit?.chars, limit?.blocks]);

  const setBlock = (tag) => exec("formatBlock", act.block === tag ? "p" : tag);
  const hit = (fn) => (e) => { e.preventDefault(); fn(); };   // mousedown: the selection stays in the text

  /* ---- blocks that are inserted as a whole (photo, button, video, divider) ---- */
  const topBlock = (n) => { const el = area.current; while (n && n.parentNode !== el) n = n.parentNode; return n || null; };
  const insertBlock = (node) => {
    grab();
    const el = area.current;
    const r = saved.current;
    const ref = r && el.contains(r.startContainer) ? topBlock(r.startContainer) : null;
    if (ref && ref.tagName === "P" && isBlank(ref)) ref.replaceWith(node);
    else if (ref) ref.after(node);
    else el.append(node);
    let next = node.nextElementSibling;
    if (!next) { next = document.createElement("p"); next.innerHTML = "<br>"; node.after(next); }
    const range = document.createRange(); range.selectNodeContents(next); range.collapse(true);
    el.focus();
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(range);
    saved.current = range.cloneRange();
    emit();
  };

  const addImages = async (files) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const url = await processUpload(file, `blog/${Date.now()}-${Math.round(performance.now())}`, adminCall, setSt);
      if (!url) continue;
      const f = document.createElement("figure"); f.className = "rt-fig";
      const img = document.createElement("img"); img.alt = "";
      // real dimensions in the markup — the page reserves the space before the photo arrives
      img.addEventListener("load", () => { img.setAttribute("width", img.naturalWidth); img.setAttribute("height", img.naturalHeight); emit(); }, { once: true });
      img.src = url;
      f.append(img); insertBlock(f);
    }
    setTimeout(() => setSt((x) => (x && (x.stage === "done" || x.stage === "error") ? null : x)), 5000);
  };

  /* ---- figure tools ---- */
  const pickFig = (el) => {
    area.current.querySelectorAll(".rte-sel").forEach((x) => x.classList.remove("rte-sel"));
    if (!el) { setFig(null); return; }
    el.classList.add("rte-sel");
    const img = el.querySelector("img");
    setFig({ el, video: !img, cls: el.className.replace(/\s*rte-sel/, "").trim(), alt: img?.getAttribute("alt") || "", cap: el.querySelector("figcaption")?.textContent || "" });
  };
  const figSet = (patch) => {
    const el = fig.el;
    if ("cls" in patch) el.className = `${patch.cls} rte-sel`;
    if ("alt" in patch) el.querySelector("img")?.setAttribute("alt", patch.alt);
    if ("cap" in patch) {
      let c = el.querySelector("figcaption");
      if (patch.cap && !c) { c = document.createElement("figcaption"); el.append(c); }
      if (c) { if (patch.cap) c.textContent = patch.cap; else c.remove(); }
    }
    setFig((f) => ({ ...f, ...patch })); emit();
  };
  const figRemove = () => { fig.el.remove(); setFig(null); if (!area.current.children.length) area.current.innerHTML = "<p><br></p>"; emit(); };

  /* ---- dialogs ---- */
  const anchorHere = () => { const n = saved.current?.startContainer; const h = n ? (n.nodeType === 1 ? n : n.parentElement) : null; return h?.closest?.("a:not(.rt-btn)") || null; };
  const openLink = () => {
    grab();
    const a = anchorHere();
    const collapsed = !saved.current || saved.current.collapsed;
    setDlg({ type: "link", el: a, url: a?.getAttribute("href") || "", blank: a ? a.getAttribute("target") === "_blank" : null, text: !a && collapsed ? "" : null });
  };
  const openButton = (el = null) => { grab(); setDlg({ type: "button", el, text: el?.textContent || "", url: el?.getAttribute("href") || "", style: BTN_STYLES.map((x) => x[0]).find((c) => c && el?.classList.contains(c)) || "", blank: el ? el.getAttribute("target") === "_blank" : null }); };
  const wantsBlank = (d) => d.blank ?? /^https?:/i.test(normUrl(d.url));
  const setTarget = (a, on) => { if (on) a.setAttribute("target", "_blank"); else a.removeAttribute("target"); };

  const apply = () => {
    const d = dlg;
    if (d.type === "video") {
      const u = embedUrl(d.url);
      if (!u) { setDlg({ ...d, err: "Wklej adres filmu z YouTube albo Vimeo." }); return; }
      const f = document.createElement("figure"); f.className = "rt-video";
      const fr = document.createElement("iframe"); fr.src = u; f.append(fr);
      setDlg(null); insertBlock(f); return;
    }
    const url = normUrl(d.url);
    if (!url) { setDlg({ ...d, err: "Wpisz adres — np. /kalendarz albo https://…" }); return; }
    if (d.type === "button") {
      if (!d.text.trim()) { setDlg({ ...d, err: "Wpisz napis na przycisku." }); return; }
      const a = d.el || document.createElement("a");
      a.className = `rt-btn ${d.style}`.trim(); a.setAttribute("href", url); a.textContent = d.text.trim(); setTarget(a, wantsBlank(d));
      setDlg(null);
      if (d.el) { emit(); return; }
      const p = document.createElement("p"); p.className = "rt-cta"; p.append(a);
      insertBlock(p); return;
    }
    // link
    setDlg(null);
    if (d.el) { d.el.setAttribute("href", url); setTarget(d.el, wantsBlank(d)); emit(); return; }
    restore();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      const a = document.createElement("a"); a.setAttribute("href", url); a.textContent = (d.text || "").trim() || url.replace(/^(https?:\/\/|mailto:|tel:)/, ""); setTarget(a, wantsBlank(d));
      const r = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (r && area.current.contains(r.startContainer)) r.insertNode(a); else (area.current.lastElementChild || area.current).append(a);
      leaveLink(a);
    } else {
      document.execCommand("createLink", false, url);
      let made = null;
      area.current.querySelectorAll("a:not(.rt-btn)").forEach((a) => { if (a.getAttribute("href") === url && sel.containsNode(a, true)) { setTarget(a, wantsBlank(d)); made = a; } });
      if (made) leaveLink(made);
    }
    emit();
  };
  // put the caret behind a fresh link (behind a space when nothing follows) — otherwise what is typed next joins the link
  const leaveLink = (a) => {
    let n = a; while (n.parentNode && n.parentNode !== area.current && !n.nextSibling && /^(STRONG|EM|B|I|U|S|SPAN)$/.test(n.parentNode.tagName)) n = n.parentNode;
    let after = n.nextSibling;
    if (!after || after.nodeType !== 3) { after = document.createTextNode("\u00a0"); n.after(after); }
    const r = document.createRange(); r.setStart(after, after.textContent.startsWith("\u00a0") && after.textContent.length === 1 ? 1 : 0); r.collapse(true);
    const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); saved.current = r.cloneRange();
  };
  const removeButton = () => { const p = dlg.el.closest("p"); if (p && p.children.length === 1) p.remove(); else dlg.el.remove(); setDlg(null); emit(); };

  /* ---- area events ---- */
  const onClick = (e) => {
    const btn = e.target.closest?.("a.rt-btn");
    if (btn) { e.preventDefault(); pickFig(null); openButton(btn); return; }
    if (e.target.closest?.("a")) e.preventDefault();
    pickFig(e.target.closest?.("figure") || null);
  };
  const onPaste = (e) => {
    const cd = e.clipboardData; if (!cd) return;
    const files = [...cd.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); if (!compact) addImages(files); return; }
    const html = cd.getData("text/html");
    if (!html) return;                                       // plain text: the browser's own paste is fine
    e.preventDefault();
    document.execCommand("insertHTML", false, sanitizeRich(html));
    emit();
  };
  const onDrop = (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault(); if (!compact) addImages(files);
  };
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); }
  };

  const toggleSource = () => {
    if (!source) { setSrc(last.current ?? value ?? ""); pickFig(null); setDlg(null); setSource(true); return; }
    const html = sanitizeRich(src);
    area.current.innerHTML = html || "<p><br></p>";
    last.current = html; onChange(html); setSource(false);
  };

  const stats = limit ? richStats(value) : null;
  const over = !!limit && ((limit.chars && stats.chars > limit.chars) || (limit.blocks && stats.blocks > limit.blocks));
  const empty = !plainText(value) && !/<(img|iframe|hr)/i.test(value || "");
  const dlgKey = (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } else if (e.key === "Escape") { e.preventDefault(); setDlg(null); } };

  return (
    <div className={`rte ${source ? "is-src" : ""} ${compact ? "rte--compact" : ""} ${over ? "is-over" : ""}`}>
      <div className="rte__bar">
        <div className="rte__row">
          <B title="Akapit" on={act.block === "p" || act.block === "div" || !act.block} onHit={() => exec("formatBlock", "p")} cls="rte__b--t">Akapit</B>
          {!compact && <B title="Nagłówek duży (H2)" on={act.block === "h2"} onHit={() => setBlock("h2")} cls="rte__b--t">H2</B>}
          <B title={compact ? "Śródtytuł" : "Nagłówek mniejszy (H3)"} on={act.block === "h3"} onHit={() => setBlock("h3")} cls="rte__b--t">{compact ? "Śródtytuł" : "H3"}</B>
          {!compact && <B title="Nadtytuł (mały, czerwony)" on={act.block === "h4"} onHit={() => setBlock("h4")} cls="rte__b--t">H4</B>}
          <i className="rte__sep" />
          <B title="Pogrubienie (Ctrl+B)" on={act.bold} onHit={() => exec("bold")}><b>B</b></B>
          <B title="Kursywa (Ctrl+I)" on={act.italic} onHit={() => exec("italic")}><em>I</em></B>
          <B title="Podkreślenie (Ctrl+U)" on={act.underline} onHit={() => exec("underline")}><u>U</u></B>
          <B title="Przekreślenie" on={act.strike} onHit={() => exec("strikeThrough")}><s>S</s></B>
          {colors.map(([c, l]) => <B key={c} title={`Kolor tekstu: ${l}`} onHit={() => exec("foreColor", c, true)} cls="rte__b--c"><span style={{ background: c }} /></B>)}
          <i className="rte__sep" />
          <B title="Lista punktowana" on={act.ul} onHit={() => exec("insertUnorderedList")}>{IC.ul}</B>
          <B title="Lista numerowana" on={act.ol} onHit={() => exec("insertOrderedList")}>{IC.ol}</B>
          {!compact && <B title="Cytat / wyróżnienie" on={act.block === "blockquote"} onHit={() => setBlock("blockquote")}>{IC.quote}</B>}
          <i className="rte__sep" />
          <B title="Do lewej" onHit={() => exec("justifyLeft", null, true)}>{IC.left}</B>
          <B title="Wyśrodkuj" on={act.center} onHit={() => exec("justifyCenter", null, true)}>{IC.center}</B>
          <B title="Do prawej" on={act.right} onHit={() => exec("justifyRight", null, true)}>{IC.right}</B>
          <i className="rte__sep" />
          <B title="Link (Ctrl+K)" on={act.link} onHit={openLink}>{IC.link}</B>
          <B title="Usuń link" onHit={() => exec("unlink")}>{IC.unlink}</B>
          {!compact && <>
          <i className="rte__sep" />
          <B title="Wstaw zdjęcie" onHit={() => { grab(); fileRef.current?.click(); }} cls="rte__b--w">{IC.image}<span>Zdjęcie</span></B>
          <B title="Wstaw przycisk" onHit={() => openButton()} cls="rte__b--w">{IC.button}<span>Przycisk</span></B>
          <B title="Wstaw film (YouTube / Vimeo)" onHit={() => { grab(); setDlg({ type: "video", url: "" }); }} cls="rte__b--w">{IC.video}<span>Wideo</span></B>
          <B title="Linia oddzielająca" onHit={() => insertBlock(document.createElement("hr"))}>{IC.hr}</B>
          </>}
          <i className="rte__sep" />
          <B title="Cofnij (Ctrl+Z)" onHit={() => exec("undo")}>{IC.undo}</B>
          <B title="Ponów" onHit={() => exec("redo")}>{IC.redo}</B>
          <B title="Wyczyść formatowanie zaznaczenia" onHit={() => exec("removeFormat")}>{IC.clear}</B>
          {!compact && <button type="button" className={`rte__b rte__b--src ${source ? "on" : ""}`} title="Widok HTML" aria-label="Widok HTML" onMouseDown={hit(toggleSource)}>{IC.code}</button>}
        </div>

        {dlg && (
          <div className="rte__dlg" onKeyDown={dlgKey}>
            <b className="rte__dlg-t">{dlg.type === "link" ? "Link" : dlg.type === "button" ? "Przycisk" : "Wideo"}</b>
            {dlg.type === "button" && <input className="rte__in" autoFocus placeholder="Napis na przycisku — np. ZAREZERWUJ TERMIN" value={dlg.text} onChange={(e) => setDlg({ ...dlg, text: e.target.value, err: "" })} />}
            {dlg.type === "link" && dlg.text !== null && <input className="rte__in" placeholder="Tekst linku (opcjonalnie)" value={dlg.text} onChange={(e) => setDlg({ ...dlg, text: e.target.value })} />}
            <input className="rte__in rte__in--url" autoFocus={dlg.type !== "button"} placeholder={dlg.type === "video" ? "https://www.youtube.com/watch?v=…" : "Adres: /kalendarz, https://…, e-mail lub telefon"} value={dlg.url} onChange={(e) => setDlg({ ...dlg, url: e.target.value, err: "" })} />
            {dlg.type === "button" && <select className="rte__in rte__in--sel" value={dlg.style} onChange={(e) => setDlg({ ...dlg, style: e.target.value })}>{BTN_STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
            {dlg.type !== "video" && <label className="rte__chk"><input type="checkbox" checked={wantsBlank(dlg)} onChange={(e) => setDlg({ ...dlg, blank: e.target.checked })} />Nowa karta</label>}
            <button type="button" className="adm-btn adm-btn--red adm-btn--sm" onClick={apply}>{dlg.el ? "Zmień" : "Wstaw"}</button>
            {dlg.type === "button" && dlg.el && <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={removeButton}>Usuń</button>}
            <button type="button" className="adm-btn adm-btn--sm" onClick={() => setDlg(null)}>Anuluj</button>
            {dlg.err && <span className="rte__err">{dlg.err}</span>}
          </div>
        )}

        {fig && !source && (
          <div className="rte__dlg rte__dlg--fig">
            <b className="rte__dlg-t">{fig.video ? "Wideo" : "Zdjęcie"}</b>
            {!fig.video && <select className="rte__in rte__in--sel" value={fig.cls} onChange={(e) => figSet({ cls: e.target.value })}>{FIG_SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
            {!fig.video && <input className="rte__in" placeholder="Opis zdjęcia dla Google (alt) — co widać na zdjęciu" value={fig.alt} onChange={(e) => figSet({ alt: e.target.value })} />}
            {!fig.video && <input className="rte__in" placeholder="Podpis pod zdjęciem (opcjonalnie)" value={fig.cap} onChange={(e) => figSet({ cap: e.target.value })} />}
            <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={figRemove}>{IC.trash}Usuń</button>
            <button type="button" className="adm-btn adm-btn--sm" onClick={() => pickFig(null)}>Gotowe</button>
          </div>
        )}
      </div>

      <div
        ref={area} className={`${areaClass} rte__area ${empty ? "is-empty" : ""}`} style={areaStyle} data-ph={placeholder} hidden={source}
        contentEditable suppressContentEditableWarning spellCheck role="textbox" aria-multiline="true" aria-label={label}
        onInput={emit} onBlur={emit} onKeyUp={() => { grab(); refresh(); }} onMouseUp={() => { grab(); refresh(); }} onClick={onClick} onPaste={onPaste} onDrop={onDrop} onKeyDown={onKeyDown}
      />
      {source && <textarea className="rte__src" value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} aria-label="Kod HTML wpisu" />}

      <div className="rte__foot">
        {limit
          ? <span className={`rte__limit ${over ? "bad" : ""}`}>{limit.chars ? <b className={stats.chars > limit.chars ? "bad" : ""}>{stats.chars}/{limit.chars} znaków</b> : null}{limit.blocks ? <b className={stats.blocks > limit.blocks ? "bad" : ""}>{stats.blocks}/{limit.blocks} linii</b> : null}{over && <em>Za długi tekst — nie zmieści się w bloku. Skróć go.</em>}</span>
          : <span>{wordCount(value)} słów · ok. {readingMinutes(value)} min czytania</span>}
        <UploadStatus st={st} />
        <span className="rte__hint">{compact ? "Ctrl+K — link. Enter — nowa linia." : source ? "Widok HTML — kliknij ponownie </>, żeby wrócić do edytora." : "Zdjęcie można też wkleić ze schowka albo przeciągnąć z dysku."}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ""; addImages(files); }} />
    </div>
  );
}
