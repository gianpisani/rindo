import { useState, useMemo, useRef, type CSSProperties, type TouchEvent } from "react";
import Layout from "@/components/Layout";
import { byNewest, useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useLiveRows } from "@/hooks/useLiveRows";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { TxRow } from "@/components/TxRow";
import { isAnalyzing } from "@/lib/tx-display";
import { useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { dayOfPeriod, periodEndOf, periodNameDate, shiftPeriod } from "@/lib/period";
import {
  useRealFlows,
  computeRealFlows,
  DEFAULT_TRANSIT_CATEGORIES,
  SWEEP_ALERT_THRESHOLD,
  type RealFlowsConfig,
} from "@/hooks/useRealFlows";
import { summarizeCategoryPeriod } from "@/lib/category-spending";
import { PiggyBank, Receipt, ChevronRight, RefreshCw } from "lucide-react";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthPulse, PaceSpark, PaceText } from "@/components/MonthPulse";
import { TxSheet, type TxSheetData } from "@/components/finanzas/TxSheet";
import { computeMonthPace } from "@/lib/month-pace";
import { HomeNotices, type HomeNotice } from "@/components/HomeNotices";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";

/*
 * Inicio: ¿cómo voy este mes? Lo gastado y el ritmo, en qué se va la plata,
 * los límites pasados y lo que va llegando. Cada categoría abre sus movimientos para
 * corregirlos ahí mismo. La historia (patrimonio, el líquido, mes a mes,
 * tendencias) vive en Finanzas, y anotar a mano, en Movimientos.
 */

const transit = new Set(DEFAULT_TRANSIT_CATEGORIES);
/** Las categorías de gasto que se ven sin tocar "más". */
const TOP_CATEGORIES = 5;

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", notation: "compact" }).format(value);

