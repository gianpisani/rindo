import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingActionButton({ onClick, className }: FloatingActionButtonProps) {
  return (
    <div
      className={cn(
        "fixed right-5 z-40",
        "md:hidden", // Solo en mobile
        className
      )}
      style={{ 
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <Button
        onClick={onClick}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full",
          "bg-primary",
          "hover:bg-primary/90",
          // Apoyado, no flotando: la sombra dura de Wero, del color de la
          // línea, y el botón se hunde al apretarlo en vez de encogerse.
          "shadow-hard press",
          "transition-all duration-200",
          "border border-border"
        )}
      >
        <Plus className="h-6 w-6 text-primary-foreground drop-shadow-lg" strokeWidth={2.5} />
      </Button>
    </div>
  );
}

