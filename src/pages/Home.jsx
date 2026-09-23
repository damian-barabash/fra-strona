import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Hero from "../sections/Hero";
import Banners from "../sections/Banners";
import Programs from "../sections/Programs";
import Fleet from "../sections/Fleet";
import Training from "../sections/Training";
import Founder from "../sections/Founder";
import Instructors from "../sections/Instructors";
import Tracks from "../sections/Tracks";
import Events from "../sections/Events";
import CtaBuy from "../sections/CtaBuy";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

export default function Home() {
  const { ready, cmsMode, isAdmin } = useStore();
  useSeo({
    path: "/",
    description: "Szkoła jazdy sportowej i wyścigowej dziewięciokrotnego mistrza Polski Mariusza Miękosia. Szkolenia 1:1 na torach Łódź, Poznań i Modlin, Ice Driving w Laponii, wyprawy, vouchery i eventy firmowe.",
  });
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
        <Founder />
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
