import "./App.css";
import { Outlet, useNavigate } from "react-router";
import AppContext from "./context";
import { useEffect, useState } from "react";
import { isTokenExpired } from "./utils/jwtUtils";

function App() {
  const [appContext, setAppContext] = useState({});
  const [showError, setShowError] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const currentPath = window.location.pathname;

    const existingToken = localStorage.getItem("authToken");

    if (
      (isTokenExpired(existingToken) || !existingToken) &&
      currentPath.includes("remote")
    ) {
      // Redirect to login or show an error
      navigate("connect");
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
    }
  }, []);

  return (
    <AppContext.Provider value={appContext}>
      {showError ? (
        <div>Error: Missing token or service URL</div>
      ) : (
        <div>
          <Outlet />
        </div>
      )}
    </AppContext.Provider>
  );
}

export default App;
