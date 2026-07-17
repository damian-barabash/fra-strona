import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Hero from "../sections/Hero";
import Banners from "../sections/Banners";
import Programs from "../sections/Programs";
import Fleet from "../sections/Fleet";
import Training from "../sections/Training";
import Instructors from "../sections/Instructors";
import Tracks from "../sections/Tracks";
import Events from "../sections/Events";
import CtaBuy from "../sections/CtaBuy";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";

export default function Home() {
  const { ready, cmsMode, isAdmin } = useStore();
  return (
    <div className={cmsMode && isAdmin ? "cms-on" : ""}>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <Banners />
        <Programs />
        <Fleet />
        <Training />
        <Instructors />
        <Tracks />
        <Events />
        <CtaBuy />
      </main>
      <Footer />
      <CmsBar />
      {!ready && <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 300, opacity: 0, pointerEvents: "none" }} />}
    </div>
  );
}
