import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Transaction } from "@/hooks/useTransactions";
import type { Category } from "@/hooks/useCategories";
import type { RealFlowsConfig } from "@/lib/real-flows";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useMonthPulse } from "@/hooks/useMonthPulse";
import { PulseNav } from "./pulse/PulseNav";
import { PaceHeadline } from "./pulse/PaceHeadline";
import { PaceRace } from "./pulse/PaceRace";
import { PaceLegend } from "./pulse/PaceLegend";
import { PulseTotals } from "./pulse/PulseTotals";
import { PaceDrivers } from "./pulse/PaceDrivers";

export { PaceText } from "./pulse/PaceText";
export { PaceSpark } from "./pulse/PaceSpark";

interface MonthPulseProps {
  open: boolean;
  onClose: () => void;
  initialMonth: Date;
  transactions: Transaction[];
  categories: Category[];
  flowConfig?: Partial<RealFlowsConfig>;
}

export function MonthPulse({ open, onClose, initialMonth, transactions, categories, flowConfig }: MonthPulseProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const pulse = useMonthPulse({ open, onClose, initialMonth, transactions, flowConfig });
  const { month, pace, verdict } = pulse;
  const colors = useMemo(() => new Map(categories.map((c) => [c.name, c.color])), [categories]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-8 lg:max-w-6xl lg:px-12 lg:pb-12">
            <PulseNav
              month={month}
              startDay={pulse.startDay}
              period={pulse.period}
              pace={pace}
              canBack={pulse.canBack}
              canForward={pulse.canForward}
              onStep={pulse.step}
              onClose={onClose}
            />

            <motion.div
              key={month.toISOString()}
              className="flex flex-col gap-8 lg:my-auto lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-x-12 lg:gap-y-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="lg:col-start-1 lg:row-start-1">
                <PaceHeadline pace={pace} verdict={verdict} privacy={isPrivacyMode} />
              </div>

              <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:rounded-card lg:bg-card lg:p-6">
                <PaceRace pace={pace} verdict={verdict} privacy={isPrivacyMode} />
                {pace.typical && <PaceLegend verdict={verdict} />}
              </div>

              {pace.typical && (
                <PulseTotals pace={pace} income={pulse.income} leftover={pulse.leftover} privacy={isPrivacyMode} />
              )}

              <div className="lg:col-start-1 lg:row-start-3">
                <PaceDrivers pace={pace} colors={colors} privacy={isPrivacyMode} />
              </div>

              {pace.typical && (
                <p className="text-xs text-muted-foreground lg:col-start-1 lg:row-start-4">
                  Tu mes típico es la mediana de tus últimos {pace.typicalMonths}{" "}
                  {pace.typicalMonths === 1 ? "mes" : "meses"} al mismo día. Gasto neto de reembolsos, sin
                  plata en tránsito.
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
