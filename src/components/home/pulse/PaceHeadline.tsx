import NumberFlow from "@number-flow/react";
import type { MonthPace, PaceVerdict } from "@/lib/month-pace";
import { pacePhrase } from "@/lib/pace-chart";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import { TONE } from "./tone";

export function PaceHeadline({ pace, verdict, privacy }: { pace: MonthPace; verdict: PaceVerdict; privacy: boolean }) {
  const tone = TONE[verdict];
  if (!pace.typical) {
    return (
      <div>
        <p className="text-hero font-semibold tracking-tight tabular-nums">
          <span className={cn(privacy && "privacy-blur")}>{clp(pace.spentSoFar)}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          gastados. Cuando cierres tu primer mes, acá vas a correr contra él.
        </p>
      </div>
    );
  }
  const phrase = pacePhrase(pace.isLive, verdict);

  return (
    <div>
      {verdict === "even" ? (
        <p className="text-hero font-medium tracking-tight">Justo {phrase}</p>
      ) : (
        <p className="text-hero font-medium tracking-tight">
          <span className={cn("font-semibold tabular-nums", privacy && "privacy-blur")} style={{ color: tone }}>
            $<NumberFlow value={Math.round(Math.abs(pace.delta))} locales="es-CL" format={{ maximumFractionDigits: 0 }} />
          </span>
          <span className="block text-xl font-medium text-muted-foreground lg:mt-1">{phrase}</span>
        </p>
      )}
      <p className={cn("mt-3 text-sm text-muted-foreground", privacy && "privacy-blur")}>
        {pace.isLive ? (
          <>
            Llevas <b className="text-foreground">{clp(pace.spentSoFar)}</b>. Al día {pace.asOfDay} sueles llevar{" "}
            {clp(pace.typicalSoFar)}.
          </>
        ) : (
          <>
            Gastaste <b className="text-foreground">{clp(pace.spentSoFar)}</b>. Tu mes típico cierra en{" "}
            {clp(pace.typicalTotal)}.
          </>
        )}
      </p>
    </div>
  );
}
