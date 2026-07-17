import { useEffect, useState } from "react";

/** Racing lap-progress bar pinned to the very top: a red fill with a glowing head. */
export default function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  return (
    <div className="scrollprog" aria-hidden="true">
      <div className="scrollprog__fill" style={{ width: `${p * 100}%` }}>
        <span className="scrollprog__head" />
      </div>
    </div>
  );
}
