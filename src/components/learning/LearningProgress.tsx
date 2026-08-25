import { useMemo } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-config";
import { MAX_COMPREHENSION, formatDuration } from "@/lib/learning-config";
import {
  bandOf,
  formatRank,
  median,
  FREQUENCY_LIST_SIZE,
  type Band,
} from "@/lib/corpus";
import type { LearningStats, PeriodStats } from "@/hooks/useLearningStats";
import type { LearningItem } from "@/hooks/useLearningItems";
import type { Corpus } from "@/hooks/useCorpus";
import { BandComposition } from "./BandComposition";

interface LearningProgressProps {
  stats: LearningStats;
  items: LearningItem[];
  corpus: Corpus;
}

/** Una palabra capturada, ubicada en el tiempo y en el ranking del inglés. */
interface Point {
  time: number;
  rank: number;
  word: string;
  band: Band;
}

export function LearningProgress({ stats, items, corpus }: LearningProgressProps) {
  const { last30, previous30 } = stats;

  const points = useMemo<Point[]>(() => {
    if (!corpus.isReady) return [];
    return items
      .map((item) => {
        const rank = corpus.rankOf(item.expression);
        if (rank === null) return null;
        return {
          time: new Date(item.created_at).getTime(),
          rank,
          word: item.expression,
          band: bandOf(rank),
        };
      })
      .filter((p): p is Point => p !== null)
      .sort((a, b) => a.time - b.time);
  }, [items, corpus]);

  /** La mediana semanal: la línea que debería subir con los meses. */
  const weekly = useMemo(() => {
    const byWeek = new Map<number, number[]>();
    for (const point of points) {
      const key = startOfWeek(point.time, { weekStartsOn: 1 }).getTime();
      byWeek.set(key, [...(byWeek.get(key) ?? []), point.rank]);
    }
    return [...byWeek.entries()]
      .map(([time, ranks]) => ({ time, rank: median(ranks) ?? 0 }))
      .sort((a, b) => a.time - b.time);
  }, [points]);

  const overallMedian = useMemo(
    () => median(points.map((p) => p.rank)),
    [points]
  );

  /** Cuánto se movió la banda entre la primera mitad y la segunda. */
  const shift = useMemo(() => {
    if (points.length < 8) return null;
    const half = Math.floor(points.length / 2);
    const before = median(points.slice(0, half).map((p) => p.rank));
    const after = median(points.slice(half).map((p) => p.rank));
    if (before === null || after === null || before === 0) return null;
    return { before, after, delta: (after - before) / before };
  }, [points]);

  const hasCorpus = corpus.isReady && corpus.totalTokens > 0;

  if (stats.allTime.sessionCount === 0 && !hasCorpus) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          El progreso aparece cuando haya contenido que medir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Tu banda: la métrica madre ────────────────────── */}
      {overallMedian !== null && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Tu banda
          </p>

          <div className="flex items-end justify-between gap-4 mt-3">
            <div>
              <p className="text-4xl font-bold tabular-nums leading-none text-primary">
                {formatRank(Math.round(overallMedian))}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2 max-w-[22ch] leading-snug">
                el puesto mediano de las palabras que te frenan
              </p>
            </div>

            {shift && (
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums flex items-center justify-end gap-1",
                    shift.delta > 0.05 ? "text-emerald-500" : "text-muted-foreground"
                  )}
                >
                  {shift.delta > 0.05 ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : shift.delta < -0.05 ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(Math.round(shift.delta * 100))}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatRank(Math.round(shift.before))} →{" "}
                  {formatRank(Math.round(shift.after))}
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/50">
            Cada palabra del inglés tiene un puesto en el ranking de uso.
            Mientras más arriba llegue el puesto de las que todavía te frenan,
            más inglés entiendes — y no depende de que declares nada.
          </p>
        </div>
      )}

      {/* ── El gráfico: cada captura, un punto ────────────── */}
      {points.length >= 4 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Lo que te frena, en el tiempo
            </p>
            <span className="text-[10px] text-muted-foreground">
              más arriba = más raro
            </span>
          </div>

          <div className="h-56 mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis
                  type="number"
                  dataKey="time"
                  domain={["dataMin - 86400000", "dataMax + 86400000"]}
                  tick={{ fontSize: 11, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) =>
                    format(new Date(value), "d MMM", { locale: es })
                  }
                />
                <YAxis
                  type="number"
                  dataKey="rank"
                  scale="log"
                  domain={[100, FREQUENCY_LIST_SIZE]}
                  ticks={[100, 1_000, 10_000]}
                  tick={{ fontSize: 11, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(value: number) => formatRank(value)}
                />
                <ZAxis range={[70, 70]} />

                {overallMedian !== null && (
                  <ReferenceLine
                    y={overallMedian}
                    stroke={CHART_COLORS.mutedAxis}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}

                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: CHART_COLORS.grid }}
                  content={<PointTooltip />}
                />

                <Scatter
                  name="Capturas"
                  data={points}
                  shape={(props: unknown) => <BandDot {...(props as DotProps)} />}
                />

                {weekly.length >= 2 && (
                  <Scatter
                    name="Mediana semanal"
                    data={weekly}
                    line={{ stroke: CHART_COLORS.investment, strokeWidth: 2 }}
                    shape={() => <g />}
                    legendType="none"
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-border/50">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              cada punto es una palabra que capturaste
            </span>
            {weekly.length >= 2 && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.investment }}
                />
                mediana semanal
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── De qué está hecho el inglés que consumes ──────── */}
      {hasCorpus && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              El inglés que consumes
            </p>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {corpus.totalTokens.toLocaleString("es-CL")} palabras ·{" "}
              {corpus.distinctLemmas.toLocaleString("es-CL")} distintas
            </span>
          </div>

          <BandComposition bandTokens={corpus.bandTokens} legend className="mt-4" />

          <div className="space-y-2.5 mt-5 pt-4 border-t border-border/50">
            {corpus.videos.slice(0, 6).map((video) => (
              <div key={video.externalId}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-medium truncate">
                    {video.title ?? video.externalId}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {video.stops > 0
                      ? `${video.stops} te frenaron`
                      : `hasta ${video.hardestBand.label.toLowerCase()}`}
                  </span>
                </div>
                <BandComposition
                  bandTokens={video.bandTokens}
                  size="sm"
                  className="mt-1.5"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── El hábito ────────────────────────────────────── */}
      <HabitCalendar stats={stats} />

      {/* ── Comprensión, cuando haya con qué ──────────────── */}
      {stats.comprehensionSeries.length >= 3 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Comprensión por sesión
            </p>
            {last30.comprehension !== null && (
              <span className="text-sm font-bold tabular-nums text-primary">
                {last30.comprehension.toFixed(1)}
                <span className="text-primary/50">/{MAX_COMPREHENSION}</span>
              </span>
            )}
          </div>

          <div className="h-36 mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.comprehensionSeries.map((point, index) => ({
                  index,
                  ...point,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
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
                  ticks={[0, 6, 12]}
                  tick={{ fontSize: 11, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
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

      {/* ── Contexto ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Últimos 30 días
        </p>

        <div className="divide-y divide-border/50 mt-2">
          <TrendRow
            label="Estudiando"
            current={last30.effectiveSeconds || null}
            previous={previous30.effectiveSeconds || null}
            format={(v) => formatDuration(v)}
          />
          <TrendRow
            label="Sesiones"
            current={last30.sessionCount || null}
            previous={previous30.sessionCount || null}
            format={(v) => String(Math.round(v))}
          />
          <TrendRow
            label="Palabras nuevas"
            current={last30.newItems || null}
            previous={previous30.newItems || null}
            format={(v) => String(Math.round(v))}
          />
        </div>
      </div>
    </div>
  );
}

// ── Piezas del gráfico ──────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: Point;
}

/** Un punto pintado con el color de su banda de frecuencia. */
function BandDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={payload.band.color}
      // Anillo del color de la superficie: separa los puntos que se pisan.
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function PointTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point.word) return null;

  return (
    <div style={CHART_TOOLTIP_STYLE} className="text-xs">
      <p className="font-semibold">{point.word}</p>
      <p className="text-muted-foreground mt-0.5">
        puesto {point.rank.toLocaleString("es-CL")} · {point.band.label}
      </p>
      <p className="text-muted-foreground">
        {format(new Date(point.time), "d 'de' MMMM", { locale: es })}
      </p>
    </div>
  );
}

// ── El hábito, como calendario ──────────────────────────────

/** Cuántos minutos hacen falta para pintar el día en cada escalón. */
const HEAT_STEPS = [1, 15, 30, 60];

function HabitCalendar({ stats }: { stats: LearningStats }) {
  const days = stats.dailyMinutes;
  if (days.length === 0) return null;

  const total = days.reduce((acc, d) => acc + d.minutes, 0);
  if (total === 0 && stats.streakDays === 0) return null;

  // Se dibuja por semanas: una columna por semana, un cuadro por día.
  const weeks: (typeof days)[] = [];
  const first = parseISO(days[0].date);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  let current: typeof days = Array.from({ length: offset }, () => ({
    date: "",
    minutes: -1,
  }));

  for (const day of days) {
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length > 0) weeks.push(current);

  const step = (minutes: number) => {
    if (minutes < 0) return -1;
    let level = 0;
    for (const threshold of HEAT_STEPS) if (minutes >= threshold) level += 1;
    return level;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          El hábito
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatDuration(total * 60)} en {days.length} días
        </span>
      </div>

      <div className="flex gap-[3px] mt-4 overflow-x-auto no-scrollbar">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px] shrink-0">
            {week.map((day, dayIndex) => {
              const level = step(day.minutes);
              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  title={
                    level < 0
                      ? undefined
                      : `${format(parseISO(day.date), "d 'de' MMMM", { locale: es })} — ${Math.round(day.minutes)} min`
                  }
                  className={cn(
                    "h-3 w-3 rounded-[3px]",
                    level < 0 && "opacity-0",
                    level === 0 && "bg-muted",
                    level === 1 && "bg-primary/25",
                    level === 2 && "bg-primary/50",
                    level === 3 && "bg-primary/75",
                    level === 4 && "bg-primary"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[10px] text-muted-foreground">menos</span>
        {["bg-muted", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"].map(
          (tone) => (
            <span key={tone} className={cn("h-2.5 w-2.5 rounded-[3px]", tone)} />
          )
        )}
        <span className="text-[10px] text-muted-foreground">más</span>
      </div>
    </div>
  );
}

// ── Una métrica con su comparación ──────────────────────────

function TrendRow({
  label,
  current,
  previous,
  format: fmt,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  format: (v: number) => string;
}) {
  const hasBoth = current !== null && previous !== null;
  const delta = hasBoth ? current - previous : null;
  const isFlat = delta !== null && Math.abs(delta) < 0.05;
  const improved = delta === null || isFlat ? null : delta > 0;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-medium">{label}</span>

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
            {improved ? (
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
