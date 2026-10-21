import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/dancing-script/600.css";
import "@fontsource/dancing-script/700.css";
import "./index.css";
import "./sections/sections.css";
import "./sections/mariusz.css";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { LightboxProvider } from "./components/Lightbox";
import { preloadRoute, prefetchAllWhenIdle } from "./lib/routes";
import { autoPauseVideos } from "./lib/video";
import { LazyMotion, domAnimation } from "./lib/motion";
import { waitSiteData } from "./lib/siteData";

// load the current page's chunk and the site data first (the prerendered snapshot stays on screen
// meanwhile), then boot — the first render then matches the snapshot. Slow data: boot anyway after 2.5 s.
Promise.all([preloadRoute(window.location.pathname), waitSiteData(2500)]).then(() => ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <LazyMotion features={domAnimation} strict>
          <LightboxProvider>
            <App />
          </LightboxProvider>
        </LazyMotion>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
));
prefetchAllWhenIdle();
autoPauseVideos();
