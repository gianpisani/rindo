import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import {
  useRealFlows,
  computeRealFlows,
  computeRealBalance,
  SWEEP_ALERT_THRESHOLD,
  type RealFlowsConfig,
} from "@/hooks/useRealFlows";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
  Eye,
  Play,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthlyStory } from "@/components/MonthlyStory";
import { LearningNudge } from "@/components/learning/LearningNudge";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCategoryIcon } from "@/components/TransactionsTable";
const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openProfileEdit } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const bankSync = useBankSyncContext();
  const { profile: userProfile, avatarUrl } = useUserProfile();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const displayName = userProfile?.nickname || userProfile?.full_name || null;
  const greetingInitials = (displayName || "").slice(0, 2).toUpperCase();

  const handleQuickAdd = (type: "Ingreso" | "Gasto" | "Inversión" | "Reembolso") => {
    openQuickAdd(type);
  };

  // Calcular stats del mes actual — flujos reales (ingreso con sueldo-shift,
  // consumo neto de reembolsos, sin tránsito)
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);

  const lastMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= lastMonthStart && date <= lastMonthEnd;
  });

  const { budget } = useMonthlyBudget();
  const flowConfig = useMemo<Partial<RealFlowsConfig>>(
    () => ({ splurgeCategories: budget?.splurge_categories ?? [] }),
    [budget?.splurge_categories]
  );
  const currentFlows = useRealFlows(transactions, now, flowConfig);
  const lastMonthFlows = useMemo(
    () => computeRealFlows(transactions, lastMonth, flowConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, lastMonth.getFullYear(), lastMonth.getMonth(), flowConfig]
  );

  const currentIncome = currentFlows.ingresoReal;
  const currentExpenses = currentFlows.consumoNeto;
  const currentInvestments = currentFlows.invertido;
  const lastMonthExpenses = lastMonthFlows.consumoNeto;
  const lastMonthIncome = lastMonthFlows.ingresoReal;

  // Balance total real: excluye tránsito y su devolución tagueada
  const totalBalance = useMemo(() => computeRealBalance(transactions), [transactions]);

  // Detector de sweep: mes cerrado con ahorro sin invertir, visible los
  // primeros días del mes (solo si el usuario ya opera con meta de ahorro)
  const sweepAlert = useMemo(() => {
    if (!budget?.savings_goal || now.getDate() > 7) return null;
    if (lastMonthFlows.consumoBruto === 0 && lastMonthFlows.ingresoReal === 0)
      return null;
    const saved = lastMonthFlows.ingresoReal - lastMonthFlows.consumoNeto;
    const gap = saved - lastMonthFlows.invertido;
    return gap > SWEEP_ALERT_THRESHOLD ? { amount: gap } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget?.savings_goal, lastMonthFlows]);

  const expenseChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;
  const incomeChange = lastMonthIncome > 0
    ? ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100
    : 0;

  // Current month summary for donut chart
  const currentMonthSummary = useMonthlySummary(transactions, categories, limits, now);

  // Category insights
  const { insights: currentInsights, categorySpending } = useCategoryInsights(
    transactions,
    limits,
    now
  );

  // Last month data for Monthly Story
  const lastMonthSummary = useMonthlySummary(transactions, categories, limits, lastMonth);
  const hasLastMonthData = lastMonthSummary.transactionCount > 0;
  const { insights: lastMonthInsights } = useCategoryInsights(transactions, limits, lastMonth);

  // Salary for last month (Sueldo category in income)
  const lastMonthSalary = useMemo(() => {
    return lastMonthTransactions
      .filter((t) => t.type === "Ingreso" && t.category_name.toLowerCase() === "sueldo")
      .reduce((s, t) => s + Number(t.amount), 0);
  }, [lastMonthTransactions]);

  // Los gastos del mes, de mayor a menor. Sin agrupar en "Otros": la lista
  // muestra las que caben y el header dice cuántas quedaron fuera.
  const topCategories = currentMonthSummary.categoryBreakdown.slice(0, 5);
  const monthExpenses = currentMonthSummary.categoryBreakdown.reduce(
    (s, c) => s + c.amount,
    0
  );
  const hiddenCategories = currentMonthSummary.categoryBreakdown.length - topCategories.length;

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);

  function getCatEmoji(categoryName: string) {
    const cat = categories.find((c) => c.name === categoryName);
    return cat?.icon || getCategoryIcon(categoryName);
  }

  // Últimas 40 transacciones agrupadas por fecha
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);

  const groupedTransactions = recentTransactions.reduce((acc, t) => {
    const key = format(new Date(t.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, typeof recentTransactions>);

  const sortedDateKeys = Object.keys(groupedTransactions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday(d)) return "Hoy";
    if (isYesterday(d)) return "Ayer";
    return format(d, "d MMM", { locale: es });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Insights — el tipo elige el tono, la fila elige con cuánta fuerza se
  // muestra. Guardamos el token crudo (triplete OKLCH) en vez de un color
  // cerrado: así la misma constante sirve para el lomo a fuerza completa,
  // el relleno translúcido y el borde, sin repetir el color en ningún lado.
  const insightTone: Record<string, string> = {
    alert: "var(--insight-alert)",
    achievement: "var(--insight-achievement)",
    opportunity: "var(--insight-opportunity)",
    pattern: "var(--insight-pattern)",
  };

  // ─── Balance Card (shared between mobile/desktop) ─────
  const balanceCard = (
    <Card className="border-border/50 flex flex-col overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-4 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Balance Total</span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums capitalize">
            {format(now, "MMMM yyyy", { locale: es })}
          </span>
        </div>
        <div className={cn("mt-1.5 md:mt-2 text-[28px] md:text-4xl font-bold font-mono tabular-nums tracking-tight leading-none", isPrivacyMode && "privacy-blur")}>
          $<NumberFlow
            value={totalBalance}
            format={{
              style: "decimal",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }}
            locales="es-CL"
          />
        </div>
        <div className="mt-2.5 pt-2.5 md:mt-3 md:pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 md:gap-6 flex-wrap">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-success shrink-0" />
              <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                ${new Intl.NumberFormat("es-CL").format(currentIncome)}
              </span>
              {incomeChange !== 0 && (
                <span className={cn(
                  "text-[9px] md:text-[10px]",
                  incomeChange > 0 ? "text-success" : "text-destructive",
                  isPrivacyMode && "privacy-blur"
                )}>
                  {incomeChange > 0 ? "+" : ""}{Math.round(incomeChange)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
              <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                ${new Intl.NumberFormat("es-CL").format(currentExpenses)}
              </span>
              {expenseChange !== 0 && (
                <span className={cn(
                  "text-[9px] md:text-[10px]",
                  expenseChange > 0 ? "text-destructive" : "text-success",
                  isPrivacyMode && "privacy-blur"
                )}>
                  {expenseChange > 0 ? "+" : ""}{Math.round(expenseChange)}%
                </span>
              )}
            </div>
            {currentInvestments > 0 && (
              <div className="flex items-center gap-1">
                <PiggyBank className="h-3 w-3 text-blue shrink-0" />
                <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                  ${new Intl.NumberFormat("es-CL").format(currentInvestments)}
                </span>
              </div>
            )}
          </div>
          {(lastMonthIncome > 0 || lastMonthExpenses > 0) && (
            <p className={cn(
              "text-[10px] text-muted-foreground font-mono tabular-nums mt-1.5 md:mt-2",
              isPrivacyMode && "privacy-blur"
            )}>
              <span className="capitalize">{format(lastMonth, "MMM", { locale: es })}</span>
              <span className="mx-1 text-muted-foreground/40">&middot;</span>
              <span className="text-success/80">+{formatCurrency(lastMonthIncome)}</span>
              <span className="mx-1 text-muted-foreground/40">&middot;</span>
              <span className="text-destructive/80">&minus;{formatCurrency(lastMonthExpenses)}</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );

  // ─── Quick Actions (shared) ───────────────────────────
  const quickActions = (
    <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 md:gap-2">
      <Button
        onClick={() => handleQuickAdd("Ingreso")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-success/30 dark:border-success/20 text-success hover:bg-success/10 hover:border-success/40 hover:shadow-sm bg-transparent transition-all"
      >
        <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Ingreso</span>
      </Button>
      <Button
        onClick={() => handleQuickAdd("Gasto")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-destructive/30 dark:border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/40 hover:shadow-sm bg-transparent transition-all"
      >
        <TrendingDown className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Gasto</span>
      </Button>
      <Button
        onClick={() => handleQuickAdd("Inversión")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-blue/30 dark:border-blue/20 text-blue hover:bg-blue/10 hover:border-blue/40 hover:shadow-sm bg-transparent transition-all"
      >
        <PiggyBank className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Inversión</span>
      </Button>
      <Button
        onClick={() => setIsBankSyncOpen(true)}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-primary/30 dark:border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 hover:shadow-sm bg-transparent transition-all group overflow-hidden"
      >
        <div className="flex items-center justify-center h-4 md:h-5">
          <div className="flex -space-x-1.5 md:-space-x-[6px]">
            {["/banks/bchile.png", "/banks/santander.png", "/banks/bci.png", "/banks/bestado.png", "/banks/itau.png"].map((logo, i) => (
              <img
                key={logo}
                src={logo}
                alt=""
                className="size-4 md:size-5 rounded-full ring-[1.5px] ring-card object-contain bg-card"
                style={{ zIndex: 5 - i }}
              />
            ))}
          </div>
        </div>
        <span className="text-[10px] md:text-xs font-semibold">Sincronizar</span>
      </Button>
    </div>
  );

  // ─── Gastos del mes (desktop top row) ──────────────────
  // El donut no mostraba un solo número y dejaba media tarjeta vacía. Acá
  // cada categoría es una fila cuyo fondo mide lo que pesa, y las filas se
  // reparten el alto disponible: con dos categorías o con cinco, la tarjeta
  // se ve igual de llena.
  const expensesCard = (
    <Card className="border-border/50 flex h-full flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Gastos del mes
        </span>
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tabular-nums",
            isPrivacyMode && "privacy-blur"
          )}
        >
          {formatCurrency(monthExpenses)}
        </span>
      </div>

      {topCategories.length === 0 ? (
        <div className="flex flex-1 items-center justify-center pb-3">
          <p className="text-xs text-muted-foreground">Sin gastos este mes</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 pb-3">
          {topCategories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => navigate("/budget")}
              className="group relative flex min-h-[24px] flex-1 items-center gap-2 overflow-hidden rounded-md px-2 text-left"
            >
              {/* El peso de la categoría es el fondo de su fila */}
              <div
                className="absolute inset-y-0 left-0 rounded-l-md transition-[width] duration-700 ease-out group-hover:opacity-90"
                style={{
                  width: `${Math.max(cat.percentage, 1.5)}%`,
                  backgroundColor: cat.color,
                  opacity: 0.17,
                }}
              />
              <div
                className="absolute inset-y-0 left-0 w-[2px]"
                style={{ backgroundColor: cat.color }}
              />
              <span className="relative min-w-0 flex-1 truncate text-[11px]">
                {getCatEmoji(cat.category)} {cat.category}
              </span>
              <span
                className={cn(
                  "relative shrink-0 font-mono text-[11px] font-medium tabular-nums",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {formatCurrency(cat.amount)}
              </span>
              <span className="relative w-7 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {Math.round(cat.percentage)}%
              </span>
            </button>
          ))}
          {hiddenCategories > 0 && (
            <p className="shrink-0 pl-2 pt-0.5 text-[10px] text-muted-foreground/70">
              +{hiddenCategories} categoría{hiddenCategories === 1 ? "" : "s"} más
            </p>
          )}
        </div>
      )}
    </Card>
  );

  // ─── Insights: el tablero de límites ──────────────────
  // Seis frases que decían lo mismo ("Bien hecho en X, te quedan $Y") eran
  // seis veces la misma información. Una categoría es una fila, no un
  // párrafo: el nombre, cuánto va de cuánto, y el avance. Diecisiete
  // insights caben en la altura donde antes entraban seis.
  const budgetRows = categorySpending
    .filter((c) => c.limit && c.limit > 0)
    .map((c) => ({
      ...c,
      usage: (c.effectiveAmount / (c.limit as number)) * 100,
    }))
    .sort((a, b) => b.usage - a.usage);

  const budgetSpent = budgetRows.reduce((s, c) => s + c.effectiveAmount, 0);
  const budgetTotal = budgetRows.reduce((s, c) => s + (c.limit as number), 0);

  // Arriba del tablero, la única frase que sigue mereciendo ser frase: lo
  // que pasa a llevar un límite o cambió de golpe. Las felicitaciones no.
  const headlineRank: Record<string, number> = {
    alert: 0,
    pattern: 1,
    opportunity: 2,
    achievement: 9,
  };
  const rankOf = (i: (typeof currentInsights)[number]) =>
    (i.percentage ?? 0) > 100 ? -1 : headlineRank[i.type] ?? 5;
  const headline = [...currentInsights]
    .filter((i) => i.type !== "achievement")
    .sort((a, b) => rankOf(a) - rankOf(b))[0];

  const usageTone = (usage: number, alertAt?: number) => {
    if (usage > 100) return "var(--insight-danger)";
    if (usage >= (alertAt ?? 80)) return "var(--insight-alert)";
    if (usage > 0) return "var(--insight-achievement)";
    return null;
  };

  const insightsPanel = (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Límites</h2>
          {budgetRows.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {budgetRows.length}
            </span>
          )}
        </div>
        {budgetTotal > 0 && (
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums text-muted-foreground",
              isPrivacyMode && "privacy-blur"
            )}
          >
            <span className="font-semibold text-foreground">
              {formatCurrency(budgetSpent)}
            </span>{" "}
            de {formatCurrency(budgetTotal)}
          </span>
        )}
      </div>

      {/* La frase que sí es un insight */}
      {headline && (
        <div className="shrink-0 px-4 pb-2">
          <div
            className="flex items-start gap-2 rounded-lg border px-2.5 py-2"
            style={{
              borderColor: `oklch(${
                (headline.percentage ?? 0) > 100
                  ? "var(--insight-danger)"
                  : insightTone[headline.type] ?? insightTone.pattern
              } / 0.3)`,
              backgroundColor: `oklch(${
                (headline.percentage ?? 0) > 100
                  ? "var(--insight-danger)"
                  : insightTone[headline.type] ?? insightTone.pattern
              } / 0.07)`,
            }}
          >
            <span className="shrink-0 text-[13px] leading-tight">
              {headline.category ? getCatEmoji(headline.category) : "💡"}
            </span>
            <p className="min-w-0 text-[11px] leading-snug">
              <span className="font-semibold">{headline.title}</span>
              <span
                className={cn(
                  "text-muted-foreground",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {" · "}
                {headline.description}
              </span>
            </p>
          </div>
        </div>
      )}

      {budgetRows.length === 0 ? (
        <button
          onClick={() => navigate("/budget")}
          className="flex flex-1 flex-col items-center justify-center gap-1 px-4 pb-4 text-center transition-colors hover:bg-muted/30"
        >
          <p className="text-xs font-medium">Aún no pones límites</p>
          <p className="text-[11px] text-muted-foreground">
            Ponle un techo a una categoría y aparece acá
          </p>
        </button>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
          {budgetRows.map((cat) => {
            const usage = cat.usage;
            const tone = usageTone(usage, cat.alertPercentage);
            const filled = Math.min(usage, 100);

            return (
              <button
                key={cat.category}
                onClick={() => navigate("/budget")}
                className="group relative flex min-h-[44px] flex-1 flex-col justify-center gap-1 rounded-t-md px-2 pb-2.5 pt-1.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-[13px] leading-none">
                    {getCatEmoji(cat.category)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {cat.category}
                  </span>
                  <span
                    className="shrink-0 font-mono text-xs font-semibold tabular-nums"
                    style={{ color: tone ? `oklch(${tone})` : undefined }}
                  >
                    {Math.round(usage)}%
                  </span>
                </div>
                <p
                  className={cn(
                    "pl-6 font-mono text-[10px] tabular-nums text-muted-foreground",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCurrency(cat.effectiveAmount)} de{" "}
                  {formatCurrency(cat.limit as number)}
                  {/* La barra se queda en 100%: el exceso lo dice el texto,
                      que es donde un 101% y un 180% se distinguen. */}
                  {usage > 100 && (
                    <span
                      className="ml-1 font-semibold"
                      style={{ color: "oklch(var(--insight-danger))" }}
                    >
                      +{formatCurrency(cat.effectiveAmount - (cat.limit as number))}
                    </span>
                  )}
                </p>
                {/* El separador de la fila ES la barra: siempre visible,
                    siempre en el borde, y no gasta una línea extra. */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-full"
                  style={{
                    backgroundColor:
                      "color-mix(in oklch, var(--muted-foreground) 22%, transparent)",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      // Un 1% tiene que dejar marca: si no, la fila miente.
                      width: usage > 0 ? `max(3px, ${filled}%)` : "0%",
                      backgroundColor: tone
                        ? `oklch(${tone})`
                        : "var(--muted-foreground)",
                      boxShadow: tone ? `0 0 8px oklch(${tone} / 0.55)` : undefined,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  // ─── Transactions Card (shared) ───────────────────────
  const transactionsCard = (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Recientes</h2>
          {recentTransactions.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {recentTransactions.length}
            </span>
          )}
        </div>
        <Button
          onClick={() => navigate("/transactions")}
          variant="ghost"
          size="sm"
          className="gap-1 text-[11px] h-6 px-2 -mr-1"
        >
          Ver todo
          <Eye className="h-3 w-3" />
        </Button>
      </div>

      {isLoading ? (
        <div className="px-5 pb-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-[3px] h-[28px] rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : recentTransactions.length === 0 ? (
        <div className="py-14 text-center px-5 pb-5">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-muted/50 mb-4">
            <Receipt className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No hay transacciones aún</p>
          <p className="text-xs text-muted-foreground mt-1">Agrega tu primera transacción arriba</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 pb-2">
          {sortedDateKeys.map((dateKey) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 px-5 py-1.5 sticky top-0 bg-card z-10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.1)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {getDateLabel(dateKey)}
                </span>
                <div className="h-px bg-border/40 flex-1" />
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {groupedTransactions[dateKey].length}
                </span>
              </div>
              {groupedTransactions[dateKey].map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 pl-5 pr-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "w-[3px] h-[28px] rounded-full flex-shrink-0",
                      t.type === "Ingreso" && "bg-success",
                      t.type === "Gasto" && "bg-destructive",
                      t.type === "Inversión" && "bg-blue"
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium truncate leading-snug", isPrivacyMode && "privacy-blur")}>
                        {t.category_name}
                      </p>
                      {t.detail && (
                        <p className={cn("text-xs text-muted-foreground truncate leading-snug", isPrivacyMode && "privacy-blur")}>
                          {t.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold font-mono tabular-nums ml-4 flex-shrink-0",
                    t.type === "Ingreso" && "text-success",
                    t.type === "Gasto" && "text-destructive",
                    t.type === "Inversión" && "text-blue",
                    isPrivacyMode && "privacy-blur"
                  )}>
                    {t.type === "Ingreso" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-4">
        {/* Greeting — compact */}
        <div className="flex items-center gap-2.5">
          {displayName && (
            <button onClick={() => openProfileEdit()} className="focus:outline-none group">
              <div className="rounded-full p-[2px] accent-gradient-bg transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_16px_var(--primary)]">
                <Avatar className="size-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                  <AvatarFallback className="bg-background text-primary text-xs font-semibold">
                    {greetingInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight">
            {getGreeting()}{displayName ? <>, <span className="animated-gradient-text">{displayName}</span></> : ""}
          </h1>
        </div>

        {/* ─── Recordatorio: días sin una sesión de aprendizaje ─── */}
        <LearningNudge />

        {/* ─── Card de sweep: ahorro del mes pasado sin invertir ─── */}
        {sweepAlert && (
          <button
            onClick={() => navigate("/budget")}
            className="w-full text-left rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 flex items-center gap-3 hover:bg-amber-500/10 transition-colors native-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <div className="flex items-center justify-center size-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-500 shrink-0">
              <PiggyBank className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Te quedó plata sin invertir</p>
              <p className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                Cerraste{" "}
                <span className="capitalize">
                  {format(lastMonth, "MMMM", { locale: es })}
                </span>{" "}
                con{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {formatCompact(sweepAlert.amount)}
                </span>{" "}
                ahorrados que no barriste a inversión.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* ─── MOBILE LAYOUT (< lg) ─── */}
        {/* 100dvh minus: header 56px + main-padding 16px + greeting ~36px + gap 16px + bottom-padding 112px */}
        <div className="lg:hidden flex flex-col gap-3" style={{ height: "calc(100dvh - 236px)" }}>
          {/* Balance + Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-[3fr,2fr] gap-3 shrink-0">
            {balanceCard}
            {quickActions}
          </div>
          {/* Transactions — scrolls internally */}
          <div className="flex-1 min-h-0">
            {transactionsCard}
          </div>
          {/* Monthly Story — always visible at bottom */}
          {hasLastMonthData && (
            <button
              onClick={() => setStoryOpen(true)}
              className="shrink-0 w-full group relative overflow-hidden rounded-xl border border-border/50 px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <Play className="h-3.5 w-3.5 ml-0.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold capitalize leading-tight">
                      Resumen de {format(lastMonth, "MMMM", { locale: es })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {lastMonthSummary.transactionCount} transacciones
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          )}
        </div>

        {/* ─── DESKTOP LAYOUT (lg+) ─── */}
        <div className="hidden lg:block space-y-3">
          {/* Top row: Balance | Donut | Quick Actions */}
          <div className="grid grid-cols-12 gap-3 items-stretch">
            <div className="col-span-5">{balanceCard}</div>
            <div className="col-span-3 min-h-0">{expensesCard}</div>
            <div className="col-span-4">{quickActions}</div>
          </div>

          {/* Bottom row: Transactions | Insights + Wrapped — fills remaining viewport */}
          <div className="grid grid-cols-12 gap-3 items-stretch" style={{ height: "calc(100vh - 340px)", minHeight: 260 }}>
            <div className="col-span-8 min-h-0">{transactionsCard}</div>
            <div className="col-span-4 min-h-0 flex flex-col gap-3">
              <div className="flex-1 min-h-0">{insightsPanel}</div>
              {hasLastMonthData && (
                <button
                  onClick={() => setStoryOpen(true)}
                  className="shrink-0 group relative overflow-hidden rounded-xl border border-border/50 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Subtle animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                      <Play className="h-3.5 w-3.5 ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-none">
                        Resumen
                      </p>
                      <p className="text-sm font-bold capitalize leading-tight mt-0.5">
                        {format(lastMonth, "MMMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        <BankSyncModal
          open={isBankSyncOpen}
          onOpenChange={setIsBankSyncOpen}
          syncStep={bankSync.step}
          pollStatus={bankSync.pollStatus}
          result={bankSync.result}
          onStart={bankSync.startSync}
          onStartStored={bankSync.startSyncStored}
          onImportSkipped={bankSync.importSkipped}
          onDeleteImported={bankSync.deleteImported}
          onReset={bankSync.reset}
        />

      </div>

      <MonthlyStory
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        month={lastMonth}
        kpis={lastMonthSummary.kpis}
        categoryBreakdown={lastMonthSummary.categoryBreakdown}
        dailyStats={lastMonthSummary.dailyStats}
        transactionCount={lastMonthSummary.transactionCount}
        salary={lastMonthSalary}
        insights={lastMonthInsights}
      />
    </Layout>
  );
};

export default Index;
