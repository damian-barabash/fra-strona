import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import StepTag from "../components/StepTag";
import { fmtGross } from "../lib/vat";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { fmtEur } from "../lib/ice";
import { usePayRedirect } from "../lib/pay";
import "../sections/wyprawa.css";
import "../sections/zakup-wyprawa.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

/* /zakup-wyprawa?pakiet=<id> — buying a trip package: DANE → PŁATNOŚĆ, no configurator.
   The price (and whether the trip is still open) is verified server-side. */
export default function ZakupWyprawa() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { products, tripPackages, ready, t, L, createTripBooking } = useStore();
  useSeo({ title: "Zakup wyprawy", path: "/zakup-wyprawa", noindex: true });

  const pkg = tripPackages.find((x) => x.id === sp.get("pakiet"));
  const trip = pkg ? products.find((x) => x.slug === pkg.product_slug) : null;

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [persons, setPersons] = useState(1);
  const [step, setStep] = useState("dane");
  const [err, setErr] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  if (!pkg || !trip) {
    if (ready && products.length) return (
      <div className="wy zw">
        <Nav />
        <main className="container zw-missing">
          <h1>{t("zak.missing")}</h1>
          <Link to="/produkty" className="btn wy-btn">{t("prod.back")}</Link>
        </main>
        <Footer />
      </div>
    );
    return <div className="wy zw"><Nav /><main style={{ minHeight: "60vh" }} /><Footer /></div>;
  }

  const style = { ["--pc"]: trip.color || "#c9a227" };
  const total = (pkg.price || 0) * persons;
  const valid = form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim();
  const goPay = () => {
    if (!valid) { setErr(t("zak.err")); return; }
    setErr(""); setStep("platnosc");
  };

  return (
    <div className="wy zw" style={style}>
      <ScrollProgress />
      <Nav />
      <main>
        <section className="zw-wrap">
          <div className="container">
            <div className="zw-head">
              <div>
                <span className="wy-kicker">{L(trip, "trip_dates")}</span>
                <h1 className="zw-head__title">{L(trip, "title")} <i>·</i> {L(pkg, "name")}</h1>
                <div className="zw-head__tag">{L(trip, "tag")}</div>
              </div>
              <div className="zw-head__price">
                <span>{t("d2r.priceLabel")}</span>
                <b>{fmtGross(total, pkg.currency)}</b>
                <i>{persons > 1 ? `${persons} × ${fmtEur(pkg.price, pkg.currency)} ${t("d2r.net")}` : `${fmtEur(total, pkg.currency)} ${t("d2r.net")}`} + VAT 23%</i>
              </div>
            </div>

            <div className="zw-steps">
              {["dane", "platnosc"].map((k, i) => (
                <div key={k} className={`zw-step ${step === k ? "on" : ""} ${i === 0 && step === "platnosc" ? "done" : ""}`}>
                  <span>{i === 0 && step === "platnosc" ? "✓" : i + 1}</span>
                  {k === "dane" ? t("flota.bk.s3") : t("flota.bk.s4")}
                </div>
              ))}
            </div>

            <div className="zw-grid">
              <div className="zw-body">
                {step === "dane" ? (
                  <>
                    <StepTag n={1} of={2} title={t("flota.bk.dataTitle")} />
                    <p className="zw-sub">{t("zak.sub")}</p>
                    <div className="zw-form">
                      <label className="zw-field"><span className="req">{t("flota.bk.name")}</span>
                        <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
                      <label className="zw-field"><span className="req">{t("flota.bk.phone")}</span>
                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                      <label className="zw-field"><span className="req">{t("flota.bk.email")}</span>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                      <label className="zw-field"><span className="req">{t("ice.persons")}</span>
                        <input type="number" min="1" max="10" value={persons}
                          onChange={(e) => setPersons(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} /></label>
                      <label className="zw-field zw-field--full"><span>{t("flota.bk.note")}</span>
                        <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>

                    {err && <div className="zw-err">{err}</div>}

                    <div className="zw-foot">
                      <button className="btn wy-btn--ghost zw-ghost" onClick={() => nav(-1)}>{t("flota.bk.prev")}</button>
                      <button className={`btn wy-btn ${!valid ? "is-locked" : ""}`} onClick={goPay}>
                        {t("flota.bk.pay")} · {fmtGross(total, pkg.currency)} <span className="btn__arrow">›</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <StepTag n={2} of={2} title={t("flota.bk.s4")} />
                    <PayTrip pkg={pkg} trip={trip} persons={persons} total={total} form={form}
                      t={t} create={createTripBooking} />
                  </>
                )}
              </div>

              <aside className="zw-side">
                <div className="zw-card">
                  {trip.photo && <img className="zw-card__img" src={trip.photo} alt="" />}
                  <div className="zw-card__body">
                    <span className="zw-card__code">{trip.code}</span>
                    <h3 className="zw-card__t">{L(pkg, "name")}</h3>
                    <ul className="zw-card__list">
                      {lines(L(pkg, "includes")).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                    {lines(L(pkg, "note")).map((n, i) => <p key={i} className="zw-card__note">{n}</p>)}
                    <div className="zw-card__total">
                      <span>{t("flota.bk.total")}</span>
                      <b>{fmtGross(total, pkg.currency)}</b>
                    </div>
                    <div className="zk-card__vat">{fmtEur(total, pkg.currency)} {t("d2r.net")} + VAT 23%</div>
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

/* payment — a luxury "sealing" animation, then the order + Tpay transaction and the gateway */
function PayTrip({ pkg, persons, form, t, create }) {
  const { phase, fill, err, retry } = usePayRedirect(create, { package_id: pkg.id, persons, full_name: form.full_name, email: form.email, phone: form.phone, note: form.note });
  return (
    <div className="zw-pay">
      <div className="zw-seal" style={{ ["--f"]: `${fill}%` }}>
        <svg viewBox="0 0 120 120" width="150" height="150">
          <circle cx="60" cy="60" r="52" className="zw-seal__track" />
          <circle cx="60" cy="60" r="52" className="zw-seal__arc" strokeDasharray={`${(fill / 100) * 327} 327`} transform="rotate(-90 60 60)" />
          <text x="60" y="68" textAnchor="middle" className="zw-seal__pct">{fill}%</text>
        </svg>
      </div>
      {phase !== "error" && <div className="zw-pay__status">{phase === "redirect" ? "→ Tpay" : t("flota.bk.processing")}</div>}
      {phase === "error" && (
        <div className="zw-pay__done">
          <h3 className="zw-pay__t">Ups!</h3>
          <p className="zw-pay__p">{err}</p>
          <button className="btn wy-btn" onClick={retry}>Spróbuj ponownie</button>
        </div>
      )}
    </div>
  );
}
