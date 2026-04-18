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
        "border border-border/50 bg-card",
        "transition-all duration-200",
        "hover:border-primary/20 hover:shadow-sm",
        className
      )}
    >
      {children}
    </Card>
  );
}
