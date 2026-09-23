import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

const isUrl = (s) => typeof s === "string" && /^(https?:|\/)/.test(s);

export default function Instructors() {
  const { instructors, L, t } = useStore();
  const [ref] = useReveal();
  const [active, setActive] = useState(0);
  const n = instructors.length;
  const go = (d) => setActive((a) => (n ? ((a + d) % n + n) % n : 0));   // wraps around — the slider loops

  const act = instructors[active];
  const bio = (act && L(act, "description")) || t("instructors.body");

  return (
    <section className="section section--paper instructors" id="instruktorzy" ref={ref}>
      <div className="tex" />
      <div className="container">
        <div className="instructors__grid">
          <div className="instructors__intro">
            <EText id="instructors.eyebrow" as="span" className="eyebrow" />
            <EText id="instructors.title" as="h2" className="instructors__title" />
            <div className="instructors__bio">
              <AnimatePresence mode="wait">
                <motion.p key={act?.id || active} className="lead instructors__bio-text"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}>
                  {bio}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="instructors__nav">
              <button className="navbtn" onClick={() => go(-1)} aria-label="prev">‹</button>
              <button className="navbtn navbtn--red" onClick={() => go(1)} aria-label="next">›</button>
            </div>
          </div>

          <div className="instructors__viewport">
            <div className="instructors__track" style={{ "--active": active }}>
              {instructors.map((p, i) => (
                <div className={`icard ${i === active ? "on" : ""}`} key={p.id} onClick={() => setActive(i)}>
                  <div className="icard__stage">
                    <div className="icard__rect" style={{ background: p.color || "#3a3d42" }} />
                    <img className="icard__fig" src={p.photo} alt={p.name} loading="lazy" />
                  </div>
                  {p.signature && !isUrl(p.signature) && <div className="icard__sig">{p.signature}</div>}
                  {isUrl(p.signature) && <img className="icard__sig-img" src={p.signature} alt="" />}
                  <div className="icard__label">{L(p, "label") || "ZAWODNIK"}</div>
                  <div className="icard__name">{p.name}</div>
                  <div className="icard__sub">{L(p, "subtitle")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
