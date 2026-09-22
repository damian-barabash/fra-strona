import { useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { fileToWebpDataUrl, fileToDataUrl } from "../lib/api";

/* ---------- tiny HTML sanitiser for CMS rich text (b/i/u/span/color/size/align only) ---------- */
const ALLOWED = /^(b|strong|i|em|u|s|span|br|font|mark|a|div|p)$/i;
export function sanitize(html) {
  if (!html || typeof html !== "string") return "";
  if (!/[<>]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild;
  const walk = (el) => {
    [...el.children].forEach((c) => {
      if (!ALLOWED.test(c.tagName)) { c.replaceWith(...c.childNodes); walk(el); return; }
      [...c.attributes].forEach((a) => {
        const n = a.name.toLowerCase();
        if (n === "style") {
          const ok = a.value.split(";").map((x) => x.trim()).filter((x) => /^(color|font-size|font-weight|font-style|text-decoration|text-align|background-color|letter-spacing|text-transform)\s*:/i.test(x));
          if (ok.length) c.setAttribute("style", ok.join(";")); else c.removeAttribute("style");
        } else if (n === "href") { if (/^(https?:|\/|mailto:|tel:)/i.test(a.value)) return; c.removeAttribute("href"); }
        else if (n === "target" || n === "rel") return;
        else c.removeAttribute(a.name);
      });
      walk(c);
    });
  };
  walk(root);
  return root.innerHTML;
}
const hasTags = (s) => /<\/?[a-z][^>]*>/i.test(String(s || ""));

/** Inline-editable text bound to a content KV key. Editing always targets the PL source;
 *  EN is auto-translated server-side on save. Rich formatting (bold, size, colour, alignment)
 *  comes from the floating toolbar (see EditorToolbar in CmsBar) and is stored as kind "html". */
export function EText({ id, as = "span", className, style, multiline = false }) {
  const { t, raw, cmsMode, isAdmin, saveContent } = useStore();
  const ref = useRef(null);
  const editing = cmsMode && isAdmin;
  const display = editing ? (raw(id).pl || t(id)) : t(id);
  const rich = hasTags(display);

  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    if (rich) ref.current.innerHTML = sanitize(display); else ref.current.textContent = display;
  }, [display, editing, rich]);

  const Tag = as;
  if (!editing) {
    if (rich) return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: sanitize(display) }} />;
    return <Tag className={className} style={style}>{display}</Tag>;
  }

  const commit = (el) => {
    const html = sanitize(el.innerHTML);
    const text = el.textContent;
    if (text.trim() === "" && !html.includes("<img")) return;   // never wipe a label
    const val = hasTags(html) ? html : text;
    if (val !== raw(id).pl) saveContent(id, val, hasTags(html) ? "html" : (raw(id).kind === "html" ? "html" : raw(id).kind));
  };

  return (
    <Tag
      ref={ref} className={className} style={style}
      data-editable data-key={id} contentEditable suppressContentEditableWarning
      onKeyDown={(e) => { if (!multiline && e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      onBlur={(e) => commit(e.currentTarget)}
    />
  );
}

/** Inline-editable image / video bound to a content KV key (stores the URL). */
export function EMedia({ id, kind = "image", className, style, videoProps = {}, imgProps = {}, wrapperStyle, alt = "" }) {
  const { media, cmsMode, isAdmin, saveContent, adminCall } = useStore();
  const url = media(id);
  const editing = cmsMode && isAdmin;
  const inputRef = useRef(null);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const dataUrl = isVideo ? await fileToDataUrl(file) : await fileToWebpDataUrl(file);
    const ext = isVideo ? (file.type === "video/webm" ? "webm" : "mp4") : "webp";
    const path = `content/${id.replace(/\W+/g, "_")}-${Date.now()}.${ext}`;
    const r = await adminCall("media.upload", { path, dataUrl });
    if (r.ok) await saveContent(id, r.url, kind);
    e.target.value = "";
  };

  const media_el = kind === "video"
    ? <video className={className} style={style} src={url} autoPlay loop muted playsInline {...videoProps} />
    : <img className={className} style={style} src={url} alt={alt} loading="lazy" {...imgProps} />;

  if (!editing) return media_el;
  return (
    <span data-editable-media style={{ position: "relative", display: "block", cursor: "pointer", ...(kind === "video" ? { height: "100%" } : {}), ...wrapperStyle }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); inputRef.current?.click(); }}>
      {media_el}
      <span style={{
        position: "absolute", top: 10, right: 10, zIndex: 5, background: "var(--red)", color: "#fff",
        font: "700 11px/1 var(--font-display)", letterSpacing: ".1em", padding: "7px 10px", borderRadius: 2,
        textTransform: "uppercase", pointerEvents: "none",
      }}>{kind === "video" ? "▲ Wideo" : "▲ Zdjęcie"}</span>
      <input ref={inputRef} type="file" accept={kind === "video" ? "video/*" : "image/*"} hidden onChange={onPick} />
    </span>
  );
}

/** Background image bound to a content key (for CSS-background blocks). Editable like EMedia. */
export function EBg({ id, className, style, children }) {
  const { media, cmsMode, isAdmin, saveContent, adminCall } = useStore();
  const url = media(id);
  const editing = cmsMode && isAdmin;
  const inputRef = useRef(null);
  const onPick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await fileToWebpDataUrl(file);
    const r = await adminCall("media.upload", { path: `content/${id.replace(/\W+/g, "_")}-${Date.now()}.webp`, dataUrl });
    if (r.ok) await saveContent(id, r.url, "image");
    e.target.value = "";
  };
  return (
    <div className={className} style={{ ...style, backgroundImage: `url(${url})` }} data-editable-media={editing ? "" : undefined}
      onClick={editing ? (e) => { e.preventDefault(); e.stopPropagation(); inputRef.current?.click(); } : undefined}>
      {children}
      {editing && (
        <>
          <span style={{ position: "absolute", top: 10, right: 10, zIndex: 5, background: "var(--red)", color: "#fff", font: "700 11px/1 var(--font-display)", letterSpacing: ".1em", padding: "7px 10px", textTransform: "uppercase", pointerEvents: "none" }}>▲ Tło</span>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
        </>
      )}
    </div>
  );
}
