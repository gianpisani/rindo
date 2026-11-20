import { forwardRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhisperOptionsProps {
  open: boolean;
  className?: string;
  children: ReactNode;
}

export function WhisperOptions({ open, className, children }: WhisperOptionsProps) {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={cn("whisper-options", className)}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface WhisperOptionsToggleProps {
  expanded: boolean;
  onToggle: () => void;
  moreLabel?: string;
  lessLabel?: string;
}

export const WhisperOptionsToggle = forwardRef<HTMLButtonElement, WhisperOptionsToggleProps>(
  ({ expanded, onToggle, moreLabel = "Más opciones", lessLabel = "Menos opciones" }, ref) => (
    <button ref={ref} type="button" className="whisper-options-toggle" aria-expanded={expanded} onClick={onToggle}>
      {expanded ? lessLabel : moreLabel}
      <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
    </button>
  ),
);
WhisperOptionsToggle.displayName = "WhisperOptionsToggle";
