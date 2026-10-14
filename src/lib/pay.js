// Shared checkout step: a short "fuelling" animation, then the booking is created server-side
// and the browser is sent to the Tpay gateway (or straight to /platnosc in test mode).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initiateCheckout } from "./pixel";

export function usePayRedirect(create, payload, { dur = 1900, dropCode } = {}) {
  const nav = useNavigate();
  const [phase, setPhase] = useState("filling");   // filling | redirect | error
  const [fill, setFill] = useState(0);
  const [err, setErr] = useState("");
  const [codeErr, setCodeErr] = useState(false);   // the discount code was refused at checkout
  const [attempt, setAttempt] = useState(0);
  const sent = useRef(false);

  useEffect(() => { initiateCheckout(); }, []);
  useEffect(() => {
    let raf = 0, cancelled = false;
    const t0 = performance.now();
    const submit = async () => {
      if (sent.current) return;
      sent.current = true;
      const r = await create(payload);
      if (cancelled) return;
      if (r?.ok && r.payment_url) { setPhase("redirect"); window.location.assign(r.payment_url); return; }
      if (r?.ok && r.paid) { setPhase("redirect"); nav(`/platnosc?order=${r.id}`); return; }
      setCodeErr(!!r?.discount_error);
      setErr(r?.error || "Błąd płatności"); setPhase("error");
    };
    const tick = (now) => {
      if (cancelled) return;
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      setFill(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick); else submit();
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [attempt]); // eslint-disable-line

  const retry = () => { sent.current = false; setErr(""); setCodeErr(false); setFill(0); setPhase("filling"); setAttempt((a) => a + 1); };
  // a refused code: the configurator forgets it (the payload loses discount_code) and the payment goes on without it
  const payWithoutCode = codeErr && dropCode ? () => { dropCode(); retry(); } : null;
  return { phase, fill, err, retry, payWithoutCode };
}