const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const edit = useInlineEdit();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openProfileEdit, openPeriodSettings } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const [sheet, setSheet] = useState<TxSheetData | null>(null);
  const [showAllCats, setShowAllCats] = useState(false);
  // En celular Recientes y Límites comparten la tarjeta.
  const [mobileTab, setMobileTab] = useState<"feed" | "limits">("feed");
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

  // "Mes" = el mes financiero del usuario (con inicio 1, el calendario).
  const now = new Date();
  const period = usePeriodConfig();
  const { startDay } = period;
  const thisPeriod = period.currentPeriod;
  const periodEnd = periodEndOf(thisPeriod, startDay);
  const lastMonth = shiftPeriod(thisPeriod, -1, startDay);
  /** El mes anterior se llama como el mes en que terminó. */
  const lastMonthName = periodNameDate(lastMonth, startDay);

  const { budget } = useMonthlyBudget();
  const flowConfig = useMemo<Partial<RealFlowsConfig>>(() => ({ periodStartDay: startDay }), [startDay]);
  // Flujos reales: ingreso con sueldo-shift, consumo neto de reembolsos, sin tránsito.
  const currentFlows = useRealFlows(transactions, thisPeriod, flowConfig);
  const lastMonthFlows = useMemo(
    () => computeRealFlows(transactions, lastMonth, flowConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, lastMonth.getTime(), flowConfig]
  );

  // Detector de sweep: mes cerrado con ahorro sin invertir, visible los
  // primeros días del mes (solo si el usuario ya opera con meta de ahorro)
  const sweepAlert = useMemo(() => {
    if (!budget?.savings_goal || dayOfPeriod(now, thisPeriod) > 7) return null;
    if (lastMonthFlows.consumoBruto === 0 && lastMonthFlows.ingresoReal === 0)
      return null;
    const saved = lastMonthFlows.ingresoReal - lastMonthFlows.consumoNeto;
    const gap = saved - lastMonthFlows.invertido;
    return gap > SWEEP_ALERT_THRESHOLD ? { amount: gap } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget?.savings_goal, lastMonthFlows]);

  // Límites por categoría (el mismo cálculo que Meta)
  const { categorySpending } = useCategoryInsights(transactions, limits, now, 6, startDay);

  // El pulso del mes: tu gasto de hoy contra tu mes típico al mismo día
  const monthPace = useMemo(
    () => computeMonthPace(transactions, now, { startDay }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, now.getFullYear(), now.getMonth(), now.getDate(), startDay]
  );
  const hasPace = monthPace.typical !== null || monthPace.spentSoFar > 0;

  // ─── Gastos del mes ───────────────────────────────────
  // Netos de reembolsos y sin plata en tránsito, de mayor a menor. Lo que Jev
  // aún está categorizando ya cuenta en el total, pero no tiene fila propia:
  // su barra crece recién cuando sabe a qué categoría va.
  const monthSpend = useMemo(() => {
    const map = summarizeCategoryPeriod(transactions, thisPeriod, periodEnd);
    for (const key of [...map.keys()]) if (transit.has(key)) map.delete(key);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, thisPeriod.getTime(), periodEnd.getTime()]);
  const monthExpenses = [...monthSpend.values()].reduce((s, c) => s + c.effectiveAmount, 0);
  const spendBreakdown = [...monthSpend.entries()]
    .filter(([category, c]) => category !== ANALYZING_CATEGORY && c.count > 0)
    .map(([category, c]) => ({ category, effectiveAmount: c.effectiveAmount }))
    .sort((a, b) => b.effectiveAmount - a.effectiveAmount);
  const shownCategories = showAllCats ? spendBreakdown : spendBreakdown.slice(0, TOP_CATEGORIES);
  const hiddenCategories = spendBreakdown.length - shownCategories.length;
  const topSpend = spendBreakdown[0]?.effectiveAmount || 1;
  const pctOf = (amount: number) => (monthExpenses > 0 ? Math.round((amount / monthExpenses) * 100) : 0);

  const colorOf = edit.colorOf;
  const emojiOf = edit.emojiOf;

  // Una categoría abre sus movimientos del mes, editables: así se corrige.
  const openCategory = (category: string) => {
    const row = monthSpend.get(category);
    const rows = transactions.filter((t) => {
      const d = new Date(t.date);
      if (d < thisPeriod || d > periodEnd) return false;
      return (t.type === "Gasto" && t.category_name === category) || t.reimbursement_for_category === category;
    });
    const count = row?.count ?? 0;
    setSheet({
      title: category,
      icon: emojiOf(category),
      color: colorOf(category),
      summary: `${formatCurrency(row?.effectiveAmount ?? 0)} · ${count} movimiento${count === 1 ? "" : "s"}${row && row.reimbursedAmount > 0 ? ` · ${formatCurrency(row.reimbursedAmount)} reembolsado` : ""}`,
      transactions: rows,
      groupBy: "day",
    });
  };

  // ─── Avisos ───────────────────────────────────────────
  // Viven en la fila del saludo: ver HomeNotices para el por qué.
  const notices = useMemo(() => {
    const list: HomeNotice[] = [];
    if (sweepAlert) {
      list.push({
        id: "sweep",
        icon: PiggyBank,
        label: `${formatCompact(sweepAlert.amount)} sin invertir`,
        detail: `Cerraste ${format(lastMonthName, "MMMM", { locale: es })} con ${formatCompact(
          sweepAlert.amount
        )} ahorrados que no barriste a inversión.`,
        tone: "warning",
        onClick: () => navigate("/budget"),
      });
    }
    return list;
  }, [sweepAlert, lastMonthName, navigate]);

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

  // ─── Límites ──────────────────────────────────────────
  // En Inicio, solo los que ya se pasaron: el resto vive completo en Meta.
  const overLimits = categorySpending
    .filter((c) => c.limit && c.limit > 0 && c.effectiveAmount > c.limit)
    .map((c) => ({ ...c, usage: (c.effectiveAmount / (c.limit as number)) * 100 }))
    .sort((a, b) => b.usage - a.usage);
  const hasLimits = categorySpending.some((c) => c.limit && c.limit > 0);
  const seeAllLimits = () => navigate("/budget", { state: { tab: "limits" } });

  const limitsList = !hasLimits ? (
    <button onClick={seeAllLimits} className="inicio-empty w-full">
      <span>
        <span className="block font-medium text-foreground">Aún no pones límites</span>
        Ponle un techo a una categoría y aparece acá
      </span>
    </button>
  ) : overLimits.length === 0 ? (
    <div className="inicio-empty">Vas bien en todos tus límites</div>
  ) : (
    overLimits.map((cat, index) => {
      const limit = cat.limit as number;
      return (
        <button key={cat.category} onClick={() => openCategory(cat.category)} className="inicio-lim">
          <span className="inicio-ico" style={tint(colorOf(cat.category))}>{emojiOf(cat.category)}</span>
          <span className="n">{cat.category}</span>
          <span className="pct">{Math.round(cat.usage)}%</span>
          <span className="inicio-track">
            <i style={{ width: "100%", background: "var(--inicio-rose)", "--i": index } as CSSProperties} />
          </span>
          <span className={cn("of", isPrivacyMode && "privacy-blur")}>
            <span>{formatCurrency(cat.effectiveAmount)} de {formatCurrency(limit)}</span>
            <span className="extra">+{formatCurrency(cat.effectiveAmount - limit)}</span>
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
        Sincroniza tu banco y aparecen acá
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
          const key = live.keyOf(t);
          return (
            <TxRow
              key={key}
              t={t}
              edit={edit}
              className={cn(live.entered.has(key) && "is-new", live.resolved.has(key) && "is-resolved")}
            />
          );
        })}
      </div>
    ))
  );

  const stackRest = monthExpenses - shownCategories.reduce((s, c) => s + c.effectiveAmount, 0);

  return (
    // `fit`: el inicio es una pantalla exacta. Le da altura definida al shell,
    // que es lo que permite medir el resto sin restar nada a mano.
    <Layout fit>
      <div className="inicio">
        <div className="inicio-grid" data-tab={mobileTab}>
          {/* Saludo. A la derecha, avisos y sincronizar: la fila ya existe,
              así que nada de eso empuja las cards fuera del fold. */}
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
              {getGreeting()}{displayName ? `, ${displayName}` : ""}
            </h1>
            <div className="inicio-head-end">
              <HomeNotices notices={notices} className="shrink-0" />
              <button
                className="inicio-act"
                onClick={() => setIsBankSyncOpen(true)}
                aria-label={lastSync ? `Sincronizar bancos, última vez ${sinceLabel(lastSync)}` : "Sincronizar bancos"}
                title="Sincronizar bancos"
              >
                {lastSync && <small>{sinceLabel(lastSync)}</small>}
                <RefreshCw aria-hidden />
              </button>
            </div>
          </header>

          {/* El mes: lo gastado y cómo va contra tu mes típico. Es el mismo
              total que reparte "Por categoría". Lo que entró y lo invertido,
              chico. El líquido es historia: vive en Finanzas. */}
          <section className="inicio-card inicio-money">
            <div className="inicio-money-top">
              <span className="inicio-title">Gastado</span>
              <button className="inicio-month" onClick={() => openPeriodSettings()} title="Configurar mes financiero">
                {period.isCalendar ? format(now, "MMMM yyyy", { locale: es }) : period.rangeLabel(thisPeriod)}
              </button>
            </div>
            <span className={cn("inicio-big", isPrivacyMode && "privacy-blur")}>
              <NumberFlow value={monthExpenses} format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
            </span>
            {hasPace && (
              <button className="inicio-pace" onClick={() => setStoryOpen(true)}>
                <span className="inicio-pace-text">
                  <PaceText pace={monthPace} className={cn(isPrivacyMode && "privacy-blur")} />
                  <small>Tu mes<ChevronRight aria-hidden /></small>
                </span>
                <PaceSpark pace={monthPace} className="inicio-spark" />
              </button>
            )}
            <div className={cn("inicio-flows", isPrivacyMode && "privacy-blur")}>
              <span className="inicio-flow" style={{ color: "var(--inicio-emerald)" }}>
                <NumberFlow value={currentFlows.ingresoReal} prefix="+" format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
                <small>entró</small>
              </span>
              {currentFlows.invertido > 0 && (
                <span className="inicio-flow" style={{ color: "var(--inicio-blue)" }}>
                  <NumberFlow value={currentFlows.invertido} format={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }} locales="es-CL" />
                  <small>invertido</small>
                </span>
              )}
            </div>
          </section>

          {/* Por categoría: el total ya está en la tarjeta del mes. Una barra
              fina en el color de cada categoría; en celular, una sola barra
              apilada con su leyenda. Tocar una categoría abre sus movimientos. */}
          <section className="inicio-card inicio-spend">
            <span className="inicio-title">Por categoría</span>
            {spendBreakdown.length === 0 ? (
              <div className="inicio-empty">Sin gastos este mes</div>
            ) : (
              <>
                {shownCategories.map((cat, index) => (
                  <button key={cat.category} onClick={() => openCategory(cat.category)} className="inicio-cat">
                    <span className="n">{emojiOf(cat.category)} {cat.category}</span>
                    <span className={cn("v", isPrivacyMode && "privacy-blur")}>{formatCurrency(cat.effectiveAmount)}</span>
                    <span className="p">{pctOf(cat.effectiveAmount)}%</span>
                    <span className="inicio-track">
                      <i style={{ width: `${Math.max((cat.effectiveAmount / topSpend) * 100, 1.5)}%`, background: colorOf(cat.category) || "var(--muted-foreground)", "--i": index } as CSSProperties} />
                    </span>
                  </button>
                ))}
                {(hiddenCategories > 0 || showAllCats) && (
                  <button onClick={() => setShowAllCats((v) => !v)} className="inicio-more">
                    {showAllCats ? "Ver menos" : `+${hiddenCategories} categoría${hiddenCategories === 1 ? "" : "s"} más`}
                  </button>
                )}
                <div className="inicio-stack">
                  {shownCategories.map((cat) => (
                    <i key={cat.category} style={{ flex: cat.effectiveAmount, background: colorOf(cat.category) || "var(--muted-foreground)" }} />
                  ))}
                  {stackRest > 0 && <i style={{ flex: stackRest, background: "var(--border)" }} />}
                </div>
                <div className="inicio-legend">
                  {shownCategories.map((cat) => (
                    <button key={cat.category} onClick={() => openCategory(cat.category)}>
                      {emojiOf(cat.category)} {cat.category} <b>{pctOf(cat.effectiveAmount)}%</b>
                    </button>
                  ))}
                  {(hiddenCategories > 0 || showAllCats) && (
                    <button onClick={() => setShowAllCats((v) => !v)}>{showAllCats ? "menos" : `+${hiddenCategories}`}</button>
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
                Límites{overLimits.length > 0 && <span className="inicio-pill">{overLimits.length}</span>}
              </button>
            </div>
            <div className="inicio-panel-head">
              <span className="inicio-title">
                Recientes{recentTransactions.length > 0 && <span className="inicio-count">{recentTransactions.length}</span>}
              </span>
              <button onClick={() => navigate("/transactions")}>Ver todo →</button>
            </div>
            <div className="inicio-scroll inicio-list-feed">{feedList}</div>
            <div className="inicio-scroll inicio-list-limits">
              {limitsList}
              {hasLimits && <button className="inicio-more inicio-see-all" onClick={seeAllLimits}>Ver todos →</button>}
            </div>
          </section>

          {/* Límites pasados; todos, en Meta */}
          <aside className="inicio-card inicio-limits">
            <div className="inicio-panel-head">
              <span className="inicio-title">Límites pasados</span>
              {hasLimits && <button onClick={seeAllLimits}>Ver todos →</button>}
            </div>
            <div className="inicio-scroll">{limitsList}</div>
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

      <TxSheet data={sheet} edit={edit} onClose={() => setSheet(null)} />

      <MonthPulse
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        initialMonth={thisPeriod}
        transactions={transactions}
        categories={categories}
        flowConfig={flowConfig}
      />
    </Layout>
  );
};

export default Index;
