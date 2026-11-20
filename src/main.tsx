import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';
import { ThemeProvider } from "next-themes";
import { applyTheme, getCachedCustomSettings, getCachedThemeId } from "./lib/theme";
import { readStorage } from "./lib/storage";

injectSpeedInsights();
inject();

const storedMode = readStorage("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialMode = storedMode === "light" || storedMode === "dark" ? storedMode : prefersDark ? "dark" : "light";
document.documentElement.classList.toggle("dark", initialMode === "dark");
applyTheme(getCachedThemeId(), getCachedCustomSettings() ?? {}, initialMode);

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => console.error("No se pudo registrar el service worker", error));
  });
}
