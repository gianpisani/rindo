import { motion } from "framer-motion";
import type { MonthPace } from "@/lib/month-pace";
import { explainingDrivers } from "@/lib/pace-chart";
import { cn } from "@/lib/utils";
import { clp, clpCompact } from "@/lib/format";
import { MUTED, TONE } from "./tone";

export function PaceDrivers({ pace, colors, privacy }: { pace: MonthPace; colors: Map<string, string | null>; privacy: boolean }) {
  const rows = explainingDrivers(pace);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.delta)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Lo que explica la diferencia</p>
      {rows.map((r, i) => {
        const over = r.delta > 0;
        const w = (Math.abs(r.delta) / max) * 50;
        return (
          <div
            key={r.category}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-3"
            title={`Llevas ${clp(r.me)} · a esta altura sueles llevar ${clp(r.typical)}`}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(r.category) ?? MUTED }} />
              <span className="truncate">{r.category}</span>
            </span>
            <div className="relative h-2">
              <div className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
              <motion.div
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: over ? TONE.over : TONE.under,
                  [over ? "left" : "right"]: "50%",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className={cn("w-20 text-right text-sm font-medium tabular-nums", privacy && "privacy-blur")}>
              {over ? "+" : "−"}
              {clpCompact(Math.abs(r.delta))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
