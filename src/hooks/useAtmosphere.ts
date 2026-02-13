import { useEffect, useRef } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { startOfMonth, endOfMonth } from "date-fns";

/**
 * Atmospheric UI - Subliminal mood system
 *
 * Shifts the app's visual atmosphere based on financial health.
 * Changes are 2-5% — nobody should consciously notice them,
 * but the app "feels" different when you're doing well vs tight.
 */
export function useAtmosphere() {
  const { transactions } = useTransactions();
  const prevMoodRef = useRef(0.5);
  const rafRef = useRef<number>();

  useEffect(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const currentMonth = transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    const income = currentMonth
      .filter((t) => t.type === "Ingreso")
      .reduce((s, t) => s + Number(t.amount), 0);

    const expenses = currentMonth
      .filter((t) => t.type === "Gasto")
      .reduce((s, t) => s + Number(t.amount), 0);

    // Calculate mood: 0 = very bad, 0.5 = neutral, 1 = very good
    let mood = 0.5;
    const total = income + expenses;
    if (total > 0) {
      mood = income / total;
      // Clamp between 0.15 and 0.85 to keep changes subtle
      mood = Math.max(0.15, Math.min(0.85, mood));
    }

    // Smooth interpolation with previous value (prevents jarring jumps)
    const smoothMood = prevMoodRef.current * 0.3 + mood * 0.7;
    prevMoodRef.current = smoothMood;

    // Apply via requestAnimationFrame for smooth rendering
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const root = document.documentElement;

      // Hue shift: -3 (cold/blue) to +3 (warm/amber) — VERY subtle
      const hueShift = (smoothMood - 0.5) * 6;
      root.style.setProperty("--atmosphere-hue", hueShift.toFixed(3));

      // Saturation multiplier: 0.97 to 1.03 — barely noticeable
      const saturation = 0.97 + smoothMood * 0.06;
      root.style.setProperty("--atmosphere-saturation", saturation.toFixed(3));

      // Warmth: 0 to 1 — drives glow opacity
      root.style.setProperty("--atmosphere-warmth", smoothMood.toFixed(3));

      // Softness: affects shadow spread subtly
      root.style.setProperty("--atmosphere-softness", smoothMood.toFixed(3));
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [transactions]);
}
