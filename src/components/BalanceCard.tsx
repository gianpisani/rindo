import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

interface BalanceCardProps {
  amount: number;
  color: string;
  bg: string;
}

export function BalanceCard({ amount, color, bg }: BalanceCardProps) {
  const { isPrivacyMode } = usePrivacyMode();

  return (
    <div className={cn("h-full flex flex-col items-center justify-center rounded-lg p-2", bg)}>
      <div className={cn("text-lg font-bold tracking-tight font-mono tabular-nums", color, isPrivacyMode && "privacy-blur")}>
        $<NumberFlow
          value={amount}
          format={{
            style: "decimal",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }}
          locales="es-CL"
        />
      </div>
    </div>
  );
}
