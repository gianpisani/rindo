import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ReactNode, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "income" | "expense" | "investment";
}

const maxWidthClasses = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[500px]",
  lg: "sm:max-w-[600px]",
  xl: "sm:max-w-[700px]",
};

const variantStyles = {
  default: {
    border: "border-white/10",
    header: "",
    accent: "",
  },
  income: {
    border: "border-success/30",
    header: "bg-success/5",
    accent: "text-success",
  },
  expense: {
    border: "border-destructive/30",
    header: "bg-destructive/5",
    accent: "text-destructive",
  },
  investment: {
    border: "border-blue-500/30",
    header: "bg-blue-500/5",
    accent: "text-blue-500",
  },
};

export function BaseModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "lg",
  variant = "default"
}: BaseModalProps) {
  const styles = variantStyles[variant];
  const scrollRef = useRef<HTMLDivElement>(null);

  // iOS PWA: the dialog open animation (200ms) prevents iOS from recognizing the
  // scroll container on first render. Activate it programmatically after animation.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.scrollTop = 1;
      el.scrollTop = 0;
    }, 250);
    return () => clearTimeout(timer);
  }, [open]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          maxWidthClasses[maxWidth],
          "w-[92vw] max-h-[90vh] flex flex-col p-0 gap-0 rounded-2xl",
          styles.border
        )}
      >
        <DialogHeader className={cn(
          "px-6 pt-6 pb-4 flex-shrink-0 rounded-t-2xl",
          styles.header
        )}>
          <DialogTitle className={cn(
            "text-2xl text-center font-bold",
            styles.accent
          )}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-center text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 min-h-0">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-border/50">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
