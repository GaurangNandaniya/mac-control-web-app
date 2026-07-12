import { useState, useCallback } from "react";

// Light/dark theme, driven by a `data-theme` attribute on <html>. The initial
// value is set pre-paint by an inline script in index.html (stored choice, else
// the OS preference), so this hook just mirrors + flips it. Plain SPA (no SSR),
// so reading the DOM/localStorage for the initial state is safe.
const KEY = "theme";
const THEME_COLOR = { dark: "#1b120c", light: "#f3ece1" };

const current = () =>
  document.documentElement.dataset.theme ||
  localStorage.getItem(KEY) ||
  (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export default function useTheme() {
  const [theme, setTheme] = useState(current);

  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", THEME_COLOR[next]);
      return next;
    });
  }, []);

  return { theme, toggle };
}
