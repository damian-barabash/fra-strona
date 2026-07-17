import { useStore } from "../lib/store";
import { EText, EMedia } from "../components/Editable";
import { useReveal, useCountUp } from "../lib/hooks";
import SpeedFx from "./SpeedFx";

export default function Training() {
  const { t, media } = useStore();
  const [ref, inView] = useReveal();
  const count = useCountUp(t("training.counterValue"), inView);

  return (
    <>
      <section className="section section--dark training" ref={ref}>
        <SpeedFx count={6} />
        <div className="container">
          <div className="training__grid">
            <div className="training__text">
              <EText id="training.eyebrow" as="span" className="eyebrow" />
              <EText id="training.title" as="h2" className="h-section" />
              <EText id="training.body" as="p" className="training__body" multiline />
              <a href="#" className="btn btn--red"><EText id="training.cta" /> <span className="btn__arrow">›</span></a>
              <div className="training__counter">
                <b>{count.toLocaleString("pl-PL")}</b>
                <EText id="training.counterLabel" as="span" />
              </div>
            </div>
            <div className="training__photo">
              <EMedia id="training.sideImage" kind="image"
                wrapperStyle={{ position: "absolute", inset: 0 }}
                imgProps={{ style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }} />
            </div>
          </div>
        </div>
      </section>
      <div className="training__band" style={{ backgroundImage: `url(${media("training.bandImage")})` }} />
    </>
  );
}
