import Layout from "@/components/Layout";
import { BichoCreature } from "@/components/bicho/BichoCreature";
import { useBicho } from "@/hooks/useBicho";
import { getScoreColor, BICHO_SHAPES } from "@/lib/bicho-shapes";
import {
  getDaysInMonth,
  format,
  startOfYear,
  eachWeekOfInterval,
  addDays,
  getDay,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Flame,
  Zap,
  Trophy,
  TrendingDown,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Annual heatmap (GitHub-style)
function AnnualHeatmap({ yearDays }: { yearDays: ReturnType<typeof useBicho>["yearDays"] }) {
  const now = new Date();
  const yearStart = startOfYear(now);

  // Build a date → score map
  const scoreMap: Record<string, (typeof yearDays)[0]> = {};
  for (const d of yearDays) {
    scoreMap[d.date] = d;
  }

  // Build weeks (Sunday-start)
  const weeks = eachWeekOfInterval(
    { start: yearStart, end: now },
    { weekStartsOn: 0 }
  );

  const cellSize = 11;
  const cellGap = 2;
  const monthLabels: { label: string; x: number }[] = [];
  let lastMonth = -1;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-fit">
        {/* Month labels */}
        <div className="flex mb-1 ml-0" style={{ gap: cellGap }}>
          {weeks.map((weekStart, wi) => {
            const month = weekStart.getMonth();
            if (month !== lastMonth) {
              lastMonth = month;
              return (
                <div
                  key={wi}
                  style={{ width: cellSize, minWidth: cellSize }}
                  className="text-[9px] text-muted-foreground/50 text-center"
                >
                  {format(weekStart, "MMM", { locale: es })}
                </div>
              );
            }
            return (
              <div
                key={wi}
                style={{ width: cellSize, minWidth: cellSize }}
              />
            );
          })}
        </div>

        {/* Grid: 7 rows × N weeks */}
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
          <div key={dayOfWeek} className="flex" style={{ gap: cellGap }}>
            {weeks.map((weekStart, wi) => {
              const cellDate = addDays(weekStart, dayOfWeek);
              const dateStr = format(cellDate, "yyyy-MM-dd");
              const dayData = scoreMap[dateStr];
              const isFuture = cellDate > now;
              const isBeforeYear = cellDate < yearStart;

              let bg = "bg-zinc-900";
              let title = "";

              if (isBeforeYear || isFuture) {
                bg = "bg-transparent";
              } else if (dayData) {
                bg = "";
                title = `${dayData.label} · Score ${dayData.score}`;
              }

              return (
                <div
                  key={wi}
                  className={cn("rounded-[2px] transition-colors", bg)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    minWidth: cellSize,
                    backgroundColor:
                      !isBeforeYear && !isFuture && dayData
                        ? dayData.color
                        : undefined,
                    opacity:
                      isBeforeYear || isFuture ? 0 : dayData ? 1 : 0.15,
                  }}
                  title={title}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Bicho() {
  const bicho = useBicho();
  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const glowColor = getScoreColor(bicho.monthlyScore);

  const formatCLP = (n: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(n);

  // Find worst and best days this month
  const sortedDays = [...bicho.monthDays].sort((a, b) => a.score - b.score);
  const worstDay = sortedDays[0];
  const bestDay = sortedDays[sortedDays.length - 1];

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
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>
                Score{" "}
                <span className="font-bold text-foreground">
                  {bicho.monthlyScore}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-500" />
              <span>
                Racha{" "}
                <span className="font-bold text-foreground">
                  {bicho.currentStreak}
                </span>{" "}
                días
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span>
                Mejor{" "}
                <span className="font-bold text-foreground">
                  {bicho.bestStreak}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* AI Message Card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>Tu bicho dice...</span>
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
              Tu bicho está pensando...
            </div>
          ) : bicho.aiMessage ? (
            <p className="text-foreground/80 leading-relaxed italic">
              "{bicho.aiMessage}"
            </p>
          ) : (
            <p className="text-muted-foreground/60 text-sm">
              Presiona "Generar" para que tu bicho te cuente cómo va el mes.
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Tu año {now.getFullYear()}
          </h2>
          <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
            <AnnualHeatmap yearDays={bicho.yearDays} />
            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground/60">
              <span>Menos</span>
              {["#ef4444", "#f97316", "#facc15", "#a3e635", "#4ade80", "#22c55e"].map(
                (color) => (
                  <div
                    key={color}
                    className="w-2.5 h-2.5 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                )
              )}
              <span>Más</span>
            </div>
          </div>
        </div>

        {/* Month insights */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Este mes
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Gasto total</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(bicho.totalMonthExpense)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Ingreso total</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(bicho.totalMonthIncome)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Promedio diario</p>
              <p className="text-lg font-bold font-mono">
                {formatCLP(bicho.avgDailyExpense)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Peor día</p>
              {worstDay ? (
                <p className="text-sm font-medium">
                  <span className="text-destructive">
                    {formatCLP(worstDay.spent)}
                  </span>{" "}
                  <span className="text-muted-foreground text-xs">
                    · {worstDay.label}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </Layout>
  );
}
