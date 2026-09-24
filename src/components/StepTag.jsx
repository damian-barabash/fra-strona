import { useStore } from "../lib/store";

/* Red "KROK n z N · TYTUŁ" tag at the top of every configurator step — the customer always
   knows where they are and what to do next. */
export default function StepTag({ n, of, title }) {
  const { lang } = useStore();
  return (
    <div className="stept" key={`${n}-${title}`}>
      <span className="stept__n">{n}</span>
      <span className="stept__t"><small>{lang === "en" ? `Step ${n} of ${of}` : `Krok ${n} z ${of}`}</small><b>{title}</b></span>
    </div>
  );
}
