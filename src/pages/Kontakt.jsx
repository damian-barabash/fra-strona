import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { sendContact } from "../lib/api";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import "../sections/kontakt.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

/* /kontakt — parsed from the old site (e-mail + Łukasz + Mariusz), rebuilt with a racing feel:
   pit-board contact cards and a form whose submit runs the F1 start-light sequence.
   The message is stored and e-mailed by the `contact` edge function (Resend). */
export default function Kontakt() {
  const { t, tracks, cmsMode, isAdmin } = useStore();
  useSeo({ title: "Kontakt", path: "/kontakt", description: "Skontaktuj się z Fastline Racing Academy: szkolenia indywidualne, vouchery i eventy firmowe. Tel. +48 603 102 665, racingacademy@fastline.pl. Tory: Łódź, Poznań, Modlin.", jsonld: [{ "@type": "ContactPage", "@id": `${SITE}/kontakt#contact`, url: `${SITE}/kontakt`, name: "Kontakt — Fastline Racing Academy" }, breadcrumbs([{ name: "Kontakt", path: "/kontakt" }])] });
  const editing = cmsMode && isAdmin;

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", subject: "", message: "" });
  const [phase, setPhase] = useState("idle");   // idle | sending | done | error
  const [err, setErr] = useState("");
  const [lights, setLights] = useState(0);      // 0..5 start lights lit

  useRevealOnScroll([tracks.length, phase]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const SUBJECTS = [t("kon.s1"), t("kon.s2"), t("kon.s3"), t("kon.s4")];
  const filled = ["full_name", "email", "message"].filter((k) => form[k].trim()).length;
  const valid = form.full_name.trim() && /.+@.+\..+/.test(form.email) && form.message.trim();

  /* The start lights double as a progress indicator: one lights up per completed part of the
     form, all five glow when it's ready to send — and they go out ("lights out") on submit. */
  const progress = [
    !!form.full_name.trim(),
    /.+@.+\..+/.test(form.email),
    !!(form.phone.trim() || form.subject),
    form.message.trim().length >= 10,
    !!valid,
  ].filter(Boolean).length;
  const lit = phase === "sending" ? lights : progress;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || phase === "sending") {
      if (!valid) setErr(t("kon.errFill"));
      return;
    }
    setErr(""); setPhase("sending"); setLights(0);

    // F1 start sequence: five lights come on…
    for (let i = 1; i <= 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 180));
      setLights(i);
    }
    const r = await sendContact({ ...form, subject: form.subject || SUBJECTS[0] });
    await new Promise((res) => setTimeout(res, 260));
    setLights(0); // …and out they go — lights out, message away

    if (r?.ok) {
      setPhase("done");
      setForm({ full_name: "", email: "", phone: "", subject: "", message: "" });
    } else {
      setPhase("error");
      setErr(r?.error || t("kon.errSend"));
    }
  };

  return (
    <div className={editing ? "cms-on kt" : "kt"}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---------------- HEADER ---------------- */}
        <section className="kt-head">
          <div className="kt-head__flag" />
          <div className="speedfx">{[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ top: `${18 + i * 22}%`, left: "-30%", width: "52%", animationDelay: `${i * 0.9}s` }} />
          ))}</div>
          <div className="container kt-head__inner">
            <EText id="kon.eyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="kon.title" as="h1" className="h-display kt-head__title reveal-up rv-d1" />
            <EText id="kon.sub" as="p" className="lead kt-head__sub reveal-up rv-d2" multiline />
          </div>
        </section>

        {/* ---------------- CONTACTS + FORM ---------------- */}
        <section className="section section--paper kt-main" id="kontakt">
          <div className="tex" />
          <div className="container kt-grid">
            {/* pit board */}
            <div className="kt-side">
              <div className="kt-card kt-card--mail reveal-left">
                <span className="kt-card__l">{t("kon.mailLabel")}</span>
                <a className="kt-card__v" href={`mailto:${t("kon.email")}`}><EText id="kon.email" /></a>
                <span className="kt-card__hint">{t("kon.mailHint")}</span>
              </div>

              {[1, 2].map((n) => (
                <a key={n} className={`kt-card kt-card--tel reveal-left rv-d${n}`} href={`tel:${t(`kon.p${n}.phone`).replace(/\s/g, "")}`}
                  onClick={(e) => editing && e.preventDefault()}>
                  <span className="kt-card__no">0{n}</span>
                  <span className="kt-card__l"><EText id={`kon.p${n}.role`} /></span>
                  <span className="kt-card__name"><EText id={`kon.p${n}.name`} /></span>
                  <span className="kt-card__v"><EText id={`kon.p${n}.phone`} /></span>
                  <span className="kt-card__go">›</span>
                </a>
              ))}

              <div className="kt-company reveal-left rv-d3">
                <EText id="kon.company" as="span" className="kt-company__n" />
                <EText id="kon.companyNote" as="span" className="kt-company__x" multiline />
              </div>
            </div>

            {/* form */}
            <form className="kt-form reveal-up" onSubmit={submit} noValidate>
              <div className="kt-form__head">
                <div>
                  <EText id="kon.formTitle" as="h2" className="kt-form__title" />
                  <EText id="kon.formSub" as="p" className="kt-form__sub" />
                </div>
                {/* F1 start lights: fill up as the form gets completed, go out on send */}
                <div className={`kt-lights ${progress === 5 && phase !== "sending" ? "ready" : ""}`}
                  title={`${progress}/5`} aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`kt-light ${lit >= i ? "on" : ""}`} />
                  ))}
                </div>
              </div>

              <div className="kt-fields">
                <label className="kt-field">
                  <span className="req">{t("kon.fName")}</span>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </label>
                <label className="kt-field">
                  <span>{t("kon.fPhone")}</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label className="kt-field kt-field--full">
                  <span className="req">{t("kon.fEmail")}</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>

                <div className="kt-field kt-field--full">
                  <span>{t("kon.fSubject")}</span>
                  <div className="kt-chips">
                    {SUBJECTS.map((s) => (
                      <button type="button" key={s}
                        className={`kt-chip ${(form.subject || SUBJECTS[0]) === s ? "on" : ""}`}
                        onClick={() => setForm({ ...form, subject: s })}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="kt-field kt-field--full">
                  <span className="req">{t("kon.fMsg")}</span>
                  <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </label>
              </div>

              {/* progress rail: fills as the required fields get filled */}
              <div className="kt-rail" aria-hidden="true">
                <span className="kt-rail__fill" style={{ width: `${(filled / 3) * 100}%` }} />
              </div>

              {err && <div className="kt-err">{err}</div>}

              <div className="kt-foot">
                <span className="kt-foot__note">{t("kon.rodo")}</span>
                <button className={`btn btn--red kt-send ${!valid ? "is-locked" : ""}`} disabled={phase === "sending"}>
                  {phase === "sending" ? t("kon.sending") : t("kon.send")} <span className="btn__arrow">›</span>
                </button>
              </div>

              <AnimatePresence>
                {phase === "done" && (
                  <motion.div className="kt-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="kt-done__box" initial={{ y: 22, scale: .96 }} animate={{ y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}>
                      <div className="kt-done__lights">{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
                      <svg className="kt-done__check" viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
                        <circle className="kt-done__ring" cx="60" cy="60" r="52" pathLength="1" />
                        <path className="kt-done__mark" d="M36 62 L53 78 L86 42" pathLength="1" />
                      </svg>
                      <h3 className="kt-done__t">{t("kon.doneTitle")}</h3>
                      <p className="kt-done__p">{t("kon.doneSub")}</p>
                      <button type="button" className="btn btn--dark" onClick={() => setPhase("idle")}>{t("kon.doneBtn")}</button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </section>

        {/* ---------------- TRACKS ---------------- */}
        {!!tracks.length && (
          <section className="section section--dark kt-tracks">
            <div className="speedfx">{[0, 1, 2].map((i) => (
              <span key={i} style={{ top: `${26 + i * 24}%`, left: "-30%", width: "46%", animationDelay: `${i * 1.1}s` }} />
            ))}</div>
            <div className="container">
              <div className="kt-tracks__head">
                <EText id="kon.trackEyebrow" as="span" className="eyebrow reveal-up" />
                <EText id="kon.trackTitle" as="h2" className="h-section reveal-up rv-d1" />
              </div>
              <div className="kt-tracks__grid">
                {tracks.slice(0, 8).map((tr, i) => (
                  <div key={tr.id} className={`kt-track reveal-up rv-d${(i % 4) + 1}`}>
                    {tr.map && <img src={tr.map} alt="" loading="lazy" />}
                    <span className="kt-track__n">{tr.full_name || tr.name}</span>
                  </div>
                ))}
              </div>
              <Link to="/kalendarz" className="btn btn--red kt-tracks__btn" onClick={() => window.scrollTo({ top: 0 })}>
                {t("kon.trackBtn")} <span className="btn__arrow">›</span>
              </Link>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
