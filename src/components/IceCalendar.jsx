import { useState } from "react";
import { addDays, isoOf, soldOutSet, windowMonths } from "../lib/ice";

const WD = { pl: ["PN", "WT", "ŚR", "CZ", "PT", "SB", "ND"], en: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] };

/* Month grids of the Laponia season window. Every day has one state:
   free · sold (marked sold out in the panel) · out (outside the season) · nofit (configurator only:
   a `days`-long stay from here would leave the window or touch a sold-out day).
   `readOnly` = the product page preview: nothing to click, only free / sold / out. */
export default function IceCalendar({ win, allowed, days = 1, start = "", onPick, lang = "pl", t, readOnly = false }) {
  const [hover, setHover] = useState("");
  const months = windowMonths(win);
  if (!months.length) return null;
  const sold = soldOutSet(win);

  const inStay = (iso, anchor) => !!anchor && iso >= anchor && iso <= addDays(anchor, days - 1);
  const stateOf = (iso) => {
    if (iso < win.date_from || iso > win.date_to) return "out";
    if (sold.has(iso)) return "sold";
    if (readOnly || allowed?.has(iso)) return "free";
    return "nofit";
  };
  const TIP = { sold: t("ice.legSold"), out: t("ice.legOut"), nofit: t("ice.legNoFit") };

  return (
    <div className={`ri-calwrap ${readOnly ? "is-ro" : ""}`}>
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
                  const st = stateOf(iso);
                  const cls = `ri-day is-${st} ${inStay(iso, start) ? "is-sel" : ""} ${!start && inStay(iso, hover) ? "is-pre" : ""}`;
                  if (readOnly) return <span key={iso} className={cls} title={TIP[st]}>{d.getDate()}{st === "sold" && <i className="ri-day__x" aria-hidden="true" />}</span>;
                  const ok = st === "free";
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={cls}
                      disabled={!ok}
                      title={TIP[st]}
                      onMouseEnter={() => ok && setHover(iso)}
                      onMouseLeave={() => setHover("")}
                      onClick={() => ok && onPick?.(iso)}
                    >
                      {d.getDate()}
                      {st === "sold" && <i className="ri-day__x" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ri-legend">
        <span><i className="ri-legend__sw is-free" />{t("ice.legFree")}</span>
        <span><i className="ri-legend__sw is-sold" />{t("ice.legSold")}</span>
        {!readOnly && <span><i className="ri-legend__sw is-nofit" />{t("ice.legNoFit")}</span>}
        <span><i className="ri-legend__sw is-out" />{t("ice.legOut")}</span>
      </div>
    </div>
  );
}
