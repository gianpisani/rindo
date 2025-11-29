import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  amount: number;
  color: string;
  bg: string;
}

export function BalanceCard({ amount, color, bg }: BalanceCardProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className={cn("text-2xl font-semibold tracking-tight", color)}>
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

