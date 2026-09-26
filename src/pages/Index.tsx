import { useState, useMemo, useRef, useEffect, type CSSProperties, type PointerEvent, type TouchEvent } from "react";
import Layout from "@/components/Layout";
import { byNewest, useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useLiveRows } from "@/hooks/useLiveRows";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { TxRow } from "@/components/TxRow";
import { isAnalyzing } from "@/lib/tx-display";
import { useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import {
  useRealFlows,
  computeRealFlows,
  computeLedger,
  SWEEP_ALERT_THRESHOLD,
  type RealFlowsConfig,
} from "@/hooks/useRealFlows";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
} from "lucide-react";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthPulse, MonthPulseCard } from "@/components/MonthPulse";
import { computeMonthPace } from "@/lib/month-pace";
import { HomeNotices, type HomeNotice } from "@/components/HomeNotices";
import { useLearningNotice } from "@/hooks/useLearningNotice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { InvestmentMoveDrawer } from "@/components/InvestmentMoveDrawer";
import type { TransactionType } from "@/lib/ledger";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";

const BANK_LOGOS = ["/banks/bchile.png", "/banks/santander.png", "/banks/bci.png", "/banks/bestado.png", "/banks/itau.png"];

/** "hace 5 min", "hace 2 h", "hace 3 d": lo justo para saber si está al día. */
const sinceLabel = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 60 * 24) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
};


/** El ícono de una categoría sobre un tono de su color. */
const tint = (color?: string | null) => ({
  background: `color-mix(in oklch, ${color || "var(--muted-foreground)"} 22%, transparent)`,
});

