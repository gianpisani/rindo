import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { format, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPulse } from "@/components/MonthPulse";
import { TxSheet, type TxSheetData } from "@/components/finanzas/TxSheet";
import {
  DailyBars,
  FlowWaterfall,
  MonthBars,
  Spark,
  WorthChart,
  type FlowStep,
} from "@/components/finanzas/FinCharts";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { computeLedger, computeRealFlows, DEFAULT_TRANSIT_CATEGORIES } from "@/hooks/useRealFlows";
import { summarizeCategoryPeriod } from "@/lib/category-spending";
import {
  buildHistory,
  categoryTrends,
  endOfMonthOf,
  historyAverages,
  clpShort,
  monthsBetween,
  startOfMonthOf,
} from "@/lib/finance-history";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { cn } from "@/lib/utils";

/**
 * Finanzas: dos preguntas, una por vista.
 * - Mes: ¿qué pasó con mi plata este mes? Una cascada (entró → gastos →
 *   invertido → quedó), el gasto de cada día y las categorías contra el mes
 *   anterior.
 * - Histórico: ¿cómo va en el tiempo? El patrimonio creciendo, mes a mes lo
 *   que entró contra lo que salió, y la tendencia de cada categoría.
 * Todo cuenta igual que el inicio (mismas funciones) y todo se puede abrir:
 * una categoría, un día o un mes muestran sus movimientos, editables.
 */

const VIEW_KEY = "finanzas-view";
const clp = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(value);
const tint = (color?: string | null) => ({
  background: `color-mix(in oklch, ${color || "var(--muted-foreground)"} 22%, transparent)`,
});
const SOFT_ROSE = "color-mix(in oklch, var(--inicio-rose) 62%, var(--muted-foreground))";
const transit = new Set(DEFAULT_TRANSIT_CATEGORIES);

/** Gasto neto por categoría de un período, sin tránsito ni lo que Jev aún categoriza. */
const spendByCategory = (transactions: Transaction[], start: Date, end: Date) => {
  const map = summarizeCategoryPeriod(transactions, start, end);
  for (const key of [...map.keys()]) if (transit.has(key) || key === ANALYZING_CATEGORY) map.delete(key);
  return map;
};

