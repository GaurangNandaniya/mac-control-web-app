import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import AppContext from "../../context";
import axios from "axios";

const Connect = () => {
  const appContext = useContext(AppContext);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState("My Mac");
  const navigate = useNavigate();

  const onConnect = async () => {
    const { token, serviceUrl } = appContext;
    if (!serviceUrl) {
      return;
    }
    try {
      setShowLoading(true);
      const response = await axios.post(
        `${serviceUrl}/auth/connect`,
        // `http://172.20.10.4:8080/auth/connect`,
        {
          device_name: deviceName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      //set the local storage
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("serviceUrl", serviceUrl);
      navigate("/remote");
    } catch (e) {
      console.log(e);
      setError(JSON.stringify(e?.response?.data || e.message));
    } finally {
      setShowLoading(false);
    }
  };
  return (
    <div className="connect-container">
      {showLoading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <>
          <input
            className="device-name-input"
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <button className="connect-button" onClick={onConnect}>
            Connect to the Mac
          </button>
        </>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default Connect;
