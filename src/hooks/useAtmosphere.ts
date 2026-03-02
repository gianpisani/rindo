import { useEffect, useRef, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { subDays } from "date-fns";

export interface AtmosphereData {
  mood: number; // 0-1
  label: string;
  description: string;
}

function getMoodInfo(mood: number): { label: string; description: string } {
  if (mood >= 0.7) return { label: "Excelente", description: "Tus ingresos superan ampliamente tus gastos." };
  if (mood >= 0.55) return { label: "Positivo", description: "Buen balance entre ingresos y gastos." };
  if (mood >= 0.45) return { label: "Neutro", description: "Ingresos y gastos están parejos." };
  if (mood >= 0.3) return { label: "Ajustado", description: "Los gastos están acercándose a tus ingresos." };
  return { label: "Negativo", description: "Los gastos superan tus ingresos." };
}

/**
 * Atmospheric UI - Subliminal mood system
 *
 * Uses normalized daily rates to avoid salary-cycle distortion:
 * - dailyIncome = total income over 90 days / 90 (smooth baseline)
 * - dailyExpense = total expenses over 30 days / 30 (recent behavior)
 * - mood = dailyIncome / (dailyIncome + dailyExpense)
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
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);

    // Income over 90 days → normalized to daily rate (smooths salary timing)
    const income90 = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === "Ingreso" && d >= ninetyDaysAgo && d <= now;
      })
      .reduce((s, t) => s + Number(t.amount), 0);
    const dailyIncome = income90 / 90;

    // Expenses over 30 days → normalized to daily rate (recent behavior)
    const expenses30 = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === "Gasto" && d >= thirtyDaysAgo && d <= now;
      })
      .reduce((s, t) => s + Number(t.amount), 0);
    const dailyExpense = expenses30 / 30;

    // Mood: ratio of earning capacity vs spending rate
    let mood = 0.5;
    const total = dailyIncome + dailyExpense;
    if (total > 0) {
      mood = dailyIncome / total;
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