/** "+11% vs ago": el tono dice si el cambio es bueno o malo para ese número. */
const deltaOf = (current: number, previous: number, prevMonth: Date, goodWhenUp: boolean | null) => {
  if (previous <= 0 || current < 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (!Number.isFinite(pct) || Math.abs(pct) > 500) return undefined;
  const up = pct > 0;
  const tone = pct === 0 || goodWhenUp === null ? undefined : up === goodWhenUp ? "var(--inicio-emerald)" : "var(--inicio-rose)";
  return { text: `${up ? "+" : ""}${pct}%`, suffix: ` vs ${format(prevMonth, "MMM", { locale: es })}`, tone };
};

export default function Overview() {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { budget } = useMonthlyBudget();
  const { isPrivacyMode } = usePrivacyMode();
  const edit = useInlineEdit();
  const flowConfig = useMemo(
    () => ({ splurgeCategories: budget?.splurge_categories ?? [] }),
    [budget?.splurge_categories]
  );

  const now = new Date();
  const thisMonth = startOfMonthOf(now);
  const [view, setView] = useState<"mes" | "hist">(() => {
    try { return localStorage.getItem(VIEW_KEY) === "hist" ? "hist" : "mes"; } catch { return "mes"; }
  });
  const [month, setMonth] = useState(thisMonth);
  const [sheet, setSheet] = useState<TxSheetData | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [histTab, setHistTab] = useState<"months" | "trends">("months");
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [hoverWorth, setHoverWorth] = useState<number | null>(null);

  const changeView = (next: "mes" | "hist") => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* sin almacenamiento, no pasa nada */ }
  };

  const colorOf = (name: string) => categories.find((c) => c.name === name)?.color ?? null;

  // ─── Meses disponibles ────────────────────────────────
  const months = useMemo(() => {
    const first = transactions.reduce<Date | null>((min, t) => {
      const d = new Date(t.date);
      return !min || d < min ? d : min;
    }, null);
    return monthsBetween(first ?? thisMonth, thisMonth, 36);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, thisMonth.getTime()]);
  const canPrev = month.getTime() > months[0].getTime();
  const canNext = month.getTime() < thisMonth.getTime();
  const step = (delta: number) =>
    setMonth((m) => {
      const next = new Date(m.getFullYear(), m.getMonth() + delta, 1);
      return next < months[0] || next > thisMonth ? m : next;
    });

  // ← y → cambian de mes (sin robarle las flechas a un campo que se edita)
  useEffect(() => {
    if (view !== "mes") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ─── Mes ──────────────────────────────────────────────
  const isCurrent = month.getTime() === thisMonth.getTime();
  const prevMonth = subMonths(month, 1);
  const flows = useMemo(() => computeRealFlows(transactions, month, flowConfig), [transactions, month, flowConfig]);
  const prevFlows = useMemo(() => computeRealFlows(transactions, prevMonth, flowConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month, flowConfig]);
  // La cascada es la liquidez del mes (lo mismo que mueve el balde líquido):
  // + entró − gastos − aportes + rescates. El rendimiento no toca la
  // liquidez: va al balde invertido, y por eso se muestra aparte, abajo.
  const quedo = flows.ingresoReal - flows.consumoNeto - flows.invertido + flows.rescatado;
  const investChange = flows.invertido - flows.rescatado + flows.rendimiento;
  const hasInvestActivity = flows.invertido !== 0 || flows.rescatado !== 0 || flows.rendimiento !== 0;
  const monthTx = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= month && d <= endOfMonthOf(month);
    }),
    [transactions, month]
  );
  const hasMonthData = monthTx.length > 0 || flows.ingresoReal > 0;

  const steps: FlowStep[] = [
    { label: "Entró", value: flows.ingresoReal, color: "var(--inicio-emerald)", delta: deltaOf(flows.ingresoReal, prevFlows.ingresoReal, prevMonth, true) },
    { label: "Gastos", value: -flows.consumoNeto, color: SOFT_ROSE, delta: deltaOf(flows.consumoNeto, prevFlows.consumoNeto, prevMonth, false) },
    // Aportes y rescates por separado: netearlos escondía lo que pasó.
    ...(flows.invertido > 0 ? [{ label: "Invertido", value: -flows.invertido, color: "var(--inicio-blue)" }] : []),
    ...(flows.rescatado > 0 ? [{ label: "Rescatado", value: flows.rescatado, color: "var(--inicio-cyan)" }] : []),
  ];
  const result: FlowStep = {
    label: isCurrent ? "Va quedando" : "Quedó",
    value: quedo,
    color: quedo >= 0 ? "var(--inicio-emerald)" : "var(--inicio-rose)",
  };

  // Días
  const lived = isCurrent ? now.getDate() : flows.dailyNet.length - 1;
  const spentDays = flows.dailyNet.slice(1, lived + 1);
  const avgDay = spentDays.length ? spentDays.reduce((s, v) => s + Math.max(0, v), 0) / spentDays.length : 0;
  const dayDate = (day: number) => new Date(month.getFullYear(), month.getMonth(), day);
  const openDay = (day: number) => {
    const rows = monthTx.filter((t) => new Date(t.date).getDate() === day);
    setSheet({
      title: format(dayDate(day), "EEEE d 'de' MMMM", { locale: es }),
      summary: `Gastaste ${clp(Math.max(0, flows.dailyNet[day] ?? 0))} · ${rows.length} movimiento${rows.length === 1 ? "" : "s"}`,
      transactions: rows,
      groupBy: "day",
    });
  };

  // Categorías del mes contra el anterior
  const monthCats = useMemo(() => {
    const current = spendByCategory(transactions, month, endOfMonthOf(month));
    const previous = spendByCategory(transactions, prevMonth, endOfMonthOf(prevMonth));
    return [...current.entries()]
      .map(([category, row]) => ({ category, ...row, prev: previous.get(category)?.effectiveAmount ?? 0 }))
      .filter((c) => c.effectiveAmount > 0 || c.amount > 0)
      .sort((a, b) => b.effectiveAmount - a.effectiveAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month]);
  const topCat = Math.max(1, ...monthCats.map((c) => c.effectiveAmount));
  const openCategory = (category: string, from: Date, to: Date, groupBy: "day" | "month", summary: string) => {
    const rows = transactions.filter((t) => {
      const d = new Date(t.date);
      if (d < from || d > to) return false;
      return (t.type === "Gasto" && t.category_name === category) || t.reimbursement_for_category === category;
    });
    setSheet({ title: category, icon: edit.emojiOf(category), color: colorOf(category), summary, transactions: rows, groupBy });
  };

  // ─── Histórico ────────────────────────────────────────
  const history = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return buildHistory(
      months,
      (m) => {
        const f = computeRealFlows(transactions, m, flowConfig);
        return { ingreso: f.ingresoReal, gasto: f.consumoNeto, invertido: f.invertido - f.rescatado };
      },
      (end) => computeLedger(sorted.filter((t) => new Date(t.date) <= end))
    );
  }, [transactions, months, flowConfig]);
  const averages = historyAverages(history, now);
  const last12 = months.slice(-12);
  const trends = useMemo(
    () => categoryTrends(last12, (start, end) => new Map([...spendByCategory(transactions, start, end)].map(([k, v]) => [k, v.effectiveAmount])), now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, months]
  );
  const worthIndex = hoverWorth ?? history.length - 1;
  const worthNow = history[worthIndex];
  const worthStart = history[Math.max(0, history.length - 13)];
  const worthChange = history.length > 1 ? history[history.length - 1].patrimonio - worthStart.patrimonio : 0;
  const monthLabel = (d: Date) => format(d, months.length > 12 ? "MMM yy" : "MMM", { locale: es }).replace(".", "");
  const hovered = hoverMonth !== null ? history[hoverMonth] : null;

  const trendRows = trends.map((c) => (
    <button
      key={c.category}
      className="fin-trend"
      onClick={() => openCategory(c.category, last12[0], endOfMonthOf(thisMonth), "month",
        `${clp(c.average)} al mes en promedio · ${clp(c.total)} en ${last12.length} meses`)}
    >
      <span className="inicio-ico" style={tint(colorOf(c.category))}>{edit.emojiOf(c.category)}</span>
      <span className="n">{c.category}</span>
      <Spark values={c.perMonth} color={colorOf(c.category) || "var(--muted-foreground)"} />
      <span className={cn("v", isPrivacyMode && "privacy-blur")}>{clp(c.average)}<small>al mes</small></span>
    </button>
  ));

  const monthsChart = (
    <div className="fin-plot" style={{ marginBottom: 14 }}>
      <MonthBars
        months={history.map((p) => ({
          key: p.month.toISOString(),
          label: monthLabel(p.month),
          ingreso: Math.max(0, p.ingreso),
          gasto: Math.max(0, p.gasto),
          current: p.month.getTime() === thisMonth.getTime(),
        }))}
        onHover={setHoverMonth}
        onPick={(i) => { setMonth(history[i].month); changeView("mes"); }}
      />
    </div>
  );

  // ─── Render ───────────────────────────────────────────
  const loading = isLoading && transactions.length === 0;
  const cardSkeleton = <div className="flex-1 p-[18px]"><Skeleton className="h-full w-full rounded-xl" /></div>;

  return (
    <Layout fit>
      <div className="inicio">
        <div className="fin-grid" data-view={view}>
          <header className="fin-head">
            <h1 className="fin-title">Finanzas</h1>
            <div className="fin-seg" role="group" aria-label="Vista">
              <button aria-pressed={view === "mes"} onClick={() => changeView("mes")}>Mes</button>
              <button aria-pressed={view === "hist"} onClick={() => changeView("hist")}>Histórico</button>
            </div>
            <div className="fin-head-end">
              {view === "mes" ? (
                <>
                  <div className="fin-stepper">
                    <button onClick={() => step(-1)} disabled={!canPrev} aria-label="Mes anterior"><ChevronLeft /></button>
                    <span className="label">{format(month, "MMMM yyyy", { locale: es })}</span>
                    <button onClick={() => step(1)} disabled={!canNext} aria-label="Mes siguiente"><ChevronRight /></button>
                  </div>
                  {hasMonthData && (
                    <button className="fin-pulse" onClick={() => setStoryOpen(true)}><span>▶</span>Tu mes</button>
                  )}
                </>
              ) : (
                <span className="inicio-num text-[12px] text-muted-foreground">
                  {history.length} mes{history.length === 1 ? "" : "es"} · desde {format(months[0], "MMMM yyyy", { locale: es })}
                </span>
              )}
            </div>
          </header>

          {view === "mes" ? (
            <>
              {/* ¿Qué pasó con mi plata? */}
              <section className="inicio-card fin-card fin-flow">
                <div className="fin-card-head">
                  <span className="inicio-title">Flujo del mes</span>
                </div>
                {loading ? cardSkeleton : !hasMonthData ? (
                  <div className="fin-empty">Sin movimientos en {format(month, "MMMM", { locale: es })}</div>
                ) : (
                  <>
                    <div className="fin-plot" style={{ marginTop: 26 }}>
                      <FlowWaterfall key={month.toISOString()} steps={steps} result={result} privacy={isPrivacyMode} />
                    </div>
                    {/* El otro balde: aportes − rescates + rendimiento */}
                    {hasInvestActivity && (
                      <div className={cn("fin-invest", isPrivacyMode && "privacy-blur")}>
                        <span>
                          Inversiones
                          {/* Rescatar no es malo: si bajan, en gris, no en rojo */}
                          <b style={{ color: investChange >= 0 ? "var(--inicio-blue)" : "var(--muted-foreground)" }}>
                            {investChange >= 0 ? "+" : "−"}{clp(Math.abs(investChange))}
                          </b>
                          {flows.rendimiento !== 0 && (
                            <small>{flows.rendimiento > 0 ? "+" : "−"}{clp(Math.abs(flows.rendimiento))} de rendimiento</small>
                          )}
                        </span>
                        <span className="ml-auto">
                          Patrimonio
                          <b style={{ color: quedo + investChange >= 0 ? "var(--inicio-emerald)" : "var(--inicio-rose)" }}>
                            {quedo + investChange >= 0 ? "+" : "−"}{clp(Math.abs(quedo + investChange))}
                          </b>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Cada día */}
              <section className="inicio-card fin-card fin-daily">
                <div className="fin-card-head">
                  <span className="inicio-title">Cada día</span>
                  {hasMonthData && (
                    <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                      {hoverDay !== null ? (
                        <><span className="capitalize">{format(dayDate(hoverDay), "EEE d", { locale: es })}</span> · <b>{clp(Math.max(0, flows.dailyNet[hoverDay] ?? 0))}</b></>
                      ) : (
                        <>promedio <b>{clp(avgDay)}</b> al día</>
                      )}
                    </span>
                  )}
                </div>
                {loading ? cardSkeleton : hasMonthData ? (
                  <div className="fin-plot" style={{ marginBottom: 12 }}>
                    <DailyBars
                      key={month.toISOString()}
                      values={flows.dailyNet}
                      month={month}
                      today={isCurrent ? now.getDate() : null}
                      onHover={setHoverDay}
                      onPick={openDay}
                    />
                  </div>
                ) : <div className="fin-empty" />}
              </section>

              {/* En qué se fue, contra el mes anterior */}
              <section className="inicio-card fin-card fin-cats">
                <div className="fin-card-head">
                  <span className="inicio-title">
                    Categorías{monthCats.length > 0 && <span className="inicio-count">{monthCats.length}</span>}
                  </span>
                  <span className="inicio-num">vs {format(prevMonth, "MMMM", { locale: es })}</span>
                </div>
                {loading ? cardSkeleton : monthCats.length === 0 ? (
                  <div className="fin-empty">Sin gastos este mes</div>
                ) : (
                  <div className="inicio-scroll">
                    {monthCats.map((c, index) => {
                      const diff = c.effectiveAmount - c.prev;
                      const dir = Math.abs(diff) < 1 ? "flat" : diff > 0 ? "up" : "down";
                      return (
                        <button
                          key={c.category}
                          className="fin-cat"
                          onClick={() => openCategory(c.category, month, endOfMonthOf(month), "day",
                            `${clp(c.effectiveAmount)} · ${c.count} movimiento${c.count === 1 ? "" : "s"}${c.reimbursedAmount > 0 ? ` · ${clp(c.reimbursedAmount)} reembolsado` : ""}`)}
                        >
                          <span className="inicio-ico" style={tint(colorOf(c.category))}>{edit.emojiOf(c.category)}</span>
                          <span className="n">{c.category}</span>
                          <span className={cn("v", isPrivacyMode && "privacy-blur")}>{clp(c.effectiveAmount)}</span>
                          <span className="row2">
                            <span className="inicio-track">
                              <i style={{ width: `${Math.max((c.effectiveAmount / topCat) * 100, 1.5)}%`, background: colorOf(c.category) || "var(--muted-foreground)", "--i": index } as CSSProperties} />
                            </span>
                            <span className={cn("delta", isPrivacyMode && "privacy-blur")} data-dir={c.prev === 0 ? "flat" : dir}>
                              {c.prev === 0 ? "nuevo" : dir === "flat" ? "igual" : `${dir === "up" ? "↑" : "↓"} ${clp(Math.abs(diff))}`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              {/* ¿Cómo va mi plata en el tiempo? */}
              <section className="inicio-card fin-card fin-worth">
                <div className="fin-card-head">
                  <span className="inicio-title">Patrimonio</span>
                  {worthNow && (
                    <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                      {hoverWorth !== null ? (
                        <><span className="capitalize">{format(worthNow.month, "MMMM yyyy", { locale: es })}</span> · <b>{clp(worthNow.patrimonio)}</b></>
                      ) : (
                        <><b>{clp(worthNow.patrimonio)}</b>{worthChange !== 0 && (
                          <span style={{ color: worthChange > 0 ? "var(--inicio-emerald)" : "var(--inicio-rose)" }}>
                            {" "}{worthChange > 0 ? "+" : "−"}{clpShort(Math.abs(worthChange))} en {Math.min(12, history.length - 1)} meses
                          </span>
                        )}</>
                      )}
                    </span>
                  )}
                </div>
                {loading ? cardSkeleton : (
                  <>
                    <div className="fin-plot" style={{ marginBottom: 10 }}>
                      <WorthChart
                        points={history.map((p) => ({ label: monthLabel(p.month), liquido: p.liquido, invertido: p.invertidoAcumulado }))}
                        onHover={setHoverWorth}
                      />
                    </div>
                    {worthNow && (
                      <div className={cn("fin-legend", isPrivacyMode && "privacy-blur")}>
                        <span><i style={{ background: "var(--inicio-emerald)" }} />Líquido <b>{clp(worthNow.liquido)}</b></span>
                        <span><i style={{ background: "var(--inicio-blue)" }} />Invertido <b>{clp(worthNow.invertidoAcumulado)}</b></span>
                      </div>
                    )}
                    {averages.months > 0 && (
                      <div className={cn("fin-stats", isPrivacyMode && "privacy-blur")}>
                        <span>Entra al mes <b style={{ color: "var(--inicio-emerald)" }}>{clp(averages.ingreso)}</b></span>
                        <span>Sale <b>{clp(averages.gasto)}</b></span>
                        {averages.ahorro !== null && <span>Ahorras <b>{Math.round(averages.ahorro * 100)}%</b></span>}
                        <span className="text-[11px]">promedio de {averages.months} mes{averages.months === 1 ? "" : "es"} cerrado{averages.months === 1 ? "" : "s"}</span>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Mes a mes (en celular comparte tarjeta con las categorías) */}
              <section className="inicio-card fin-card fin-months" data-tab={histTab}>
                <div className="fin-hist-tabs" role="tablist">
                  <button role="tab" aria-selected={histTab === "months"} onClick={() => setHistTab("months")}>Mes a mes</button>
                  <button role="tab" aria-selected={histTab === "trends"} onClick={() => setHistTab("trends")}>Categorías</button>
                </div>
                <div className="fin-card-head">
                  <span className="inicio-title">Mes a mes</span>
                  <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                    {hovered ? (
                      <><span className="capitalize">{format(hovered.month, "MMM yyyy", { locale: es })}</span> · <b style={{ color: "var(--inicio-emerald)" }}>+{clpShort(hovered.ingreso)}</b> · <b>−{clpShort(hovered.gasto)}</b></>
                    ) : (
                      <><span style={{ color: "var(--inicio-emerald)" }}>entró</span> vs <span style={{ color: SOFT_ROSE }}>salió</span></>
                    )}
                  </span>
                </div>
                <div className="fin-months-body flex min-h-0 flex-1 flex-col">
                  {loading ? cardSkeleton : (
                    <>
                      {/* En celular el encabezado va oculto: el mes activo se lee acá */}
                      <div className={cn("px-[18px] pt-2 text-[11.5px] text-muted-foreground inicio-num sm:hidden", isPrivacyMode && "privacy-blur")}>
                        {hovered ? `${format(hovered.month, "MMM yyyy", { locale: es })} · +${clpShort(hovered.ingreso)} · −${clpShort(hovered.gasto)}` : "Toca un mes para verlo"}
                      </div>
                      {monthsChart}
                    </>
                  )}
                </div>
                <div className="fin-trends-body inicio-scroll">{trendRows}</div>
              </section>

              <section className="inicio-card fin-card fin-trends">
                <div className="fin-card-head">
                  <span className="inicio-title">Categorías</span>
                  <span className="inicio-num">últimos {last12.length} meses</span>
                </div>
                {loading ? cardSkeleton : trends.length === 0 ? (
                  <div className="fin-empty">Sin gastos todavía</div>
                ) : (
                  <div className="inicio-scroll">{trendRows}</div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <TxSheet data={sheet} edit={edit} onClose={() => setSheet(null)} />

      <MonthPulse
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        initialMonth={month}
        transactions={transactions}
        categories={categories}
        flowConfig={flowConfig}
      />
    </Layout>
  );
}
