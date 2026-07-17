import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Auto-shrink text to fit its container width; caps at an ideal responsive max. */
export function useFitText(dep) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const center = el.closest(".tracks__center");
      const name = el.closest(".tracks__name");
      if (!center || !name) return;
      const padL = parseFloat(getComputedStyle(name).paddingLeft) || 0;
      const avail = Math.max(80, center.clientWidth - padL - 6);
      const idealMax = Math.min(128, window.innerWidth * 0.085);
      el.style.fontSize = idealMax + "px";
      const w = el.scrollWidth;
      el.style.fontSize = (w > avail ? Math.max(26, Math.floor(idealMax * (avail / w))) : idealMax) + "px";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [dep]);
  return ref;
}

// reveal-on-scroll: returns [callbackRef, inView].
// Uses a callback ref so it also works when the element mounts LATE (after async data loads),
// and a safety timeout so content can never stay permanently hidden.
export function useReveal(opts = {}) {
  const [inView, setInView] = useState(false);
  const cleanup = useRef(null);
  const setRef = useCallback((el) => {
    if (cleanup.current) { cleanup.current(); cleanup.current = null; }
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: opts.threshold ?? 0.12, rootMargin: opts.rootMargin ?? "0px 0px -6% 0px" },
    );
    io.observe(el);
    cleanup.current = () => io.disconnect();
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setInView(true), 2500); // never stay hidden
    return () => clearTimeout(id);
  }, []);
  return [setRef, inView];
}

// Scan the page for any .reveal* element and add `.in` when it scrolls into view.
// Lets us sprinkle reveal classes anywhere without wiring each one up by hand.
export function useRevealOnScroll(deps = []) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sel = ".reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale";
    const els = Array.from(document.querySelectorAll(sel)).filter((el) => !el.classList.contains("in"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );
    els.forEach((el) => io.observe(el));
    // fallback: quickly reveal only what's already in view; below-fold waits for the
    // observer so it animates when scrolled to (never reveals prematurely).
    const t = setTimeout(() => els.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
    }), 900);
    return () => { io.disconnect(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// smooth animated counter when in view
export function useCountUp(target, inView, dur = 1600) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const n = parseInt(String(target).replace(/\D/g, ""), 10) || 0;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(n * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, dur]);
  return val;
}
