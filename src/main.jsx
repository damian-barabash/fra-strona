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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <LightboxProvider>
          <App />
        </LightboxProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
