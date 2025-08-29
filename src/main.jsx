import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import App from "./App.jsx";
import Connect from "./components/Connect";
import Remote from "./components/Remote";

createRoot(document.getElementById("root")).render(
  // <StrictMode
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route path="connect" element={<Connect />} />
        <Route path="remote" element={<Remote />} />
      </Route>
    </Routes>
  </BrowserRouter>
  /* </StrictMode> */
);
