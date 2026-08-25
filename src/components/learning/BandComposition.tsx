import { cn } from "@/lib/utils";
import { BANDS, type BandKey } from "@/lib/corpus";

interface BandCompositionProps {
  /** Palabras dichas en cada banda de frecuencia. */
  bandTokens: Record<BandKey, number>;
  /** Muestra el nombre de cada banda debajo. */
  legend?: boolean;
  /** Alto de la barra. */
  size?: "sm" | "md";
  className?: string;
}

/** Bajo este porcentaje el segmento no lleva número escrito adentro. */
const LABEL_THRESHOLD = 0.09;

/**
 * De qué está hecho el inglés que escuchaste.
 *
 * Una barra por composición, no por magnitud: lo que importa no es cuántas
 * palabras dijo el video sino qué proporción de ellas eran básicas y qué
 * proporción eran raras. Dos videos de largos distintos se comparan igual.
 */
export function BandComposition({
  bandTokens,
  legend = false,
  size = "md",
  className,
}: BandCompositionProps) {
  const total = BANDS.reduce((acc, band) => acc + (bandTokens[band.key] ?? 0), 0);
  if (total === 0) return null;

  const segments = BANDS.map((band) => ({
    band,
    count: bandTokens[band.key] ?? 0,
    share: (bandTokens[band.key] ?? 0) / total,
  })).filter((s) => s.count > 0);

  return (
    <div className={className}>
      {/* El gap deja ver el fondo entre segmentos: separa sin agregar tinta. */}
      <div
        className={cn(
          "flex gap-[2px] w-full overflow-hidden rounded-full",
          size === "sm" ? "h-2" : "h-7"
        )}
      >
        {segments.map(({ band, share }) => (
          <div
            key={band.key}
            title={`${band.label} (${band.hint}) — ${Math.round(share * 100)}%`}
            style={{ width: `${share * 100}%`, backgroundColor: band.color }}
            className={cn(
              "flex items-center justify-center first:rounded-l-full last:rounded-r-full",
              "transition-[width] duration-500"
            )}
          >
            {size === "md" && share >= LABEL_THRESHOLD && (
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  // Los dos escalones extremos de la rampa necesitan tinta
                  // opuesta para leerse encima del relleno.
                  band.key === "core" || band.key === "common"
                    ? "text-black/60"
                    : "text-white/90"
                )}
              >
                {Math.round(share * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {legend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
          {segments.map(({ band, count }) => (
            <span
              key={band.key}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: band.color }}
              />
              {band.label}
              <span className="tabular-nums opacity-60">
                {count.toLocaleString("es-CL")}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** La banda de una palabra, en chico. */
export function BandPill({
  label,
  color,
  detail,
  className,
}: {
  label: string;
  color: string;
  detail?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5",
        "text-[10px] font-medium border",
        className
      )}
      style={{ borderColor: color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
      {detail && (
        <span className="text-muted-foreground tabular-nums">{detail}</span>
      )}
    </span>
  );
}
