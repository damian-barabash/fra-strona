import { useEffect, useMemo, useRef } from "react";
import { sanitizeRich } from "../lib/richtext";
import { toneOf, isExternal } from "../lib/popup";
import "./popup.css";

/* The advertising pop-up as the visitor sees it: a photo and a block of text in the chosen colour,
   cut apart by a racing diagonal. Everything is sized from its own frame (container units), so the
   very same markup is the real pop-up on the site, the full-screen preview in the panel and the
   small live preview next to the form (`embed` — it then fills its parent instead of the window).

   p       — a row of `popups`
   onClose — the cross, the dark area around the block, Esc
   onGo    — a click on the button or on a link in the text: (event, href, "button" | "link")
   out     — play the closing animation (the owner unmounts it a moment later) */
const hex = (c) => String(c || "").trim().toLowerCase();
export const popupVars = (p) => {
  const tone = toneOf(p.color), btnTone = toneOf(p.btn_color);
  const same = hex(p.color) === hex(p.btn_color);
  return {
    tone, same,
    style: {
      "--pc": p.color || "#14161a", "--pb": p.btn_color || "#e30613",
      "--pt": tone === "light" ? "#ffffff" : "#14161a",
      "--pt2": tone === "light" ? "rgba(255,255,255,.84)" : "#3a3e45",
      "--pbt": btnTone === "light" ? "#ffffff" : "#14161a",
      // accents (bullets, eyebrow bar) take the button colour unless it would vanish on the block
      "--pa": same ? (tone === "light" ? "#ffffff" : "#14161a") : (p.btn_color || "#e30613"),
    },
  };
};

export default function PopupView({ p, lang = "pl", onClose, onGo, embed = false, device, out = false }) {
  const pick = (base) => (lang === "en" ? p[`${base}_en`] || p[`${base}_pl`] : p[`${base}_pl`]) || "";
  const bodyRaw = pick("body");
  const body = useMemo(() => sanitizeRich(bodyRaw), [bodyRaw]);
  const { tone, same, style } = popupVars(p);
  const cardRef = useRef(null);

  const narrow = device ? device === "mobile" : typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  const img = (narrow && p.image_mobile) || p.image || p.image_mobile || "";
  const layout = img ? p.layout || "left" : "text";
  const eyebrow = pick("eyebrow"), title = pick("title"), label = pick("btn_label");
  const url = String(p.btn_url || "").trim();
  const blank = p.btn_blank || (isExternal(url) && /^(https?:)?\/\//i.test(url));

  // the real pop-up owns the screen: the page behind does not scroll, Esc closes, the keyboard focus moves into the block
  useEffect(() => {
    if (embed) return;
    document.documentElement.classList.add("apop-lock");
    const key = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", key);
    cardRef.current?.focus({ preventScroll: true });
    return () => { document.documentElement.classList.remove("apop-lock"); window.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed]);

  const bodyClick = (e) => { const a = e.target.closest?.("a[href]"); if (a) onGo?.(e, a.getAttribute("href"), "link"); };

  return (
    <div className={`apop ${embed ? "apop--embed" : ""} ${out ? "apop--out" : ""}`} data-layout={layout} data-tone={tone} data-btn={same ? "outline" : undefined}
      role="dialog" aria-modal={embed ? undefined : "true"} aria-label={title || eyebrow || "Fastline Racing Academy"}>
      <div className="apop__scrim" onClick={onClose} />
      <article className="apop__card" style={style} ref={cardRef} tabIndex={-1}>
        {img && (
          <div className="apop__media">
            <img src={img} alt={p.image_alt || ""} decoding="async" />
          </div>
        )}
        {img && <span className="apop__cut" aria-hidden="true" />}
        <span className="apop__slashes" aria-hidden="true"><i /><i /><i /></span>
        <div className="apop__panel">
          {eyebrow && <span className="apop__eyebrow">{eyebrow}</span>}
          {title && <h2 className="apop__title">{title}</h2>}
          {body && <div className="apop__body apop-rt" onClick={bodyClick} dangerouslySetInnerHTML={{ __html: body }} />}
          {label && url && (
            <a className="apop__btn" href={url} target={blank ? "_blank" : undefined} rel={blank ? "noopener noreferrer" : undefined}
              onClick={(e) => onGo?.(e, url, "button")}>
              <span>{label}</span><i aria-hidden="true">›</i>
            </a>
          )}
        </div>
        <span className="apop__flag" aria-hidden="true" />
        <button type="button" className="apop__x" onClick={onClose} aria-label={lang === "en" ? "Close" : "Zamknij"}><span aria-hidden="true" /></button>
      </article>
    </div>
  );
}
