import { TrendingUp, Settings, Info } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, TooltipProps, Brush, CartesianGrid,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useState, useEffect, useMemo } from "react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { CHART_COLORS } from "@/lib/chart-config";

// --- Types & Constants ---

type RiskProfile = "aggressive" | "moderate" | "conservative" | "none";

const DEFAULT_INFLATION = 4; // 4% anual (Chile promedio)

const RISK_RETURNS: Record<RiskProfile, number> = {
  aggressive: 0.10, moderate: 0.07, conservative: 0.05, none: 0.00,
};

const RISK_VOLATILITY: Record<RiskProfile, number> = {
  aggressive: 0.18, moderate: 0.11, conservative: 0.04, none: 0.00,
};

const RISK_LABELS: Record<RiskProfile, string> = {
  aggressive: "Agresivo (10%)",
  moderate: "Moderado (7%)",
  conservative: "Conservador (5%)",
  none: "Sin Rentabilidad",
};

// --- Helpers ---

const fmtCompact = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", notation: "compact", maximumFractionDigits: 1 }).format(value);

const fmtFull = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value);

// --- Tooltip ---

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;

  const get = (key: string) => payload.find(p => p.dataKey === key)?.value as number | undefined;
  const patrimonio = get("patrimonio");
  const proyeccion = get("proyeccion");
  const valorReal = get("valorReal");
  const sinInversion = get("sinInversion");
  const bandaLower = get("bandaLower");
  const bandWidthVal = get("bandWidth");
  const bandaUpper = (bandaLower != null && bandWidthVal != null) ? bandaLower + bandWidthVal : undefined;

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-3 shadow-xl min-w-[220px]">
      <p className="font-semibold text-xs text-foreground mb-2 pb-1.5 border-b border-border">{label}</p>
      <div className="space-y-1.5 text-xs">
        {patrimonio != null && (
          <TooltipRow color={CHART_COLORS.expense} label="Patrimonio" value={fmtFull(patrimonio)} bold />
        )}
        {proyeccion != null && (
          <TooltipRow color={CHART_COLORS.investment} label="Proyección" value={fmtFull(proyeccion)} bold />
        )}
        {valorReal != null && (
          <TooltipRow color={CHART_COLORS.balance} label="Valor real" value={fmtFull(valorReal)} />
        )}
        {sinInversion != null && proyeccion != null && Math.abs(sinInversion - proyeccion) > 1000 && (
          <TooltipRow color={CHART_COLORS.mutedAxis} label="Sin inversión" value={fmtFull(sinInversion)} />
        )}
        {bandaUpper != null && bandaLower != null && (
          <div className="pt-1.5 mt-1.5 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">
              Rango 80%: {fmtCompact(bandaLower)} — {fmtCompact(bandaUpper)}
            </p>
          </div>
        )}
        {proyeccion != null && valorReal != null && proyeccion - valorReal > 1000 && (
          <p className="text-[10px] text-amber-500/80">
            Inflación erosiona {fmtCompact(proyeccion - valorReal)}
          </p>
        )}
      </div>
    </div>
  );
};

function TooltipRow({ color, label, value, bold }: { color: string; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={cn("font-mono tabular-nums", bold ? "font-bold" : "font-medium")}>{value}</span>
    </div>
  );
}

// --- Main Component ---

