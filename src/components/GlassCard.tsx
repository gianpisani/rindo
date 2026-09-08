import { ReactNode } from "react";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <Card
      className={cn(
        "border border-border bg-card",
        "transition-colors duration-200",
        // El hover ya no levanta la tarjeta: le sube el tono a la línea.
        // Es el único movimiento que Wero le permite a un borde.
        "hover:border-primary",
        className
      )}
    >
      {children}
    </Card>
  );
}
