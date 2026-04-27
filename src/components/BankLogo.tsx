import { cn } from "@/lib/utils";
import type { Bank } from "@/lib/banks";

interface BankLogoProps {
  bank: Bank;
  size?: "sm" | "md";
}

export function BankLogo({ bank, size = "sm" }: BankLogoProps) {
  const px = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  return (
    <img
      src={`/banks/${bank.value}.png`}
      alt={bank.label}
      className={cn(px, "rounded-lg object-contain shrink-0")}
    />
  );
}
