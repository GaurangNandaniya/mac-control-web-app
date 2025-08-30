import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import AppContext from "../../context";
import axios from "axios";

const Connect = () => {
  const appContext = useContext(AppContext);
  const [showLoading, setShowLoading] = useState(false);
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
          device_name: "My Mac",
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
    } finally {
      setShowLoading(false);
    }
  };
  return (
    <div className="connect-container">
      {showLoading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <button className="connect-button" onClick={onConnect}>
          Connect to the Mac
        </button>
      )}
    </div>
  );
};

export default Connect;