const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const edit = useInlineEdit();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openProfileEdit } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const [investmentMoveOpen, setInvestmentMoveOpen] = useState(false);
  // En celular Recientes y Límites comparten la tarjeta.
  const [mobileTab, setMobileTab] = useState<"feed" | "limits">("feed");
  // La categoría que se está mirando: se destaca en las tres tarjetas a la vez.
  const [focus, setFocus] = useState<{ category: string; from: "spend" | "feed" | "limits"; pinned?: boolean } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const { data: bankCredentials } = useBankSyncCredentials();
  const lastSync = (bankCredentials ?? [])
    .filter((c) => c.is_active && c.last_sync_status === "success" && c.last_sync_at)
    .map((c) => c.last_sync_at as string)
    .sort()
    .at(-1);
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

  const handleQuickAdd = (type: TransactionType) => {
    openQuickAdd(type);
  };

  // Calcular stats del mes actual — flujos reales (ingreso con sueldo-shift,
  // consumo neto de reembolsos, sin tránsito)
  const now = new Date();
  const lastMonth = subMonths(now, 1);

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

  // Los dos baldes del patrimonio: líquido (lo que puedo gastar hoy) e
  // invertido (lo que está trabajando). Excluye tránsito y su devolución.
  const { liquido, invertido, patrimonio } = useMemo(
    () => computeLedger(transactions),
    [transactions]
  );

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
  const { categorySpending } = useCategoryInsights(
    transactions,
    limits,
    now
  );

  // El pulso del mes: tu gasto de hoy contra tu mes típico al mismo día
  const monthPace = useMemo(
    () => computeMonthPace(transactions, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, now.getFullYear(), now.getMonth(), now.getDate()]
  );
  const hasPace = monthPace.typical !== null || monthPace.spentSoFar > 0;

  // Los gastos del mes, de mayor a menor. Sin agrupar en "Otros": la lista
  // muestra las que caben y el header dice cuántas quedaron fuera.
  // Lo que Jev aún está categorizando ya cuenta en el total, pero no tiene
  // fila propia: su barra crece recién cuando sabe a qué categoría va.
  const spendBreakdown = currentMonthSummary.categoryBreakdown.filter((c) => c.category !== ANALYZING_CATEGORY);
  const topCategories = spendBreakdown.slice(0, 5);
  const monthExpenses = currentMonthSummary.categoryBreakdown.reduce(
    (s, c) => s + c.effectiveAmount,
    0
  );
  const hiddenCategories = spendBreakdown.length - topCategories.length;

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);

  // ─── Avisos ───────────────────────────────────────────
  // Viven en la fila del saludo: ver HomeNotices para el por qué.
  const learningNotice = useLearningNotice();
  const notices = useMemo(() => {
    const list: HomeNotice[] = [];
    if (sweepAlert) {
      list.push({
        id: "sweep",
        icon: PiggyBank,
        label: `${formatCompact(sweepAlert.amount)} sin invertir`,
        detail: `Cerraste ${format(lastMonth, "MMMM", { locale: es })} con ${formatCompact(
          sweepAlert.amount
        )} ahorrados que no barriste a inversión.`,
        tone: "warning",
        onClick: () => navigate("/budget"),
      });
    }
    if (learningNotice) list.push(learningNotice);
    return list;
  }, [sweepAlert, learningNotice, lastMonth, navigate]);

  function getCatEmoji(categoryName: string) {
    const cat = categories.find((c) => c.name === categoryName);
    return cat?.icon || getCategoryIcon(categoryName);
  }

  // Últimas 40 transacciones agrupadas por fecha
  const recentTransactions = [...transactions]
    .sort(byNewest)
    .slice(0, 40);

  const live = useLiveRows(recentTransactions, !isLoading, isAnalyzing);

  const groupedTransactions = live.visible.reduce((acc, t) => {
    const key = format(new Date(t.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const dayExpenses = (dateKey: string) =>
    groupedTransactions[dateKey].reduce((sum, t) => sum + (t.type === "Gasto" ? Number(t.amount) : 0), 0);

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

  const colorOf = (categoryName: string) =>
    categories.find((c) => c.name === categoryName)?.color ?? null;

  // ─── Una categoría a la vez ───────────────────────────
  // Con mouse, pasar sobre una categoría la destaca en las otras tarjetas.
  // Solo con mouse: en el celular un toque no tiene "salida" y dejaría todo
  // atenuado. Ahí se elige tocando la leyenda de Gastos del mes.
  const focusable = (category: string, from: "spend" | "feed" | "limits") => ({
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType === "mouse") setFocus({ category, from }); },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === "mouse") setFocus((f) => (f?.category === category && f.from === from ? null : f));
    },
  });
  const dimmed = (category: string, list: "spend" | "feed" | "limits") =>
    focus !== null && focus.from !== list && focus.category !== category;

  // Al elegirla desde la leyenda (celular), las listas bajan hasta su primer
  // movimiento: si no, lo único visible sería lo atenuado.
  useEffect(() => {
    if (!focus?.pinned) return;
    document.querySelectorAll<HTMLElement>(".inicio-scroll").forEach((list) => {
      const match = list.querySelector<HTMLElement>(`[data-category="${CSS.escape(focus.category)}"]`);
      if (match) list.scrollTo({ top: Math.max(0, match.offsetTop - 36), behavior: "smooth" });
    });
  }, [focus]);

  // ─── Límites ──────────────────────────────────────────
  // Una categoría es una fila: cuánto va de cuánto y el avance. Arriba, en
  // vez de una alerta roja, el conteo por estado.
  const budgetRows = categorySpending
    .filter((c) => c.limit && c.limit > 0)
    .map((c) => {
      const usage = (c.effectiveAmount / (c.limit as number)) * 100;
      const state: "over" | "near" | "ok" =
        usage > 100 ? "over" : usage >= (c.alertPercentage || 80) ? "near" : "ok";
      return { ...c, usage, state };
    })
    .sort((a, b) => b.usage - a.usage);

  const budgetSpent = budgetRows.reduce((s, c) => s + c.effectiveAmount, 0);
  const budgetTotal = budgetRows.reduce((s, c) => s + (c.limit as number), 0);
  const budgetCounts = budgetRows.reduce(
    (acc, c) => ({ ...acc, [c.state]: acc[c.state] + 1 }),
    { over: 0, near: 0, ok: 0 }
  );

  // Cómo voy: dónde cierro el mes si lo que queda se parece a los mismos
  // días de los últimos 3 meses. No extrapola un ritmo: un cargo fijo que ya
  // pasó (arriendo, suscripciones) no suma nada, y lo que suele caer a fin
  // de mes sí.
  const remainingTypical = useMemo(() => {
    const today = now.getDate();
    const sums = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "Gasto" && !t.reimbursement_for_category) continue;
      const d = new Date(t.date);
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (monthsAgo < 1 || monthsAgo > 3 || d.getDate() <= today) continue;
      const category = t.type === "Gasto" ? t.category_name : (t.reimbursement_for_category as string);
      const signed = t.type === "Gasto" ? Number(t.amount) : -Number(t.amount);
      sums.set(category, (sums.get(category) ?? 0) + signed);
    }
    return new Map([...sums].map(([category, sum]) => [category, Math.max(0, sum / 3)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, now.getFullYear(), now.getMonth(), now.getDate()]);

  const projectionOf = (c: (typeof budgetRows)[number]) => {
    const rest = remainingTypical.get(c.category) ?? 0;
    if (c.state === "over" || rest <= 0) return null;
    return ((c.effectiveAmount + rest) / (c.limit as number)) * 100;
  };

  const limitsSummary = budgetRows.length > 0 && (
    <div className="inicio-limits-summary">
      {budgetCounts.over > 0 && <span className="inicio-pill" data-state="over">{budgetCounts.over} pasado{budgetCounts.over === 1 ? "" : "s"}</span>}
      {budgetCounts.near > 0 && <span className="inicio-pill" data-state="near">{budgetCounts.near} cerca</span>}
      {budgetCounts.ok > 0 && <span className="inicio-pill" data-state="ok">{budgetCounts.ok} bien</span>}
    </div>
  );

  const limitsList =
    budgetRows.length === 0 ? (
      <button onClick={() => navigate("/budget")} className="inicio-empty w-full">
        <span>
          <span className="block font-medium text-foreground">Aún no pones límites</span>
          Ponle un techo a una categoría y aparece acá
        </span>
      </button>
    ) : (
      budgetRows.map((cat, index) => {
        const limit = cat.limit as number;
        const projection = projectionOf(cat);
        const willPass = projection !== null && projection > 100;
        const color = cat.state === "over" ? "var(--inicio-rose)" : cat.state === "near" ? "var(--inicio-amber)" : colorOf(cat.category) || "var(--muted-foreground)";
        return (
          <button
            key={cat.category}
            onClick={() => navigate("/budget")}
            className={cn("inicio-lim", dimmed(cat.category, "limits") && "is-dim")}
            data-state={cat.state}
            data-category={cat.category}
            {...focusable(cat.category, "limits")}
          >
            <span className="inicio-ico" style={tint(colorOf(cat.category))}>{getCatEmoji(cat.category)}</span>
            <span className="n">{cat.category}</span>
            <span className="pct">
              {/* Cómo voy: si a este ritmo me paso, adónde llego */}
              {willPass && <small className="proj">→ {Math.round(projection as number)}%</small>}
              {Math.round(cat.usage)}%
            </span>
            <span className="inicio-track" title={projection !== null ? `A este ritmo cierras el mes en ${Math.round(projection)}%` : undefined}>
              {/* Un 1% tiene que dejar marca: si no, la fila miente. */}
              <i style={{ width: cat.usage > 0 ? `max(3px, ${Math.min(cat.usage, 100)}%)` : "0%", background: color, "--i": index } as CSSProperties} />
              {/* La estela: desde donde vas hasta donde cierras a este ritmo */}
              {projection !== null && projection > cat.usage && (
                <i
                  className="inicio-ghost"
                  style={{
                    left: `${cat.usage}%`,
                    width: `${Math.min(projection, 100) - Math.min(cat.usage, 100)}%`,
                    background: willPass ? "var(--inicio-amber)" : color,
                    "--i": index,
                  } as CSSProperties}
                />
              )}
            </span>
            <span className={cn("of", isPrivacyMode && "privacy-blur")}>
              <span>{formatCurrency(cat.effectiveAmount)} de {formatCurrency(limit)}</span>
              {cat.state === "over" ? (
                <span className="extra">+{formatCurrency(cat.effectiveAmount - limit)}</span>
              ) : (
                <span>quedan {formatCurrency(limit - cat.effectiveAmount)}</span>
              )}
            </span>
          </button>
        );
      })
    );

  // ─── Recientes ────────────────────────────────────────
  const feedList = isLoading ? (
    <div className="space-y-3 px-[18px] py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-[30px] rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  ) : recentTransactions.length === 0 ? (
    <div className="inicio-empty h-full">
      <span>
        <Receipt className="mx-auto mb-3 size-7 text-muted-foreground" />
        <span className="block font-medium text-foreground">No hay movimientos aún</span>
        Aprieta W o Gasto para anotar el primero
      </span>
    </div>
  ) : (
    sortedDateKeys.map((dateKey) => (
      <div key={dateKey}>
        <div className="inicio-day">
          {getDateLabel(dateKey)}
          {/* Cuánto se fue ese día dice más que cuántos movimientos hubo */}
          {dayExpenses(dateKey) > 0 && (
            <span className={cn(isPrivacyMode && "privacy-blur")}>−{formatCurrency(dayExpenses(dateKey))}</span>
          )}
        </div>
        {groupedTransactions[dateKey].map((t) => {
          const analyzing = isAnalyzing(t);
          const key = live.keyOf(t);
          return (
            <TxRow
              key={key}
              t={t}
              edit={edit}
              className={cn(
                live.entered.has(key) && "is-new",
                live.resolved.has(key) && "is-resolved",
                !analyzing && dimmed(t.category_name, "feed") && "is-dim"
              )}
              data-category={analyzing ? undefined : t.category_name}
              {...(analyzing ? {} : focusable(t.category_name, "feed"))}
            />
          );
        })}
      </div>
    ))
  );

  // ─── Acciones ─────────────────────────────────────────
  const actions = (
    <>
      <button className="inicio-act" data-tone="income" onClick={() => handleQuickAdd("Ingreso")}>
        <TrendingUp />Ingreso
      </button>
      <button className="inicio-act" data-tone="expense" onClick={() => handleQuickAdd("Gasto")}>
        <TrendingDown />Gasto <kbd className="inicio-kbd">W</kbd>
      </button>
      <button className="inicio-act" data-tone="investment" onClick={() => handleQuickAdd("Inversión")}>
        <PiggyBank />Inversión
      </button>
      <button
        className="inicio-act"
        onClick={() => setIsBankSyncOpen(true)}
        aria-label={lastSync ? `Sincronizar bancos, última vez ${sinceLabel(lastSync)}` : "Sincronizar bancos"}
      >
        <span className="inicio-banks">
          {BANK_LOGOS.map((logo, i) => <img key={logo} src={logo} alt="" style={{ zIndex: 5 - i }} />)}
        </span>
        <span className="long">
          Sincronizar{lastSync && <small className="inicio-since">{sinceLabel(lastSync)}</small>}
        </span>
      </button>
    </>
  );

  const stackRest = monthExpenses - topCategories.reduce((s, c) => s + c.effectiveAmount, 0);

  return (
    // `fit`: el inicio es una pantalla exacta. Le da altura definida al shell,
    // que es lo que permite medir el resto sin restar nada a mano.
    <Layout fit>
      <div className="inicio">
        <div className="inicio-grid" data-tab={mobileTab}>
          {/* Saludo. A la derecha, avisos y acciones: la fila ya existe, así
              que nada de eso empuja las cards fuera del fold. */}
          <header className="inicio-head">
            {displayName && (
              <button onClick={() => openProfileEdit()} className="inicio-avatar" aria-label="Editar perfil">
                <Avatar className="size-full">
                  {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                  <AvatarFallback className="text-xs font-semibold text-primary" style={{ background: "color-mix(in oklch, var(--primary) 12%, var(--card))" }}>
                    {greetingInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            )}
            <h1 className="inicio-hello">
              {getGreeting()}{displayName ? <>, <em>{displayName}</em></> : ""}
            </h1>
            <div className="inicio-head-end">
              <HomeNotices notices={notices} className="shrink-0" />
              <div className="inicio-actions">{actions}</div>
              {hasPace && (
                <button className="inicio-pulse-pill" onClick={() => setStoryOpen(true)}>
                  <span>▶</span>Tu mes
                </button>
              )}
            </div>
          </header>

          {/* Líquido: el número con el que se decide si se puede gastar. El
              patrimonio es contexto, no la decisión del día. */}
          <section className="inicio-card inicio-money">
            <div className="inicio-money-top">
              <span className="inicio-title">Líquido</span>
              <span className="inicio-month">{format(now, "MMMM yyyy", { locale: es })}</span>
            </div>
            <div className={cn("inicio-big", isPrivacyMode && "privacy-blur")}>
              $<NumberFlow
                value={liquido}
                format={{ style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                locales="es-CL"
              />
            </div>
            <div className="inicio-wealth">
              <button onClick={() => setInvestmentMoveOpen(true)} className="inicio-invested">
                Invertido<b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(invertido)}</b>
              </button>
              <span>Patrimonio<b className={cn(isPrivacyMode && "privacy-blur")}>{formatCurrency(patrimonio)}</b></span>
            </div>
            <div className={cn("inicio-flows", isPrivacyMode && "privacy-blur")}>
              <span className="inicio-flow" style={{ color: "var(--inicio-emerald)" }}>
                <NumberFlow value={currentIncome} prefix="+" format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
                {incomeChange !== 0 && <small>{incomeChange > 0 ? "+" : ""}{Math.round(incomeChange)}%</small>}
              </span>
              <span className="inicio-flow">
                <NumberFlow value={currentExpenses} prefix="−" format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
                {expenseChange !== 0 && (
                  <small style={{ color: expenseChange > 0 ? "var(--inicio-rose)" : "var(--inicio-emerald)" }}>
                    {expenseChange > 0 ? "+" : ""}{Math.round(expenseChange)}%
                  </small>
                )}
              </span>
              {currentInvestments > 0 && (
                <span className="inicio-flow" style={{ color: "var(--inicio-blue)" }}>
                  <NumberFlow value={currentInvestments} format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" /> <small className="inv-lbl">invertido</small>
                </span>
              )}
            </div>
            {(lastMonthIncome > 0 || lastMonthExpenses > 0) && (
              <p className={cn("inicio-prev", isPrivacyMode && "privacy-blur")}>
                <span className="capitalize">{format(lastMonth, "MMM", { locale: es })}</span>
                {" · "}+{formatCurrency(lastMonthIncome)}{" · "}−{formatCurrency(lastMonthExpenses)}
              </p>
            )}
          </section>

          {/* En celular las acciones van bajo Líquido: abajo ya está la navbar */}
          <nav className="inicio-actions-row" aria-label="Agregar movimiento">{actions}</nav>

          {/* Gastos del mes: una barra fina en el color de cada categoría.
              En celular, una sola barra apilada con su leyenda. */}
          <section className="inicio-card inicio-spend">
            <div className="inicio-spend-head">
              <span className="inicio-title">Gastos del mes</span>
              <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                <NumberFlow value={monthExpenses} format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
              </span>
            </div>
            {topCategories.length === 0 ? (
              <div className="inicio-empty">Sin gastos este mes</div>
            ) : (
              <>
                {topCategories.map((cat, index) => (
                  <button
                    key={cat.category}
                    onClick={() => navigate("/budget")}
                    className={cn("inicio-cat", dimmed(cat.category, "spend") && "is-dim")}
                    {...focusable(cat.category, "spend")}
                  >
                    <span className="n">{getCatEmoji(cat.category)} {cat.category}</span>
                    <span className={cn("v", isPrivacyMode && "privacy-blur")}>{formatCurrency(cat.effectiveAmount)}</span>
                    <span className="p">{Math.round(cat.percentage)}%</span>
                    <span className="inicio-track">
                      <i style={{ width: `${Math.max((cat.effectiveAmount / topCategories[0].effectiveAmount) * 100, 1.5)}%`, background: cat.color, "--i": index } as CSSProperties} />
                    </span>
                  </button>
                ))}
                {hiddenCategories > 0 && (
                  <button onClick={() => navigate("/budget")} className="inicio-more">
                    +{hiddenCategories} categoría{hiddenCategories === 1 ? "" : "s"} más →
                  </button>
                )}
                <div className="inicio-stack">
                  {topCategories.map((cat) => (
                    <i
                      key={cat.category}
                      className={cn(focus && focus.category !== cat.category && "is-dim")}
                      style={{ flex: cat.effectiveAmount, background: cat.color }}
                    />
                  ))}
                  {stackRest > 0 && <i className={cn(focus && "is-dim")} style={{ flex: stackRest, background: "var(--border)" }} />}
                </div>
                {/* En celular la leyenda elige la categoría que se destaca abajo */}
                <div className="inicio-legend">
                  {topCategories.slice(0, 4).map((cat) => (
                    <button
                      key={cat.category}
                      aria-pressed={focus?.category === cat.category}
                      onClick={() => setFocus((f) => (f?.category === cat.category ? null : { category: cat.category, from: "spend", pinned: true }))}
                    >
                      {getCatEmoji(cat.category)} {cat.category} <b>{Math.round(cat.percentage)}%</b>
                    </button>
                  ))}
                  {spendBreakdown.length > 4 && (
                    <button onClick={() => navigate("/budget")}>+{spendBreakdown.length - 4}</button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Recientes. En celular comparte la tarjeta con Límites. */}
          <section
            className="inicio-card inicio-feed"
            onTouchStart={(e: TouchEvent) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
            onTouchEnd={(e: TouchEvent) => {
              const start = swipe.current;
              swipe.current = null;
              if (!start) return;
              const dx = e.changedTouches[0].clientX - start.x;
              const dy = e.changedTouches[0].clientY - start.y;
              // Solo un gesto claramente horizontal: el vertical es scroll.
              if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
              setMobileTab(dx < 0 ? "limits" : "feed");
            }}
          >
            <div className="inicio-tabs" role="tablist">
              <button className="inicio-tab" role="tab" aria-selected={mobileTab === "feed"} onClick={() => setMobileTab("feed")}>
                Recientes{recentTransactions.length > 0 && <span className="inicio-count">{recentTransactions.length}</span>}
              </button>
              <button className="inicio-tab" role="tab" aria-selected={mobileTab === "limits"} onClick={() => setMobileTab("limits")}>
                Límites{budgetCounts.over > 0 && <span className="inicio-pill" data-state="over">{budgetCounts.over}</span>}
              </button>
            </div>
            <div className="inicio-panel-head">
              <span className="inicio-title">
                Recientes{recentTransactions.length > 0 && <span className="inicio-count">{recentTransactions.length}</span>}
              </span>
              <button onClick={() => navigate("/transactions")}>Ver todo →</button>
            </div>
            <div className="inicio-scroll inicio-list-feed">{feedList}</div>
            <div className="inicio-scroll inicio-list-limits">{limitsSummary}{limitsList}</div>
          </section>

          {/* Límites a toda la altura, con el pulso del mes al pie */}
          <aside className="inicio-card inicio-limits">
            <div className="inicio-panel-head">
              <span className="inicio-title">
                Límites{budgetRows.length > 0 && <span className="inicio-count">{budgetRows.length}</span>}
              </span>
              {budgetTotal > 0 && (
                <span className={cn("inicio-num text-[11px] text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(budgetSpent)} de {formatCurrency(budgetTotal)}
                </span>
              )}
            </div>
            {limitsSummary}
            <div className="inicio-scroll">{limitsList}</div>
            {hasPace && (
              <MonthPulseCard
                pace={monthPace}
                onOpen={() => setStoryOpen(true)}
                className="shrink-0 rounded-none border-0 border-t px-[18px]"
              />
            )}
          </aside>
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

      <MonthPulse
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        initialMonth={now}
        transactions={transactions}
        categories={categories}
        flowConfig={flowConfig}
      />

      <InvestmentMoveDrawer
        open={investmentMoveOpen}
        onOpenChange={setInvestmentMoveOpen}
      />
    </Layout>
  );
};

export default Index;
