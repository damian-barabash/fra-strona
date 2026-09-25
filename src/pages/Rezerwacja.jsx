import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import CarSlider from "../sections/CarSlider";
import ProductCard from "../components/ProductCard";
import StepTag from "../components/StepTag";
import { fmtGross } from "../lib/vat";
import { Speedo, FuelTank } from "../components/Fuel";
import { PACKAGES, packageOf, trackLabel, carPrice, customPrice, fmtZl, isPoznan } from "../lib/flota";
import { usePayRedirect } from "../lib/pay";
import "../sections/flota.css";
import "../sections/rezerwacja.css";
import "../sections/productcard.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

// "no date" pseudo-term — books without a specific date (arranged individually), base (Łódź) pricing
const NO_DATE = { id: "__nodate__", noDate: true, track: "lodz", location_pl: null };
const fmtDate = (iso, lang) => {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* /rezerwacja — the drive configurator: AUTO → TERMIN → PAKIET → PRODUKT (card) → DANE → PŁATNOŚĆ (Tpay).
   Entry presets: ?car=<id> ?custom=1 ?term=<id> ?sessions=N. The total is recomputed server-side. */
export default function Rezerwacja() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { cars, terms, t, raw, lang, L, createBooking } = useStore();
  useSeo({ title: "Kup szkolenie — konfigurator jazdy na torze", path: "/rezerwacja", description: "Wybierz auto, termin i pakiet 3, 6 lub 9 sesji na torze Łódź lub Poznań. Szkolenie 1:1 z instruktorem, płatność online.", jsonld: breadcrumbs([{ name: "Rezerwacja", path: "/rezerwacja" }]) });

  const carId = sp.get("car");
  const custom = sp.get("custom") === "1";
  const termIdQ = sp.get("term");
  const presetCar = carId ? cars.find((c) => c.id === carId) : null;
  const presetTerm = termIdQ ? terms.find((x) => x.id === termIdQ && x.date >= today()) || null : null;

  const [carSel, setCarSel] = useState(null);
  const [termSel, setTermSel] = useState(null);
  const sessionsQ = parseInt(sp.get("sessions"), 10);
  const [sessions, setSessions] = useState(packageOf(sessionsQ) ? sessionsQ : null);
  const [carName, setCarName] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (presetCar) setCarSel(presetCar); }, [presetCar?.id]); // eslint-disable-line
  useEffect(() => { if (presetTerm) setTermSel(presetTerm); }, [presetTerm?.id]); // eslint-disable-line

  const stepKeys = useMemo(() => {
    const s = [];
    if (!custom && !carId) s.push("auto");
    if (!termIdQ) s.push("termin");
    s.push("pakiet", "produkt", "dane", "platnosc");
    return s;
  }, [custom, carId, termIdQ]);
  const step = stepKeys[stepIdx];

  const track = termSel?.track || "lodz";
  const priceFor = (n) => (custom ? customPrice(raw, n, track) : carPrice(carSel, n, track));
  const total = sessions ? priceFor(sessions) : 0;
  const pkg = packageOf(sessions);

  const dateLabel = termSel?.noDate ? t("flota.bk.noDate")
    : termSel ? `${fmtDate(termSel.date, lang)} · ${termSel.location_pl || trackLabel(termSel.track, lang)} · ${termSel.time}` : "";
  const carTitle = custom ? (carName.trim() || t("flota.customName")) : (carSel?.name || t("flota.bk.title"));
  const headSub = stepKeys[0] === "auto" ? t("flota.bk.configTitle") : t("flota.bk.title");
  const upcoming = terms.filter((x) => x.date && x.date >= today() && (x.type || "sport") !== "ice");

  const canNext =
    step === "auto" ? !!carSel :
    step === "termin" ? !!termSel :
    step === "pakiet" ? !!sessions :
    step === "produkt" ? true :
    step === "dane" ? (form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim() && (!custom || carName.trim())) :
    true;

  const goNext = () => {
    if (!canNext) {
      setErr(step === "auto" ? "Wybierz auto." : step === "termin" ? "Wybierz termin." : step === "pakiet" ? "Wybierz pakiet."
        : (custom && !carName.trim()) ? "Podaj model swojego auta." : "Uzupełnij poprawnie: imię i nazwisko, e-mail oraz telefon.");
      return;
    }
    setErr(""); setStepIdx((i) => Math.min(stepKeys.length - 1, i + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goPrev = () => { setErr(""); if (stepIdx === 0) { nav(-1); return; } setStepIdx((i) => Math.max(0, i - 1)); };

  const gauge = stepKeys.length > 1 ? stepIdx / (stepKeys.length - 1) : 1;
  const STEP_LABEL = { auto: t("flota.bk.sAuto"), termin: t("flota.bk.s2"), pakiet: t("flota.bk.s1"), produkt: t("card.step"), dane: t("flota.bk.s3"), platnosc: t("flota.bk.s4") };

  const cardLines = [
    [t("flota.bk.sAuto"), custom ? (carName || t("flota.customName")) : (carSel?.name || "—")],
    [t("flota.bk.s1"), pkg ? `${lang === "en" ? pkg.sub_en : pkg.sub_pl} · ${lang === "en" ? pkg.en : pkg.pl}` : "—"],
    [t("kal.fTrack"), termSel?.location_pl || trackLabel(track, lang)],
    [t("flota.bk.s2"), termSel?.noDate ? t("flota.bk.noDate") : termSel ? `${fmtDate(termSel.date, lang)} · ${termSel.time}` : "—"],
  ];
  const cardIncludes = [
    lang === "en" ? "1-hour sport-driving theory lecture" : "1-godzinny wykład z teorii jazdy sportowej",
    lang === "en" ? `${sessions} track sessions 1:1 with an instructor` : `${sessions} sesji na torze 1:1 z instruktorem`,
    lang === "en" ? "Demo lap with the instructor" : "Okrążenie pokazowe z instruktorem",
    lang === "en" ? "Fastline Racing Academy certificate signed by Mariusz Miękoś" : "Certyfikat Fastline Racing Academy z podpisem Mariusza Miękosia",
  ];

  return (
    <div className="rz">
      <ScrollProgress />
      <Nav />
      <main>
        <section className="rz-wrap">
          <div className="container">
            <div className="rz-head rz--dark">
              <div className="rz-head__l">
                <span className="rz-head__eyebrow">{t("flota.bk.product")}</span>
                <h1 className="rz-head__title">{carTitle}</h1>
                <div className="rz-head__product">{t("flota.bk.productSub")} <i>·</i> {headSub}</div>
                <div className="rz-head__ctx">
                  {(carSel || custom) && <span className="rz-chip"><b>{t("flota.bk.chosenCar")}</b>{custom ? t("flota.customName") : carSel?.name}</span>}
                  {dateLabel && <span className="rz-chip"><b>{t("flota.bk.chosenDate")}</b>{dateLabel}</span>}
                  {sessions && <span className="rz-chip"><b>{t("flota.bk.total")}</b>{fmtZl(total)} {t("card.net")}</span>}
                </div>
              </div>
              <div className="rz-head__gauge"><Speedo value={step === "platnosc" ? 1 : gauge} big /></div>
            </div>

            <div className="fl-steps rz-steps">
              {stepKeys.map((k, i) => (
                <div key={k} className={`fl-steps__i ${i === stepIdx ? "on" : ""} ${i < stepIdx ? "done" : ""}`}>
                  <span className="fl-steps__n">{i < stepIdx ? "✓" : i + 1}</span>{STEP_LABEL[k]}
                </div>
              ))}
            </div>

            <div className="rz-body">
              {step === "auto" && (
                <div className="fl-bk rz-auto">
                  <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("flota.bk.autoTitle")} />
                  <p className="fl-bk__sub">{t("flota.bk.autoSub")}</p>
                  <CarSlider hideHead priceTrack={track} onCurrent={(c) => setCarSel(c)}
                    onChoose={(c) => { setCarSel(c); setStepIdx((i) => Math.min(stepKeys.length - 1, i + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                </div>
              )}

              {step === "termin" && (
                <div className="fl-bk">
                  <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("flota.bk.termTitle")} />
                  <p className="fl-bk__sub">{t("flota.bk.termSub")}</p>
                  <div className="fl-terms">
                    {upcoming.map((tm) => (
                      <button key={tm.id} className={`fl-term ${(tm.type || "sport") === "heels" ? "fl-term--heels" : ""} ${termSel?.id === tm.id ? "on" : ""}`} onClick={() => setTermSel(tm)}>
                        <span className="fl-term__date">{fmtDate(tm.date, lang)}</span>
                        <span className="fl-term__loc">{tm.location_pl || trackLabel(tm.track, lang)}{isPoznan(tm.track) && <b className="fl-term__pz">POZNAŃ</b>}</span>
                        <span className="fl-term__time">{tm.time}{tm.title_pl && (tm.type || "sport") !== "sport" ? ` · ${L(tm, "title")}` : ""}</span>
                      </button>
                    ))}
                    <button className={`fl-term fl-term--nodate ${termSel?.noDate ? "on" : ""}`} onClick={() => setTermSel(NO_DATE)}>
                      <span className="fl-term__date">{t("flota.bk.noDate")}</span>
                      <span className="fl-term__loc">{t("flota.bk.noDateSub")}</span>
                    </button>
                  </div>
                </div>
              )}

              {step === "pakiet" && (
                <div className="fl-bk">
                  <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("flota.bk.pkgTitle")} />
                  <p className="fl-bk__sub">{t("flota.bk.pkgSub")} · <b>{termSel?.location_pl || trackLabel(track, lang)}</b> · {lang === "en" ? "all prices net" : "ceny netto"}</p>
                  <div className="fl-pkgs">
                    {PACKAGES.map((p) => {
                      const price = priceFor(p.n);
                      return (
                        <button key={p.n} className={`fl-pkg ${sessions === p.n ? "on" : ""}`} onClick={() => setSessions(p.n)} disabled={!price}>
                          <span className="fl-pkg__n">{p.n} <i>{(lang === "en" ? p.sub_en : p.sub_pl).replace(/^\d+\s*/, "")}</i></span>
                          <span className="fl-pkg__name">{lang === "en" ? p.en : p.pl}</span>
                          <span className="fl-pkg__price">{price ? fmtZl(price) : "—"} <small>{t("card.net")}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === "produkt" && (
                <div className="fl-bk">
                  <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("card.title")} />
                  <ProductCard
                    title={t("flota.bk.product")} subtitle={t("card.desc")}
                    code={custom ? "OWN" : carSel?.badge} color={custom ? "var(--red)" : (carSel?.color || "var(--red)")}
                    photo={custom ? "/assets/covers/mariusz.webp" : (carSel?.png || carSel?.photos?.[0])} photos={custom ? [] : (carSel?.photos || [])}
                    price={total} currency="PLN" lines={cardLines} includes={cardIncludes} onOrder={goNext}
                  />
                </div>
              )}

              {step === "dane" && (
                <div className="fl-bk">
                  <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("flota.bk.dataTitle")} />
                  <p className="fl-bk__sub">{t("flota.bk.dataSub")}</p>
                  <div className="fl-form">
                    {custom && (
                      <label className="fl-field fl-field--full"><span className="req">{t("flota.bk.carLabel")}</span>
                        <input value={carName} onChange={(e) => setCarName(e.target.value)} placeholder={t("flota.bk.carPh")} /></label>
                    )}
                    <label className="fl-field"><span className="req">{t("flota.bk.name")}</span>
                      <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="name" /></label>
                    <label className="fl-field"><span className="req">{t("flota.bk.phone")}</span>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
                    <label className="fl-field fl-field--full"><span className="req">{t("flota.bk.email")}</span>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                    <label className="fl-field fl-field--full"><span>{t("flota.bk.note")}</span>
                      <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                  </div>
                </div>
              )}

              {step === "platnosc" && <StepTag n={stepIdx + 1} of={stepKeys.length} title={t("flota.bk.s4")} />}
              {step === "platnosc" && (
                <PayStep create={createBooking} payload={{
                  car_id: custom ? null : carSel?.id, car_name: custom ? carName : carSel?.name, is_custom: custom, sessions,
                  term_id: (termSel && !termSel.noDate) ? termSel.id : null, track,
                  term_label: termSel?.noDate ? "Termin do ustalenia" : termSel ? `${termSel.location_pl || trackLabel(termSel.track, "pl")} · ${termSel.date} · ${termSel.time}` : "",
                  full_name: form.full_name, email: form.email, phone: form.phone, note: form.note,
                }} />
              )}
            </div>

            {step !== "platnosc" && step !== "produkt" && (
              <>
                {err && <div className="rz-err">{err}</div>}
                <div className="rz-foot">
                  <button className="btn btn--back" onClick={goPrev}><i className="btn__back">‹</i>{t("flota.bk.prev")}</button>
                  <div className="rz-foot__sum">
                    {sessions && <span>{pkg?.[lang === "en" ? "en" : "pl"]}</span>}
                    {total > 0 && <b>{fmtZl(total)} <small style={{ font: "600 11px var(--font-body)", color: "var(--muted)" }}>{t("card.net")}</small></b>}
                  </div>
                  <button className={`btn btn--red ${!canNext ? "is-locked" : ""}`} onClick={goNext}>
                    {step === "dane" ? t("flota.bk.pay") : t("flota.bk.next")} ›
                  </button>
                </div>
              </>
            )}
            {step === "produkt" && (
              <div className="rz-foot">
                <button className="btn btn--back" onClick={goPrev}><i className="btn__back">‹</i>{t("flota.bk.prev")}</button>
                <div className="rz-foot__sum"><span>{carTitle}</span><b>{fmtGross(total)} <small style={{ font: "600 11px var(--font-body)", color: "var(--muted)" }}>{t("card.grossShort")}</small></b></div>
                <button className="btn btn--red" onClick={goNext}>{t("card.order")} ›</button>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* payment step — the tank fills, the pending order + Tpay transaction are created, then off to the gateway */
export function PayStep({ create, payload }) {
  const { t } = useStore();
  const { phase, fill, err, retry } = usePayRedirect(create, payload);
  return (
    <div className="fl-pay rz-pay">
      <FuelTank fill={fill} done={phase === "redirect"} />
      {phase !== "error" && <div className="fl-pay__status">{phase === "redirect" ? "→ Tpay" : t("flota.bk.processing")}</div>}
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
