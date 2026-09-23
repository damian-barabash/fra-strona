import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { FuelTank } from "../components/Fuel";
import { PACKAGES, packageOf, carPrice, customPrice, fmtZl } from "../lib/flota";
import { usePayRedirect } from "../lib/pay";
import { useRevealOnScroll } from "../lib/hooks";
import ProductCard from "../components/ProductCard";
import "../sections/productcard.css";
import "../sections/flota.css";
import "../sections/rezerwacja.css";
import "../sections/voucher.css";

const OWN = { id: "__own__", own: true };
const STEPS = ["auto", "pakiet", "gift", "produkt", "dane", "platnosc"];

/* /voucher — gift voucher configurator: AUTO → PAKIET (+ circuit) → DEDYKACJA → DANE → PŁATNOŚĆ.
   The voucher code is issued by the server after Tpay confirms the payment. */
export default function Voucher() {
  const nav = useNavigate();
  const { cars, raw, t, L, lang, createVoucherBooking } = useStore();
  const [car, setCar] = useState(null);
  const [track, setTrack] = useState("lodz");
  const [sessions, setSessions] = useState(null);
  const [gift, setGift] = useState({ voucher_for: "", voucher_message: "" });
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState("");
  useRevealOnScroll([cars.length, stepIdx]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const step = STEPS[stepIdx];
  const priceFor = (n) => (car?.own ? customPrice(raw, n, track) : carPrice(car, n, track));
  const total = sessions ? priceFor(sessions) : 0;
  const pkg = packageOf(sessions);
  const carName = car?.own ? t("vch.own") : car?.name;

  const canNext = step === "auto" ? !!car : step === "pakiet" ? !!sessions : step === "gift" || step === "produkt" ? true
    : step === "dane" ? (form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim()) : true;
  const goNext = () => {
    if (!canNext) { setErr(step === "auto" ? "Wybierz auto." : step === "pakiet" ? "Wybierz pakiet." : "Uzupełnij poprawnie: imię i nazwisko, e-mail oraz telefon."); return; }
    setErr(""); setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goPrev = () => { setErr(""); if (stepIdx === 0) { nav(-1); return; } setStepIdx((i) => Math.max(0, i - 1)); };
  const LBL = { auto: t("vch.sAuto"), pakiet: t("vch.sPkg"), gift: t("vch.sGift"), produkt: t("card.step"), dane: t("vch.sData"), platnosc: t("vch.sPay") };

  return (
    <div className="rz vc">
      <ScrollProgress />
      <Nav />
      <main>
        <section className="vc-head">
          <div className="vc-head__flag" />
          <div className="container vc-head__inner">
            <EText id="vch.eyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="vch.title" as="h1" className="h-display vc-head__title reveal-up rv-d1" />
            <EText id="vch.sub" as="p" className="lead vc-head__sub reveal-up rv-d2" multiline />
          </div>
        </section>

        <section className="rz-wrap vc-wrap">
          <div className="container vc-grid">
            <div className="vc-main">
              <div className="fl-steps rz-steps vc-steps">
                {STEPS.map((k, i) => (
                  <div key={k} className={`fl-steps__i ${i === stepIdx ? "on" : ""} ${i < stepIdx ? "done" : ""}`}>
                    <span className="fl-steps__n">{i < stepIdx ? "✓" : i + 1}</span>{LBL[k]}
                  </div>
                ))}
              </div>

              <div className="rz-body">
                {step === "auto" && (
                  <div className="fl-bk">
                    <h4 className="fl-bk__h">{t("flota.bk.autoTitle")}</h4>
                    <p className="fl-bk__sub">{t("flota.bk.autoSub")}</p>
                    <div className="rz-cars">
                      {cars.map((c, i) => (
                        <button key={c.id} className={`rz-car ${car?.id === c.id ? "on" : ""}`} style={{ ["--cc"]: c.color, animationDelay: `${i * 60}ms` }} onClick={() => setCar(c)}>
                          <span className="rz-car__media">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt={c.name} loading="lazy" />}<span className="rz-car__badge">{c.badge}</span></span>
                          <span className="rz-car__foot"><span className="rz-car__name">{c.name}</span><span className="rz-car__from">{t("flota.from")} {fmtZl(carPrice(c, 3, "lodz"))}</span></span>
                        </button>
                      ))}
                      <button className={`rz-car rz-car--own ${car?.own ? "on" : ""}`} style={{ animationDelay: `${cars.length * 60}ms` }} onClick={() => setCar(OWN)}>
                        <span className="rz-car__media"><span className="rz-car__badge">⌁</span></span>
                        <span className="rz-car__foot"><span className="rz-car__name">{t("vch.own")}</span><span className="rz-car__from">{t("flota.from")} {fmtZl(customPrice(raw, 3, "lodz"))}</span></span>
                      </button>
                    </div>
                  </div>
                )}

                {step === "pakiet" && (
                  <div className="fl-bk">
                    <h4 className="fl-bk__h">{t("vch.trackTitle")}</h4>
                    <div className="cn-switch vc-switch">
                      {[{ k: "lodz", l: t("cen.lodz") }, { k: "poznan", l: t("cen.poznan") }].map((x) => (
                        <button key={x.k} className={`cn-switch__b ${track === x.k ? "on" : ""}`} onClick={() => setTrack(x.k)}>{x.l}</button>
                      ))}
                    </div>
                    <h4 className="fl-bk__h" style={{ marginTop: 26 }}>{t("flota.bk.pkgTitle")}</h4>
                    <p className="fl-bk__sub">{t("flota.bk.pkgSub")}</p>
                    <div className="fl-pkgs">
                      {PACKAGES.map((p) => {
                        const price = priceFor(p.n);
                        return (
                          <button key={p.n} className={`fl-pkg ${sessions === p.n ? "on" : ""}`} onClick={() => setSessions(p.n)} disabled={!price}>
                            <span className="fl-pkg__n">{p.n}<i>×</i></span>
                            <span className="fl-pkg__name">{lang === "en" ? p.en : p.pl}</span>
                            <span className="fl-pkg__sub">{lang === "en" ? p.sub_en : p.sub_pl}</span>
                            <span className="fl-pkg__price">{price ? fmtZl(price) : "—"} <small>{t("card.net")}</small></span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === "gift" && (
                  <div className="fl-bk">
                    <h4 className="fl-bk__h">{t("vch.giftTitle")}</h4>
                    <p className="fl-bk__sub">{t("vch.giftSub")}</p>
                    <div className="fl-form">
                      <label className="fl-field fl-field--full"><span>{t("vch.for")}</span>
                        <input value={gift.voucher_for} onChange={(e) => setGift({ ...gift, voucher_for: e.target.value })} placeholder={t("vch.forPh")} maxLength={80} /></label>
                      <label className="fl-field fl-field--full"><span>{t("vch.msg")}</span>
                        <textarea rows={3} value={gift.voucher_message} onChange={(e) => setGift({ ...gift, voucher_message: e.target.value })} placeholder={t("vch.msgPh")} maxLength={400} /></label>
                    </div>
                    <p className="vc-valid">{t("vch.valid")}</p>
                  </div>
                )}

                {step === "produkt" && (
                  <div className="fl-bk">
                    <h4 className="fl-bk__h">{t("card.title")}</h4>
                    <ProductCard
                      title={`${t("vch.title")} · ${carName}`} subtitle={car?.own ? t("flota.customDesc").replace(/<[^>]+>/g, "") : (car ? L(car, "description") : "")}
                      code={car?.own ? "OWN" : car?.badge} color={car?.own ? "var(--red)" : (car?.color || "var(--red)")}
                      photo={car?.own ? "/assets/covers/mariusz.webp" : (car?.png || car?.photos?.[0])} photos={car?.own ? [] : (car?.photos || [])}
                      price={total} currency="PLN" onOrder={goNext}
                      lines={[[t("vch.sPkg"), pkg ? `${sessions} × · ${lang === "en" ? pkg.en : pkg.pl}` : "—"], [t("kal.fTrack"), track === "poznan" ? "Tor Poznań" : "Tor Łódź"], [t("vch.for"), gift.voucher_for || "—"]]}
                      includes={[
                        lang === "en" ? "Gift voucher valid 12 months" : "Voucher prezentowy ważny 12 miesięcy",
                        lang === "en" ? "30-minute sport-driving theory lecture" : "30-minutowy wykład z teorii jazdy sportowej",
                        lang === "en" ? `${sessions} track sessions 1:1 with an instructor` : `${sessions} sesji na torze 1:1 z instruktorem`,
                        lang === "en" ? "Fastline Racing Academy certificate signed by Mariusz Miękoś" : "Certyfikat Fastline Racing Academy z podpisem Mariusza Miękosia",
                      ]}
                    />
                  </div>
                )}

                {step === "dane" && (
                  <div className="fl-bk">
                    <h4 className="fl-bk__h">{t("flota.bk.dataTitle")}</h4>
                    <p className="fl-bk__sub">{t("flota.bk.dataSub")}</p>
                    <div className="fl-form">
                      <label className="fl-field"><span className="req">{t("flota.bk.name")}</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" /></label>
                      <label className="fl-field"><span className="req">{t("flota.bk.phone")}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
                      <label className="fl-field fl-field--full"><span className="req">{t("flota.bk.email")}</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                      <label className="fl-field fl-field--full"><span>{t("flota.bk.note")}</span><textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                    </div>
                  </div>
                )}

                {step === "platnosc" && (
                  <PayVoucher t={t} create={createVoucherBooking} payload={{
                    car_id: car?.own ? null : car?.id, is_custom: !!car?.own, sessions, track,
                    voucher_for: gift.voucher_for, voucher_message: gift.voucher_message,
                    full_name: form.full_name, email: form.email, phone: form.phone, note: form.note,
                  }} />
                )}
              </div>

              {step === "produkt" && (
                <div className="rz-foot">
                  <button className="btn btn--ghost" onClick={goPrev}>{t("flota.bk.prev")}</button>
                  <div className="rz-foot__sum"><span>{carName}</span><b>{fmtZl(total)}</b></div>
                  <button className="btn btn--red" onClick={goNext}>{t("card.order")} ›</button>
                </div>
              )}
              {step !== "platnosc" && step !== "produkt" && (
                <>
                  {err && <div className="rz-err">{err}</div>}
                  <div className="rz-foot">
                    <button className="btn btn--ghost" onClick={goPrev}>{t("flota.bk.prev")}</button>
                    <div className="rz-foot__sum">{sessions && <span>{pkg?.[lang === "en" ? "en" : "pl"]}</span>}{total > 0 && <b>{fmtZl(total)}</b>}</div>
                    <button className={`btn btn--red ${!canNext ? "is-locked" : ""}`} onClick={goNext}>{step === "dane" ? t("vch.pay") : t("flota.bk.next")} ›</button>
                  </div>
                </>
              )}
            </div>

            {/* live voucher preview */}
            <aside className="vc-side">
              <span className="vc-side__lbl">{t("vch.preview")}</span>
              <motion.div className="vc-card" layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <span className="vc-card__flag" />
                <img className="vc-card__logo" src="/assets/ui/logo_dark.webp" alt="Fastline Racing Academy" />
                <span className="vc-card__eyebrow">VOUCHER PREZENTOWY</span>
                <div className="vc-card__for">{gift.voucher_for || "· · ·"}</div>
                <div className="vc-card__what">
                  <b>{carName || t("vch.sAuto")}</b>
                  <span>{pkg ? `${sessions} × ${lang === "en" ? pkg.en : pkg.pl} · ${track === "poznan" ? "Tor Poznań" : "Tor Łódź"}` : t("vch.sPkg")}</span>
                </div>
                {gift.voucher_message && <p className="vc-card__msg">“{gift.voucher_message}”</p>}
                <div className="vc-card__code">{t("vch.code")}</div>
                <div className="vc-card__price">{total ? fmtZl(total) : "—"} <small>{t("card.net")}</small></div>
                {(car?.png || car?.photos?.[0]) && <img className="vc-card__car" src={car.png || car.photos[0]} alt="" />}
              </motion.div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

function PayVoucher({ t, create, payload }) {
  const { phase, fill, err, retry } = usePayRedirect(create, payload);
  return (
    <div className="fl-pay rz-pay">
      <FuelTank fill={fill} done={phase === "redirect"} />
      {phase !== "error" && <div className="fl-pay__status">{phase === "redirect" ? "→ Tpay" : t("vch.processing")}</div>}
      {phase === "error" && (
        <div className="fl-pay__done">
          <h4 className="fl-pay__title" style={{ color: "var(--red)" }}>Ups!</h4>
          <p className="fl-pay__thanks">{err}</p>
          <button className="btn btn--red" onClick={retry}>Spróbuj ponownie</button>
        </div>
      )}
    </div>
  );
}
