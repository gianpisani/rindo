import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, AlertTriangle, Trophy, Sparkles, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CategoryInsight {
  type: "alert" | "achievement" | "opportunity" | "pattern";
  title: string;
  description: string;
  category?: string;
  impact?: number;
}

interface MonthlyStoryProps {
  open: boolean;
  onClose: () => void;
  month: Date;
  kpis: {
    income: number;
    expenses: number;
    investments: number;
    balance: number;
    savingsRate: number;
    prevSavingsRate: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    effectiveAmount?: number;
    reimbursedAmount?: number;
    percentage: number;
    color: string;
    count: number;
  }>;
  dailyStats: {
    avgDaily: number;
    peakDay: { date: string; amount: number; dayName: string } | null;
    totalDays: number;
    daysWithSpending: number;
  };
  transactionCount: number;
  salary?: number;
  insights?: CategoryInsight[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(value);

function getClosingMessage(savingsRate: number) {
  if (savingsRate > 50)
    return {
      word: "Impecable",
      subtitle: "No todos pueden decir que ahorraron más de la mitad. Tú sí.",
      accent: "#34d399",
      glowColor: "rgba(52, 211, 153, 0.15)",
    };
  if (savingsRate > 30)
    return {
      word: "Sólido",
      subtitle: "Mes controlado, plata clara. Así se maneja.",
      accent: "#60a5fa",
      glowColor: "rgba(96, 165, 250, 0.15)",
    };
  if (savingsRate > 10)
    return {
      word: "En control",
      subtitle: "Cada peso en su lugar. Vas bien, sigue así.",
      accent: "#22d3ee",
      glowColor: "rgba(34, 211, 238, 0.12)",
    };
  if (savingsRate > 0)
    return {
      word: "Positivo",
      subtitle: "Cerraste en verde. Eso ya te pone adelante.",
      accent: "#fbbf24",
      glowColor: "rgba(251, 191, 36, 0.12)",
    };
  return {
    word: "A revancha",
    subtitle: "Un mes complicado, pero ya sabes cómo volver.",
    accent: "#fb7185",
    glowColor: "rgba(251, 113, 133, 0.12)",
  };
}

function getInsightIcon(type: CategoryInsight["type"]) {
  switch (type) {
    case "alert": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "achievement": return <Trophy className="h-4 w-4 text-emerald-400" />;
    case "opportunity": return <Lightbulb className="h-4 w-4 text-blue-400" />;
    case "pattern": return <Sparkles className="h-4 w-4 text-purple-400" />;
  }
}

export function MonthlyStory({
  open,
  onClose,
  month,
  kpis,
  categoryBreakdown,
  dailyStats,
  transactionCount,
  salary = 0,
  insights = [],
}: MonthlyStoryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const closing = getClosingMessage(kpis.savingsRate);

  // Use effectiveAmount (reimbursements deducted) when available, fallback to amount
  const effectiveBreakdown = categoryBreakdown
    .map((c) => ({
      ...c,
      displayAmount: c.effectiveAmount ?? c.amount,
    }))
    .filter((c) => c.displayAmount > 0)
    .sort((a, b) => b.displayAmount - a.displayAmount);

  const totalEffectiveExpenses = effectiveBreakdown.reduce(
    (s, c) => s + c.displayAmount,
    0
  );

  const topCategories = effectiveBreakdown.slice(0, 5);
  const topCategory = effectiveBreakdown[0] || null;

  // Pick top 3 most relevant insights (alerts first, then achievements, then patterns)
  const topInsights = [...insights]
    .sort((a, b) => {
      const order = { alert: 0, pattern: 1, opportunity: 2, achievement: 3 };
      return order[a.type] - order[b.type];
    })
    .slice(0, 3);

  // Build slides
  const slides: Array<{ id: string; render: () => React.ReactNode }> = [];

  // 1 - Opening
  slides.push({
    id: "opening",
    render: () => (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <motion.h1
          className="text-5xl md:text-7xl font-bold text-white capitalize"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {format(month, "MMMM", { locale: es })}
        </motion.h1>
        <motion.p
          className="text-lg text-white/40 font-light tracking-wider"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {format(month, "yyyy")}
        </motion.p>
        <motion.p
          className="text-sm text-white/25 tracking-widest uppercase mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          Tu resumen financiero
        </motion.p>
      </div>
    ),
  });

  // 2 - Salary
  if (salary > 0) {
    slides.push({
      id: "salary",
      render: () => (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <motion.p
            className="text-white/40 text-sm tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            Tu sueldo este mes
          </motion.p>
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          >
            <div className="absolute inset-0 blur-3xl bg-emerald-500/10 rounded-full scale-150" />
            <p className="relative text-4xl md:text-6xl font-bold text-emerald-400 font-mono tabular-nums">
              {formatCurrency(salary)}
            </p>
          </motion.div>
          <motion.p
            className="text-white/30 text-sm max-w-xs text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {kpis.income > salary
              ? `+ ${formatCurrency(kpis.income - salary)} en otros ingresos`
              : "Tu única fuente de ingresos este mes"}
          </motion.p>
        </div>
      ),
    });
  }

  // 3 - Where money went (top categories with effective amounts)
  if (topCategories.length > 0) {
    slides.push({
      id: "breakdown",
      render: () => {
        const maxAmount = topCategories[0]?.displayAmount || 1;
        return (
          <div className="flex flex-col items-center justify-center h-full gap-6 w-full max-w-md mx-auto px-6">
            <motion.p
              className="text-white/40 text-sm tracking-wider uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              &iquest;En qu&eacute; se fue la plata?
            </motion.p>
            <motion.div
              className="w-full space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {topCategories.map((cat, i) => {
                const pct = totalEffectiveExpenses > 0
                  ? (cat.displayAmount / totalEffectiveExpenses) * 100
                  : 0;
                return (
                  <motion.div
                    key={cat.category}
                    className="space-y-1.5"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-white/70 text-sm font-medium truncate mr-2">
                        {cat.category}
                      </span>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-white/30 text-xs">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-white text-sm font-bold font-mono tabular-nums">
                          {formatCurrency(cat.displayAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(cat.displayAmount / maxAmount) * 100}%`,
                        }}
                        transition={{
                          delay: 0.5 + i * 0.1,
                          duration: 0.8,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    {(cat.reimbursedAmount ?? 0) > 0 && (
                      <motion.p
                        className="text-emerald-400/50 text-xs"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 + i * 0.1 }}
                      >
                        {formatCurrency(cat.reimbursedAmount!)} reembolsado
                      </motion.p>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
            {effectiveBreakdown.length > 5 && (
              <motion.p
                className="text-white/20 text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                + {effectiveBreakdown.length - 5} categor&iacute;as m&aacute;s
              </motion.p>
            )}
          </div>
        );
      },
    });
  }

  // 4 - Top Category spotlight
  if (topCategory) {
    slides.push({
      id: "top-category",
      render: () => {
        const pct = totalEffectiveExpenses > 0
          ? (topCategory.displayAmount / totalEffectiveExpenses) * 100
          : 0;
        return (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <motion.p
              className="text-white/40 text-sm tracking-wider uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              Tu mayor gasto fue
            </motion.p>
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.3,
                duration: 0.5,
                type: "spring",
                stiffness: 200,
              }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
                {topCategory.category}
              </h2>
              <div
                className="w-16 h-1 rounded-full mx-auto mb-4"
                style={{ backgroundColor: topCategory.color }}
              />
            </motion.div>
            <motion.div
              className="text-center space-y-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <p className="text-white/60 text-2xl font-mono tabular-nums font-semibold">
                {formatCurrency(topCategory.displayAmount)}
              </p>
              <p className="text-white/30 text-sm">
                {pct.toFixed(0)}% del gasto total &middot;{" "}
                {topCategory.count} movimientos
              </p>
            </motion.div>
          </div>
        );
      },
    });
  }

  // 5 - Savings Rate
  slides.push({
    id: "savings",
    render: () => {
      const rate = Math.max(0, Math.min(100, kpis.savingsRate));
      const circumference = 2 * Math.PI * 60;
      const offset = circumference - (rate / 100) * circumference;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <motion.p
            className="text-white/40 text-sm tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Tasa de ahorro
          </motion.p>
          <motion.div
            className="relative w-40 h-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 140 140"
            >
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="8"
              />
              <motion.circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke={kpis.savingsRate >= 0 ? "#34d399" : "#fb7185"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ delay: 0.4, duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                className="text-3xl font-bold text-white font-mono tabular-nums"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {rate.toFixed(0)}%
              </motion.span>
            </div>
          </motion.div>
          {kpis.prevSavingsRate !== 0 && (
            <motion.p
              className="text-white/30 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              vs {kpis.prevSavingsRate.toFixed(0)}% el mes pasado
            </motion.p>
          )}
        </div>
      );
    },
  });

  // 6 - Insights (if available)
  if (topInsights.length > 0) {
    slides.push({
      id: "insights",
      render: () => (
        <div className="flex flex-col items-center justify-center h-full gap-6 w-full max-w-md mx-auto px-6">
          <motion.p
            className="text-white/40 text-sm tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            Lo que debes saber
          </motion.p>
          <motion.div
            className="w-full space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {topInsights.map((insight, i) => (
              <motion.div
                key={i}
                className="flex gap-3 items-start bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
              >
                <div className="mt-0.5 shrink-0">
                  {getInsightIcon(insight.type)}
                </div>
                <div>
                  <p className="text-white/80 text-sm font-medium">
                    {insight.title}
                  </p>
                  <p className="text-white/35 text-xs mt-0.5">
                    {insight.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      ),
    });
  }

  // 7 - Final Summary + Closing
  slides.push({
    id: "closing",
    render: () => {
      const savedAmount = kpis.balance;
      const incomeSource = salary > 0 ? salary : kpis.income;

      // Build flow segments
      const segments: Array<{ label: string; amount: number; color: string; pct: number }> = [];
      if (incomeSource > 0) {
        if (kpis.expenses > 0)
          segments.push({
            label: "Gastos",
            amount: kpis.expenses,
            color: "#fb7185",
            pct: Math.min(100, (kpis.expenses / incomeSource) * 100),
          });
        if (kpis.investments > 0)
          segments.push({
            label: "Inversiones",
            amount: kpis.investments,
            color: "#60a5fa",
            pct: Math.min(100, (kpis.investments / incomeSource) * 100),
          });
        if (savedAmount > 0)
          segments.push({
            label: "Ahorro",
            amount: savedAmount,
            color: "#34d399",
            pct: Math.min(100, (savedAmount / incomeSource) * 100),
          });
      }

      const usedPct = segments.reduce((s, seg) => s + seg.pct, 0);

      // SVG donut for the right panel
      const donutRadius = 70;
      const donutCircumference = 2 * Math.PI * donutRadius;
      let donutOffset = 0;

      return (
        <div className="relative h-full w-full overflow-hidden">
          {/* Multi-layer glow background — fixed to fill the viewport */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <div
              className="absolute top-[20%] left-[15%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[150px] opacity-60"
              style={{ background: closing.glowColor }}
            />
            <div
              className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full blur-[130px] opacity-40"
              style={{ background: closing.glowColor }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full blur-[100px] opacity-30"
              style={{ background: closing.accent }}
            />
          </div>

          {/* Desktop: two-column layout / Mobile: stacked */}
          <div className="relative h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 px-6 md:px-12 lg:px-20 py-12" style={{ zIndex: 1 }}>

            {/* LEFT: Mood + subtitle */}
            <div className="flex flex-col items-center md:items-start gap-4 md:flex-1 md:max-w-md">
              <motion.h1
                className="text-6xl md:text-8xl lg:text-9xl font-bold text-white tracking-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, type: "spring", stiffness: 100 }}
              >
                {closing.word}
              </motion.h1>

              <motion.div
                className="h-1 rounded-full"
                style={{ backgroundColor: closing.accent }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 64, opacity: 0.7 }}
                transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              />

              <motion.p
                className="text-white/50 text-sm md:text-base leading-relaxed text-center md:text-left max-w-[300px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                {closing.subtitle}
              </motion.p>

              <motion.p
                className="text-white/15 text-[10px] md:text-xs capitalize tracking-wider mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {format(month, "MMMM yyyy", { locale: es })}
              </motion.p>

              <motion.button
                className="mt-2 px-6 py-2.5 rounded-full text-white/50 text-xs font-medium hover:bg-white/5 transition-colors"
                style={{ border: `1px solid ${closing.accent}40` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
              >
                Cerrar
              </motion.button>
            </div>

            {/* RIGHT: Visual breakdown */}
            <motion.div
              className="flex flex-col gap-6 w-full md:flex-1 md:max-w-lg"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {/* Donut + metric cards row */}
              <div className="flex items-center gap-6 md:gap-8">
                {/* Donut chart */}
                <motion.div
                  className="shrink-0"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                >
                  <svg width="160" height="160" viewBox="0 0 180 180" className="w-28 h-28 md:w-40 md:h-40">
                    {/* Background ring */}
                    <circle
                      cx="90" cy="90" r={donutRadius}
                      fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14"
                    />
                    {/* Segments */}
                    {segments.map((seg, i) => {
                      const segLength = (seg.pct / 100) * donutCircumference;
                      const currentOffset = donutOffset;
                      donutOffset += segLength;
                      return (
                        <motion.circle
                          key={seg.label}
                          cx="90" cy="90" r={donutRadius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="14"
                          strokeLinecap="butt"
                          strokeDasharray={`${segLength} ${donutCircumference - segLength}`}
                          strokeDashoffset={-currentOffset}
                          className="-rotate-90 origin-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                        />
                      );
                    })}
                    {/* Center text */}
                    <text x="90" y="84" textAnchor="middle" className="fill-white/70 text-[11px] font-medium">
                      {kpis.savingsRate >= 0 ? "Ahorro" : "D\u00e9ficit"}
                    </text>
                    <text
                      x="90" y="104" textAnchor="middle"
                      className="text-[16px] font-bold font-mono"
                      fill={savedAmount >= 0 ? "#34d399" : "#fb7185"}
                    >
                      {kpis.savingsRate.toFixed(0)}%
                    </text>
                  </svg>
                </motion.div>

                {/* Metric cards */}
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  {/* Income card */}
                  {incomeSource > 0 && (
                    <motion.div
                      className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 md:p-4"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.4 }}
                    >
                      <span className="text-white/35 text-[10px] md:text-[11px] uppercase tracking-wider">
                        {salary > 0 ? "Sueldo" : "Ingresos"}
                      </span>
                      <p className="text-emerald-400 text-lg md:text-xl font-bold font-mono tabular-nums mt-0.5">
                        {formatCurrency(incomeSource)}
                      </p>
                    </motion.div>
                  )}

                  {/* Balance card */}
                  <motion.div
                    className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 md:p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85, duration: 0.4 }}
                  >
                    <span className="text-white/35 text-[10px] md:text-[11px] uppercase tracking-wider">
                      {savedAmount >= 0 ? "Ahorraste" : "D\u00e9ficit"}
                    </span>
                    <p
                      className="text-lg md:text-xl font-bold font-mono tabular-nums mt-0.5"
                      style={{ color: savedAmount >= 0 ? "#34d399" : "#fb7185" }}
                    >
                      {savedAmount >= 0 ? "+" : ""}
                      {formatCurrency(savedAmount)}
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Full-width stacked bar */}
              {segments.length > 0 && (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <span className="text-white/30 text-[10px] md:text-[11px] uppercase tracking-wider">
                    Distribuci&oacute;n del ingreso
                  </span>
                  <div className="h-4 md:h-5 rounded-full bg-white/[0.04] overflow-hidden flex">
                    {segments.map((seg, i) => (
                      <motion.div
                        key={seg.label}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{ backgroundColor: seg.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${usedPct > 0 ? (seg.pct / usedPct) * 100 : 0}%`,
                        }}
                        transition={{
                          delay: 1.2 + i * 0.15,
                          duration: 0.8,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  </div>

                  {/* Legend row */}
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {segments.map((seg, i) => (
                      <motion.div
                        key={seg.label}
                        className="flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 + i * 0.1 }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-white/50 text-[11px] md:text-xs">
                          {seg.label}
                        </span>
                        <span
                          className="text-[11px] md:text-xs font-bold font-mono tabular-nums"
                          style={{ color: seg.color }}
                        >
                          {formatCurrency(seg.amount)}
                        </span>
                        <span className="text-white/25 text-[10px] font-mono">
                          {seg.pct.toFixed(0)}%
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      );
    },
  });

  const totalSlides = slides.length;

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev < totalSlides - 1) {
        setDirection(1);
        return prev + 1;
      }
      return prev;
    });
  }, [totalSlides]);

  const goBack = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev > 0) {
        setDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
      setDirection(1);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goBack, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 40 : -40,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -40 : 40,
    }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] bg-[#0a0a0b] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-4 pt-4">
            {slides.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-white/40 rounded-full"
                  initial={false}
                  animate={{ width: i <= currentSlide ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-white/40" />
          </button>

          {/* Slide content */}
          <div
            className="flex-1 flex items-center justify-center cursor-pointer select-none"
            onClick={goNext}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={slides[currentSlide].id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className={`w-full h-full flex items-center justify-center ${
                  slides[currentSlide].id === "closing" ? "" : "px-6"
                }`}
              >
                {slides[currentSlide].render()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center gap-1.5 pb-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(i > currentSlide ? 1 : -1);
                  setCurrentSlide(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentSlide
                    ? "bg-white/60 w-4"
                    : "bg-white/15 hover:bg-white/25 w-1.5"
                }`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
