import NumberFlow from "@number-flow/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { PeriodConfig } from "@/hooks/usePeriodConfig";
import type { MonthPace } from "@/lib/month-pace";
import type { RealFlows } from "@/lib/real-flows";
import { cn } from "@/lib/utils";
import { PaceSpark } from "./pulse/PaceSpark";
import { PaceText } from "./pulse/PaceText";

const CLP_FORMAT = { style: "currency", currency: "CLP", maximumFractionDigits: 0 } as const;

interface MoneyCardProps {
  period: PeriodConfig;
  thisPeriod: Date;
  monthExpenses: number;
  pace: MonthPace;
  hasPace: boolean;
  flows: RealFlows;
  onOpenPace: () => void;
}

export function MoneyCard({ period, thisPeriod, monthExpenses, pace, hasPace, flows, onOpenPace }: MoneyCardProps) {
  const { openPeriodSettings } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();

  return (
    <section className="inicio-card inicio-money">
      <div className="inicio-money-top">
        <span className="inicio-title">Gastado</span>
        <button className="inicio-month" onClick={() => openPeriodSettings()} title="Configurar mes financiero">
          {period.isCalendar ? format(new Date(), "MMMM yyyy", { locale: es }) : period.rangeLabel(thisPeriod)}
        </button>
      </div>
      <span className={cn("inicio-big", isPrivacyMode && "privacy-blur")}>
        <NumberFlow value={monthExpenses} format={CLP_FORMAT} locales="es-CL" />
      </span>
      {hasPace && (
        <button className="inicio-pace" onClick={onOpenPace}>
          <span className="inicio-pace-text">
            <PaceText pace={pace} className={cn(isPrivacyMode && "privacy-blur")} />
            <small>Tu mes<ChevronRight aria-hidden /></small>
          </span>
          <PaceSpark pace={pace} className="inicio-spark" />
        </button>
      )}
      <div className={cn("inicio-flows", isPrivacyMode && "privacy-blur")}>
        <span className="inicio-flow text-success">
          <NumberFlow className="font-mono" value={flows.ingresoReal} prefix="+" format={CLP_FORMAT} locales="es-CL" />
          <small>entró</small>
        </span>
        {flows.invertido > 0 && (
          <span className="inicio-flow" style={{ color: "var(--inicio-blue)" }}>
            <NumberFlow className="font-mono" value={flows.invertido} format={CLP_FORMAT} locales="es-CL" />
            <small>invertido</small>
          </span>
        )}
      </div>
    </section>
  );
}
