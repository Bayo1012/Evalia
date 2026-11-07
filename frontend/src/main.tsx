import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/sora";
import "@fontsource-variable/manrope";
import "./index.css";
import App from "./App";
import { registrarAdaptadorAudio } from "./integrations/audio";
import { grabadorAudio } from "./integrations/grabador";
registrarAdaptadorAudio(grabadorAudio);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
