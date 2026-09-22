import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { FuelTank } from "../components/Fuel";
import { usePayRedirect } from "../lib/pay";
import { fmtZl } from "../lib/flota";
import "../sections/rezerwacja.css";
import "../sections/d2r.css";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

/* /zakup?produkt=<slug> — buying a fixed-price package (Driver2Racer): no configurator,
   straight to DANE → PŁATNOŚĆ. The price is re-read server-side from the product row. */
export default function Zakup() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { products, ready, t, L, createProductBooking } = useStore();

  const slug = sp.get("produkt") || "";
  const p = products.find((x) => x.slug === slug && x.buy_direct);

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [step, setStep] = useState("dane");     // dane | platnosc
  const [err, setErr] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  if (!p) {
    if (ready && products.length) return (
      <div className="d2 zk">
        <Nav />
        <main className="container zk-missing">
          <h1>{t("zak.missing")}</h1>
          <Link to="/produkty" className="btn btn--red">{t("prod.back")}</Link>
        </main>
        <Footer />
      </div>
    );
    return <div className="d2 zk"><Nav /><main style={{ minHeight: "60vh" }} /><Footer /></div>;
  }

  const valid = form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim();
  const goPay = () => {
    if (!valid) { setErr(t("zak.err")); return; }
    setErr(""); setStep("platnosc");
  };

  return (
    <div className="d2 zk">
      <ScrollProgress />
      <Nav />
      <main>
        <section className="zk-wrap">
          <div className="container">
            <div className="zk-head">
              <div>
                <span className="zk-head__eyebrow">{t("zak.eyebrow")}</span>
                {p.theme === "d2r"
                  ? <>
                      <img className="zk-head__logo" src="/assets/d2r/logo-white.webp" alt={L(p, "title")} />
                      <h1 className="sr-only">{L(p, "title")}</h1>
                    </>
                  : <h1 className="zk-head__title">{L(p, "title")}</h1>}
                <div className="zk-head__tag">{L(p, "tag")}</div>
              </div>
              <div className="zk-head__price">
                <span>{t("d2r.priceLabel")}</span>
                <b>{fmtZl(p.price)}</b>
                <i>{t("d2r.net")}</i>
              </div>
            </div>

            <div className="zk-steps">
              {["dane", "platnosc"].map((k, i) => (
                <div key={k} className={`zk-step ${step === k ? "on" : ""} ${i === 0 && step === "platnosc" ? "done" : ""}`}>
                  <span>{i === 0 && step === "platnosc" ? "✓" : i + 1}</span>
                  {k === "dane" ? t("flota.bk.s3") : t("flota.bk.s4")}
                </div>
              ))}
            </div>

            <div className="zk-grid">
              <div className="zk-body">
                {step === "dane" && (
                  <>
                    <h2 className="zk-h">{t("flota.bk.dataTitle")}</h2>
                    <p className="zk-sub">{t("zak.sub")}</p>
                    <div className="zk-form">
                      <label className="zk-field"><span>{t("flota.bk.name")}</span>
                        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
                      <label className="zk-field"><span>{t("flota.bk.phone")}</span>
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                      <label className="zk-field zk-field--full"><span>{t("flota.bk.email")}</span>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                      <label className="zk-field zk-field--full"><span>{t("flota.bk.note")}</span>
                        <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>

                    {err && <div className="zk-err">{err}</div>}

                    <div className="zk-foot">
                      <button className="btn btn--ghost zk-ghost" onClick={() => nav(-1)}>{t("flota.bk.prev")}</button>
                      <button className={`btn btn--red ${!valid ? "is-locked" : ""}`} onClick={goPay}>
                        {t("flota.bk.pay")} · {fmtZl(p.price)} <span className="btn__arrow">›</span>
                      </button>
                    </div>
                  </>
                )}

                {step === "platnosc" && (
                  <PayStep p={p} form={form} t={t} create={createProductBooking} />
                )}
              </div>

              {/* what you are buying */}
              <aside className="zk-side">
                <div className="zk-card">
                  {p.photo && <img className="zk-card__img" src={p.photo} alt="" />}
                  <div className="zk-card__body">
                    <span className="zk-card__code">{p.code}</span>
                    <h3 className="zk-card__t">{L(p, "title")}</h3>
                    <ul className="zk-card__list">
                      {lines(L(p, "includes")).slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                    <div className="zk-card__total">
                      <span>{t("flota.bk.total")}</span>
                      <b>{fmtZl(p.price)}</b>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* payment — the tank fills, the order + Tpay transaction are created server-side, then the gateway */
function PayStep({ p, form, t, create }) {
  const { phase, fill, err, retry } = usePayRedirect(create, { product_slug: p.slug, full_name: form.full_name, email: form.email, phone: form.phone, note: form.note });
  return (
    <div className="zk-pay">
      <FuelTank fill={fill} done={phase === "redirect"} />
      {phase !== "error" && <div className="zk-pay__status">{phase === "redirect" ? "→ Tpay" : t("flota.bk.processing")}</div>}
      {phase === "error" && (
        <div className="zk-pay__done">
          <h3 className="zk-pay__t" style={{ color: "var(--red)" }}>Ups!</h3>
          <p className="zk-pay__p">{err}</p>
          <button className="btn btn--red" onClick={retry}>Spróbuj ponownie</button>
        </div>
      )}
    </div>
  );
}
