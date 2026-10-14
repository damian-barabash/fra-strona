import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { valueLabel } from "../lib/discount";
import { fmtMoney } from "../lib/vat";
import "../sections/discount.css";

/* Kod rabatowy in a configurator.
   The code is checked like a lap on the timing screen: its characters spin, sectors S1 → S2 → S3 light up
   yellow, and a valid code turns them all PURPLE (the fastest-sector colour). Then the discount flies out
   of the board to the price on screen (the nearest [data-disc-target]) and the price counts down.
   variant "strip"   — the dark band at the bottom of a configurator's first step (always open)
   variant "compact" — inside a price box (the product card): a "+ I have a code" link that opens the field */
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

export function DiscountField({ d, variant = "strip", need = "", preview, tone = "light" }) {
  const { t, lang } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(variant === "strip" || !!d.input);
  const boardRef = useRef(null);
  const code = d.code;
  const busy = d.status === "checking";
  const submit = (e) => { e?.preventDefault(); if (!busy && d.input) d.apply(d.input); };

  // a valid code: the discount leaves the board and lands on the price
  useEffect(() => {
    if (d.status !== "landing") return;
    const target = pickTarget();
    if (!boardRef.current || !target || reduced()) { const id = setTimeout(d.land, reduced() ? 0 : 420); return () => clearTimeout(id); }
    const id = setTimeout(() => fly(boardRef.current, target, valueLabel(code, t), () => { d.land(); hit(target); }), 380);
    return () => clearTimeout(id);
  }, [d.status, d.seq]); // eslint-disable-line

  const errText = d.status === "error" ? (lang === "en" ? t(`disc.err.${d.reason}`) || d.error : d.error || t(`disc.err.${d.reason}`)) : "";
  const pv = preview;
  let msg = null;
  if (d.status === "ok" && code && pv) {
    if (!pv.ok) msg = (
      <p className="dsc-msg dsc-msg--warn">
        {t("disc.other").replace("{label}", code.label || "")}
        {code.url && <button type="button" className="dsc-go" onClick={() => nav(code.url)}>{t("disc.go")} ›</button>}
      </p>);
    else if (!pv.ready) msg = <p className="dsc-msg">{t("disc.pick").replace("{v}", valueLabel(code, t)).replace("{what}", need)}</p>;
    else if (variant === "strip" || pv.free) msg = <p className="dsc-msg dsc-msg--ok">{pv.free ? t("disc.free") : `${t("disc.applied")}: −${fmtMoney(pv.off)}`}</p>;
  }

  return (
    <div className={`dsc dsc--${variant} dsc--${variant === "strip" ? "dark" : tone} ${d.status === "error" ? "is-error" : ""}`} key={d.status === "error" ? `e${d.seq}` : "f"}>
      {variant === "strip" && (
        <div className="dsc__head">
          <span className="dsc__flag" aria-hidden="true" />
          <span className="dsc__t">{t("disc.title")}</span>
          <span className="dsc__sub">{t("disc.sub")}</span>
        </div>
      )}

      <div className="dsc__body">
        {(d.status === "checking" || d.status === "landing" || d.status === "redirect") ? (
          <div className="dsc-board" ref={boardRef} data-state={d.status === "checking" ? "run" : "purple"} role="status" aria-live="polite">
            <Scramble text={d.input} run={d.status === "checking"} />
            <div className="dsc-sectors" aria-hidden="true"><i><b>S1</b></i><i><b>S2</b></i><i><b>S3</b></i></div>
            <span className="dsc-board__lbl">{d.status === "checking" ? t("disc.checking") : t("disc.cleared")}</span>
          </div>
        ) : d.status === "ok" && code ? (
          <div className="dsc-ticket">
            <span className="dsc-ticket__ok" aria-hidden="true">✓</span>
            <span className="dsc-ticket__code">{code.code}</span>
            <b className="dsc-ticket__val">{valueLabel(code, t)}</b>
            <button type="button" className="dsc-ticket__x" onClick={d.clear} aria-label={t("disc.remove")} title={t("disc.remove")}>×</button>
          </div>
        ) : !open ? (
          <button type="button" className="dsc-open" onClick={() => setOpen(true)}>{t("disc.open")}</button>
        ) : (
          <form className="dsc-form" onSubmit={submit}>
            <input value={d.input} onChange={(e) => d.setInput(e.target.value)} placeholder={t("disc.ph")} aria-label={t("disc.title")}
              autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={40} />
            <button type="submit" className="dsc-form__btn" disabled={!d.input}>{t("disc.check")} ›</button>
          </form>
        )}
        {d.status === "redirect" && code && (
          <p className="dsc-msg dsc-msg--go">{t("disc.redirect").replace("{label}", code.label || "")}<span className="dsc-bar" /></p>
        )}
        {errText && <p className="dsc-msg dsc-msg--err" role="alert">{errText}</p>}
        {msg}
      </div>
    </div>
  );
}

