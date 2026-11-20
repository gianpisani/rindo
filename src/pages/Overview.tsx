import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Layout from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { InvestmentMoveDrawer } from "@/components/finanzas/InvestmentMoveDrawer";
import { TxSheet, type TxSheetData } from "@/components/finanzas/TxSheet";
import { CategoryHistory, MonthBars, Spark, WorthChart } from "@/components/finanzas/FinCharts";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { computeLedger, computeRealFlows, DEFAULT_TRANSIT_CATEGORIES } from "@/lib/real-flows";
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
import { periodNameDate } from "@/lib/period";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { cn } from "@/lib/utils";
import { tint } from "@/lib/category-color";
import { clp } from "@/lib/format";
import { readStorage, writeStorage } from "@/lib/storage";

const RANGE_KEY = "finanzas-meses";
const RANGES = [12, 6, 3] as const;
type Range = (typeof RANGES)[number];

const transit = new Set(DEFAULT_TRANSIT_CATEGORIES);

const spendByCategory = (transactions: Transaction[], start: Date, end: Date) => {
  const map = summarizeCategoryPeriod(transactions, start, end);
  for (const key of [...map.keys()]) if (transit.has(key) || key === ANALYZING_CATEGORY) map.delete(key);
  return map;
};

export default function Overview() {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { isPrivacyMode } = usePrivacyMode();
  const edit = useInlineEdit();
  const { openReconciliation } = useGlobalDrawers();
  const { startDay } = usePeriodConfig();
  const flowConfig = useMemo(() => ({ periodStartDay: startDay }), [startDay]);

  const now = new Date();
  const thisMonth = startOfMonthOf(now, startDay);
  const nameOf = (d: Date) => periodNameDate(d, startDay);
  const [sheet, setSheet] = useState<TxSheetData | null>(null);
  const [investmentMoveOpen, setInvestmentMoveOpen] = useState(false);
  const [histTab, setHistTab] = useState<"months" | "trends">("months");
  const [range, setRange] = useState<Range>(() => {
    const saved = Number(readStorage(RANGE_KEY));
    return (RANGES as readonly number[]).includes(saved) ? (saved as Range) : 12;
  });
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [hoverWorth, setHoverWorth] = useState<number | null>(null);

  const pickRange = (next: Range) => {
    setRange(next);
    writeStorage(RANGE_KEY, String(next));
  };

  const colorOf = (name: string) => categories.find((c) => c.name === name)?.color ?? null;

  const months = useMemo(() => {
    const first = transactions.reduce<Date | null>((min, t) => {
      const d = new Date(t.date);
      return !min || d < min ? d : min;
    }, null);
    return monthsBetween(first ?? thisMonth, thisMonth, range, startDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, thisMonth.getTime(), range, startDay]);
  const rangeStart = months[0];
  const rangeEnd = endOfMonthOf(months[months.length - 1], startDay);

  const history = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return buildHistory(
      months,
      (m) => {
        const f = computeRealFlows(transactions, m, flowConfig);
        return { ingreso: f.ingresoReal, gasto: f.consumoNeto, invertido: f.invertido - f.rescatado };
      },
      (end) => computeLedger(sorted.filter((t) => new Date(t.date) <= end)),
      startDay
    );
  }, [transactions, months, flowConfig, startDay]);
  const averages = historyAverages(history, now, startDay);
  const trends = useMemo(
    () => categoryTrends(months, (start, end) => new Map([...spendByCategory(transactions, start, end)].map(([k, v]) => [k, v.effectiveAmount])), now, Infinity, startDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, months, startDay]
  );
  const worthIndex = hoverWorth ?? history.length - 1;
  const worthNow = history[worthIndex];
  const worthChange = history.length > 1 ? history[history.length - 1].patrimonio - history[0].patrimonio : 0;
  const monthLabel = (d: Date) => format(nameOf(d), "MMM", { locale: es }).replace(".", "");
  const hovered = hoverMonth !== null ? history[hoverMonth] : null;

  const openTrend = (c: typeof trends[number]) => {
    const rows = transactions.filter((t) => {
      const d = new Date(t.date);
      if (d < rangeStart || d > rangeEnd) return false;
      return (t.type === "Gasto" && t.category_name === c.category) || t.reimbursement_for_category === c.category;
    });
    setSheet({
      title: c.category,
      icon: edit.emojiOf(c.category),
      color: colorOf(c.category),
      summary: `${clp(c.average)} al mes en promedio · ${clp(c.total)} en ${months.length} mes${months.length === 1 ? "" : "es"}`,
      transactions: rows,
      groupBy: "month",
      chart: (
        <CategoryHistory
          points={months.map((m, i) => ({ label: monthLabel(m), value: c.perMonth[i] ?? 0 }))}
          color={colorOf(c.category) || "var(--muted-foreground)"}
          privacy={isPrivacyMode}
        />
      ),
    });
  };

  const trendRows = trends.map((c) => (
    <button key={c.category} className="fin-trend" onClick={() => openTrend(c)}>
      <span className="inicio-ico" style={tint(colorOf(c.category))}>{edit.emojiOf(c.category)}</span>
      <span className="n">{c.category}</span>
      <Spark values={c.perMonth} color={colorOf(c.category)} />
      <span className={cn("v", isPrivacyMode && "privacy-blur")}>{clp(c.average)}</span>
    </button>
  ));

  const loading = isLoading && transactions.length === 0;
  const cardSkeleton = <div className="flex-1 p-4"><Skeleton className="h-full w-full rounded-card" /></div>;

  return (
    <Layout fit>
      <div className="inicio">
        <div className="fin-grid">
          <header className="fin-head">
            <h1 className="fin-title">Finanzas</h1>
            <div className="fin-seg" role="group" aria-label="Cuántos meses mirar">
              {RANGES.map((n) => (
                <button key={n} aria-pressed={range === n} onClick={() => pickRange(n)}>{n} meses</button>
              ))}
            </div>
          </header>

          <section className="inicio-card fin-card fin-worth">
            <div className="fin-card-head">
              <span className="inicio-title">Patrimonio</span>
              {worthNow && (
                <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                  {hoverWorth !== null ? (
                    <><span className="capitalize">{format(nameOf(worthNow.month), "MMMM yyyy", { locale: es })}</span> · <b>{clp(worthNow.patrimonio)}</b></>
                  ) : (
                    <><b>{clp(worthNow.patrimonio)}</b>{worthChange !== 0 && (
                      <span className={worthChange > 0 ? "text-success" : "text-destructive"}>
                        {" "}{worthChange > 0 ? "+" : "−"}{clpShort(Math.abs(worthChange))} en {history.length - 1} mes{history.length === 2 ? "" : "es"}
                      </span>
                    )}</>
                  )}
                </span>
              )}
            </div>
            {loading ? cardSkeleton : (
              <>
                <div className="fin-plot" style={{ marginBottom: 8 }}>
                  <WorthChart
                    points={history.map((p) => ({ label: monthLabel(p.month), liquido: p.liquido, invertido: p.invertidoAcumulado }))}
                    onHover={setHoverWorth}
                  />
                </div>
                {worthNow && (
                  <div className={cn("fin-legend", isPrivacyMode && "privacy-blur")}>
                    <button className="is-liquid" onClick={() => openReconciliation()} title="Conciliar con tu banco">
                      <i className="bg-success" />Líquido <b>{clp(worthNow.liquido)}</b>
                    </button>
                    <button onClick={() => setInvestmentMoveOpen(true)} title="Rescatar o actualizar inversiones">
                      <i style={{ background: "var(--inicio-blue)" }} />Invertido <b>{clp(worthNow.invertidoAcumulado)}</b>
                    </button>
                  </div>
                )}
                {averages.months > 0 && (
                  <div className={cn("fin-stats", isPrivacyMode && "privacy-blur")}>
                    <div className="fin-stats-row">
                      <span>Entra al mes <b style={{ color: "oklch(var(--success))" }}>{clp(averages.ingreso)}</b></span>
                      <span>Sale <b>{clp(averages.gasto)}</b></span>
                      {averages.ahorro !== null && <span>Ahorras <b>{Math.round(averages.ahorro * 100)}%</b></span>}
                    </div>
                    <p>promedio de {averages.months} mes{averages.months === 1 ? "" : "es"} cerrado{averages.months === 1 ? "" : "s"}</p>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="inicio-card fin-card fin-months" data-tab={histTab}>
            <div className="fin-hist-tabs" role="tablist">
              <button role="tab" aria-selected={histTab === "months"} onClick={() => setHistTab("months")}>Mes a mes</button>
              <button role="tab" aria-selected={histTab === "trends"} onClick={() => setHistTab("trends")}>Categorías</button>
            </div>
            <div className="fin-card-head">
              <span className="inicio-title">Mes a mes</span>
              <span className={cn("inicio-num", isPrivacyMode && "privacy-blur")}>
                {hovered ? (
                  <><span className="capitalize">{format(nameOf(hovered.month), "MMM yyyy", { locale: es })}</span> · <b style={{ color: "oklch(var(--success))" }}>+{clpShort(hovered.ingreso)}</b> · <b>−{clpShort(hovered.gasto)}</b></>
                ) : (
                  <><span className="text-success">entró</span> vs <span className="text-spend">salió</span></>
                )}
              </span>
            </div>
            <div className="fin-months-body flex min-h-0 flex-1 flex-col">
              {loading ? cardSkeleton : (
                <>
                  <div className={cn("px-4 pt-2 text-xs text-muted-foreground inicio-num sm:hidden", isPrivacyMode && "privacy-blur")}>
                    {hovered ? `${format(nameOf(hovered.month), "MMM yyyy", { locale: es })} · +${clpShort(hovered.ingreso)} · −${clpShort(hovered.gasto)}` : "Toca un mes para verlo"}
                  </div>
                  <div className="fin-plot" style={{ marginBottom: 12 }}>
                    <MonthBars
                      months={history.map((p) => ({
                        key: p.month.toISOString(),
                        label: monthLabel(p.month),
                        ingreso: Math.max(0, p.ingreso),
                        gasto: Math.max(0, p.gasto),
                        current: p.month.getTime() === thisMonth.getTime(),
                      }))}
                      onHover={setHoverMonth}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="fin-trends-body inicio-scroll">
              <div className="px-4 pt-2 text-xs text-muted-foreground">promedio al mes</div>
              {trendRows}
            </div>
          </section>

          <section className="inicio-card fin-card fin-trends">
            <div className="fin-card-head">
              <span className="inicio-title">
                Categorías{trends.length > 0 && <span className="inicio-count">{trends.length}</span>}
              </span>
              <span className="inicio-num">promedio al mes</span>
            </div>
            {loading ? cardSkeleton : trends.length === 0 ? (
              <EmptyState>Sin gastos todavía</EmptyState>
            ) : (
              <div className="inicio-scroll">{trendRows}</div>
            )}
          </section>
        </div>
      </div>

      <TxSheet data={sheet} edit={edit} onClose={() => setSheet(null)} />

      <InvestmentMoveDrawer open={investmentMoveOpen} onOpenChange={setInvestmentMoveOpen} />
    </Layout>
  );
}
