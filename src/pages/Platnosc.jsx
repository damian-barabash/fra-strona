import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "../lib/motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import { fmtZl } from "../lib/flota";
import { fmtMoney, gross } from "../lib/vat";
import "../sections/platnosc.css";
import { purchase } from "../lib/pixel";
import { forgetDiscount } from "../lib/discount";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

const POLL_MS = 1800, GIVE_UP_MS = 90_000, CLUB_POLLS = 6;
const FPL_LOGIN = "https://performancelab.fastlineracingacademy.pl/login";

/* Return from the Tpay gateway. The browser never decides whether an order is paid — it polls
   the server until the webhook has confirmed the payment, then plays the "lights out" celebration. */
export default function Platnosc() {
  const [sp] = useSearchParams();
  const { t, orderStatus } = useStore();
  useSeo({ title: "Płatność", path: "/platnosc", noindex: true });
  const id = sp.get("order") || "";
  const isError = sp.get("error") === "1";
  const [phase, setPhase] = useState(id ? "wait" : "empty");   // wait | paid | slow | failed | empty
  const [order, setOrder] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  // plain closure flag — a ref guard would break under StrictMode's double effect
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const t0 = Date.now();
    (async () => {
      let misses = 0, paidSeen = 0;
      while (!stop) {
        const r = await orderStatus(id).catch(() => null);
        if (stop) return;
        if (r?.ok) {
          setOrder(r.order); misses = 0;
          if (r.order.status === "paid") {
            if (!paidSeen) { purchase(r.order); forgetDiscount(); setPhase("paid"); }
            // the Performance Lab account is set up right after the payment — wait a few polls for it
            if (r.order.club || ++paidSeen > CLUB_POLLS) return;
            await new Promise((res) => setTimeout(res, POLL_MS));
            continue;
          }
          if (r.order.status === "chargeback" || r.order.status === "cancelled") { setPhase("failed"); return; }
          if (isError) { setPhase("failed"); return; }
        } else if (r && !r.ok) { setPhase(isError ? "failed" : "empty"); return; }
        else if (++misses >= 5) { setPhase("slow"); return; }
        if (Date.now() - t0 > GIVE_UP_MS) { setPhase("slow"); return; }
        await new Promise((res) => setTimeout(res, POLL_MS));
      }
    })();
    return () => { stop = true; };
  }, [id, isError]); // eslint-disable-line

  const isVoucher = order?.kind === "voucher";
  const copy = () => { navigator.clipboard?.writeText(order?.voucher_code || ""); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  // with a discount code the receipt shows what was actually charged (PLN), the code is a line of its own
  const money = !order ? "" : Number(order.discount_pln) > 0 ? `${fmtMoney(order.amount_pln)} brutto`
    : `${fmtMoney(order.total_gross != null ? order.total_gross : gross(order.total), order.currency)} brutto`;

  return (
    <div className="pl">
      <Nav />
      <main className="pl-main">
        <div className="pl-flag" aria-hidden="true" />
        <div className="container pl-inner">
          <AnimatePresence mode="wait">
            {phase === "wait" && (
              <motion.div key="wait" className="pl-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Lights phase="wait" />
                <h1 className="pl-t">{t("pay.wait")}</h1>
                <p className="pl-p">{t("pay.waitSub")}</p>
              </motion.div>
            )}
            {phase === "paid" && (
              <motion.div key="paid" className="pl-box" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
                <Lights phase="go" />
                <Check />
                <h1 className="pl-t pl-t--go">{isVoucher ? t("pay.voucherTitle") : t("pay.doneTitle")}</h1>
                <p className="pl-p">{isVoucher ? t("pay.voucherSub") : t("pay.doneSub")}</p>
                {isVoucher && order?.voucher_code && (
                  <div className="pl-code">
                    <span>KOD VOUCHERA</span>
                    <b>{order.voucher_code}</b>
                    <button className="pl-code__copy" onClick={copy}>{copied ? t("pay.copied") : t("pay.copy")}</button>
                  </div>
                )}
                <Receipt order={order} money={money} t={t} />
                <Club order={order} t={t} />
                <div className="pl-btns">
                  <Link to="/kalendarz" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>{t("pay.calendar")} <span className="btn__arrow">›</span></Link>
                  <Link to="/" className="btn btn--ghost" onClick={() => window.scrollTo({ top: 0 })}>{t("pay.home")}</Link>
                </div>
                <Confetti />
              </motion.div>
            )}
            {phase === "slow" && (
              <motion.div key="slow" className="pl-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Lights phase="wait" />
                <h1 className="pl-t">{t("pay.slowTitle")}</h1>
                <p className="pl-p">{t("pay.slowSub")}</p>
                <Receipt order={order} money={money} t={t} />
                <div className="pl-btns">
                  {order?.payment_url && <a className="btn btn--red" href={order.payment_url}>{t("pay.retry")}</a>}
                  <Link to="/" className="btn btn--ghost">{t("pay.home")}</Link>
                </div>
              </motion.div>
            )}
            {phase === "failed" && (
              <motion.div key="failed" className="pl-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Lights phase="red" />
                <h1 className="pl-t">{t("pay.failTitle")}</h1>
                <p className="pl-p">{t("pay.failSub")}</p>
                <Receipt order={order} money={money} t={t} />
                <div className="pl-btns">
                  {order?.payment_url && <a className="btn btn--red" href={order.payment_url}>{t("pay.retry")} <span className="btn__arrow">›</span></a>}
                  <Link to="/" className="btn btn--ghost">{t("pay.home")}</Link>
                </div>
              </motion.div>
            )}
            {phase === "empty" && (
              <motion.div key="empty" className="pl-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="pl-t">{t("pay.missing")}</h1>
                <div className="pl-btns"><Link to="/oferta" className="btn btn--red">{t("prod.back")}</Link></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* after every paid order: the welcome to Fastline Racing Club + where the Performance Lab login is.
   order.club = how Performance Lab handled the buyer: created / invited (login e-mail sent) / existing. */
function Club({ order, t }) {
  if (!order) return null;
  const club = order.club;
  const mailed = club === "created" || club === "invited";
  return (
    <div className={`pl-club${club ? "" : " is-pending"}`}>
      <span className="pl-club__eyebrow">{t("pay.clubEyebrow")}</span>
      <h2 className="pl-club__t">{t("pay.clubTitle")}</h2>
      <p className="pl-club__p">{t("pay.clubLead")}</p>
      {club === "existing" ? (
        <p className="pl-club__p">{t("pay.clubExisting")}</p>
      ) : (
        <p className="pl-club__p">
          {t(mailed ? "pay.clubMailed" : "pay.clubPending")} <b className="pl-club__mail">{order.email}</b>
          {mailed && <>. {t("pay.clubSpam")}</>}
        </p>
      )}
      <a className="pl-club__btn" href={FPL_LOGIN} target="_blank" rel="noreferrer">{t("pay.clubLogin")} <span aria-hidden="true">↗</span></a>
    </div>
  );
}

function Receipt({ order, money, t }) {
  if (!order) return null;
  return (
    <div className="pl-receipt">
      <div className="pl-receipt__no">{t("pay.orderNo")} <b>#{order.number}</b></div>
      <div className="pl-receipt__row"><span>{order.car_name || order.product_name}</span><b>{money}</b></div>
      {order.sessions && <div className="pl-receipt__row"><span>{order.sessions} × sesja{order.term_label ? ` · ${order.term_label}` : ""}</span></div>}
      {order.package_name && <div className="pl-receipt__row"><span>{order.package_name}{order.persons > 1 ? ` · ${order.persons} os.` : ""}</span></div>}
      {order.voucher_for && <div className="pl-receipt__row"><span>Voucher dla: {order.voucher_for}</span></div>}
      {Number(order.discount_pln) > 0 && <div className="pl-receipt__row"><span>{t("disc.line")} · {order.discount_code}</span><b>−{fmtMoney(order.discount_pln)}</b></div>}
      <div className="pl-receipt__mail">{order.email}</div>
    </div>
  );
}

/* F1 start gantry: waiting = lights coming on one by one; go = all out; red = all red (failed) */
function Lights({ phase }) {
  return (
    <div className={`pl-lights pl-lights--${phase}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ["--i"]: i }} />)}
    </div>
  );
}
function Check() {
  return (
    <svg className="pl-check" viewBox="0 0 120 120" width="118" height="118" aria-hidden="true">
      <circle className="pl-check__ring" cx="60" cy="60" r="52" pathLength="1" />
      <path className="pl-check__mark" d="M36 62 L53 78 L86 42" pathLength="1" />
    </svg>
  );
}
function Confetti() {
  return (
    <div className="pl-confetti" aria-hidden="true">
      {Array.from({ length: 26 }, (_, i) => (
        <i key={i} style={{ ["--x"]: `${(i * 37) % 100}%`, ["--d"]: `${1.6 + (i % 5) * .35}s`, ["--r"]: `${(i * 53) % 360}deg`, ["--c"]: i % 3 ? (i % 2 ? "#e30613" : "#14161a") : "#fff", ["--delay"]: `${(i % 7) * .12}s` }} />
      ))}
    </div>
  );
}
