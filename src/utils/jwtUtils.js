import { jwtDecode } from "jwt-decode";

export const isTokenExpired = (token) => {
  if (!token) {
    return true; // No token provided, consider it expired
  }
  try {
    const decodedToken = jwtDecode(token);
    const currentTime = Date.now() / 1000; // Current time in seconds

    // Check if the expiration time (exp) in the token is less than the current time
    return decodedToken.exp < currentTime;
  } catch (error) {
    console.error("Error decoding token:", error);
    return true; // Treat decoding errors as expired tokens
  }
};
