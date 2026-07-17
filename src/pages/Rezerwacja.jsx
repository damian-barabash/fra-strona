import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import CarSlider from "../sections/CarSlider";
import { FuelGauge, FuelTank } from "../components/Fuel";
import { PACKAGES, trackLabel, carPrice, customPrice, fmtZl, isPoznan } from "../lib/flota";
import "../sections/flota.css";
import "../sections/rezerwacja.css";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// "no date" pseudo-term — books without a specific date (arranged individually), base (Łódź) pricing
const NO_DATE = { id: "__nodate__", noDate: true, track: "lodz", location_pl: null };
const fmtDate = (iso, lang) => {
  if (!iso) return "";
  try { return new Date(iso + "T00:00:00").toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
};

export default function Rezerwacja() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { cars, terms, events, t, raw, lang, L, createBooking } = useStore();

  const carId = sp.get("car");
  const custom = sp.get("custom") === "1";
  const eventId = sp.get("event");
  const termIdQ = sp.get("term");

  const presetCar = carId ? cars.find((c) => c.id === carId) : null;
  const presetEvent = eventId ? events.find((e) => e.id === eventId) : null;
  const presetTerm = termIdQ ? terms.find((x) => x.id === termIdQ) : null;

  const [carSel, setCarSel] = useState(null);
  const [termSel, setTermSel] = useState(null);
  // ?sessions=N — the price board on /cennik links straight to a package
  const sessionsQ = parseInt(sp.get("sessions"), 10);
  const [sessions, setSessions] = useState(PACKAGES.some((p) => p.n === sessionsQ) ? sessionsQ : null);
  const [carName, setCarName] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  // presets can resolve after async data load
  useEffect(() => { if (presetCar) setCarSel(presetCar); }, [presetCar?.id]); // eslint-disable-line
  useEffect(() => { if (presetTerm) setTermSel(presetTerm); }, [presetTerm?.id]); // eslint-disable-line

  // an event carries its own date + track (acts like a chosen term, without term_id)
  const eventCtx = presetEvent ? {
    label: `${L(presetEvent, "title")} · ${presetEvent.day || ""} ${L(presetEvent, "month")} · ${presetEvent.time || ""}`,
    loc: presetEvent.location_pl || trackLabel(presetEvent.track, lang),
    track: presetEvent.track || "lodz",
  } : null;

  // fixed step list (decided from the query context at entry)
  const stepKeys = useMemo(() => {
    const s = [];
    if (!custom && !carId) s.push("auto");
    if (!eventId && !termIdQ) s.push("termin");
    s.push("pakiet", "dane", "platnosc");
    return s;
  }, [custom, carId, eventId, termIdQ]);
  const step = stepKeys[stepIdx];

  const track = termSel?.track || eventCtx?.track || "lodz";
  const priceFor = (n) => (custom ? customPrice(raw, n, track) : carPrice(carSel, n, track));
  const total = sessions ? priceFor(sessions) : 0;

  const dateLabel = termSel?.noDate ? t("flota.bk.noDate")
    : termSel ? `${fmtDate(termSel.date, lang)} · ${termSel.location_pl || trackLabel(termSel.track, lang)} · ${termSel.time}`
    : eventCtx ? `${eventCtx.loc} · ${eventCtx.label}` : "";

  const carTitle = custom ? (carName.trim() || t("flota.customName")) : (carSel?.name || t("flota.bk.title"));
  // the header always says WHAT is being booked; the h1 shows the chosen car (or the configurator title)
  const headTitle = carTitle;
  const headSub = stepKeys[0] === "auto" ? t("flota.bk.configTitle") : t("flota.bk.title");

  const canNext =
    step === "auto" ? !!carSel :
    step === "termin" ? !!termSel :
    step === "pakiet" ? !!sessions :
    step === "dane" ? (form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim() && (!custom || carName.trim())) :
    true;

  const goNext = () => {
    if (!canNext) {
      setErr(
        step === "auto" ? "Wybierz auto." :
        step === "termin" ? "Wybierz termin." :
        step === "pakiet" ? "Wybierz pakiet." :
        (custom && !carName.trim()) ? "Podaj model swojego auta." :
        "Uzupełnij poprawnie: imię i nazwisko, e-mail oraz telefon."
      );
      return;
    }
    setErr(""); setStepIdx((i) => Math.min(stepKeys.length - 1, i + 1));
  };
  const goPrev = () => {
    setErr("");
    if (stepIdx === 0) { nav(-1); return; }
    setStepIdx((i) => Math.max(0, i - 1));
  };

  const gauge = stepKeys.length > 1 ? stepIdx / (stepKeys.length - 1) : 1;
  const STEP_LABEL = { auto: t("flota.bk.sAuto"), termin: t("flota.bk.s2"), pakiet: t("flota.bk.s1"), dane: t("flota.bk.s3"), platnosc: t("flota.bk.s4") };

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
                <h1 className="rz-head__title">{headTitle}</h1>
                <div className="rz-head__product">
                  {t("flota.bk.productSub")} <i>·</i> {headSub}
                </div>
                <div className="rz-head__ctx">
                  {(carSel || custom) && <span className="rz-chip"><b>{t("flota.bk.chosenCar")}</b>{custom ? t("flota.customName") : carSel?.name}</span>}
                  {dateLabel && <span className="rz-chip"><b>{t("flota.bk.chosenDate")}</b>{dateLabel}</span>}
                  {sessions && <span className="rz-chip"><b>{t("flota.bk.total")}</b>{fmtZl(total)}</span>}
                </div>
              </div>
              <div className="rz-head__gauge"><FuelGauge value={step === "platnosc" ? 1 : gauge} big /></div>
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
                  <h4 className="fl-bk__h">{t("flota.bk.autoTitle")}</h4>
                  <p className="fl-bk__sub">{t("flota.bk.autoSub")}</p>
                  <CarSlider
                    hideHead priceTrack={track}
                    onCurrent={(c) => setCarSel(c)}
                    onChoose={(c) => { setCarSel(c); setStepIdx((i) => Math.min(stepKeys.length - 1, i + 1)); }}
                  />
                </div>
              )}

              {step === "termin" && (
                <div className="fl-bk">
                  <h4 className="fl-bk__h">{t("flota.bk.termTitle")}</h4>
                  <p className="fl-bk__sub">{t("flota.bk.termSub")}</p>
                  <div className="fl-terms">
                    {terms.map((tm) => (
                      <button key={tm.id} className={`fl-term ${termSel?.id === tm.id ? "on" : ""}`} onClick={() => setTermSel(tm)}>
                        <span className="fl-term__date">{fmtDate(tm.date, lang)}</span>
                        <span className="fl-term__loc">{tm.location_pl || trackLabel(tm.track, lang)}{isPoznan(tm.track) && <b className="fl-term__pz">POZNAŃ</b>}</span>
                        <span className="fl-term__time">{tm.time}</span>
                      </button>
                    ))}
                    {/* book without a specific date — arranged individually */}
                    <button className={`fl-term fl-term--nodate ${termSel?.noDate ? "on" : ""}`} onClick={() => setTermSel(NO_DATE)}>
                      <span className="fl-term__date">{t("flota.bk.noDate")}</span>
                      <span className="fl-term__loc">{t("flota.bk.noDateSub")}</span>
                    </button>
                  </div>
                </div>
              )}

              {step === "pakiet" && (
                <div className="fl-bk">
                  <h4 className="fl-bk__h">{t("flota.bk.pkgTitle")}</h4>
                  <p className="fl-bk__sub">{t("flota.bk.pkgSub")} · <b>{termSel?.location_pl || eventCtx?.loc || trackLabel(track, lang)}</b></p>
                  <div className="fl-pkgs">
                    {PACKAGES.map((p) => {
                      const price = priceFor(p.n);
                      return (
                        <button key={p.n} className={`fl-pkg ${sessions === p.n ? "on" : ""}`} onClick={() => setSessions(p.n)} disabled={!price}>
                          <span className="fl-pkg__n">{p.n}<i>×</i></span>
                          <span className="fl-pkg__name">{lang === "en" ? p.en : p.pl}</span>
                          <span className="fl-pkg__sub">{lang === "en" ? p.sub_en : p.sub_pl}</span>
                          <span className="fl-pkg__price">{price ? fmtZl(price) : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === "dane" && (
                <div className="fl-bk">
                  <h4 className="fl-bk__h">{t("flota.bk.dataTitle")}</h4>
                  <p className="fl-bk__sub">{t("flota.bk.dataSub")}</p>
                  <div className="fl-form">
                    {custom && (
                      <label className="fl-field fl-field--full"><span>{t("flota.bk.carLabel")}</span>
                        <input value={carName} onChange={(e) => setCarName(e.target.value)} placeholder={t("flota.bk.carPh")} /></label>
                    )}
                    <label className="fl-field"><span>{t("flota.bk.name")}</span>
                      <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
                    <label className="fl-field"><span>{t("flota.bk.phone")}</span>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="fl-field fl-field--full"><span>{t("flota.bk.email")}</span>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label className="fl-field fl-field--full"><span>{t("flota.bk.note")}</span>
                      <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                  </div>
                </div>
              )}

              {step === "platnosc" && (
                <PayStep
                  custom={custom} car={carSel} carName={carName} sessions={sessions} total={total}
                  termSel={termSel} eventCtx={eventCtx} track={track} form={form}
                  createBooking={createBooking} onClose={() => nav("/flota")}
                />
              )}
            </div>

            {step !== "platnosc" && (
              <>
                {err && <div className="rz-err">{err}</div>}
                <div className="rz-foot">
                  <button className="btn btn--ghost" onClick={goPrev}>{t("flota.bk.prev")}</button>
                  <div className="rz-foot__sum">
                    {sessions && <span>{PACKAGES.find((p) => p.n === sessions)?.[lang === "en" ? "en" : "pl"]}</span>}
                    {total > 0 && <b>{fmtZl(total)}</b>}
                  </div>
                  <button className={`btn btn--red ${!canNext ? "is-locked" : ""}`} onClick={goNext}>
                    {step === "dane" ? t("flota.bk.pay") : t("flota.bk.next")} ›
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* payment step — the big fuel-fill interaction (page, not modal) */
function PayStep({ custom, car, carName, sessions, total, termSel, eventCtx, track, form, createBooking, onClose }) {
  const { t, lang } = useStore();
  const [phase, setPhase] = useState("filling");
  const [fill, setFill] = useState(0);
  const [err, setErr] = useState("");
  const submittedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let raf = 0, cancelled = false;
    const t0 = performance.now(), dur = 2400;
    const submit = async () => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const termLabel = termSel?.noDate ? "Termin do ustalenia"
        : termSel ? `${termSel.location_pl || trackLabel(termSel.track, "pl")} · ${termSel.date} · ${termSel.time}`
        : eventCtx ? `${eventCtx.loc} · ${eventCtx.label}` : "";
      const r = await createBooking({
        car_id: custom ? null : car?.id,
        car_name: custom ? carName : car?.name,
        is_custom: custom,
        sessions,
        term_id: (termSel && !termSel.noDate) ? termSel.id : null,
        track,
        term_label: termLabel,
        full_name: form.full_name, email: form.email, phone: form.phone, note: form.note,
      });
      if (cancelled) return;
      if (r?.ok) setPhase("done");
      else { setErr(r?.error || "Błąd rezerwacji"); setPhase("error"); }
    };
    const tick = (now) => {
      if (cancelled) return;
      const p = clamp((now - t0) / dur, 0, 1);
      setFill(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick); else submit();
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [attempt]); // eslint-disable-line

  const retry = () => { submittedRef.current = false; setErr(""); setFill(0); setPhase("filling"); setAttempt((a) => a + 1); };

  return (
    <div className="fl-pay rz-pay">
      <FuelTank fill={fill} done={phase === "done"} />
      {phase === "filling" && <div className="fl-pay__status">{t("flota.bk.processing")}</div>}
      {phase === "done" && (
        <div className="fl-pay__done">
          <div className="fl-pay__check">✓</div>
          <h4 className="fl-pay__title">{t("flota.bk.doneTitle")}</h4>
          <p className="fl-pay__thanks">{t("flota.bk.thanks")}</p>
          <div className="fl-pay__receipt">
            <div><span>{custom ? carName || t("flota.customName") : car?.name}</span><b>{fmtZl(total)}</b></div>
            <div><span>{sessions} × {lang === "en" ? "session" : "sesja"} · {termSel?.noDate ? t("flota.bk.noDate") : (termSel?.location_pl || eventCtx?.loc || trackLabel(track, lang))}</span></div>
            <div className="fl-pay__demo">{t("flota.bk.demoNote")}</div>
          </div>
          <div className="rz-pay__btns">
            <Link to="/" className="btn btn--ghost" onClick={() => window.scrollTo({ top: 0 })}>{t("flota.bk.close")}</Link>
            <Link to="/flota" className="btn btn--dark" onClick={() => window.scrollTo({ top: 0 })}>{t("flota.title")}</Link>
          </div>
        </div>
      )}
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
