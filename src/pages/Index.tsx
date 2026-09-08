import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import NumberFlow from "@number-flow/react";
import {
  format,
  subMonths,
  getDate,
  getDaysInMonth,
  isToday,
  isYesterday,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
  Eye,
  Play,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import {
  useRealFlows,
  computeRealFlows,
  computeRealBalance,
  SWEEP_ALERT_THRESHOLD,
  type RealFlowsConfig,
} from "@/hooks/useRealFlows";

import { BankSyncModal } from "@/components/BankSyncModal";
import { MonthlyStory } from "@/components/MonthlyStory";
import { LearningNudge } from "@/components/learning/LearningNudge";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────
   Inicio
   ─────────────────────────────────────────────────────────────────────
   La página está armada como una grilla de línea de pelo: los paneles no
   flotan sobre el fondo, se topan entre sí y lo único que los separa es
   1px. El truco es que las líneas SON los gaps — el contenedor se pinta
   del color del borde y los hijos del color de la tarjeta. Así la misma
   perilla (--radius, --border) que endereza el resto de la app también
   junta esto, y no hay 40 bordes escritos a mano que se desincronicen.

   El único bloque invertido de la pantalla es la proyección: fondo de
   acento a fuerza completa y tinta oscura encima. Es el gesto de Wero y
   se gasta una sola vez, en el número que mira al futuro.
   ───────────────────────────────────────────────────────────────────── */

const MONTHS_BACK = 6;

const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const { budget } = useMonthlyBudget();
  const { isPrivacyMode } = usePrivacyMode();
  const { openQuickAdd, openProfileEdit } = useGlobalDrawers();
  const { profile: userProfile, avatarUrl } = useUserProfile();
  const bankSync = useBankSyncContext();
  const navigate = useNavigate();

  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);

  // Una sola fecha para toda la página: si se rehace en cada render, cada
  // useMemo de abajo recalcula seis meses de flujos por gusto.
  const now = useMemo(() => new Date(), []);
  const lastMonth = useMemo(() => subMonths(now, 1), [now]);

  const displayName = userProfile?.nickname || userProfile?.full_name || null;
  const greetingInitials = (displayName || "").slice(0, 2).toUpperCase();
  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, [now]);

  // ── Flujos reales ──────────────────────────────────────────────────
  const flowConfig = useMemo<Partial<RealFlowsConfig>>(
    () => ({ splurgeCategories: budget?.splurge_categories ?? [] }),
    [budget?.splurge_categories]
  );

  const currentFlows = useRealFlows(transactions, now, flowConfig);
  const lastMonthFlows = useMemo(
    () => computeRealFlows(transactions, lastMonth, flowConfig),
    [transactions, lastMonth, flowConfig]
  );

  const currentIncome = currentFlows.ingresoReal;
  const currentExpenses = currentFlows.consumoNeto;
  const currentInvestments = currentFlows.invertido;
  const monthBalance = currentIncome - currentExpenses;
  const totalBalance = useMemo(
    () => computeRealBalance(transactions),
    [transactions]
  );

  // ── Los meses anteriores, solo para el promedio ────────────────────
  // Antes esta serie alimentaba el gráfico de evolución; ese se fue a
  // Finanzas, que es donde se compara la historia. Acá queda porque el
  // balance del mes no dice nada suelto: dice algo contra su promedio.
  const priorMonths = useMemo(
    () =>
      Array.from({ length: MONTHS_BACK - 1 }, (_, i) => {
        const month = subMonths(now, MONTHS_BACK - 1 - i);
        const flows = computeRealFlows(transactions, month, flowConfig);
        return {
          ingresos: flows.ingresoReal,
          gastos: flows.consumoNeto,
          balance: flows.ingresoReal - flows.consumoNeto,
        };
      })
        // Un mes vacío no es un mes bueno: contarlo como 0 arrastraría el
        // promedio hacia arriba y el delta mentiría.
        .filter((m) => m.ingresos > 0 || m.gastos > 0),
    [transactions, now, flowConfig]
  );
  const avgPriorBalance = priorMonths.length
    ? priorMonths.reduce((s, m) => s + m.balance, 0) / priorMonths.length
    : null;
  const balanceDelta =
    avgPriorBalance !== null ? monthBalance - avgPriorBalance : null;

  // ── Proyección a fin de mes ────────────────────────────────────────
  // Se proyecta el gasto, no el ingreso: el sueldo entra una vez y
  // extrapolarlo por día lo multiplicaría por un mes entero.
  const dayOfMonth = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const daysLeft = daysInMonth - dayOfMonth;
  const projectedExpenses =
    dayOfMonth > 0 ? (currentExpenses / dayOfMonth) * daysInMonth : 0;
  const projectedBalance = currentIncome - projectedExpenses;
  const savingsGoal = budget?.savings_goal ?? null;
  const goalProgress =
    savingsGoal && savingsGoal > 0
      ? (projectedBalance / savingsGoal) * 100
      : null;

  const savingsRate =
    currentIncome > 0 ? (monthBalance / currentIncome) * 100 : null;
  const lastMonthSavingsRate =
    lastMonthFlows.ingresoReal > 0
      ? ((lastMonthFlows.ingresoReal - lastMonthFlows.consumoNeto) /
          lastMonthFlows.ingresoReal) *
        100
      : null;

  const lastMonthName = format(lastMonth, "MMMM", { locale: es });
  /** "−16,5% vs agosto", o null si el mes pasado no tiene con qué comparar. */
  const vsLastMonth = (current: number, previous: number) =>
    previous > 0
      ? `${current >= previous ? "+" : "−"}${Math.abs(
          Math.round(((current - previous) / previous) * 100)
        )}% vs ${lastMonthName}`
      : null;

  // ── Resúmenes e insights ───────────────────────────────────────────
  const { insights: currentInsights, categorySpending } = useCategoryInsights(
    transactions,
    limits,
    now
  );
  const lastMonthSummary = useMonthlySummary(
    transactions,
    categories,
    limits,
    lastMonth
  );
  const { insights: lastMonthInsights } = useCategoryInsights(
    transactions,
    limits,
    lastMonth
  );
  const hasLastMonthData = lastMonthSummary.transactionCount > 0;

  const lastMonthSalary = useMemo(() => {
    const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    return transactions
      .filter((t) => {
        const d = new Date(t.date);
        return (
          d >= start &&
          d <= end &&
          t.type === "Ingreso" &&
          t.category_name.toLowerCase() === "sueldo"
        );
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  }, [transactions, lastMonth]);

  // Aviso de barrido: el mes cerró con ahorro que no se invirtió.
  const sweepAlert = useMemo(() => {
    if (!budget?.savings_goal || dayOfMonth > 7) return null;
    if (lastMonthFlows.consumoBruto === 0 && lastMonthFlows.ingresoReal === 0)
      return null;
    const saved = lastMonthFlows.ingresoReal - lastMonthFlows.consumoNeto;
    const gap = saved - lastMonthFlows.invertido;
    return gap > SWEEP_ALERT_THRESHOLD ? { amount: gap } : null;
  }, [budget?.savings_goal, dayOfMonth, lastMonthFlows]);

  // ── Formato ────────────────────────────────────────────────────────
  const money = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);

  const getCatEmoji = (categoryName: string) =>
    categories.find((c) => c.name === categoryName)?.icon ||
    getCategoryIcon(categoryName);

  // ── El titular ─────────────────────────────────────────────────────
  // El tablero de insights se fue a Finanzas, pero una frase se queda: la
  // que avisa que algo se pasó de un límite o cambió de golpe. Las
  // felicitaciones no — un "bien hecho" no cambia lo que hacés hoy.
  const insightTone: Record<string, string> = {
    alert: "var(--insight-alert)",
    opportunity: "var(--insight-opportunity)",
    pattern: "var(--insight-pattern)",
  };
  const headlineRank: Record<string, number> = {
    alert: 0,
    pattern: 1,
    opportunity: 2,
  };
  const headline = useMemo(() => {
    const rankOf = (i: (typeof currentInsights)[number]) =>
      (i.percentage ?? 0) > 100 ? -1 : headlineRank[i.type] ?? 5;
    return [...currentInsights]
      .filter((i) => i.type !== "achievement")
      .sort((a, b) => rankOf(a) - rankOf(b))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInsights]);
  const headlineTone =
    headline && (headline.percentage ?? 0) > 100
      ? "var(--insight-danger)"
      : insightTone[headline?.type ?? "pattern"] ?? "var(--insight-pattern)";

  // ── Límites ────────────────────────────────────────────────────────
  const budgetRows = categorySpending
    .filter((c) => c.limit && c.limit > 0)
    .map((c) => ({ ...c, usage: (c.effectiveAmount / (c.limit as number)) * 100 }))
    .sort((a, b) => b.usage - a.usage);
  const budgetSpent = budgetRows.reduce((s, c) => s + c.effectiveAmount, 0);
  const budgetTotal = budgetRows.reduce((s, c) => s + (c.limit as number), 0);

  const usageTone = (usage: number, alertAt?: number) => {
    if (usage > 100) return "var(--insight-danger)";
    if (usage >= (alertAt ?? 80)) return "var(--insight-alert)";
    if (usage > 0) return "var(--insight-achievement)";
    return null;
  };

  // ── Movimientos recientes ──────────────────────────────────────────
  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 40),
    [transactions]
  );

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof recentTransactions> = {};
    for (const t of recentTransactions) {
      const key = format(new Date(t.date), "yyyy-MM-dd");
      (groups[key] ||= []).push(t);
    }
    return groups;
  }, [recentTransactions]);

  const sortedDateKeys = Object.keys(groupedTransactions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const dateLabel = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (isToday(d)) return "Hoy";
    if (isYesterday(d)) return "Ayer";
    return format(d, "d MMM", { locale: es });
  };

  // ── Acciones rápidas ───────────────────────────────────────────────
  const quickActions = [
    {
      label: "Ingreso",
      icon: TrendingUp,
      tone: "var(--insight-achievement)",
      onClick: () => openQuickAdd("Ingreso"),
    },
    {
      label: "Gasto",
      icon: TrendingDown,
      tone: "var(--insight-danger)",
      onClick: () => openQuickAdd("Gasto"),
    },
    {
      label: "Inversión",
      icon: PiggyBank,
      tone: "var(--insight-opportunity)",
      onClick: () => openQuickAdd("Inversión"),
    },
    {
      label: "Sincronizar",
      icon: null,
      tone: null,
      onClick: () => setIsBankSyncOpen(true),
    },
  ] as const;

  return (
    <Layout bleed>
      {/* Las alertas viven fuera de la grilla, con su propio padding. El
          contenedor se esconde solo cuando ninguna de las dos aparece
          (empty:hidden), así no deja un hueco arriba del balance. */}
      {/* ── LA PRIMERA PANTALLA ───────────────────────────────────
          Alto exacto: viewport menos el header (h-14 = 3.5rem). Las dos
          primeras filas miden lo que su contenido; la de gráficos absorbe
          todo lo que sobre. Así ni el contenido ni el tamaño de la ventana
          pueden empujar nada abajo del pliegue — no hay presupuesto de
          píxeles que adivinar. Debajo de lg no aplica: apilado en un
          teléfono esto no cabe ni forzándolo, y ahí el scroll es lo
          correcto. El min-h evita que en una ventana muy baja el gráfico
          quede convertido en una línea. */}
      <Screen>
        <div className="flex flex-col gap-3 p-4 pb-0 empty:hidden sm:p-5 sm:pb-0 lg:shrink-0">
          <LearningNudge />

          {sweepAlert && (
            <button
              onClick={() => navigate("/budget")}
              className="native-press flex w-full items-center gap-3 border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "oklch(var(--insight-alert) / 0.16)",
                  color: "oklch(var(--insight-alert))",
                }}
              >
                <PiggyBank className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="section-title text-sm">Te quedó plata sin invertir</p>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  Cerraste{" "}
                  <span className="capitalize">
                    {format(lastMonth, "MMMM", { locale: es })}
                  </span>{" "}
                  con{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {money(sweepAlert.amount)}
                  </span>{" "}
                  ahorrados que no barriste a inversión.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>

          {/* Fila 1 — el balance y el bloque invertido */}
          <Row className="lg:flex-[4_1_0%] lg:grid-cols-[1.35fr_1fr]">
            <Panel className="flex flex-col justify-center px-5 py-5 md:px-6">
              {/* El saludo entra acá en vez de gastar una fila propia: es
                  lo que le devuelve la primera pantalla al balance. */}
              <div className="flex min-w-0 items-center gap-2.5">
                {displayName && (
                  <button
                    onClick={() => openProfileEdit()}
                    className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Editar perfil"
                  >
                    <Avatar className="size-7 border border-border">
                      {avatarUrl && (
                        <AvatarImage src={avatarUrl} className="object-cover" />
                      )}
                      <AvatarFallback className="bg-muted text-[10px] font-semibold text-primary">
                        {greetingInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                )}
                <h1 className="truncate text-[13px] font-normal text-muted-foreground">
                  {greeting}
                  {displayName ? (
                    <>
                      ,{" "}
                      <span className="font-semibold text-foreground">
                        {displayName}
                      </span>
                    </>
                  ) : null}
                </h1>
              </div>

              <p className="eyebrow mt-4">Balance total</p>

              <div
                className={cn(
                  "mt-2 flex items-baseline gap-1.5 font-mono text-[34px] font-bold leading-none tracking-tight tabular-nums md:text-[50px]",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                <span className="text-[0.45em] text-muted-foreground">$</span>
                <NumberFlow
                  value={totalBalance}
                  format={{
                    style: "decimal",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }}
                  locales="es-CL"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="eyebrow">Este mes</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      monthBalance >= 0 ? "text-success" : "text-destructive",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {monthBalance >= 0 ? "+" : "−"}
                    {money(Math.abs(monthBalance))}
                  </span>
                </span>

                {balanceDelta !== null && priorMonths.length > 0 && (
                  <span className="inline-flex items-center gap-2 border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    {balanceDelta >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        balanceDelta >= 0 ? "text-success" : "text-destructive",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {balanceDelta >= 0 ? "+" : "−"}
                      {money(Math.abs(balanceDelta))}
                    </span>
                    <span>
                      sobre tu promedio de {priorMonths.length}{" "}
                      {priorMonths.length === 1 ? "mes" : "meses"}
                    </span>
                  </span>
                )}
              </div>
            </Panel>

            {/* El único bloque invertido: fondo de acento, tinta oscura.
                Los colores van inline porque --ink-on-accent no tiene
                utilidad de Tailwind: es el token de esta situación. */}
            <Panel
              className="flex flex-col justify-center px-5 py-5 md:px-6"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--ink-on-accent)",
              }}
            >
              <>
                <p
                  className="eyebrow"
                  style={{
                    color:
                      "color-mix(in oklch, var(--ink-on-accent) 65%, transparent)",
                  }}
                >
                  Proyección a fin de mes
                </p>
                <p
                  className={cn(
                    "mt-3 font-mono text-[26px] font-bold leading-none tracking-tight tabular-nums md:text-[34px]",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {projectedBalance >= 0 ? "" : "−"}
                  {money(Math.abs(projectedBalance))}
                </p>
                <p
                  className={cn(
                    "mt-2.5 text-xs",
                    isPrivacyMode && "privacy-blur"
                  )}
                  style={{
                    color:
                      "color-mix(in oklch, var(--ink-on-accent) 78%, transparent)",
                  }}
                >
                  {goalProgress !== null ? (
                    <>
                      {Math.round(goalProgress)}% de tu meta de{" "}
                      {money(savingsGoal as number)}
                      {daysLeft > 0
                        ? ` · faltan ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                        : " · último día del mes"}
                    </>
                  ) : (
                    <>
                      Gasto proyectado {money(projectedExpenses)}
                      {daysLeft > 0
                        ? ` · faltan ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                        : ""}
                    </>
                  )}
                </p>

                {goalProgress !== null ? (
                  <div
                    className="mt-4 h-2 overflow-hidden"
                    style={{
                      backgroundColor:
                        "color-mix(in oklch, var(--ink-on-accent) 22%, transparent)",
                    }}
                    role="img"
                    aria-label={`${Math.round(goalProgress)} por ciento de la meta de ahorro`}
                  >
                    <div
                      className="h-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${Math.max(0, Math.min(goalProgress, 100))}%`,
                        backgroundColor: "var(--ink-on-accent)",
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => navigate("/budget")}
                    className="mt-4 self-start border px-2.5 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
                    style={{
                      borderColor:
                        "color-mix(in oklch, var(--ink-on-accent) 40%, transparent)",
                      color: "var(--ink-on-accent)",
                    }}
                  >
                    Ponle una meta de ahorro
                  </button>
                )}
              </>
            </Panel>
          </Row>

          {/* Fila 2 — los cuatro indicadores */}
          <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
            <Panel className="px-4 py-3.5 md:px-5">
              <p className="eyebrow">Ingresos</p>
              <p
                className={cn(
                  "mt-2 font-mono text-lg font-bold tracking-tight tabular-nums text-success md:text-xl",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {money(currentIncome)}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] text-muted-foreground",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {vsLastMonth(currentIncome, lastMonthFlows.ingresoReal) ??
                  (currentIncome > 0 ? "Ingreso real" : "Sin ingresos aún")}
              </p>
            </Panel>

            <Panel className="px-4 py-3.5 md:px-5">
              <p className="eyebrow">Gastos</p>
              <p
                className={cn(
                  "mt-2 font-mono text-lg font-bold tracking-tight tabular-nums text-destructive md:text-xl",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {money(currentExpenses)}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] text-muted-foreground",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {vsLastMonth(currentExpenses, lastMonthFlows.consumoNeto) ??
                  "Neto de reembolsos"}
              </p>
            </Panel>

            <Panel className="px-4 py-3.5 md:px-5">
              <p className="eyebrow">Inversión</p>
              <p
                className={cn(
                  "mt-2 font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl",
                  isPrivacyMode && "privacy-blur"
                )}
                style={{ color: "oklch(var(--insight-opportunity))" }}
              >
                {money(currentInvestments)}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] text-muted-foreground",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {currentInvestments > 0
                  ? (vsLastMonth(currentInvestments, lastMonthFlows.invertido) ??
                    "Barrido este mes")
                  : "Nada barrido todavía"}
              </p>
            </Panel>

            <Panel className="px-4 py-3.5 md:px-5">
              <p className="eyebrow">Tasa de ahorro</p>
              <p
                className={cn(
                  "mt-2 font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {savingsRate === null
                  ? "—"
                  : `${new Intl.NumberFormat("es-CL", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(savingsRate)}%`}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] text-muted-foreground",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {savingsRate === null
                  ? "Necesita un ingreso"
                  : lastMonthSavingsRate !== null
                    ? `${lastMonthName}: ${new Intl.NumberFormat("es-CL", {
                        maximumFractionDigits: 1,
                      }).format(lastMonthSavingsRate)}%`
                    : "De lo que entró este mes"}
              </p>
            </Panel>
          </Row>

          {/* Fila 3 — los verbos. Bloques planos, como los de Wero, y en
              una sola línea: apilados eran otra franja de 90px entre los
              indicadores y el contenido, y son atajos, no una sección. */}
          <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="native-press flex items-center justify-center gap-2.5 bg-card px-3 py-3.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  style={
                    action.tone ? { color: `oklch(${action.tone})` } : undefined
                  }
                >
                  {Icon ? (
                    <Icon className="h-4 w-4 shrink-0" />
                  ) : (
                    <div className="flex h-4 shrink-0 items-center -space-x-1.5">
                      {[
                        "/banks/bchile.png",
                        "/banks/santander.png",
                        "/banks/bci.png",
                        "/banks/bestado.png",
                        "/banks/itau.png",
                      ].map((logo, i) => (
                        <img
                          key={logo}
                          src={logo}
                          alt=""
                          className="size-4 rounded-full bg-card object-contain ring-1 ring-border"
                          style={{ zIndex: 5 - i }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="section-title truncate text-[11px]">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </Row>

          {/* Fila 4 — lo que pasó y si te estás pasando. Esta es la que
              cede: se queda con todo lo que sobre del viewport, y sus dos
              paneles scrollean por dentro, así que llena cualquier alto. */}
          <Row className="lg:min-h-0 lg:flex-[7_1_0%] lg:grid-cols-[1.6fr_1fr]">
            <Panel className="flex flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-5">
                <div className="flex items-baseline gap-2">
                  <h2 className="section-title text-base">Recientes</h2>
                  {recentTransactions.length > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {recentTransactions.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate("/transactions")}
                  className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ver todo
                  <Eye className="h-3 w-3" />
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-3 px-4 pb-4 md:px-5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <Skeleton className="h-7 w-[3px]" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                  <div className="flex size-14 items-center justify-center border border-border">
                    <Receipt className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="section-title text-sm">
                    Todavía no hay movimientos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Captura el primero con los bloques de arriba.
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] flex-1 overflow-y-auto lg:max-h-none lg:min-h-0">
                  {sortedDateKeys.map((dateKey) => (
                    <div key={dateKey}>
                      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-1.5 md:px-5">
                        <span className="eyebrow whitespace-nowrap">
                          {dateLabel(dateKey)}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {groupedTransactions[dateKey].length}
                        </span>
                      </div>
                      {groupedTransactions[dateKey].map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-muted md:px-5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={cn(
                                "h-7 w-[3px] shrink-0",
                                t.type === "Ingreso" && "bg-success",
                                t.type === "Gasto" && "bg-destructive",
                                t.type === "Inversión" && "bg-blue"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-medium leading-snug",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {t.category_name}
                              </p>
                              {t.detail && (
                                <p
                                  className={cn(
                                    "truncate text-xs leading-snug text-muted-foreground",
                                    isPrivacyMode && "privacy-blur"
                                  )}
                                >
                                  {t.detail}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-sm font-semibold tabular-nums",
                              t.type === "Ingreso" && "text-success",
                              t.type === "Gasto" && "text-destructive",
                              t.type === "Inversión" && "text-blue",
                              isPrivacyMode && "privacy-blur"
                            )}
                          >
                            {t.type === "Ingreso" ? "+" : "−"}
                            {money(Number(t.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="flex flex-col">
              <div className="flex shrink-0 items-baseline justify-between gap-2 px-4 pb-2 pt-4 md:px-5">
                <div className="flex items-baseline gap-2">
                  <h2 className="section-title text-base">Límites</h2>
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
                      {money(budgetSpent)}
                    </span>{" "}
                    de {money(budgetTotal)}
                  </span>
                )}
              </div>

              {/* La frase que sí es un insight. Tira de pelo a la
                  izquierda con el tono de su tipo — la misma gramática que
                  el resto de la app, sin caja ni relleno teñido. */}
              {headline && (
                <div className="flex shrink-0 items-start gap-2.5 border-y border-border px-4 py-2.5 md:px-5">
                  <div
                    className="mt-0.5 h-[26px] w-[3px] shrink-0"
                    style={{ backgroundColor: `oklch(${headlineTone})` }}
                  />
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
              )}

              {budgetRows.length === 0 ? (
                <button
                  onClick={() => navigate("/budget")}
                  className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <p className="section-title text-sm">Aún no pones límites</p>
                  <p className="text-[11px] text-muted-foreground">
                    Ponle un techo a una categoría y aparece acá.
                  </p>
                </button>
              ) : (
                <div className="max-h-[420px] flex-1 overflow-y-auto lg:max-h-none lg:min-h-0">
                  {budgetRows.map((cat) => {
                    const tone = usageTone(cat.usage, cat.alertPercentage);
                    const filled = Math.min(cat.usage, 100);
                    return (
                      <button
                        key={cat.category}
                        onClick={() => navigate("/budget")}
                        className="group relative block w-full border-b border-border px-4 pb-3 pt-2.5 text-left transition-colors last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
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
                            style={{
                              color: tone ? `oklch(${tone})` : undefined,
                            }}
                          >
                            {Math.round(cat.usage)}%
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-1 pl-6 font-mono text-[10px] tabular-nums text-muted-foreground",
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          {money(cat.effectiveAmount)} de{" "}
                          {money(cat.limit as number)}
                          {cat.usage > 100 && (
                            <span
                              className="ml-1 font-semibold"
                              style={{ color: "oklch(var(--insight-danger))" }}
                            >
                              +{money(cat.effectiveAmount - (cat.limit as number))}
                            </span>
                          )}
                        </p>
                        {/* La barra vive en el borde inferior: es el
                            separador de la fila y el avance a la vez. */}
                        <div
                          className="absolute inset-x-0 bottom-0 h-[3px]"
                          style={{
                            backgroundColor:
                              "color-mix(in oklch, var(--muted-foreground) 20%, transparent)",
                          }}
                        >
                          <div
                            className="h-full transition-[width] duration-700 ease-out"
                            style={{
                              width: cat.usage > 0 ? `max(3px, ${filled}%)` : "0%",
                              backgroundColor: tone
                                ? `oklch(${tone})`
                                : "var(--muted-foreground)",
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          </Row>
      </Screen>

      {/* ── ABAJO DEL PLIEGUE ─────────────────────────────────────── */}
      <div className="grid gap-px border-b border-border bg-border">

        {/* El resumen del mes cerrado: lo único que queda abajo. */}
        {hasLastMonthData && (
          <Row>
            <button
              onClick={() => setStoryOpen(true)}
              className="native-press group flex items-center gap-3 bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-hard">
                <Play className="ml-0.5 h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Resumen</p>
                <p className="section-title text-sm capitalize">
                  {format(lastMonth, "MMMM yyyy", { locale: es })}
                </p>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {lastMonthSummary.transactionCount} movimientos
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </Row>
        )}
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