/** the discount lines under a price: code → −amount, then what is left to pay (counts down when it lands) */
export function DiscountLines({ code, pv, tone = "light" }) {
  const { t } = useStore();
  if (!code || !pv?.ok || !pv.ready || !pv.off) return null;
  return (
    <div className={`dsc-lines dsc--${tone}`}>
      <div><span>{t("disc.line")} <code>{code.code}</code></span><b className="dsc-lines__off">−{fmtMoney(pv.off)}</b></div>
      <div className="dsc-lines__pay"><span>{t("disc.toPay")}</span><b><Roll from={pv.base} value={pv.toPay} /></b></div>
    </div>
  );
}

/** a money amount that counts from `from` to `value` (and between later values) */
export function Roll({ value, from, fmt = (n) => fmtMoney(n) }) {
  const start = from ?? value;
  const [shown, setShown] = useState(start);
  const prev = useRef(start);
  useEffect(() => {
    const a = prev.current, b = Number(value) || 0;
    prev.current = b;
    if (a === b || reduced()) { setShown(b); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 950);
      setShown(a + (b - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="dsc-roll">{fmt(Math.round(shown * 100) / 100)}</span>;
}

/* the code's characters spin like a timing screen and settle left to right */
function Scramble({ text, run }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!run || reduced()) { setOut(text); return undefined; }
    const t0 = performance.now();
    const id = setInterval(() => {
      const settled = Math.floor(((performance.now() - t0) / 1250) * text.length);
      setOut(text.split("").map((c, i) => (i < settled || c === "-" ? c : CHARS[Math.floor(Math.random() * CHARS.length)])).join(""));
      if (settled >= text.length) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [text, run]);
  return <span className="dsc-board__code">{out}</span>;
}

/* the price the discount lands on: the visible [data-disc-target] with the lowest number */
function pickTarget() {
  const vh = window.innerHeight;
  const els = [...document.querySelectorAll("[data-disc-target]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  });
  els.sort((a, b) => Number(a.dataset.discTarget) - Number(b.dataset.discTarget));
  return els[0] || null;
}

function fly(src, dst, text, done) {
  const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  const lift = Math.min(170, Math.abs(dx) * 0.25 + Math.abs(dy) * 0.15 + 50);
  const el = document.createElement("div");
  el.className = "dsc-fly";
  el.style.left = `${x0}px`; el.style.top = `${y0}px`;
  el.style.setProperty("--ang", `${Math.atan2(dy - lift, dx) * (180 / Math.PI)}deg`);
  el.innerHTML = "<i></i><span></span>";
  el.querySelector("span").textContent = text;
  document.body.appendChild(el);
  const at = (f, k, s) => `translate(calc(-50% + ${dx * f}px), calc(-50% + ${dy * f - lift * k}px)) scale(${s})`;
  const anim = el.animate([
    { transform: at(0, 0, 0.5), opacity: 0 },
    { transform: at(0, 0.15, 1.2), opacity: 1, offset: 0.14 },
    { transform: at(0.5, 1, 1), opacity: 1, offset: 0.55 },
    { transform: at(1, 0, 0.6), opacity: 0.95 },
  ], { duration: 950, easing: "cubic-bezier(.45,0,.25,1)" });
  const end = () => { el.remove(); done(); };
  anim.onfinish = end;
  anim.oncancel = end;
}

function hit(el) {
  el.classList.remove("dsc-hit");
  void el.offsetWidth;   // restart the animation
  el.classList.add("dsc-hit");
  setTimeout(() => el.classList.remove("dsc-hit"), 1100);
}
