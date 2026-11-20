import type { MonthPace } from "@/lib/month-pace";
import { leftoverLabel } from "@/lib/pace-chart";
import { cn } from "@/lib/utils";
import { clpCompact } from "@/lib/format";
import { TONE } from "./tone";

interface PulseTotalsProps {
  pace: MonthPace;
  income: { amount: number; estimated: boolean };
  leftover: number;
  privacy: boolean;
}

export function PulseTotals({ pace, income, leftover, privacy }: PulseTotalsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:col-start-1 lg:row-start-2">
      <div className="rounded-card bg-muted p-4">
        <p className="text-xs text-muted-foreground">
          {pace.isLive ? "Cierras en" : "Gastaste"}
        </p>
        <p className={cn("mt-1 text-xl font-medium tabular-nums", privacy && "privacy-blur")}>
          {pace.isLive ? "~" : ""}
          {clpCompact(pace.projectedTotal)}
        </p>
        <p className={cn("text-xs text-muted-foreground", privacy && "privacy-blur")}>
          típico {clpCompact(pace.typicalTotal)}
        </p>
      </div>
      {income.amount > 0 && (
        <div className="rounded-card bg-muted p-4">
          <p className="text-xs text-muted-foreground">
            {leftoverLabel(leftover, pace.isLive)}
          </p>
          <p
            className={cn("mt-1 text-xl font-medium tabular-nums", privacy && "privacy-blur")}
            style={{ color: leftover >= 0 ? TONE.under : TONE.over }}
          >
            {pace.isLive ? "~" : ""}
            {clpCompact(Math.abs(leftover))}
          </p>
          <p className={cn("text-xs text-muted-foreground", privacy && "privacy-blur")}>
            de {clpCompact(income.amount)} {income.estimated ? "que suelen entrar" : "que entraron"}
          </p>
        </div>
      )}
    </div>
  );
}
