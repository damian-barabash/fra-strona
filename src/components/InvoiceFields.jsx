import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { adminCall } from "../lib/api";
import { normNip, nipValid, fmtPostal } from "../lib/invoice";
import "../sections/invoice.css";

/* "Chcę fakturę VAT na firmę" in the DANE step of every configurator.
   A valid NIP fills the company name and address from the MF VAT register (Biała lista, via admin-api
   `nip.lookup`) — only a suggestion, the customer can change everything; checkout checks it again.
   `f` = the configurator's field-class prefix (fl | ri | zk | zw), so the inputs look like the rest of the form. */
export default function InvoiceFields({ value, onChange, f = "fl" }) {
  const { t } = useStore();
  const inv = value;
  const set = (patch) => onChange({ ...inv, ...patch });
  const digits = normNip(inv.nip);
  const bad = digits.length >= 10 && !nipValid(digits);
  const [look, setLook] = useState({ busy: false, ok: false, msg: "", for: "" });
  const seq = useRef(0);

  const lookup = async (force = false) => {
    if (!nipValid(digits) || look.busy) return;
    if (!force && look.for === digits) return;
    const my = ++seq.current;
    setLook({ busy: true, ok: false, msg: "", for: digits });
    const r = await adminCall("", "nip.lookup", { nip: digits }).catch(() => null);
    if (my !== seq.current) return;
    if (r?.ok) {
      onChange({ ...inv, company: r.company || inv.company, street: r.street || inv.street, postal: r.postal || inv.postal, city: r.city || inv.city });
      setLook({ busy: false, ok: true, for: digits, msg: t("inv.found") + (r.vat_status ? ` · ${t("inv.vatStatus")}: ${r.vat_status}` : "") });
    } else {
      setLook({ busy: false, ok: false, for: digits, msg: t(r?.reason === "notfound" ? "inv.notFound" : "inv.lookupFail") });
    }
  };
  // a valid NIP → fetch the company at once, no need to look for the button
  useEffect(() => {
    if (!inv.want || !nipValid(digits)) return;
    const id = setTimeout(() => lookup(), 250);
    return () => clearTimeout(id);
  }, [digits, inv.want]); // eslint-disable-line

  const fld = (cls = "") => `${f}-field inv-field ${cls}`;
  return (
    <div className={`inv inv--${f} ${inv.want ? "is-on" : ""}`}>
      <label className="inv-toggle">
        <input type="checkbox" checked={inv.want} onChange={(e) => set({ want: e.target.checked })} />
        <i className="inv-toggle__box" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>
        </i>
        <span className="inv-toggle__txt">
          <b>{t("inv.want")}</b>
          <small>{t("inv.wantSub")}</small>
        </span>
      </label>

      <div className="inv-panel" aria-hidden={!inv.want}>
        <div className="inv-panel__in">
          <div className="inv-grid">
            <div className="inv-nip">
              <label className={fld()}><span className="req">{t("inv.nip")}</span>
                <input value={inv.nip} onChange={(e) => set({ nip: e.target.value })} inputMode="numeric" maxLength={16}
                  placeholder={t("inv.nipPh")} aria-invalid={bad} tabIndex={inv.want ? 0 : -1} autoComplete="off" /></label>
              <button type="button" className="inv-fetch" onClick={() => lookup(true)} disabled={!nipValid(digits) || look.busy} tabIndex={inv.want ? 0 : -1}>
                {look.busy ? <><i className="inv-spin" />{t("inv.fetching")}</> : t("inv.fetch")}
              </button>
            </div>
            {bad
              ? <p className="inv-msg is-bad">{t("inv.errNip")}</p>
              : look.msg && look.for === digits && <p className={`inv-msg ${look.ok ? "is-ok" : "is-bad"}`}>{look.msg}</p>}
            <label className={fld("inv-full")}><span className="req">{t("inv.company")}</span>
              <input value={inv.company} onChange={(e) => set({ company: e.target.value })} maxLength={200} autoComplete="organization" tabIndex={inv.want ? 0 : -1} /></label>
            <label className={fld("inv-full")}><span className="req">{t("inv.street")}</span>
              <input value={inv.street} onChange={(e) => set({ street: e.target.value })} maxLength={200} autoComplete="address-line1" tabIndex={inv.want ? 0 : -1} /></label>
            <label className={fld("inv-postal")}><span className="req">{t("inv.postal")}</span>
              <input value={inv.postal} onChange={(e) => set({ postal: fmtPostal(e.target.value) })} inputMode="numeric" placeholder="00-000" autoComplete="postal-code" tabIndex={inv.want ? 0 : -1} /></label>
            <label className={fld()}><span className="req">{t("inv.city")}</span>
              <input value={inv.city} onChange={(e) => set({ city: e.target.value })} maxLength={100} autoComplete="address-level2" tabIndex={inv.want ? 0 : -1} /></label>
          </div>
          <p className="inv-note">{t("inv.note")}</p>
        </div>
      </div>
    </div>
  );
}
