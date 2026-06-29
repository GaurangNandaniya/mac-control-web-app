import "./App.css";
import { Outlet, useLocation, useNavigate } from "react-router";
import AppContext from "./context";
import { useEffect, useState } from "react";
import { isTokenExpired } from "./utils/jwtUtils";

function App() {
  const [appContext, setAppContext] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;

    const existingToken = localStorage.getItem("authToken");

    if (
      existingToken &&
      !isTokenExpired(existingToken) &&
      !currentPath.includes("/remote")
    ) {
      navigate("remote");
      return;
    }

    if (
      (isTokenExpired(existingToken) || !existingToken) &&
      currentPath.includes("connect")
    ) {
      const urlParams = new URLSearchParams(window.location.search);
      // From a deep-link QR these are present; when launched standalone from
      // the home screen they're absent — the Connect screen then offers the
      // in-app QR scanner to pair in this (isolated) storage context.
      const tempToken = urlParams.get("token");
      const serviceUrl = urlParams.get("serviceUrl");
      setAppContext({ token: tempToken, serviceUrl });
      return;
    }

    if (isTokenExpired(existingToken) || !existingToken || currentPath == "/") {
      navigate("connect");
      return;
    }
  }, [location]);

  return (
    <AppContext.Provider value={appContext}>
      <Outlet />
    </AppContext.Provider>
  );
}

export default App;
