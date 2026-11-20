import type { ThemeMode } from "./theme.ts";

export interface RevealOrigin {
  x: number;
  y: number;
}

const REVEAL_MS = 620;
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function revealOriginOf(element: Element): RevealOrigin {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function resolveColorMode(mode: ThemeMode | "system"): ThemeMode {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function revealTheme(update: () => void, origin?: RevealOrigin) {
  if (!origin || typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return;
  }

  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(update);

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch((error: unknown) => console.debug("Transición de tema omitida", error));
}
