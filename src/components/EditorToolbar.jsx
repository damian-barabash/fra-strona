import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { sanitize } from "./Editable";

/* Floating rich-text toolbar for the inline CMS. It appears above any text selection made inside
   an editable element and applies bold / italic / underline / size / colour / alignment.
   Formatting is saved as HTML on the element's content key. */
const SIZES = [["S", "0.85em"], ["M", ""], ["L", "1.25em"], ["XL", "1.6em"]];
const COLORS = ["#e30613", "#14161a", "#ffffff", "#6c7075", "#f0a500", "#2f9fe0", "#21b573"];

export default function EditorToolbar() {
  const { cmsMode, isAdmin, saveContent, raw } = useStore();
  const [pos, setPos] = useState(null);
  const [target, setTarget] = useState(null);
  const [color, setColor] = useState("#e30613");
  const barRef = useRef(null);
  const active = cmsMode && isAdmin;

  useEffect(() => {
    if (!active) { setPos(null); return; }
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { if (!barRef.current?.contains(document.activeElement)) setPos(null); return; }
      const range = sel.getRangeAt(0);
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentElement;
      const el = node?.closest?.("[data-editable]");
      if (!el) { setPos(null); return; }
      const r = range.getBoundingClientRect();
      setTarget(el);
      setPos({ x: Math.max(160, Math.min(window.innerWidth - 160, r.left + r.width / 2)), y: Math.max(64, r.top + window.scrollY - 54) });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [active]);

  if (!active || !pos || !target) return null;

  const save = () => {
    const key = target.dataset.key;
    const html = sanitize(target.innerHTML);
    const val = /<\/?[a-z][^>]*>/i.test(html) ? html : target.textContent;
    if (key && val.trim()) saveContent(key, val, /<\/?[a-z][^>]*>/i.test(html) ? "html" : raw(key).kind);
  };
  const run = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); target.focus(); fn(); save(); };
  const exec = (cmd, val) => document.execCommand(cmd, false, val);
  const wrapSize = (size) => {
    exec("fontSize", "7");   // marker, then swap the <font> for a span with a real size
    target.querySelectorAll('font[size="7"]').forEach((f) => {
      const sp = document.createElement("span");
      if (size) sp.style.fontSize = size;
      sp.innerHTML = f.innerHTML; f.replaceWith(sp);
    });
  };
  const align = (a) => { target.style.textAlign = a; target.innerHTML = `<div style="text-align:${a}">${target.innerHTML.replace(/<div style="text-align:[^"]*">|<\/div>/g, "")}</div>`; };
  const clear = () => { exec("removeFormat"); target.innerHTML = target.textContent; target.style.textAlign = ""; };

  return (
    <div ref={barRef} className="cms-tb" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.preventDefault()}>
      <button title="Pogrubienie" onMouseDown={run(() => exec("bold"))}><b>B</b></button>
      <button title="Kursywa" onMouseDown={run(() => exec("italic"))}><i>I</i></button>
      <button title="Podkreślenie" onMouseDown={run(() => exec("underline"))}><u>U</u></button>
      <span className="cms-tb__sep" />
      {SIZES.map(([l, v]) => <button key={l} title={`Rozmiar ${l}`} className="cms-tb__sz" onMouseDown={run(() => wrapSize(v))}>{l}</button>)}
      <span className="cms-tb__sep" />
      {COLORS.map((c) => <button key={c} title={c} className="cms-tb__c" style={{ background: c }} onMouseDown={run(() => exec("foreColor", c))} />)}
      <label className="cms-tb__pick" title="Własny kolor">
        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); target.focus(); exec("foreColor", e.target.value); save(); }} />
      </label>
      <span className="cms-tb__sep" />
      <button title="Do lewej" onMouseDown={run(() => align("left"))}>≡</button>
      <button title="Środek" onMouseDown={run(() => align("center"))}>☰</button>
      <button title="Do prawej" onMouseDown={run(() => align("right"))}>≡</button>
      <span className="cms-tb__sep" />
      <button title="Wyczyść formatowanie" onMouseDown={run(clear)}>✕</button>
    </div>
  );
}
