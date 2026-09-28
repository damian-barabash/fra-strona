/* Video helpers for speed on phones.
   1) `vsrc(url)` — on narrow screens swaps a bundled hero video for its lighter 720p/960w `-m.webm`
      twin (only for files that have one; CMS uploads are returned unchanged).
   2) `autoPauseVideos()` — every autoplaying <video> is paused while it is off screen and resumed when
      it comes back, so the phone doesn't keep decoding clips nobody sees. A video the visitor paused
      by hand (`data-user-paused`) is left alone. */
const MOBILE = new Set([
  "/assets/hero/HERO.webm",
  "/assets/szkola/hero.webm",
  "/assets/monaco/hero.webm",
  "/assets/laponia/hero.webm",
]);

const narrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;

export function vsrc(url) {
  if (!url || !MOBILE.has(url) || !narrow()) return url;
  return url.replace(/\.webm$/, "-m.webm");
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
