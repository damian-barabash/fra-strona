import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";

export default function Banners() {
  const { banners } = useStore();
  const [idx, setIdx] = useState(0);
  const n = banners.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n]);

  if (!n) return null; // no banners -> section hidden

  const b = banners[idx % n];
  const media = (
    <picture>
      {b.image_mobile && <source media="(max-width: 767px)" srcSet={b.image_mobile} />}
      <img className="banner__img" src={b.image} alt={b.alt || ""} loading="lazy" />
    </picture>
  );

  return (
    <section className="section banners" aria-label="Reklama">
      <div className="container">
        <div className="banners__wrap">
          <AnimatePresence>
            <motion.div key={b.id} className="banners__slide"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}>
              {b.link
                ? <a href={b.link} target="_blank" rel="noreferrer">{media}</a>
                : media}
            </motion.div>
          </AnimatePresence>

          {n > 1 && (
            <div className="banners__dots">
              {banners.map((_, i) => (
                <button key={i} className={i === idx ? "on" : ""}
                  onClick={() => setIdx(i)} aria-label={`Baner ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
