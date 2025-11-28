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
        "border border-border bg-card shadow-card",
        "transition-all duration-200",
        "hover:shadow-md",
        className
      )}
    >
      {children}
    </Card>
  );
}

