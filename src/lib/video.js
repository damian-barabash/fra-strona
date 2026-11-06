/* Video helpers for speed on phones.
   1) `vsrc(url)` — on narrow screens swaps a hero video for its lighter 720p/960w `-m.webm` twin:
      bundled files from the MOBILE list, and panel uploads in Storage when the build copied a
      `<name>-m.webm` next to them (lib/media.js); anything else is returned unchanged.
   2) `autoPauseVideos()` — every autoplaying <video> is paused while it is off screen and resumed when
      it comes back, so the phone doesn't keep decoding clips nobody sees. A video the visitor paused
      by hand (`data-user-paused`) is left alone. */
import { STORAGE, hasLocal } from "./media";

const MOBILE = new Set([
  "/assets/hero/HERO.webm",
  "/assets/szkola/hero.webm",
  "/assets/monaco/hero.webm",
  "/assets/laponia/hero.webm",
  "/assets/swieta/loop.webm",
]);

const narrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;

export function vsrc(url) {
  if (!url || typeof url !== "string" || !narrow()) return url;
  if (MOBILE.has(url)) return url.replace(/\.webm$/, "-m.webm");
  if (url.startsWith(STORAGE) && /\.webm$/.test(url)) {
    const twin = url.slice(STORAGE.length).replace(/\.webm$/, "-m.webm");
    if (hasLocal(twin)) return STORAGE + twin;    // the JSX runtime then points it at /media/
  }
  return url;
}

export function autoPauseVideos() {
  if (typeof IntersectionObserver === "undefined") return;
  const io = new IntersectionObserver((entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) { if (v.paused && !v.dataset.userPaused) v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }
  });
  const seen = new WeakSet();
  const scan = (root) => {
    const list = root.tagName === "VIDEO" ? [root] : root.querySelectorAll?.("video[autoplay]") || [];
    for (const v of list) if (v.autoplay && !seen.has(v)) { seen.add(v); io.observe(v); }
  };
  scan(document);
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
      for (const n of m.removedNodes) if (n.nodeType === 1) (n.tagName === "VIDEO" ? [n] : n.querySelectorAll?.("video") || []).forEach((v) => io.unobserve(v));
    }
  }).observe(document.body, { childList: true, subtree: true });
}
