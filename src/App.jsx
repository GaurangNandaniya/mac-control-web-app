import "./App.css";
import { Outlet, useLocation, useNavigate } from "react-router";
import AppContext from "./context";
import { useEffect, useState } from "react";
import { isTokenExpired } from "./utils/jwtUtils";

function App() {
  const [appContext, setAppContext] = useState({});
  const [showError, setShowError] = useState(false);
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
      const tempToken = urlParams.get("token");
      const serviceUrl = urlParams.get("serviceUrl");

      if (!tempToken || !serviceUrl) {
        setShowError(true);
      }

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
      {showError ? <div>Error: Missing token or service URL</div> : <Outlet />}
      <button
        className="control-button clean-token-button"
        onClick={() => {
          localStorage.removeItem("authToken");
          localStorage.removeItem("serviceUrl");
        }}
      >
        Clean token
      </button>
    </AppContext.Provider>
  );
}

export default App;
