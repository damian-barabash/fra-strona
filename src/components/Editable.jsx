import { useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { fileToWebpDataUrl, fileToDataUrl } from "../lib/api";

/** Inline-editable text bound to a content KV key. Editing always targets the PL source;
 *  EN is auto-translated server-side on save. */
export function EText({ id, as = "span", className, style, multiline = false }) {
  const { t, raw, cmsMode, isAdmin, saveContent } = useStore();
  const ref = useRef(null);
  const editing = cmsMode && isAdmin;
  // in edit mode show the effective PL value (DB row OR default) so text never blanks out
  const display = editing ? (raw(id).pl || t(id)) : t(id);

  // `editing` is in deps too: entering edit mode reuses the same DOM node, React strips its
  // text child, and display is unchanged for PL — so without `editing` the effect wouldn't
  // re-run and the contentEditable would stay empty.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.textContent = display;
  }, [display, editing]);

  const Tag = as;
  if (!editing) return <Tag className={className} style={style}>{display}</Tag>;

  return (
    <Tag
      ref={ref}
      className={className}
      style={style}
      data-editable
      data-key={id}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={(e) => { if (!multiline && e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      onBlur={(e) => {
        const val = e.currentTarget.textContent;
        // never save an empty value — it would wipe the default and blank the label
        if (val.trim() !== "" && val !== raw(id).pl) saveContent(id, val, raw(id).kind);
      }}
    />
  );
}

/** Inline-editable image / video bound to a content KV key (stores the URL). */
export function EMedia({ id, kind = "image", className, style, videoProps = {}, imgProps = {}, wrapperStyle }) {
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
    : <img className={className} style={style} src={url} alt="" loading="lazy" {...imgProps} />;

  if (!editing) return media_el;
  return (
    <span data-editable-media style={{ position: "relative", display: "block", cursor: "pointer", ...(kind === "video" ? { height: "100%" } : {}), ...wrapperStyle }}
      onClick={() => inputRef.current?.click()}>
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
