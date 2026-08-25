import { useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
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
import { ArrowDown, ArrowUp, Flame, Minus, MoveUpRight } from "lucide-react";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-config";
import {
  MAX_COMPREHENSION,
  comprehensionScore,
  formatDuration,
  youTubeWatchUrl,
} from "@/lib/learning-config";
import { bandOf, formatRank, median } from "@/lib/corpus";
import {
  FORM_PROJECTION_DAYS,
  computeForm,
  formState,
  projectForm,
  projectFormAtPace,
  stopRate,
  trendOf,
} from "@/lib/progress";
import type { LearningStats } from "@/hooks/useLearningStats";
import type { SessionWithItemCount } from "@/hooks/useLearningSessions";
import type { LearningItem } from "@/hooks/useLearningItems";
import type { Corpus } from "@/hooks/useCorpus";
import type { LearningGoal } from "@/hooks/useLearningGoals";
import { BandComposition } from "./BandComposition";

interface LearningProgressProps {
  stats: LearningStats;
  sessions: SessionWithItemCount[];
  items: LearningItem[];
  corpus: Corpus;
  goal: LearningGoal;
}

/** Un video terminado, con todo lo que se puede comparar contra los otros. */
interface SessionPoint {
  id: string;
  externalId: string | null;
  title: string;
  date: string;
  comprehension: number | null;
  /** 0–100: cuánto del video está fuera de las mil palabras más usadas. */
  difficulty: number | null;
  stops: number;
  /** Frenos por cada diez minutos de contenido. */
  rate: number | null;
  order: number;
}

export function LearningProgress({
  stats,
  sessions,
  items,
  corpus,
  goal,
}: LearningProgressProps) {
  /** Las sesiones en orden cronológico, cruzadas con el corpus. */
  const points = useMemo<SessionPoint[]>(
    () =>
      [...sessions]
        .reverse()
        .map((session, index) => {
          const video = corpus.videoOf(session.external_id);
          return {
            id: session.id,
            externalId: session.external_id,
            title: session.content_title ?? video?.title ?? "Sesión",
            date: session.started_at,
            comprehension: comprehensionScore(session),
            difficulty: video?.difficulty ?? null,
            stops: session.new_item_count,
            rate: stopRate(session.new_item_count, session.consumed_seconds),
            order: index,
          };
        }),
    [sessions, corpus]
  );

  const rankedCaptures = useMemo(
    () =>
      items
        .map((item) => ({
          word: item.expression,
          rank: corpus.rankOf(item.expression),
          date: item.created_at,
        }))
        .filter((x): x is { word: string; rank: number; date: string } =>
          x.rank !== null
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [items, corpus]
  );

  const hasAnything = sessions.length > 0 || rankedCaptures.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Termina un video y acá empieza a dibujarse tu trayectoria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormCard stats={stats} goal={goal} />
      <LearningCurve points={points} />

      <div className="grid gap-4 sm:grid-cols-2">
        <BandTile captures={rankedCaptures} />
        <StopRateTile points={points} />
      </div>

      <SessionLedger points={points} corpus={corpus} />
    </div>
  );
}

// ── 1. Forma ────────────────────────────────────────────────

const FORM_TONE = {
  hot: "text-emerald-500",
  good: "text-primary",
  warm: "text-amber-500",
  cold: "text-muted-foreground",
} as const;

/**
 * La forma, a lo Strava.
 *
 * Es lo único de esta pantalla que empeora sola con el tiempo, y por eso es lo
 * primero: mide constancia, no logros acumulados. Un mes bueno seguido de tres
 * semanas sin abrir la app tiene que verse como lo que es.
 */
function FormCard({ stats, goal }: { stats: LearningStats; goal: LearningGoal }) {
  const curve = useMemo(
    () => computeForm(stats.dailyMinutes, goal.daily_minutes_target),
    [stats.dailyMinutes, goal.daily_minutes_target]
  );

  const current = curve.at(-1)?.form ?? 0;
  const weekAgo = curve.at(-8)?.form ?? 0;
  const delta = current - weekAgo;
  const state = formState(current, delta, stats.daysSinceLastSession);

  // Arranca el gráfico en el primer día con actividad: 60 días planos en cero
  // antes de tu primera sesión no son información.
  const firstActive = curve.findIndex((p) => p.minutes > 0);
  const history = firstActive === -1 ? curve.slice(-14) : curve.slice(Math.max(0, firstActive - 2));

  const projection = useMemo(() => {
    const last = history.at(-1);
    if (!last) return [];
    const lastDate = parseISO(last.date);
    return Array.from({ length: FORM_PROJECTION_DAYS }, (_, i) => ({
      date: format(subDays(lastDate, -(i + 1)), "yyyy-MM-dd"),
      projected: projectForm(last.form, i + 1),
      form: null as number | null,
      minutes: 0,
    }));
  }, [history]);

  const data = useMemo(
    () => [
      ...history.map((p) => ({ ...p, projected: null as number | null })),
      // El primer punto proyectado repite el último real para que la línea
      // punteada nazca pegada a la sólida y no flotando.
      ...(history.length > 0
        ? [{ ...history.at(-1)!, projected: history.at(-1)!.form }]
        : []),
      ...projection,
    ],
    [history, projection]
  );

  const inAWeek = projectForm(current, 7);
  const inTwoWeeks = projectFormAtPace(current, 14);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Forma
          </p>
          <div className="flex items-end gap-2.5 mt-2">
            <p
              className={cn(
                "text-5xl font-bold tabular-nums leading-none",
                FORM_TONE[state.tone]
              )}
            >
              {Math.round(current)}
            </p>
            <div className="pb-1">
              <p className="text-sm font-semibold leading-none">{state.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{state.hint}</p>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p
            className={cn(
              "text-sm font-bold tabular-nums flex items-center justify-end gap-1",
              delta > 0.5
                ? "text-emerald-500"
                : delta < -0.5
                  ? "text-rose-500"
                  : "text-muted-foreground"
            )}
          >
            {delta > 0.5 ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : delta < -0.5 ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            {Math.abs(Math.round(delta))}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">esta semana</p>
          {stats.streakDays > 1 && (
            <p className="flex items-center justify-end gap-1 text-primary mt-2">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-sm font-bold tabular-nums">
                {stats.streakDays}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="h-36 mt-5 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="formFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.32} />
                <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.grid}
              vertical={false}
              opacity={0.35}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: CHART_COLORS.mutedAxis }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tickFormatter={(value: string) =>
                format(parseISO(value), "d MMM", { locale: es })
              }
            />
            <YAxis
              domain={[0, (max: number) => Math.max(110, max * 1.1)]}
              ticks={[0, 50, 100]}
              tick={{ fontSize: 10, fill: CHART_COLORS.mutedAxis }}
              axisLine={false}
              tickLine={false}
              width={26}
            />
            <ReferenceLine
              y={100}
              stroke={CHART_COLORS.mutedAxis}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelFormatter={(value: string) =>
                format(parseISO(value), "d 'de' MMMM", { locale: es })
              }
              formatter={(value: number, name) => [
                Math.round(value),
                name === "projected" ? "Si no estudias" : "Forma",
              ]}
            />
            <Area
              type="monotone"
              dataKey="form"
              stroke={CHART_COLORS.income}
              strokeWidth={2}
              fill="url(#formFill)"
              connectNulls={false}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="projected"
              stroke={CHART_COLORS.mutedAxis}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              connectNulls
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">
        100 es cumplir tu meta de {goal.daily_minutes_target} min todos los días.{" "}
        {current < 40
          ? `Cumpliéndola a diario llegas a ${Math.round(inTwoWeeks)} en dos semanas.`
          : `Si paras una semana caes a ${Math.round(inAWeek)}.`}
      </p>

      <HabitStrip stats={stats} />
    </div>
  );
}

/** Los últimos 42 días, uno por cuadrito. Vive dentro de la tarjeta de forma. */
function HabitStrip({ stats }: { stats: LearningStats }) {
  const days = stats.dailyMinutes.slice(-42);
  const max = Math.max(...days.map((d) => d.minutes), 1);

  return (
    <div className="flex items-end gap-[3px] mt-4">
      {days.map((day) => {
        const level = day.minutes === 0 ? 0 : Math.ceil((day.minutes / max) * 4);
        return (
          <span
            key={day.date}
            title={`${format(parseISO(day.date), "d 'de' MMMM", { locale: es })} — ${Math.round(day.minutes)} min`}
            className={cn(
              "h-2.5 flex-1 rounded-[2px] min-w-[3px]",
              level === 0 && "bg-muted",
              level === 1 && "bg-primary/30",
              level === 2 && "bg-primary/50",
              level === 3 && "bg-primary/75",
              level >= 4 && "bg-primary"
            )}
          />
        );
      })}
    </div>
  );
}

// ── 2. La curva de aprendizaje ──────────────────────────────

/**
 * Comprensión contra dificultad, video a video.
 *
 * Es la única forma honesta que encontré de mostrar progreso con pocos datos:
 * entender un video fácil no dice nada y entender poco de uno difícil tampoco.
 * Lo que sí dice algo es el movimiento — mantener la comprensión mientras el
 * contenido se pone más duro. Arriba y a la derecha.
 */
function LearningCurve({ points }: { points: SessionPoint[] }) {
  const usable = points.filter(
    (p) => p.comprehension !== null && p.difficulty !== null
  );

  const path = usable.map((p) => ({
    ...p,
    x: p.difficulty!,
    y: p.comprehension!,
    /** Los más nuevos van más opacos: el tiempo se lee sin eje. */
    weight: 0.35 + (0.65 * (p.order + 1)) / Math.max(1, points.length),
  }));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Tu curva
        </p>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MoveUpRight className="h-3 w-3" />
          arriba y a la derecha
        </span>
      </div>

      {path.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Necesito un video terminado y evaluado, con su transcripción pegada.
        </p>
      ) : (
        <>
          <div className="h-52 mt-4 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  opacity={0.35}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, (max: number) => Math.max(25, Math.ceil(max * 1.2))]}
                  tick={{ fontSize: 10, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${Math.round(v)}%`}
                  label={{
                    value: "dificultad del video",
                    position: "insideBottomRight",
                    offset: -2,
                    fontSize: 10,
                    fill: CHART_COLORS.mutedAxis,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, MAX_COMPREHENSION]}
                  ticks={[0, 6, 12]}
                  tick={{ fontSize: 10, fill: CHART_COLORS.mutedAxis }}
                  axisLine={false}
                  tickLine={false}
                  width={26}
                  label={{
                    value: "entendiste",
                    angle: -90,
                    position: "insideLeft",
                    offset: 14,
                    fontSize: 10,
                    fill: CHART_COLORS.mutedAxis,
                  }}
                />
                <ZAxis range={[80, 80]} />
                <ReferenceLine
                  y={MAX_COMPREHENSION / 2}
                  stroke={CHART_COLORS.mutedAxis}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <Tooltip cursor={false} content={<CurveTooltip />} />
                <Scatter
                  data={path}
                  line={
                    path.length > 1
                      ? { stroke: CHART_COLORS.investment, strokeWidth: 1.5 }
                      : false
                  }
                  shape={(props: unknown) => <CurveDot {...(props as CurveDotProps)} />}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">
            {path.length === 1
              ? "Un punto no es una curva. Con el segundo video ya se ve para dónde vas."
              : "Cada punto es un video: la dificultad es qué porcentaje de sus palabras está fuera de las mil más usadas del inglés. El punto más opaco es el más reciente."}
          </p>
        </>
      )}
    </div>
  );
}

interface CurveDotProps {
  cx?: number;
  cy?: number;
  payload?: SessionPoint & { weight: number };
}

function CurveDot({ cx, cy, payload }: CurveDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={CHART_COLORS.investment}
      fillOpacity={payload.weight}
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SessionPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div style={CHART_TOOLTIP_STYLE} className="text-xs max-w-[220px]">
      <p className="font-semibold line-clamp-2">{point.title}</p>
      <p className="text-muted-foreground mt-1">
        entendiste {point.comprehension}/{MAX_COMPREHENSION} · dificultad{" "}
        {Math.round(point.difficulty ?? 0)}%
      </p>
      <p className="text-muted-foreground">
        {point.stops} {point.stops === 1 ? "freno" : "frenos"} ·{" "}
        {format(parseISO(point.date), "d MMM", { locale: es })}
      </p>
    </div>
  );
}

// ── 3. Las dos baldosas ─────────────────────────────────────

/** Tu banda: el puesto de lo que te frena, y si se está moviendo. */
function BandTile({
  captures,
}: {
  captures: { word: string; rank: number; date: string }[];
}) {
  const overall = median(captures.map((c) => c.rank));
  const trend = trendOf(captures.map((c) => c.rank));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        Tu banda
      </p>

      <div className="flex items-end justify-between gap-3 mt-2">
        <p className="text-3xl font-bold tabular-nums leading-none text-primary">
          {overall === null ? "—" : formatRank(Math.round(overall))}
        </p>
        {trend && (
          <p
            className={cn(
              "text-xs font-bold tabular-nums flex items-center gap-0.5",
              trend.delta > 0 ? "text-emerald-500" : "text-muted-foreground"
            )}
          >
            {trend.delta > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {formatRank(Math.round(trend.first))} →{" "}
            {formatRank(Math.round(trend.last))}
          </p>
        )}
      </div>

      {/* Cada captura, ubicada en el ranking. Se lee con un punto o con cien. */}
      {captures.length > 0 && (
        <div className="relative h-10 mt-4">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          {captures.map((capture) => {
            // Escala logarítmica: del puesto 100 al 50.000 hay tres órdenes de
            // magnitud, y lineal apretaría todo contra la izquierda.
            const left =
              (Math.log10(Math.max(100, capture.rank)) - 2) / (Math.log10(50_000) - 2);
            return (
              <span
                key={`${capture.word}-${capture.date}`}
                title={`${capture.word} — puesto ${capture.rank.toLocaleString("es-CL")}`}
                style={{
                  left: `${Math.min(98, Math.max(0, left * 100))}%`,
                  backgroundColor: bandOf(capture.rank).color,
                }}
                className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ring-2 ring-card"
              />
            );
          })}
          {overall !== null && (
            <span
              style={{
                left: `${Math.min(98, Math.max(0, ((Math.log10(Math.max(100, overall)) - 2) / (Math.log10(50_000) - 2)) * 100))}%`,
              }}
              className="absolute top-0 bottom-0 w-px bg-primary"
            />
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug mt-2">
        Más a la derecha, palabras más raras. La línea es tu mediana; sube
        cuando dejan de frenarte las comunes.
      </p>
    </div>
  );
}

/** Frenos por diez minutos: debería bajar aunque suba la dificultad. */
function StopRateTile({ points }: { points: SessionPoint[] }) {
  const rates = points
    .map((p) => p.rate)
    .filter((r): r is number => r !== null);
  const last = rates.at(-1) ?? null;
  const trend = trendOf(rates);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        Frenos por 10 min
      </p>

      <div className="flex items-end justify-between gap-3 mt-2">
        <p className="text-3xl font-bold tabular-nums leading-none">
          {last === null ? "—" : last.toFixed(1)}
        </p>
        {trend && (
          <p
            className={cn(
              "text-xs font-bold tabular-nums flex items-center gap-0.5",
              trend.delta < 0 ? "text-emerald-500" : "text-muted-foreground"
            )}
          >
            {trend.delta < 0 ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
            {trend.first.toFixed(1)} → {trend.last.toFixed(1)}
          </p>
        )}
      </div>

      {/* Una barra por video, en orden. */}
      {rates.length > 0 && (
        <div className="flex items-end gap-1 h-10 mt-4">
          {rates.map((rate, index) => (
            <span
              key={index}
              title={`${rate.toFixed(1)} frenos / 10 min`}
              style={{
                height: `${Math.max(8, (rate / Math.max(...rates)) * 100)}%`,
              }}
              className="flex-1 rounded-[3px] bg-primary/60 min-w-[6px]"
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug mt-2">
        Cuántas veces por diez minutos tuviste que parar. Solo significa algo
        si seguiste capturando igual de seguido.
      </p>
    </div>
  );
}

// ── 4. El libro de cuentas ──────────────────────────────────

/** Cada video terminado, con lo que se puede comparar. Lo más nuevo arriba. */
function SessionLedger({
  points,
  corpus,
}: {
  points: SessionPoint[];
  corpus: Corpus;
}) {
  if (points.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        Video por video
      </p>

      <div className="divide-y divide-border/50 mt-1">
        {[...points].reverse().map((point) => {
          const video = corpus.videoOf(point.externalId);
          return (
            <div key={point.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium truncate">
                  {point.externalId ? (
                    <a
                      href={youTubeWatchUrl(point.externalId)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {point.title}
                    </a>
                  ) : (
                    point.title
                  )}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {format(parseISO(point.date), "d MMM", { locale: es })}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[11px] tabular-nums">
                <span className="font-semibold text-primary">
                  {point.comprehension ?? "—"}/{MAX_COMPREHENSION}
                </span>
                {point.difficulty !== null && (
                  <span className="text-muted-foreground">
                    dificultad {Math.round(point.difficulty)}%
                  </span>
                )}
                <span className="text-muted-foreground">
                  {point.stops} {point.stops === 1 ? "freno" : "frenos"}
                </span>
                {point.rate !== null && (
                  <span className="text-muted-foreground">
                    {point.rate.toFixed(1)}/10min
                  </span>
                )}
              </div>

              {video && (
                <BandComposition
                  bandTokens={video.bandTokens}
                  size="sm"
                  className="mt-2"
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">
        La barra de cada video es de qué está hecho su inglés: de las mil
        palabras más usadas a la izquierda, hasta las raras a la derecha.
      </p>
    </div>
  );
}
