import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useRef, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthClasses = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[500px]",
  lg: "sm:max-w-[600px]",
  xl: "sm:max-w-[700px]",
};

export function BaseModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "lg",
}: BaseModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      // Activate iOS WebKit scroll context so react-remove-scroll's
      // locationCouldBeScrolled check (scrollHeight > clientHeight) passes
      // after the dialog entry animation completes.
      el.scrollTop = 1;
      el.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClasses[maxWidth],
          "w-[92vw] max-h-[90vh] flex flex-col p-0 gap-0 rounded-card border-border dark:border-white/10"
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 rounded-t-card">
          <DialogTitle className="text-xl text-center font-medium">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-center text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 min-h-0 overscroll-contain"
          style={{ touchAction: "pan-y" }}
          // react-remove-scroll (el scroll-lock de Radix) escucha touchmove
          // en document y le hace preventDefault, matando el scroll táctil
          // en iOS aunque este contenedor sí pueda scrollear. Cortar la
          // propagación evita que el gesto llegue a ese listener; el fondo
          // sigue bloqueado (eso lo hace CSS en el body). overscroll-contain
          // evita el encadenamiento del rebote hacia la página.
          onTouchMove={(e) => e.stopPropagation()}
        >
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
