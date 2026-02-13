import { useEffect, useRef, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { startOfMonth, endOfMonth } from "date-fns";

export interface AtmosphereData {
  mood: number; // 0-1
  label: string;
  description: string;
}

function getMoodInfo(mood: number): { label: string; description: string } {
  if (mood >= 0.7) return { label: "Excelente", description: "Tus ingresos superan ampliamente tus gastos este mes." };
  if (mood >= 0.55) return { label: "Positivo", description: "Buen balance entre ingresos y gastos este mes." };
  if (mood >= 0.45) return { label: "Neutro", description: "Ingresos y gastos están parejos este mes." };
  if (mood >= 0.3) return { label: "Ajustado", description: "Los gastos están acercándose a tus ingresos." };
  return { label: "Negativo", description: "Los gastos superan tus ingresos este mes." };
}

/**
 * Atmospheric UI - Subliminal mood system
 *
 * Shifts the app's visual atmosphere based on financial health.
 * The glow color and intensity change based on your income/expense ratio.
 */
export function useAtmosphere(): AtmosphereData {
  const { transactions } = useTransactions();
  const prevMoodRef = useRef(0.5);
  const rafRef = useRef<number>();
  const [atmosphereData, setAtmosphereData] = useState<AtmosphereData>({
    mood: 0.5,
    label: "Neutro",
    description: "Sin datos suficientes.",
  });

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
      mood = Math.max(0.15, Math.min(0.85, mood));
    }

    // Smooth interpolation
    const smoothMood = prevMoodRef.current * 0.3 + mood * 0.7;
    prevMoodRef.current = smoothMood;

    const info = getMoodInfo(smoothMood);
    setAtmosphereData({ mood: smoothMood, ...info });

    // Apply CSS variables via requestAnimationFrame
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const root = document.documentElement;
      const hueShift = (smoothMood - 0.5) * 6;
      root.style.setProperty("--atmosphere-hue", hueShift.toFixed(3));
      const saturation = 0.97 + smoothMood * 0.06;
      root.style.setProperty("--atmosphere-saturation", saturation.toFixed(3));
      root.style.setProperty("--atmosphere-warmth", smoothMood.toFixed(3));
      root.style.setProperty("--atmosphere-softness", smoothMood.toFixed(3));
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [transactions]);

  return atmosphereData;
}
