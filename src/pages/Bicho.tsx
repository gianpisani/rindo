import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { BichoCreature } from "@/components/bicho/BichoCreature";
import { useBicho } from "@/hooks/useBicho";
import { type DayScore } from "@/hooks/useBicho";
import { getScoreColor, BICHO_SHAPES } from "@/lib/bicho-shapes";
import {
  getDaysInMonth,
  format,
  eachWeekOfInterval,
  addDays,
  subDays,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Flame,
  Zap,
  Trophy,
  Sparkles,
  Loader2,
  RefreshCw,
  Info,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

// --- Heatmap tooltip content ---
function HeatmapTooltipContent({ day }: { day: DayScore }) {
  const formatCLP = (n: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(n);

  const scoreColor = getScoreColor(day.score);

  return (
    <div className="p-3 min-w-[200px] space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground capitalize">{day.label}</span>
        <span className="text-xs font-bold font-mono" style={{ color: scoreColor }}>
          {day.score} pts
        </span>
      </div>
      <div className="border-t border-border/50" />
      <div className="grid gap-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gasto</span>
          <span className="font-mono font-medium">{formatCLP(day.spent)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ingreso</span>
          <span className="font-mono font-medium">{formatCLP(day.income)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Transacciones</span>
          <span className="font-mono font-medium">{day.txCount}</span>
        </div>
        {day.hormigaCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">🐜 Hormiga</span>
            <span className="font-mono font-medium">
              {day.hormigaCount} ({formatCLP(day.hormigaTotal)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- SVG-based annual heatmap (rolling 12 months) ---
function AnnualHeatmap({ yearDays }: { yearDays: DayScore[] }) {
  const now = new Date();
  const rollingStart = subDays(now, 364);
  // Align to Monday so the grid starts clean
  const gridStart = startOfWeek(rollingStart, { weekStartsOn: 1 });

  const scoreMap: Record<string, DayScore> = {};
  for (const d of yearDays) {
    scoreMap[d.date] = d;
  }

  const weeks = eachWeekOfInterval(
    { start: gridStart, end: now },
    { weekStartsOn: 1 }
  );

  const cell = 12;
  const gap = 2;
  const step = cell + gap;
  const labelW = 20;
  const labelH = 14;

  const dayLabels = ["L", "", "M", "", "V", "", "D"];

  const monthPositions = useMemo(() => {
    const positions: { label: string; x: number }[] = [];
    let lastKey = "";
    weeks.forEach((weekStart, wi) => {
      const key = format(weekStart, "yyyy-MM");
      if (key !== lastKey) {
        lastKey = key;
        positions.push({
          label: format(weekStart, "MMM", { locale: es }),
          x: labelW + wi * step,
        });
      }
    });
    return positions;
  }, [weeks]);

  const svgW = labelW + weeks.length * step;
  const svgH = labelH + 7 * step;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <svg width={svgW} height={svgH} className="block">
          {/* Month labels */}
          {monthPositions.map((m, i) => (
            <text
              key={i}
              x={m.x + cell / 2}
              y={10}
              textAnchor="middle"
              className="fill-muted-foreground/70"
              fontSize={9}
              fontFamily="inherit"
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {dayLabels.map((label, i) =>
            label ? (
              <text
                key={i}
                x={labelW - 5}
                y={labelH + i * step + cell * 0.75}
                textAnchor="end"
                className="fill-muted-foreground/60"
                fontSize={9}
                fontFamily="inherit"
              >
                {label}
              </text>
            ) : null
          )}

          {/* Cells */}
          {weeks.map((weekStart, wi) =>
            [0, 1, 2, 3, 4, 5, 6].map((dow) => {
              const cellDate = addDays(weekStart, dow);
              const dateStr = format(cellDate, "yyyy-MM-dd");
              const dayData = scoreMap[dateStr];
              const isFuture = cellDate > now;
              const isBeforeGrid = cellDate < gridStart;

              if (isBeforeGrid || isFuture) return null;

              const x = labelW + wi * step;
              const y = labelH + dow * step;
              const fill = dayData ? dayData.color : "#27272a";
              const opacity = dayData ? 1 : 0.3;

              if (dayData) {
                return (
                  <Tooltip key={`${wi}-${dow}`}>
                    <TooltipTrigger asChild>
                      <rect
                        x={x}
                        y={y}
                        width={cell}
                        height={cell}
                        rx={2.5}
                        fill={fill}
                        opacity={opacity}
                        className="cursor-pointer transition-all duration-200 hover:brightness-125"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="p-0">
                      <HeatmapTooltipContent day={dayData} />
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <rect
                  key={`${wi}-${dow}`}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={2.5}
                  fill={fill}
                  opacity={opacity}
                  className="transition-all duration-200"
                />
              );
            })
          )}
        </svg>
      </div>
    </TooltipProvider>
  );
}

// --- Monthly trend chart ---
const MONTH_LABELS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function MonthlyTrendChart({ yearDays }: { yearDays: DayScore[] }) {
  const monthlyScores = useMemo(() => {
    // Group by YYYY-MM key to handle rolling across year boundaries
    const byKey: Record<string, number[]> = {};
    const orderedKeys: string[] = [];

    for (const d of yearDays) {
      const date = new Date(d.date);
      const key = format(date, "yyyy-MM");
      if (!byKey[key]) {
        byKey[key] = [];
        orderedKeys.push(key);
      }
      byKey[key].push(d.score);
    }

    return orderedKeys.map((key) => {
      const scores = byKey[key];
      const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      const monthIdx = parseInt(key.split("-")[1], 10) - 1;
      return {
        month: MONTH_LABELS_ES[monthIdx],
        score: avg,
        fill: getScoreColor(avg),
      };
    });
  }, [yearDays]);

  if (monthlyScores.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Tendencia mensual
      </h2>
      <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={monthlyScores} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, 100]} />
            <RechartsTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md">
                    <span className="font-medium">{data.month}:</span>{" "}
                    <span className="font-mono font-bold" style={{ color: data.fill }}>
                      {data.score} pts
                    </span>
                  </div>
                );
              }}
            />
            <Bar dataKey="score" barSize={16} radius={[4, 4, 0, 0]}>
              {monthlyScores.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Period selector types ---
type Period = "7d" | "30d" | "month" | "year";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
  { value: "year", label: "Anual" },
];

interface PeriodMetrics {
  totalExpense: number;
  totalIncome: number;
  avgDaily: number;
  hormigaCount: number;
  hormigaTotal: number;
  avgScore: number;
}

function computePeriodMetrics(days: DayScore[]): PeriodMetrics {
  if (days.length === 0) {
    return { totalExpense: 0, totalIncome: 0, avgDaily: 0, hormigaCount: 0, hormigaTotal: 0, avgScore: 0 };
  }
  const totalExpense = days.reduce((s, d) => s + d.spent, 0);
  const totalIncome = days.reduce((s, d) => s + d.income, 0);
  const avgDaily = totalExpense / days.length;
  const hormigaCount = days.reduce((s, d) => s + d.hormigaCount, 0);
  const hormigaTotal = days.reduce((s, d) => s + d.hormigaTotal, 0);
  const avgScore = Math.round(days.reduce((s, d) => s + d.score, 0) / days.length);
  return { totalExpense, totalIncome, avgDaily, hormigaCount, hormigaTotal, avgScore };
}

function getPeriodHeading(period: Period, year: number): string {
  switch (period) {
    case "7d": return "Últimos 7 días";
    case "30d": return "Últimos 30 días";
    case "month": return "Este mes";
    case "year": return `Año ${year}`;
  }
}

// --- Delta indicator ---
function Delta({
  current,
  previous,
  inverted = false,
  formatFn,
  suffix,
}: {
  current: number;
  previous: number;
  inverted?: boolean; // true = lower is better (expenses)
  formatFn: (n: number) => string;
  suffix?: string;
}) {
  if (previous === 0) return null;
  const diff = current - previous;
  if (diff === 0) return null;

  const isUp = diff > 0;
  // For expenses: going down is good (green). For income/score: going up is good.
  const isGood = inverted ? !isUp : isUp;

  return (
    <div className={cn(
      "flex items-center gap-1 text-[11px] font-medium",
      isGood ? "text-emerald-500" : "text-red-400"
    )}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{formatFn(Math.abs(diff))}{suffix} vs anterior</span>
    </div>
  );
}

// =============================================================
// Main page
// =============================================================
export default function Bicho() {
  const bicho = useBicho();
  const [infoOpen, setInfoOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const glowColor = getScoreColor(bicho.monthlyScore);

  const formatCLP = (n: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(n);

  // --- Period metrics ---
  const { current: periodCurrent, previous: periodPrevious } = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    const dayMap: Record<string, DayScore> = {};
    for (const d of bicho.yearDays) {
      dayMap[d.date] = d;
    }

    const getDaysInRange = (start: Date, end: Date): DayScore[] => {
      const result: DayScore[] = [];
      const d = new Date(start);
      while (d <= end) {
        const key = format(d, "yyyy-MM-dd");
        if (dayMap[key]) result.push(dayMap[key]);
        d.setDate(d.getDate() + 1);
      }
      return result;
    };

    let currentDays: DayScore[] = [];
    let previousDays: DayScore[] = [];

    switch (period) {
      case "7d": {
        const start = subDays(today, 6);
        const prevStart = subDays(today, 13);
        const prevEnd = subDays(today, 7);
        currentDays = getDaysInRange(start, today);
        previousDays = getDaysInRange(prevStart, prevEnd);
        break;
      }
      case "30d": {
        const start = subDays(today, 29);
        const prevStart = subDays(today, 59);
        const prevEnd = subDays(today, 30);
        currentDays = getDaysInRange(start, today);
        previousDays = getDaysInRange(prevStart, prevEnd);
        break;
      }
      case "month": {
        const monthStart = startOfMonth(today);
        const prevMonth = subMonths(today, 1);
        const prevMonthStart = startOfMonth(prevMonth);
        // For previous month, use same number of days elapsed
        const daysElapsed = today.getDate();
        const prevEnd = new Date(prevMonthStart);
        prevEnd.setDate(prevEnd.getDate() + daysElapsed - 1);
        currentDays = getDaysInRange(monthStart, today);
        previousDays = getDaysInRange(prevMonthStart, prevEnd);
        break;
      }
      case "year": {
        currentDays = bicho.yearDays;
        previousDays = [];
        break;
      }
    }

    return {
      current: computePeriodMetrics(currentDays),
      previous: computePeriodMetrics(previousDays),
    };
  }, [bicho.yearDays, period]);

  // Evolution timeline
  const levels = [1, 2, 3, 4];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Hero: Creature */}
        <div className="flex flex-col items-center gap-6 pt-4">
          {/* Glow */}
          <div className="relative">
            <div
              className="absolute inset-0 blur-[60px] rounded-full opacity-20 pointer-events-none scale-[2]"
              style={{ backgroundColor: glowColor }}
            />
            <BichoCreature
              shape={bicho.shape}
              dayScores={bicho.monthDays}
              daysInMonth={daysInMonth}
              pixelSize={20}
              gap={3}
              showTooltips
            />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {bicho.shape.emoji} {bicho.shape.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {bicho.shape.description}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-bold text-foreground">
                  {bicho.monthlyScore}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">Salud mensual</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-bold text-foreground">
                  {bicho.savingStreak}d
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">Racha ahorro</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-foreground">
                  {bicho.bestSavingStreak}d
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">Mejor racha</span>
            </div>
          </div>
        </div>

        {/* Collapsible info banner */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              <span>Cómo funciona</span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-300",
                infoOpen && "rotate-180"
              )}
            />
          </button>
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: infoOpen ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="px-5 pb-4 pt-1 grid gap-3 text-sm border-t border-border/30">
                <div className="flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">Salud mensual</span>
                    <span className="text-muted-foreground"> — promedio de tu score diario. Cada día se mide cuánto gastaste vs tu promedio de 90 días. Menos gastas, más sube.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Flame className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">Racha de ahorro</span>
                    <span className="text-muted-foreground"> — días consecutivos gastando bajo tu promedio diario. Tu récord es {bicho.bestSavingStreak} días.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-[15px] mt-0.5 shrink-0">🐜</span>
                  <div>
                    <span className="font-medium text-foreground">Gastos hormiga</span>
                    <span className="text-muted-foreground"> — compras bajo $5.000 que no duelen pero suman. Últimos 30 días: {bicho.monthHormigaCount} compras por {formatCLP(bicho.monthHormigaTotal)}.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Message Card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>Tu {bicho.shape.name.toLowerCase()} dice...</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={bicho.generateAIMessage}
              disabled={bicho.isLoadingAI}
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3 mr-1",
                  bicho.isLoadingAI && "animate-spin"
                )}
              />
              {bicho.aiMessage ? "Regenerar" : "Generar"}
            </Button>
          </div>
          {bicho.isLoadingAI ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Tu {bicho.shape.name.toLowerCase()} está pensando...
            </div>
          ) : bicho.aiMessage ? (
            <p className="text-foreground/80 leading-relaxed italic">
              "{bicho.aiMessage}"
            </p>
          ) : (
            <p className="text-muted-foreground/60 text-sm">
              Presiona "Generar" para que tu {bicho.shape.name.toLowerCase()} te cuente cómo va el mes.
            </p>
          )}
        </div>

        {/* Evolution Timeline */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Evolución
          </h2>
          <div className="flex items-center justify-between gap-2">
            {levels.map((lvl) => {
              const s = BICHO_SHAPES[lvl];
              const isActive = lvl === bicho.level;
              const isLocked = lvl > bicho.level;
              return (
                <div
                  key={lvl}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    isActive
                      ? "border-primary/50 bg-primary/5"
                      : isLocked
                        ? "border-border/30 opacity-40"
                        : "border-border/50"
                  )}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Annual Heatmap */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Últimos 12 meses
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
              <span>Peor</span>
              {["#ef4444", "#f97316", "#facc15", "#a3e635", "#4ade80", "#22c55e"].map(
                (color) => (
                  <div
                    key={color}
                    className="w-2 h-2 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                )
              )}
              <span>Mejor</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
            <AnnualHeatmap yearDays={bicho.yearDays} />
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <MonthlyTrendChart yearDays={bicho.yearDays} />

        {/* Period insights */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {getPeriodHeading(period, now.getFullYear())}
          </h2>

          {/* Period chips */}
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Gasto total</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(periodCurrent.totalExpense)}
              </p>
              {period !== "year" && (
                <Delta
                  current={periodCurrent.totalExpense}
                  previous={periodPrevious.totalExpense}
                  inverted
                  formatFn={formatCLP}
                />
              )}
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Ingreso total</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(periodCurrent.totalIncome)}
              </p>
              {period !== "year" && (
                <Delta
                  current={periodCurrent.totalIncome}
                  previous={periodPrevious.totalIncome}
                  formatFn={formatCLP}
                />
              )}
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Promedio diario</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(periodCurrent.avgDaily)}
              </p>
              {period !== "year" && (
                <Delta
                  current={periodCurrent.avgDaily}
                  previous={periodPrevious.avgDaily}
                  inverted
                  formatFn={formatCLP}
                />
              )}
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                🐜 Gastos hormiga
              </p>
              <p className="text-lg font-bold font-mono">
                {periodCurrent.hormigaCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatCLP(periodCurrent.hormigaTotal)} en compras &lt;$5k
              </p>
              {period !== "year" && (
                <Delta
                  current={periodCurrent.hormigaCount}
                  previous={periodPrevious.hormigaCount}
                  inverted
                  formatFn={(n) => String(n)}
                  suffix=" compras"
                />
              )}
            </div>
          </div>

          {/* Score card - full width */}
          {periodCurrent.avgScore > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Score promedio</p>
              <div className="flex items-center gap-2">
                <p
                  className="text-lg font-bold font-mono"
                  style={{ color: getScoreColor(periodCurrent.avgScore) }}
                >
                  {periodCurrent.avgScore} pts
                </p>
                {period !== "year" && (
                  <Delta
                    current={periodCurrent.avgScore}
                    previous={periodPrevious.avgScore}
                    formatFn={(n) => String(n)}
                    suffix=" pts"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </Layout>
  );
}