export default function ProjectionCard() {
  const { transactions } = useTransactions();
  const { isPrivacyMode } = usePrivacyMode();

  const [projectionMonths, setProjectionMonths] = useState(3);
  const [calculationMode, setCalculationMode] = useState<"3months" | "6months" | "manual">("3months");
  const [manualSalary, setManualSalary] = useState("");
  const [customYears, setCustomYears] = useState("");
  const [useCustomYears, setUseCustomYears] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [riskMapping, setRiskMapping] = useState<Record<string, RiskProfile>>({});
  const [inflationRate, setInflationRate] = useState(DEFAULT_INFLATION);
  const [isLoaded, setIsLoaded] = useState(false);

  // localStorage persistence
  useEffect(() => {
    const saved = localStorage.getItem("projection-settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.mode) setCalculationMode(s.mode);
        if (s.salary) setManualSalary(s.salary);
        if (s.months) setProjectionMonths(s.months);
        if (s.customYears) setCustomYears(s.customYears);
        if (s.useCustom !== undefined) setUseCustomYears(s.useCustom);
        if (s.riskMapping) setRiskMapping(s.riskMapping);
        if (s.inflationRate !== undefined) setInflationRate(s.inflationRate);
      } catch { /* ignore */ }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("projection-settings", JSON.stringify({
      mode: calculationMode, salary: manualSalary, months: projectionMonths,
      customYears, useCustom: useCustomYears, riskMapping, inflationRate,
    }));
  }, [calculationMode, manualSalary, projectionMonths, customYears, useCustomYears, riskMapping, inflationRate, isLoaded]);

  // --- Data Calculations ---

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => { if (t.type === "Inversión" && t.category_name) cats.add(t.category_name); });
    return Array.from(cats).sort();
  }, [transactions]);

  const categoryWeights = useMemo(() => {
    const byCategory: Record<string, number> = {};
    let total = 0;
    transactions.forEach(t => {
      if (t.type === "Inversión" && t.category_name) {
        const amt = Number(t.amount);
        byCategory[t.category_name] = (byCategory[t.category_name] || 0) + amt;
        total += amt;
      }
    });
    const weights: Record<string, number> = {};
    Object.entries(byCategory).forEach(([cat, amt]) => { weights[cat] = total > 0 ? amt / total : 0; });
    return weights;
  }, [transactions]);

  const totalInvested = useMemo(() =>
    transactions.filter(t => t.type === "Inversión").reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );

  const { portfolioReturn, portfolioVolatility } = useMemo(() => {
    let ret = 0, vol = 0;
    Object.entries(categoryWeights).forEach(([cat, w]) => {
      const risk = riskMapping[cat] || "none";
      ret += w * RISK_RETURNS[risk];
      vol += w * RISK_VOLATILITY[risk];
    });
    return { portfolioReturn: ret, portfolioVolatility: vol };
  }, [categoryWeights, riskMapping]);

  const monthlyReturn = Math.pow(1 + portfolioReturn, 1 / 12) - 1;
  const monthlyInflation = Math.pow(1 + inflationRate / 100, 1 / 12) - 1;

  // Historical patrimonio (last 12 months)
  const monthlyPatrimonio = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date() });
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const txUntil = transactions.filter(t => {
        const d = new Date(t.date);
        return isBefore(d, monthEnd) || d.getTime() === monthEnd.getTime();
      });
      const income = txUntil.filter(t => t.type === "Ingreso").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = txUntil.filter(t => t.type === "Gasto").reduce((s, t) => s + Number(t.amount), 0);
      const monthTx = transactions.filter(t => { const d = new Date(t.date); return d >= monthStart && d <= monthEnd; });
      const hasIncome = monthTx.some(t => t.type === "Ingreso");
      return { fullDate: month, patrimonio: income - expenses, hasIncome };
    });
  }, [transactions]);

  const completeMonths = monthlyPatrimonio.filter(m => m.hasIncome);
  const excludingCurrentMonth = !monthlyPatrimonio[monthlyPatrimonio.length - 1]?.hasIncome;

  const monthsToUse = calculationMode === "3months" ? 3 : calculationMode === "6months" ? 6 : 0;
  const recentCompleteMonths = calculationMode !== "manual"
    ? completeMonths.slice(-Math.min(monthsToUse, completeMonths.length))
    : [];

  // Average monthly expenses (for manual mode)
  const avgMonthlyExpenses = useMemo(() => {
    const months = completeMonths.slice(-6);
    if (months.length === 0) return 0;
    return months.reduce((sum, m) => {
      const ms = startOfMonth(new Date(m.fullDate)), me = endOfMonth(new Date(m.fullDate));
      return sum + transactions
        .filter(t => { const d = new Date(t.date); return t.type === "Gasto" && d >= ms && d <= me; })
        .reduce((s, t) => s + Number(t.amount), 0);
    }, 0) / months.length;
  }, [transactions, completeMonths]);

  // Average monthly growth (patrimonio change per month)
  let avgMonthlyGrowth = 0;
  if (calculationMode === "manual") {
    avgMonthlyGrowth = (Number(manualSalary) || 0) - avgMonthlyExpenses;
  } else if (recentCompleteMonths.length >= 2) {
    const growths = [];
    for (let i = 1; i < recentCompleteMonths.length; i++) {
      growths.push(recentCompleteMonths[i].patrimonio - recentCompleteMonths[i - 1].patrimonio);
    }
    avgMonthlyGrowth = growths.reduce((s, g) => s + g, 0) / growths.length;
  }

  // Average monthly investment contribution
  const avgMonthlyInvestment = useMemo(() => {
    const months = calculationMode === "manual" ? completeMonths.slice(-6) : recentCompleteMonths;
    if (months.length === 0) return 0;
    return months.reduce((sum, m) => {
      const ms = startOfMonth(new Date(m.fullDate)), me = endOfMonth(new Date(m.fullDate));
      return sum + transactions
        .filter(t => { const d = new Date(t.date); return t.type === "Inversión" && d >= ms && d <= me; })
        .reduce((s, t) => s + Number(t.amount), 0);
    }, 0) / months.length;
  }, [transactions, recentCompleteMonths, completeMonths, calculationMode]);

  const currentPatrimonio = monthlyPatrimonio[monthlyPatrimonio.length - 1]?.patrimonio || 0;

  // --- Projection ---

  const effectiveMonths = Math.max(1, useCustomYears && customYears ? Number(customYears) * 12 : projectionMonths);
  const nextMonths = eachMonthOfInterval({ start: addMonths(new Date(), 1), end: addMonths(new Date(), effectiveMonths) });

  // Compound interest ONLY on invested portion, cash grows linearly
  let investedValue = totalInvested;
  let cashValue = currentPatrimonio - totalInvested;

  const projectionData = nextMonths.map((month, idx) => {
    const t = idx + 1;

    // Invested: compound returns + new monthly contributions
    investedValue = investedValue * (1 + monthlyReturn) + avgMonthlyInvestment;
    // Cash: net savings minus what goes to investments
    cashValue += avgMonthlyGrowth - avgMonthlyInvestment;

    const nominal = investedValue + cashValue;
    const linear = currentPatrimonio + avgMonthlyGrowth * t;
    const real = nominal / Math.pow(1 + monthlyInflation, t);

    // Confidence band based on portfolio volatility
    const annTime = t / 12;
    const stdDev = investedValue > 0 ? investedValue * portfolioVolatility * Math.sqrt(annTime) : 0;
    const upper = nominal + 1.28 * stdDev;
    const lower = nominal - 1.28 * stdDev;

    return {
      month: format(month, "MMM yy", { locale: es }),
      patrimonio: null as number | null,
      proyeccion: Math.round(nominal),
      valorReal: Math.round(real),
      sinInversion: Math.round(linear),
      bandaLower: Math.round(Math.max(0, lower)),
      bandWidth: Math.round(upper - Math.max(0, lower)),
      isProjection: true,
    };
  });

  // --- Chart Data Assembly ---

  const historicalCount = calculationMode === "3months" ? 3 : 6;
  const historicalData = monthlyPatrimonio
    .filter(m => m.hasIncome)
    .slice(-historicalCount)
    .map(m => ({
      month: format(new Date(m.fullDate), "MMM yy", { locale: es }),
      patrimonio: m.patrimonio,
      proyeccion: null as number | null,
      valorReal: null as number | null,
      sinInversion: null as number | null,
      bandaLower: null as number | null,
      bandWidth: null as number | null,
      isProjection: false,
    }));

  // Connection point: bridges historical → projection
  const lastH = historicalData[historicalData.length - 1];
  const connectionPoint = lastH ? {
    ...lastH,
    proyeccion: lastH.patrimonio,
    valorReal: lastH.patrimonio,
    sinInversion: lastH.patrimonio,
    bandaLower: lastH.patrimonio,
    bandWidth: 0,
  } : null;

  const chartData = [
    ...historicalData.slice(0, -1),
    ...(connectionPoint ? [connectionPoint] : []),
    ...projectionData,
  ];

  // --- Derived Values ---

  const projectedValue = projectionData.length > 0 ? projectionData[projectionData.length - 1].proyeccion! : currentPatrimonio;
  const projectedReal = projectionData.length > 0 ? projectionData[projectionData.length - 1].valorReal! : currentPatrimonio;

  const projectionLabel = useCustomYears && customYears
    ? `${customYears} año${Number(customYears) !== 1 ? "s" : ""}`
    : projectionMonths === 12 ? "1 año" : projectionMonths === 24 ? "2 años" : `${projectionMonths} meses`;

  const isDataSufficient = calculationMode === "manual"
    ? manualSalary && Number(manualSalary) > 0
    : recentCompleteMonths.length >= 2;

  const hasReturns = portfolioReturn > 0;
  const hasVolatility = portfolioVolatility > 0;

  const tickInterval = Math.max(0, Math.ceil(chartData.length / 12) - 1);

  // --- Render ---

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-foreground">Proyección</h3>
          {hasReturns && (
            <Badge variant="outline" className="text-[10px] font-mono tabular-nums gap-1 h-5">
              <TrendingUp className="h-3 w-3" />
              {(portfolioReturn * 100).toFixed(1)}% anual
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)}>
          <Settings className={cn("h-4 w-4 transition-transform", showSettings && "rotate-90")} />
        </Button>
      </div>

      {/* Horizon selector — always visible */}
      {!useCustomYears ? (
        <div className="flex items-center gap-1.5">
          <ToggleGroup
            type="single"
            value={projectionMonths.toString()}
            onValueChange={v => v && setProjectionMonths(Number(v))}
            className="flex gap-1.5"
          >
            {[["3", "3M"], ["6", "6M"], ["12", "1A"], ["24", "2A"]].map(([v, lbl]) => (
              <ToggleGroupItem key={v} value={v} className="h-7 px-3 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {lbl}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <button onClick={() => setUseCustomYears(true)} className="h-7 px-2 text-xs text-primary font-medium hover:bg-muted rounded-md transition-colors">
            Otro
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Años" value={customYears} onChange={e => setCustomYears(e.target.value)}
            className="h-7 text-xs w-20" min="1" max="30" />
          <span className="text-xs text-muted-foreground">años</span>
          <button onClick={() => setUseCustomYears(false)} className="text-xs text-primary hover:underline ml-auto">
            ← Volver
          </button>
        </div>
      )}

      {/* Settings panel — collapsed by default */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent className="space-y-2.5 pt-1">
          {/* Calculation method */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Método de cálculo</Label>
            <ToggleGroup type="single" value={calculationMode}
              onValueChange={v => v && setCalculationMode(v as typeof calculationMode)}
              className="flex gap-1.5">
              <ToggleGroupItem value="3months" className="h-7 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">3 meses</ToggleGroupItem>
              <ToggleGroupItem value="6months" className="h-7 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">6 meses</ToggleGroupItem>
              <ToggleGroupItem value="manual" className="h-7 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Manual</ToggleGroupItem>
            </ToggleGroup>
            {calculationMode === "manual" && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Sueldo mensual</Label>
                <Input type="text" placeholder="$1.500.000"
                  value={manualSalary ? `$${Number(manualSalary).toLocaleString("es-CL")}` : ""}
                  onChange={e => setManualSalary(e.target.value.replace(/\D/g, ""))}
                  className="h-7 text-xs" />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              {calculationMode === "manual"
                ? avgMonthlyExpenses > 0 ? `Gastos promedio: ${fmtFull(avgMonthlyExpenses)}` : ""
                : recentCompleteMonths.length > 0
                  ? `Basado en ${recentCompleteMonths.length} mes${recentCompleteMonths.length !== 1 ? "es" : ""} completo${recentCompleteMonths.length !== 1 ? "s" : ""}${excludingCurrentMonth ? " · Excluyendo mes actual" : ""}`
                  : "Sin datos suficientes"}
            </p>
          </div>

          {/* Inflation */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inflación anual</Label>
            <div className="flex items-center gap-2">
              <Input type="number" value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))}
                className="h-7 text-xs w-16" min="0" max="30" step="0.5" />
              <span className="text-[10px] text-muted-foreground">% — muestra el poder adquisitivo real</span>
            </div>
          </div>

          {/* Risk config */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Riesgo por inversión</Label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Más riesgo = más retorno a largo plazo, pero más volatilidad a corto plazo. La banda en el gráfico refleja esta incertidumbre.
            </p>
            {uniqueCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Sin categorías de inversión</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {uniqueCategories.map(cat => (
                  <div key={cat} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card border border-border/30">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{cat}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{((categoryWeights[cat] || 0) * 100).toFixed(0)}%</p>
                    </div>
                    <Select value={riskMapping[cat] || "none"}
                      onValueChange={(v: RiskProfile) => setRiskMapping(prev => ({ ...prev, [cat]: v }))}>
                      <SelectTrigger className="w-[150px] h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(RISK_LABELS) as RiskProfile[]).map(r => (
                          <SelectItem key={r} value={r} className="text-xs">{RISK_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {hasReturns && (
              <p className="text-[10px] text-success font-medium mt-1">
                Retorno ponderado: {(portfolioReturn * 100).toFixed(2)}% anual · Volatilidad: {(portfolioVolatility * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chart + metrics */}
      {isDataSufficient ? (
        <>
          <div className={cn("rounded-xl bg-muted/10 border border-border/30 p-2 pb-1")}>
            <div className={cn(isPrivacyMode && "privacy-blur")}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} opacity={0.15} vertical={false} />

                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tickMargin={6}
                    stroke={CHART_COLORS.mutedAxis} interval={tickInterval} />
                  <YAxis tickFormatter={fmtCompact} fontSize={10} tickLine={false} axisLine={false}
                    tickMargin={4} width={55} stroke={CHART_COLORS.mutedAxis} />

                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.mutedAxis, strokeWidth: 1, strokeDasharray: "4 4" }} />

                  {/* Confidence band (stacked: transparent base + colored width) */}
                  {hasVolatility && (
                    <>
                      <Area dataKey="bandaLower" stackId="band" type="monotone" fill="transparent" stroke="none" connectNulls={false} />
                      <Area dataKey="bandWidth" stackId="band" type="monotone"
                        fill={CHART_COLORS.investment} fillOpacity={0.08} stroke="none" connectNulls={false} />
                    </>
                  )}

                  {/* Historical area fill */}
                  <Area type="monotone" dataKey="patrimonio" stroke="none" fill="url(#gradHist)" connectNulls={false} />

                  {/* Sin inversión (subtle baseline) */}
                  {hasReturns && (
                    <Line type="monotone" dataKey="sinInversion" stroke={CHART_COLORS.mutedAxis}
                      strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
                  )}

                  {/* Valor real (inflation-adjusted) */}
                  <Line type="monotone" dataKey="valorReal" stroke={CHART_COLORS.balance}
                    strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />

                  {/* Projection (nominal) */}
                  <Line type="monotone" dataKey="proyeccion" stroke={CHART_COLORS.investment}
                    strokeWidth={2.5} strokeDasharray="8 4" dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.investment, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false} />

                  {/* Historical patrimonio */}
                  <Line type="monotone" dataKey="patrimonio" stroke={CHART_COLORS.expense} strokeWidth={2.5}
                    dot={{ fill: CHART_COLORS.expense, strokeWidth: 2, r: 3, stroke: "#fff" }}
                    activeDot={{ r: 5, fill: CHART_COLORS.expense, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false} />

                  {chartData.length > 15 && (
                    <Brush dataKey="month" height={20} stroke={CHART_COLORS.investment}
                      fill="transparent" travellerWidth={6} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pt-1 pb-0.5">
              <LegendItem color={CHART_COLORS.expense} label="Real" />
              <LegendItem color={CHART_COLORS.investment} label="Proyección" dashed />
              <LegendItem color={CHART_COLORS.balance} label="Valor real" dashed />
              {hasReturns && <LegendItem color={CHART_COLORS.mutedAxis} label="Sin inversión" dashed />}
              {hasVolatility && <LegendItem color={CHART_COLORS.investment} label="Rango 80%" band />}
            </div>
          </div>

          {/* Compact metrics */}
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="Actual" value={currentPatrimonio} />
            <MetricCard label={`En ${projectionLabel}`} value={projectedValue} highlight />
            <MetricCard label="Valor real" value={projectedReal} sublabel={`con ${inflationRate}% inflación`} amber />
          </div>

          {/* Brief insight */}
          <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
            {avgMonthlyGrowth >= 0 ? (
              <>
                Creces <strong className="text-success font-mono">{fmtCompact(avgMonthlyGrowth)}</strong>/mes.
                {hasReturns ? (
                  <> Inversiones al <span className="font-mono">{(portfolioReturn * 100).toFixed(1)}%</span> anual llevarían tu patrimonio a{" "}
                  <strong className="text-foreground font-mono">{fmtCompact(projectedValue)}</strong> en {projectionLabel},
                  pero en poder adquisitivo real son <strong className="text-amber-600 dark:text-amber-400 font-mono">{fmtCompact(projectedReal)}</strong>.
                  {hasVolatility && <> La banda muestra que a corto plazo hay más incertidumbre.</>}</>
                ) : (
                  <> En {projectionLabel} tendrías <strong className="text-foreground font-mono">{fmtCompact(projectedValue)}</strong>,
                  pero ajustado por inflación serían <strong className="text-amber-600 dark:text-amber-400 font-mono">{fmtCompact(projectedReal)}</strong> reales.</>
                )}
                {excludingCurrentMonth && (
                  <span className="opacity-60"> Se actualizará al registrar ingresos de este mes.</span>
                )}
              </>
            ) : (
              <>
                Tu patrimonio baja <strong className="text-destructive font-mono">{fmtCompact(Math.abs(avgMonthlyGrowth))}</strong>/mes.
                Considera revisar tus gastos.
              </>
            )}
          </p>
        </>
      ) : (
        <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {calculationMode === "manual"
                ? "Ingresa tu sueldo mensual para generar una proyección."
                : "Necesitas al menos 2 meses con ingresos registrados para proyectar."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function LegendItem({ color, label, dashed, band }: { color: string; label: string; dashed?: boolean; band?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {band ? (
        <div className="w-3 h-2 rounded-sm opacity-30" style={{ backgroundColor: color }} />
      ) : (
        <div className={cn("w-2 h-2 rounded-full", dashed && "opacity-60")} style={{ backgroundColor: color }} />
      )}
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricCard({ label, value, sublabel, highlight, amber }: {
  label: string; value: number; sublabel?: string; highlight?: boolean; amber?: boolean;
}) {
  const { isPrivacyMode } = usePrivacyMode();
  return (
    <div className={cn(
      "p-2 rounded-xl border space-y-0.5",
      highlight ? "bg-primary/5 border-primary/20" : amber ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/20 border-border/30"
    )}>
      <p className={cn("text-[10px] font-medium", highlight ? "text-primary" : amber ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{label}</p>
      <p className={cn(
        "text-base sm:text-lg font-bold font-mono tabular-nums leading-tight",
        highlight ? (value >= 0 ? "text-success" : "text-destructive") : amber ? "text-amber-600 dark:text-amber-400" : "text-foreground",
        isPrivacyMode && "privacy-blur"
      )}>
        {fmtCompact(value)}
      </p>
      {sublabel && <p className="text-[9px] text-muted-foreground leading-tight">{sublabel}</p>}
    </div>
  );
}
