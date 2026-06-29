// Tiny tap feedback. No-op on iOS (WebKit doesn't implement the Vibration
// API); a light buzz on Android and other supporting browsers.
export const haptic = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported — ignore */
  }
};
