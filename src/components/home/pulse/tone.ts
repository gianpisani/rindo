import type { PaceVerdict } from "@/lib/month-pace";

export const TONE: Record<PaceVerdict, string> = {
  under: "oklch(var(--success))",
  over: "oklch(var(--destructive))",
  even: "var(--foreground)",
};

export const MUTED = "var(--muted-foreground)";
