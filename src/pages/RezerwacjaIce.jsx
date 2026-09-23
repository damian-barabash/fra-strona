import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { fmtEur, fmtDay, addDays, parseISO, isoOf, startDates, iceDateRange } from "../lib/ice";
import ProductCard from "../components/ProductCard";
import { usePayRedirect } from "../lib/pay";
import { fmtZl } from "../lib/flota";
import "../sections/laponia.css";
import "../sections/productcard.css";

const lines = (x) => String(x || "").split("\n").map((v) => v.trim()).filter(Boolean);
const WD = { pl: ["PN", "WT", "ŚR", "CZ", "PT", "SB", "ND"], en: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] };

/* The ice configurator: PAKIET → TERMIN (a start date inside the CMS season window) → DANE → PŁATNOŚĆ.
   Prices and the window come from the CMS; the total is recomputed server-side on submit. */
export default function RezerwacjaIce() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { icePackages, iceWindows, products, raw, t, L, lang, createIceBooking } = useStore();

  const preset = sp.get("pkg");
  const [pkg, setPkg] = useState(null);
  const [win, setWin] = useState(null);
  const [start, setStart] = useState("");
  const [persons, setPersons] = useState(1);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", note: "" });
  const [stepIdx, setStepIdx] = useState(preset ? 1 : 0);
  const [err, setErr] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { // presets resolve after the async load
    if (preset && !pkg) {
      const found = icePackages.find((x) => x.id === preset);
      if (found) setPkg(found);
    }
  }, [preset, icePackages, pkg]);
  useEffect(() => { if (!win && iceWindows.length) setWin(iceWindows[0]); }, [iceWindows, win]);

  const days = pkg?.days || 1;
  const allowed = useMemo(() => new Set(startDates(win, days)), [win, days]);
  const end = start ? addDays(start, days - 1) : "";
  const total = (pkg?.price || 0) * persons;

  const STEPS = ["pakiet", "termin", "produkt", "dane", "platnosc"];
  const laponia = products.find((x) => x.slug === "ice-driving-laponia");
  const eurRate = parseFloat(String(raw("ice.eurRate").pl || "4.35").replace(",", ".")) || 4.35;
  const step = STEPS[stepIdx];

  const canNext =
    step === "pakiet" ? !!pkg :
    step === "termin" ? !!start :
    step === "produkt" ? true :
    step === "dane" ? (form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.phone.trim()) :
    true;

  const goNext = () => {
    if (!canNext) {
      setErr(
        step === "pakiet" ? t("ice.errPkg") :
        step === "termin" ? t("ice.errDate") : t("ice.errData"),
      );
      return;
    }
    setErr("");
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goPrev = () => {
    setErr("");
    if (stepIdx === 0) { nav(-1); return; }
    setStepIdx((i) => Math.max(0, i - 1));
  };

  const progress = stepIdx / (STEPS.length - 1);
  const LBL = { pakiet: t("ice.sPkg"), termin: t("ice.sDate"), produkt: t("card.step"), dane: t("ice.sData"), platnosc: t("ice.sPay") };

  return (
    <div className="lp rz-ice">
      <ScrollProgress />
      <Nav />
      <Snowfall />
      <main>
        <section className="lp-sec ri-wrap">
          <div className="container">
            {/* header + frost progress */}
            <div className="ri-head">
              <div>
                <span className="lp-kicker">{t("ice.bkTitle")}</span>
                <h1 className="ri-head__title">{pkg ? L(pkg, "name") : t("ice.configTitle")}</h1>
                <div className="ri-head__product">{t("ice.bkSub")}</div>
                <div className="ri-chips">
                  {pkg && <span className="lp-frost-chip"><b>{t("ice.sPkg")}</b>{L(pkg, "name")}</span>}
                  {start && <span className="lp-frost-chip"><b>{t("ice.sDate")}</b>{fmtDay(start, lang)}{days > 1 ? ` – ${fmtDay(end, lang)}` : ""}</span>}
                  {pkg && <span className="lp-frost-chip"><b>{t("ice.total")}</b>{fmtEur(total, pkg.currency)}</span>}
                </div>
              </div>
              <IceGauge value={step === "platnosc" ? 1 : progress} />
            </div>

            <div className="ri-steps">
              {STEPS.map((k, i) => (
                <div key={k} className={`ri-step ${i === stepIdx ? "on" : ""} ${i < stepIdx ? "done" : ""}`}>
                  <span>{i < stepIdx ? "✓" : i + 1}</span>{LBL[k]}
                </div>
              ))}
            </div>

            <div className="ri-body">
              {step === "pakiet" && (
                <div className="ri-block">
                  <h3 className="lp-h">{t("ice.pickPkg")}</h3>
                  <div className="ri-pkgs">
                    {icePackages.map((pk) => (
                      <button key={pk.id} className={`ri-pkg ${pkg?.id === pk.id ? "on" : ""}`} onClick={() => setPkg(pk)}>
                        <span className="ri-pkg__days">{pk.days}<i>{pk.days === 1 ? t("ice.day") : t("ice.days")}</i></span>
                        <span className="ri-pkg__name">{L(pk, "name")}</span>
                        <span className="ri-pkg__sessions">{L(pk, "sessions")}</span>
                        <span className="ri-pkg__price">{fmtEur(pk.price, pk.currency)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === "termin" && (
                <div className="ri-block">
                  <h3 className="lp-h">{t("ice.pickDate")}</h3>
                  <p className="ri-sub">
                    {t("ice.windowNote")} <b>{iceDateRange(win, lang)}</b>
                    {days > 1 && <> · {t("ice.daysNote").replace("{n}", days)}</>}
                  </p>
                  <IceCalendar win={win} allowed={allowed} days={days} start={start} onPick={setStart} lang={lang} />
                  {start && (
                    <div className="ri-range">
                      <span>{t("ice.stay")}</span>
                      <b>{fmtDay(start, lang)}{days > 1 ? ` – ${fmtDay(end, lang)}` : ""}</b>
                    </div>
                  )}
                </div>
              )}

              {step === "produkt" && (
                <div className="ri-block">
                  <h3 className="lp-h">{t("card.title")}</h3>
                  <ProductCard kind="ice" color="#2a9fd0"
                    title={`${L(laponia, "title") || "ICE DRIVING EXPERIENCE"} · ${L(pkg, "name")}`}
                    subtitle={L(pkg, "desc")} code={`${pkg?.days || 1} ${pkg?.days === 1 ? t("ice.day") : t("ice.days")}`}
                    photo={laponia?.photo} photos={Array.isArray(laponia?.photos) ? laponia.photos : []}
                    price={total} currency={pkg?.currency || "EUR"} pricePln={Math.round(total * eurRate)}
                    lines={[[t("ice.sPkg"), L(pkg, "name")], [t("ice.sessions") || "SESJE", L(pkg, "sessions")], [t("ice.sDate"), `${fmtDay(start, lang)}${days > 1 ? ` – ${fmtDay(end, lang)}` : ""}`], [t("ice.persons"), String(persons)]]}
                    includes={lines(L(laponia, "includes"))}
                    onOrder={goNext}
                  />
                </div>
              )}

              {step === "dane" && (
                <div className="ri-block">
                  <h3 className="lp-h">{t("flota.bk.dataTitle")}</h3>
                  <p className="ri-sub">{t("flota.bk.dataSub")}</p>
                  <div className="ri-form">
                    <label className="ri-field"><span className="req">{t("flota.bk.name")}</span>
                      <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
                    <label className="ri-field"><span className="req">{t("flota.bk.phone")}</span>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="ri-field"><span className="req">{t("flota.bk.email")}</span>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label className="ri-field"><span className="req">{t("ice.persons")}</span>
                      <input type="number" min="1" max="10" value={persons}
                        onChange={(e) => setPersons(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} /></label>
                    <label className="ri-field ri-field--full"><span>{t("flota.bk.note")}</span>
                      <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
                  </div>
                </div>
              )}

              {step === "platnosc" && (
                <PayIce t={t} create={createIceBooking} payload={{
                  package_id: pkg?.id, window_id: win?.id, date_from: start, persons,
                  full_name: form.full_name, email: form.email, phone: form.phone, note: form.note,
                }} />
              )}
            </div>

            {step !== "platnosc" && step !== "produkt" && (
              <>
                {err && <div className="ri-err">{err}</div>}
                <div className="ri-foot">
                  <button className="btn lp-btn--ghost" onClick={goPrev}>{t("flota.bk.prev")}</button>
                  <div className="ri-foot__sum">
                    {pkg && <span>{L(pkg, "name")}{persons > 1 ? ` · ${persons} ${t("ice.personsShort")}` : ""}</span>}
                    {total > 0 && <b>{fmtEur(total, pkg?.currency)}</b>}
                  </div>
                  <button className={`btn lp-btn ${!canNext ? "is-locked" : ""}`} onClick={goNext}>
                    {step === "dane" ? t("ice.pay") : t("flota.bk.next")} ›
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

/* month grid limited to the season window; a hovered day previews the whole stay */
function IceCalendar({ win, allowed, days, start, onPick, lang }) {
  const [hover, setHover] = useState("");
  if (!win) return null;

  const from = parseISO(win.date_from), to = parseISO(win.date_to);
  if (!from || !to) return null;

  // every month the window touches
  const months = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= to) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const inStay = (iso, anchor) => {
    if (!anchor) return false;
    return iso >= anchor && iso <= addDays(anchor, days - 1);
  };

  return (
    <div className="ri-cal">
      {months.map((m) => {
        const y = m.getFullYear(), mo = m.getMonth();
        const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
        const dim = new Date(y, mo + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push(null);
        for (let d = 1; d <= dim; d++) cells.push(new Date(y, mo, d));
        return (
          <div className="ri-cal__month" key={`${y}-${mo}`}>
            <div className="ri-cal__name">
              {m.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { month: "long", year: "numeric" }).toUpperCase()}
            </div>
            <div className="ri-cal__wd">{WD[lang === "en" ? "en" : "pl"].map((w) => <span key={w}>{w}</span>)}</div>
            <div className="ri-cal__grid">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} className="ri-day ri-day--empty" />;
                const iso = isoOf(d);
                const ok = allowed.has(iso);
                const sel = inStay(iso, start);
                const pre = !start && inStay(iso, hover);
                return (
                  <button
                    key={iso}
                    className={`ri-day ${ok ? "is-free" : "is-off"} ${sel ? "is-sel" : ""} ${pre ? "is-pre" : ""}`}
                    disabled={!ok}
                    onMouseEnter={() => ok && setHover(iso)}
                    onMouseLeave={() => setHover("")}
                    onClick={() => ok && onPick(iso)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* payment: the ice freezes over, the pending order + Tpay transaction are created, then off to the gateway */
function PayIce({ t, create, payload }) {
  const { phase, fill, err, retry } = usePayRedirect(create, payload);
  return (
    <div className="ri-pay">
      <div className="ri-ice" style={{ ["--f"]: `${fill}%` }}>
        <div className="ri-ice__fill" />
        <div className="ri-ice__crack" />
        <span className="ri-ice__pct">{`${fill}%`}</span>
      </div>
      {phase !== "error" && <div className="ri-pay__status">{phase === "redirect" ? "→ Tpay" : t("ice.freezing")}</div>}
      {phase === "error" && (
        <div className="ri-pay__done">
          <h3 className="ri-pay__title" style={{ color: "var(--red)" }}>Ups!</h3>
          <p className="ri-pay__thanks">{err}</p>
          <button className="btn lp-btn" onClick={retry}>Spróbuj ponownie</button>
        </div>
      )}
    </div>
  );
}

/* frost gauge — a snowflake that travels from ❄ to ❄❄❄ as the steps advance */
function IceGauge({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="ri-gauge" role="img" aria-label={`${pct}%`}>
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(94,200,240,.2)" strokeWidth="8" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#5ec8f0" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 314} 314`} transform="rotate(-90 60 60)" />
        <text x="60" y="58" textAnchor="middle" fontSize="26" fill="#5ec8f0">❄</text>
        {/* the gauge sits on the dark header — the readout has to be light */}
        <text x="60" y="83" textAnchor="middle" fontSize="16" fontWeight="800" fill="#eaf6fb" fontFamily="Montserrat, sans-serif">{pct}%</text>
      </svg>
    </div>
  );
}

function Snowfall() {
  return (
    <div className="lp-snow" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => (
        <span key={i} style={{
          ["--x"]: `${(i * 41) % 100}%`,
          ["--d"]: `${10 + ((i * 7) % 9)}s`,
          ["--delay"]: `${-((i * 4) % 12)}s`,
          ["--s"]: `${2 + ((i * 3) % 4)}px`,
          ["--o"]: 0.2 + ((i % 4) * 0.14),
        }} />
      ))}
    </div>
  );
}
