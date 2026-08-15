import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-config";
import { MAX_COMPREHENSION, formatDuration } from "@/lib/learning-config";
import type { LearningStats, PeriodStats } from "@/hooks/useLearningStats";

interface LearningProgressProps {
  stats: LearningStats;
}

/**
 * Una métrica con su comparación contra el periodo anterior.
 * `betterWhen` dice hacia dónde es mejorar, para pintar la flecha.
 */
function TrendRow({
  label,
  current,
  previous,
  format: fmt,
  betterWhen = "up",
  caveat,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  format: (v: number) => string;
  betterWhen?: "up" | "down";
  caveat?: boolean;
}) {
  const hasBoth = current !== null && previous !== null;
  const delta = hasBoth ? current - previous : null;
  const isFlat = delta !== null && Math.abs(delta) < 0.05;

  const improved =
    delta === null || isFlat
      ? null
      : betterWhen === "up"
        ? delta > 0
        : delta < 0;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className={cn("text-sm", caveat ? "text-muted-foreground" : "font-medium")}>
        {label}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {hasBoth && !isFlat && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmt(previous)}
            <span className="mx-1">→</span>
          </span>
        )}
        <span className="text-sm font-bold tabular-nums">
          {current !== null ? fmt(current) : "—"}
        </span>
        {improved !== null && (
          <span
            className={cn(
              "flex items-center",
              improved ? "text-emerald-500" : "text-muted-foreground"
            )}
          >
            {delta! > 0 ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        {isFlat && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    </div>
  );
}

/** Frase honesta sobre lo que cambió — solo si hay evidencia suficiente. */
function conclusion(last30: PeriodStats, previous30: PeriodStats): string | null {
  if (last30.sessionCount < 3 || previous30.sessionCount < 3) return null;

  const parts: string[] = [];

  if (last30.comprehension !== null && previous30.comprehension !== null) {
    const delta = last30.comprehension - previous30.comprehension;
    if (delta >= 0.4) {
      parts.push(
        `Tu comprensión subió de ${previous30.comprehension.toFixed(1)} a ${last30.comprehension.toFixed(1)} sobre ${MAX_COMPREHENSION}`
      );
    } else if (delta <= -0.4) {
      parts.push(
        `Tu comprensión bajó de ${previous30.comprehension.toFixed(1)} a ${last30.comprehension.toFixed(1)}`
      );
    } else {
      parts.push("Tu comprensión se mantuvo estable");
    }
  }

  if (last30.effectiveSeconds > 0 && previous30.effectiveSeconds > 0) {
    const ratio = last30.effectiveSeconds / previous30.effectiveSeconds;
    if (ratio >= 1.15) {
      parts.push(`estudiaste ${Math.round((ratio - 1) * 100)}% más`);
    } else if (ratio <= 0.85) {
      parts.push(`estudiaste ${Math.round((1 - ratio) * 100)}% menos`);
    }
  }

  if (parts.length === 0) return null;
  return parts.join(", ") + ".";
}

export function LearningProgress({ stats }: LearningProgressProps) {
  const { last30, previous30 } = stats;

  const dailyData = useMemo(
    () =>
      stats.dailyMinutes.map((d) => ({
        date: d.date,
        minutes: Math.round(d.minutes),
      })),
    [stats.dailyMinutes]
  );

  const comprehensionData = useMemo(
    () =>
      stats.comprehensionSeries.map((point, index) => ({
        index,
        date: point.date,
        score: point.score,
      })),
    [stats.comprehensionSeries]
  );

  const summary = conclusion(last30, previous30);

  if (stats.allTime.sessionCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          El progreso aparece cuando haya sesiones que comparar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Lo que importa ───────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Últimos 30 días
        </p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none text-primary">
              {last30.comprehension !== null
                ? last30.comprehension.toFixed(1)
                : "—"}
              <span className="text-base text-primary/50">/{MAX_COMPREHENSION}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              comprensión promedio
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums leading-none">
              {formatDuration(last30.effectiveSeconds)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">estudiando</p>
          </div>
        </div>

        {summary && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/50">
            {summary}
          </p>
        )}
      </div>

      {/* ── Comprensión en el tiempo ─────────────────────── */}
      {comprehensionData.length >= 3 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
            Comprensión por sesión
          </p>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comprehensionData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="comprehensionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.investment} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_COLORS.investment} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis dataKey="index" hide />
                <YAxis
                  domain={[0, MAX_COMPREHENSION]}
                  ticks={[0, 4, 8]}
                  tick={{ fontSize: 11, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(_, payload) => {
                    const raw = payload?.[0]?.payload?.date;
                    return raw
                      ? format(parseISO(raw), "d 'de' MMMM", { locale: es })
                      : "";
                  }}
                  formatter={(value: number) => [
                    `${value} / ${MAX_COMPREHENSION}`,
                    "Comprensión",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={CHART_COLORS.investment}
                  strokeWidth={2}
                  fill="url(#comprehensionFill)"
                  dot={{ r: 2.5, strokeWidth: 0, fill: CHART_COLORS.investment }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Minutos por día ──────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
          Minutos efectivos por día
        </p>

        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                vertical={false}
                opacity={0.4}
              />
              <XAxis dataKey="date" hide />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.mutedAxis }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(value: string) =>
                  format(parseISO(value), "d 'de' MMMM", { locale: es })
                }
                formatter={(value: number) => [`${value} min`, "Estudiando"]}
              />
              <Bar
                dataKey="minutes"
                fill={CHART_COLORS.income}
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Contexto ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Contexto
        </p>

        <div className="divide-y divide-border/50 mt-2">
          <TrendRow
            label="Sesiones"
            current={last30.sessionCount || null}
            previous={previous30.sessionCount || null}
            format={(v) => String(Math.round(v))}
          />
          <TrendRow
            label="Expresiones nuevas"
            current={last30.newItems || null}
            previous={previous30.newItems || null}
            format={(v) => String(Math.round(v))}
          />
          <TrendRow
            label="Independencia de subtítulos"
            current={last30.subtitleIndependence}
            previous={previous30.subtitleIndependence}
            format={(v) => `${v.toFixed(1)}/2`}
          />
          <TrendRow
            label="Multiplicador de estudio"
            current={last30.studyMultiplier}
            previous={previous30.studyMultiplier}
            format={(v) => `${v.toFixed(2)}x`}
            betterWhen="down"
            caveat
          />
          <TrendRow
            label="Expresiones por minuto"
            current={last30.vocabDensity}
            previous={previous30.vocabDensity}
            format={(v) => v.toFixed(2)}
            betterWhen="down"
            caveat
          />
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/50">
          Las dos últimas bajan cuando mejoras, pero también bajan si dejas de
          pausar y de capturar. Solo significan algo si mantuviste el hábito.
          La medida honesta de progreso es la comprensión.
        </p>
      </div>
    </div>
  );
}
