import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { fmtZl } from "../lib/flota";
import { gross, vatOf, fmtMoney, VAT_RATE } from "../lib/vat";

/* The "shop product card" shown in every configurator right before the customer's data:
   a big photo with thumbnails, a buy-box on the right, and the full training description below
   (the same structure as a classic product page: 1 photo · 2 buy box · 3 highlights · 4 description). */
export default function ProductCard({
  title, subtitle, code, photo, photos = [], color = "var(--red)",
  price, currency = "PLN", pricePln, lines = [], includes = [], onOrder, orderLabel, kind = "track",
}) {
  const { t, lang } = useStore();
  const gallery = [photo, ...photos].filter(Boolean).slice(0, 5);
  const netStr = currency === "EUR" ? `${(Number(price) || 0).toLocaleString("pl-PL")} €` : fmtZl(price);
  const grossStr = fmtMoney(gross(price), currency);
  const vatStr = fmtMoney(vatOf(price), currency);
  const vatPct = Math.round(VAT_RATE * 100);

  return (
    <div className="pcard-x" style={{ ["--pc"]: color }}>
      <div className="pcard-x__grid">
        {/* 1 · photo */}
        <div className="pcard-x__media">
          <div className="pcard-x__main">
            {gallery[0] ? <img src={gallery[0]} alt={title} /> : <span className="pcard-x__nophoto">{code}</span>}
            {code && <span className="pcard-x__code">{code}</span>}
          </div>
          {gallery.length > 1 && (
            <div className="pcard-x__thumbs">{gallery.slice(1).map((s, i) => <img key={i} src={s} alt="" loading="lazy" />)}</div>
          )}
        </div>

        {/* 2 · buy box */}
        <aside className="pcard-x__buy">
          <span className="pcard-x__eyebrow"><EText id="card.eyebrow" /></span>
          <h3 className="pcard-x__title">{title}</h3>
          {subtitle && <p className="pcard-x__sub">{subtitle}</p>}
          <ul className="pcard-x__lines">{lines.map((l, i) => <li key={i}><b>{l[0]}</b><span>{l[1]}</span></li>)}</ul>
          <div className="pcard-x__price">
            <span><EText id="card.priceLabel" /></span>
            <b>{grossStr}</b>
            <i>{t("card.gross")}</i>
            <em className="pcard-x__vat">{netStr} {t("card.net")} + VAT {vatPct}% ({vatStr}){currency === "EUR" && pricePln ? ` · ≈ ${fmtMoney(gross(pricePln))} ${t("card.pln")}` : ""}</em>
          </div>
          <button type="button" className="btn btn--red pcard-x__btn" onClick={onOrder}>{orderLabel || t("card.order")} <span className="btn__arrow">›</span></button>
          <div className="pcard-x__trust">
            <span>🔒 Tpay · BLIK · karta · przelew</span>
            <span>✓ {t("card.cert")}</span>
          </div>
        </aside>
      </div>

      {/* 3 · highlights */}
      {!!includes.length && (
        <div className="pcard-x__inc">
          <span className="pcard-x__eyebrow"><EText id="card.includes" /></span>
          <ul>{includes.map((x, i) => <li key={i}><i>✓</i>{x}</li>)}</ul>
        </div>
      )}

      {/* 4 · full description */}
      <div className="pcard-x__desc">
        <span className="pcard-x__eyebrow"><EText id="card.descTitle" /></span>
        {kind === "ice" ? (
          <>
            <EText id="card.iceLead" as="p" className="pcard-x__lead" multiline />
            <ul className="pcard-x__ul">{t("card.iceList").split("\n").filter(Boolean).map((l, i) => <li key={i}><i>❄</i>{l}</li>)}</ul>
            <EText id="card.iceNote" as="p" className="pcard-x__note" multiline />
          </>
        ) : (
          <>
            <EText id="card.lead" as="p" className="pcard-x__lead" multiline />
            <div className="pcard-x__parts">
              <article><span className="pcard-x__n">01</span><h4><EText id="card.theory" /></h4><EText id="card.theoryBody" as="p" multiline /></article>
              <article><span className="pcard-x__n">02</span><h4><EText id="card.practice" /></h4><EText id="card.practiceBody" as="p" multiline /></article>
            </div>
            <div className="pcard-x__parts pcard-x__parts--dark">
              <article><h4><EText id="card.cert" /></h4><EText id="card.certBody" as="p" multiline /><img src="/assets/mariusz/signature-black.webp" alt="" className="pcard-x__sig" /></article>
              <article><h4><EText id="card.instr" /></h4><EText id="card.instrBody" as="p" multiline /></article>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
