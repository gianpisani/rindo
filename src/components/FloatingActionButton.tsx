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
          "bg-gradient-to-br from-blue to-blue-600",
          "hover:from-blue-600 hover:to-blue-700",
          "shadow-[0_8px_30px_rgb(59,130,246,0.5)]",
          "hover:shadow-[0_12px_40px_rgb(59,130,246,0.6)]",
          "transition-all duration-300",
          "active:scale-95",
          "border-2 border-white/10"
        )}
      >
        <Plus className="h-6 w-6 text-primary-foreground drop-shadow-lg" strokeWidth={2.5} />
      </Button>
    </div>
  );
}

