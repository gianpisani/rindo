import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(value);

function getMood(savingsRate: number) {
  if (savingsRate > 50)
    return {
      word: "Impecable",
      gradient: "from-emerald-500/20 via-emerald-600/10 to-transparent",
    };
  if (savingsRate > 20)
    return {
      word: "S\u00f3lido",
      gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
    };
  if (savingsRate > 0)
    return {
      word: "En control",
      gradient: "from-amber-500/20 via-amber-600/10 to-transparent",
    };
  return {
    word: "A mejorar",
    gradient: "from-rose-500/20 via-rose-600/10 to-transparent",
  };
}

export function MonthlyStory({
  open,
  onClose,
  month,
  kpis,
  categoryBreakdown,
  dailyStats,
  transactionCount,
}: MonthlyStoryProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const topCategory = categoryBreakdown[0] || null;
  const mood = getMood(kpis.savingsRate);
  const totalMovement = kpis.income + kpis.expenses + kpis.investments;

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

  // 2 - Total Movement
  slides.push({
    id: "movement",
    render: () => (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <motion.p
          className="text-white/40 text-sm tracking-wider uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          Este mes moviste
        </motion.p>
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        >
          <div className="absolute inset-0 blur-3xl bg-primary/10 rounded-full scale-150" />
          <p className="relative text-4xl md:text-6xl font-bold text-white font-mono tabular-nums">
            {formatCurrency(totalMovement)}
          </p>
        </motion.div>
        <motion.p
          className="text-white/30 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          en {transactionCount} transacciones
        </motion.p>
      </div>
    ),
  });

  // 3 - Income vs Expenses
  slides.push({
    id: "comparison",
    render: () => {
      const maxVal = Math.max(kpis.income, kpis.expenses) || 1;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-8 w-full max-w-md mx-auto px-6">
          <motion.div
            className="w-full space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Income */}
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-emerald-400 text-sm font-medium">
                  Ingresos
                </span>
                <span className="text-emerald-400 text-2xl font-bold font-mono tabular-nums">
                  {formatCurrency(kpis.income)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(kpis.income / maxVal) * 100}%`,
                  }}
                  transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>

            {/* Expenses */}
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-rose-400 text-sm font-medium">
                  Gastos
                </span>
                <span className="text-rose-400 text-2xl font-bold font-mono tabular-nums">
                  {formatCurrency(kpis.expenses)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-rose-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(kpis.expenses / maxVal) * 100}%`,
                  }}
                  transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Balance */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
          >
            <span className="text-white/30 text-xs uppercase tracking-wider">
              Balance
            </span>
            <p
              className={`text-xl font-bold font-mono tabular-nums ${kpis.balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {kpis.balance >= 0 ? "+" : ""}
              {formatCurrency(kpis.balance)}
            </p>
          </motion.div>
        </div>
      );
    },
  });

  // 4 - Top Category
  if (topCategory) {
    slides.push({
      id: "top-category",
      render: () => (
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
              {formatCurrency(topCategory.amount)}
            </p>
            <p className="text-white/30 text-sm">
              {topCategory.percentage.toFixed(0)}% del total &middot;{" "}
              {topCategory.count} movimientos
            </p>
          </motion.div>
        </div>
      ),
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

  // 6 - Peak Day
  if (dailyStats.peakDay) {
    slides.push({
      id: "peak-day",
      render: () => (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <motion.p
            className="text-white/40 text-sm tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Tu d&iacute;a m&aacute;s caro
          </motion.p>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white capitalize mb-2">
              {dailyStats.peakDay.dayName} {dailyStats.peakDay.date}
            </h2>
            <p className="text-rose-400 text-2xl font-mono tabular-nums font-bold">
              {formatCurrency(dailyStats.peakDay.amount)}
            </p>
          </motion.div>
          <motion.p
            className="text-white/25 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            promedio diario: {formatCurrency(dailyStats.avgDaily)}
          </motion.p>
        </div>
      ),
    });
  }

  // 7 - Closing mood
  slides.push({
    id: "mood",
    render: () => (
      <div className="flex flex-col items-center justify-center h-full gap-6 relative">
        <div
          className={`absolute inset-0 bg-gradient-to-b ${mood.gradient} pointer-events-none`}
        />
        <motion.h1
          className="relative text-5xl md:text-7xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.6,
            type: "spring",
            stiffness: 200,
          }}
        >
          {mood.word}
        </motion.h1>
        <motion.p
          className="relative text-white/30 text-sm mt-4 capitalize"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {format(month, "MMMM yyyy", { locale: es })}
        </motion.p>
        <motion.button
          className="relative mt-8 px-6 py-2.5 rounded-full bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          Cerrar
        </motion.button>
      </div>
    ),
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
                className="w-full h-full flex items-center justify-center px-6"
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
