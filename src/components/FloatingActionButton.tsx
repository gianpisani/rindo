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
        "fixed bottom-6 right-6 z-40",
        "md:hidden", // Solo en mobile
        className
      )}
    >
      <Button
        onClick={onClick}
        size="lg"
        className={cn(
          "h-12 w-12 rounded-full",
          "bg-primary hover:bg-primary/90",
          "shadow-lg hover:shadow-md",
          "transition-all duration-200"
        )}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}

