import { useEffect, useRef } from "react";

/** Racing lap-progress bar pinned to the very top: a red fill with a glowing head.
 *  Driven by a compositor-only transform written straight to the DOM once per frame —
 *  no React re-render and no layout while scrolling. */
export default function ScrollProgress() {
  const fillRef = useRef(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      if (fillRef.current) fillRef.current.style.transform = `translate3d(${(p - 1) * 100}%,0,0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <div className="scrollprog" aria-hidden="true">
      <div className="scrollprog__fill" ref={fillRef}>
        <span className="scrollprog__head" />
      </div>
    </div>
  );
}
