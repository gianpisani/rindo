import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CategorySpending } from "@/hooks/useCategoryInsights";
import { CategoryDetailContent } from "./CategoryDetailContent";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CategoryDetailExpandedProps {
  category: CategorySpending;
  monthName: string;
  onClose: () => void;
  /** When true, skip layoutId morph and just fade in (e.g. opened from insights modal) */
  disableMorph?: boolean;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(value);
};

export function CategoryDetailExpanded({
  category,
  monthName,
  onClose,
  disableMorph = false,
}: CategoryDetailExpandedProps) {
  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const getTrendIcon = () => {
    switch (category.trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-destructive" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-success" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const layoutId = disableMorph ? undefined : `cat-card-${category.category}`;
  const nameLayoutId = disableMorph ? undefined : `cat-name-${category.category}`;
  const amountLayoutId = disableMorph ? undefined : `cat-amount-${category.category}`;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      />

      {/* Container - the morph target */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          layoutId={layoutId}
          className="bg-card border rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden"
          transition={springTransition}
          style={{ borderRadius: 16 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${category.category}`}
          {...(disableMorph
            ? {
                initial: { opacity: 0, scale: 0.95 },
                animate: { opacity: 1, scale: 1 },
                exit: { opacity: 0, scale: 0.95 },
              }
            : {})}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <motion.h2
                layoutId={nameLayoutId}
                className="text-2xl font-bold"
                transition={springTransition}
              >
                {category.category}
              </motion.h2>
              <div className="flex items-center gap-2 mt-1">
                <motion.span
                  layoutId={amountLayoutId}
                  className="text-lg font-bold font-mono tabular-nums text-muted-foreground"
                  transition={springTransition}
                >
                  {formatCurrencyFull(category.amount)}
                </motion.span>
                {category.count > 0 && (
                  <>
                    {getTrendIcon()}
                    {category.trend !== "stable" && (
                      <Badge variant="outline" className="text-xs font-mono tabular-nums">
                        {category.trend === "up" ? "+" : "-"}
                        {category.trendPercentage.toFixed(0)}%
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 capitalize">{monthName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content with fade-in delay */}
          <motion.div
            className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.2 }}
          >
            <CategoryDetailContent category={category} monthName={monthName} />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
