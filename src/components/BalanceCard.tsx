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
    <div className="h-full flex flex-col items-center justify-center">
      <div className={cn("text-base font-semibold tracking-tight", color, isPrivacyMode && "privacy-blur")}>
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

