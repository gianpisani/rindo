import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';
import { ThemeProvider } from "next-themes";
import { applyThemePreview, applyFontPreview, applyRadiusPreview, getCachedThemeId, getCachedCustomSettings } from "./hooks/useCustomTheme";

injectSpeedInsights();
inject();

// Apply cached theme instantly to avoid flash of default colors
const cachedTheme = getCachedThemeId();
const cachedSettings = getCachedCustomSettings();
{
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const storedTheme = localStorage.getItem("theme");
  const mode = storedTheme === "light" ? "light" : storedTheme === "dark" ? "dark" : prefersDark ? "dark" : "light";
  // Apply dark/light class immediately so loading screen uses correct colors
  document.documentElement.classList.toggle("dark", mode === "dark");
  if (cachedTheme) {
    applyThemePreview(cachedTheme, mode, cachedSettings);
  }
  if (cachedSettings?.font) applyFontPreview(cachedSettings.font);
  if (cachedSettings?.radius != null) applyRadiusPreview(cachedSettings.radius);
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
