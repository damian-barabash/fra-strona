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
import StepTag from "../components/StepTag";
import { fmtGross, vatOf, fmtMoney } from "../lib/vat";
import "../sections/rezerwacja.css";
import "../sections/d2r.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
/* "Alpine A110S — 999 zł netto · opis" → { name, price, note }: a product with such package lines is sold in variants */
export const parseVariants = (txt) => lines(txt).filter((l) => !l.startsWith("## ")).map((l) => {
  const m = l.match(/^(.+?)\s*[—–-]\s*(\d[\d\s]*)\s*zł(?:\s*netto)?\s*(?:[·—–-]\s*(.*))?$/i);
  return m ? { name: m[1].trim(), price: parseInt(m[2].replace(/\s/g, ""), 10), note: (m[3] || "").trim() } : null;
}).filter(Boolean);

/* /zakup?produkt=<slug> — buying a fixed-price package (Driver2Racer): no configurator,
   straight to DANE → PŁATNOŚĆ. The price is re-read server-side from the product row. */
export default function Zakup() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { products, ready, t, L, createProductBooking } = useStore();

  const slug = sp.get("produkt") || "";
  const p = products.find((x) => x.slug === slug && x.buy_direct);
  useSeo({ title: p ? `Zakup — ${p.title_pl}` : "Zakup", path: "/zakup", noindex: true });

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [step, setStep] = useState("dane");     // dane | platnosc
  const variants = p ? parseVariants(L(p, "packages")) : [];
  const [variant, setVariant] = useState(() => { const i = parseInt(sp.get("wariant"), 10); return Number.isFinite(i) ? i : 0; });
  const chosen = variants[variant] || variants[0] || null;
  const price = chosen ? chosen.price : p?.price;
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
                <b>{fmtGross(price)}</b>
                <i>{t("card.grossShort")} · {fmtZl(price)} {t("d2r.net")} + VAT 23% {fmtMoney(vatOf(price))}</i>
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
                    {variants.length > 1 && (
                      <div className="zk-variants">
                        <StepTag n={1} of={3} title={t("zak.variant")} />
                        <div className="zk-variants__grid">
                          {variants.map((v, i) => (
                            <button key={v.name} type="button" className={`zk-variant ${i === variant ? "on" : ""}`} onClick={() => setVariant(i)}>
                              <b>{v.name}</b>{v.note && <small>{v.note}</small>}<span>{fmtZl(v.price)} <i>{t("d2r.net")}</i></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <StepTag n={variants.length > 1 ? 2 : 1} of={variants.length > 1 ? 3 : 2} title={t("flota.bk.dataTitle")} />
                    <p className="zk-sub">{t("zak.sub")}</p>
                    <div className="zk-form">
                      <label className="zk-field"><span className="req">{t("flota.bk.name")}</span>
                        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
                      <label className="zk-field"><span className="req">{t("flota.bk.phone")}</span>
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                      <label className="zk-field zk-field--full"><span className="req">{t("flota.bk.email")}</span>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                      <label className="zk-field zk-field--full"><span>{t("flota.bk.note")}</span>
                        <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>

                    {err && <div className="zk-err">{err}</div>}

                    <div className="zk-foot">
                      <button className="btn btn--ghost zk-ghost" onClick={() => nav(-1)}>{t("flota.bk.prev")}</button>
                      <button className={`btn btn--red ${!valid ? "is-locked" : ""}`} onClick={goPay}>
                        {t("flota.bk.pay")} · {fmtGross(price)} <span className="btn__arrow">›</span>
                      </button>
                    </div>
                  </>
                )}

                {step === "platnosc" && (
                  <>
                    <StepTag n={variants.length > 1 ? 3 : 2} of={variants.length > 1 ? 3 : 2} title={t("flota.bk.s4")} />
                    <PayStep p={p} form={form} t={t} create={createProductBooking} variant={chosen?.name} />
                  </>
                )}
              </div>

              {/* what you are buying */}
              <aside className="zk-side">
                <div className="zk-card">
                  {p.photo && <img className="zk-card__img" src={p.photo} alt="" />}
                  <div className="zk-card__body">
                    <span className="zk-card__code">{p.code}</span>
                    <h3 className="zk-card__t">{L(p, "title")}</h3>
                    {chosen && <div className="zk-card__variant">{chosen.name}</div>}
                    <ul className="zk-card__list">
                      {lines(L(p, "includes")).slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                    <div className="zk-card__total">
                      <span>{t("flota.bk.total")}</span>
                      <b>{fmtGross(price)}</b>
                    </div>
                    <div className="zk-card__vat">{fmtZl(price)} {t("d2r.net")} + VAT 23%</div>
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
function PayStep({ p, form, t, create, variant }) {
  const { phase, fill, err, retry } = usePayRedirect(create, { product_slug: p.slug, variant: variant || null, full_name: form.full_name, email: form.email, phone: form.phone, note: form.note });
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
