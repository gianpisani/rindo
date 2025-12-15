import { TrendingUp, TrendingDown, Minus, Info, Settings, TrendingUpIcon } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from "recharts";
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
import { Card, CardContent } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(value);
  };

  // Extraer los diferentes valores del punto
  const patrimonioReal = payload.find(p => p.dataKey === 'patrimonio')?.value as number | undefined;
  const proyeccionConInteres = payload.find(p => p.dataKey === 'proyeccion')?.value as number | undefined;
  const proyeccionSinInteres = payload.find(p => p.dataKey === 'proyeccionLineal')?.value as number | undefined;

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg min-w-[200px]">
      <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {patrimonioReal !== undefined && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Real:</span>
            <span className="text-sm font-bold text-[#e11d48]">
              {formatCurrencyFull(patrimonioReal)}
            </span>
          </div>
        )}
        {proyeccionConInteres !== undefined && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Con interés:</span>
            <span className="text-sm font-bold text-[#e11d48]">
              {formatCurrencyFull(proyeccionConInteres)}
            </span>
          </div>
        )}
        {proyeccionSinInteres !== undefined && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Sin interés:</span>
            <span className="text-sm font-bold text-[#94a3b8]">
              {formatCurrencyFull(proyeccionSinInteres)}
            </span>
          </div>
        )}
        {proyeccionConInteres !== undefined && proyeccionSinInteres !== undefined && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Diferencia:</span>
              <span className="text-sm font-bold text-success">
                +{formatCurrencyFull(proyeccionConInteres - proyeccionSinInteres)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Perfiles de riesgo disponibles
type RiskProfile = "aggressive" | "moderate" | "conservative" | "none";

interface RiskMapping {
  [category: string]: RiskProfile;
}

const RISK_RETURNS: Record<RiskProfile, number> = {
  aggressive: 0.10,    // 10% anual
  moderate: 0.07,      // 7% anual
  conservative: 0.05,  // 5% anual
  none: 0.00,          // Sin rentabilidad
};

const RISK_LABELS: Record<RiskProfile, string> = {
  aggressive: "Agresivo (10%)",
  moderate: "Moderado (7%)",
  conservative: "Conservador (5%)",
  none: "Sin Rentabilidad (0%)",
};

export default function ProjectionCard() {
  const { transactions } = useTransactions();
  const [projectionMonths, setProjectionMonths] = useState<number>(3);
  const [calculationMode, setCalculationMode] = useState<"3months" | "6months" | "manual">("3months");
  const [manualSalary, setManualSalary] = useState<string>("");
  const [customYears, setCustomYears] = useState<string>("");
  const [useCustomYears, setUseCustomYears] = useState<boolean>(false);
  const [showRiskConfig, setShowRiskConfig] = useState<boolean>(false);
  const [riskMapping, setRiskMapping] = useState<RiskMapping>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const { isPrivacyMode } = usePrivacyMode();

  // Cargar desde localStorage solo una vez al montar
  useEffect(() => {
    const saved = localStorage.getItem("projection-settings");
    if (saved) {
      try {
        const { mode, salary, months, customYears: savedYears, useCustom, riskMapping: savedRiskMapping } = JSON.parse(saved);
        if (mode) setCalculationMode(mode);
        if (salary) setManualSalary(salary);
        if (months) setProjectionMonths(months);
        if (savedYears) setCustomYears(savedYears);
        if (useCustom !== undefined) setUseCustomYears(useCustom);
        if (savedRiskMapping) setRiskMapping(savedRiskMapping);
      } catch (e) {
        console.error("Error loading projection settings:", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Guardar en localStorage solo después de cargar
  useEffect(() => {
    if (!isLoaded) return; // No guardar hasta que hayamos cargado
    
    localStorage.setItem("projection-settings", JSON.stringify({
      mode: calculationMode,
      salary: manualSalary,
      months: projectionMonths,
      customYears,
      useCustom: useCustomYears,
      riskMapping,
    }));
  }, [calculationMode, manualSalary, projectionMonths, customYears, useCustomYears, riskMapping, isLoaded]);

  // Extraer SOLO categorías de tipo Inversión
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach((t) => {
      if (t.category_name && t.type === "Inversión") {
        categories.add(t.category_name);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Calcular distribución de dinero por categoría (solo Inversiones)
  const categoryWeights = useMemo(() => {
    const totalByCategory: Record<string, number> = {};
    let totalAmount = 0;

    transactions.forEach((t) => {
      if (t.category_name && t.type === "Inversión") {
        const amount = Number(t.amount);
        totalByCategory[t.category_name] = (totalByCategory[t.category_name] || 0) + amount;
        totalAmount += amount;
      }
    });

    // Calcular porcentajes
    const weights: Record<string, number> = {};
    Object.entries(totalByCategory).forEach(([category, amount]) => {
      weights[category] = totalAmount > 0 ? amount / totalAmount : 0;
    });

    return weights;
  }, [transactions]);

  // Calcular tasa de retorno ponderada del portafolio
  const portfolioReturn = useMemo(() => {
    let weightedReturn = 0;

    Object.entries(categoryWeights).forEach(([category, weight]) => {
      const riskProfile = riskMapping[category] || "none";
      const annualReturn = RISK_RETURNS[riskProfile];
      weightedReturn += weight * annualReturn;
    });

    return weightedReturn;
  }, [categoryWeights, riskMapping]);

  // Convertir tasa anual a mensual efectiva: (1 + r_anual)^(1/12) - 1
  const monthlyReturn = useMemo(() => {
    return Math.pow(1 + portfolioReturn, 1 / 12) - 1;
  }, [portfolioReturn]);

  // Calcular patrimonio acumulado mes a mes (solo meses completos)
  const last12Months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date(),
  });

  // Filtrar solo meses que tienen tanto ingresos como gastos (meses "completos")
  const monthlyPatrimonio = last12Months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Calcular patrimonio acumulado hasta este mes
    const transactionsUntilMonth = transactions.filter((t) => {
      const date = new Date(t.date);
      return isBefore(date, monthEnd) || date.getTime() === monthEnd.getTime();
    });

    const income = transactionsUntilMonth
      .filter((t) => t.type === "Ingreso")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactionsUntilMonth
      .filter((t) => t.type === "Gasto")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const patrimonio = income - expenses;

    // Verificar si el mes tiene actividad de ingresos
    const monthTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return date >= monthStart && date <= monthEnd;
    });
    
    const hasIncome = monthTransactions.some((t) => t.type === "Ingreso");

    return {
      month: format(month, "MMM", { locale: es }),
      fullDate: month,
      patrimonio,
      hasIncome,
      isProjection: false,
    };
  });

  // Filtrar solo meses con ingresos (meses completos)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const completeMonths = monthlyPatrimonio.filter(m => {
    const monthDate = new Date(m.fullDate);
    const isCurrentMonth = monthDate.getMonth() === currentMonth && monthDate.getFullYear() === currentYear;
    
    if (isCurrentMonth) {
      return m.hasIncome;
    }
    
    return m.hasIncome;
  });
  
  // Calcular gastos promedio mensual para modo manual
  const recentMonthsForExpenses = completeMonths.slice(-6);
  const avgMonthlyExpenses = recentMonthsForExpenses.length > 0
    ? recentMonthsForExpenses.reduce((sum, month) => {
        const monthStart = startOfMonth(new Date(month.fullDate));
        const monthEnd = endOfMonth(new Date(month.fullDate));
        const monthExpenses = transactions
          .filter((t) => {
            const date = new Date(t.date);
            return t.type === "Gasto" && date >= monthStart && date <= monthEnd;
          })
          .reduce((expSum, t) => expSum + Number(t.amount), 0);
        return sum + monthExpenses;
      }, 0) / recentMonthsForExpenses.length
    : 0;
  
  // Usar últimos 3 o 6 meses según el modo seleccionado
  const monthsToUse = calculationMode === "3months" ? 3 : calculationMode === "6months" ? 6 : 0;
  const recentCompleteMonths = calculationMode !== "manual" 
    ? completeMonths.slice(-Math.min(monthsToUse, completeMonths.length))
    : [];
  
  const excludingCurrentMonth = !monthlyPatrimonio[monthlyPatrimonio.length - 1]?.hasIncome;
  
  // Calcular crecimiento promedio mensual del patrimonio
  let avgMonthlyGrowth = 0;
  
  if (calculationMode === "manual") {
    // Modo manual: sueldo ingresado - gastos promedio
    const salary = Number(manualSalary) || 0;
    avgMonthlyGrowth = salary - avgMonthlyExpenses;
  } else {
    // Modo histórico: calcular basado en últimos N meses
    if (recentCompleteMonths.length >= 2) {
      const growths = [];
      for (let i = 1; i < recentCompleteMonths.length; i++) {
        const growth = recentCompleteMonths[i].patrimonio - recentCompleteMonths[i - 1].patrimonio;
        growths.push(growth);
      }
      avgMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
    }
  }

  // Patrimonio actual
  const currentPatrimonio = monthlyPatrimonio[monthlyPatrimonio.length - 1]?.patrimonio || 0;

  // Calcular meses de proyección: usar custom si está activo, sino usar el selector normal
  const effectiveProjectionMonths = useCustomYears && customYears 
    ? Number(customYears) * 12 
    : projectionMonths;

  // Generar proyecciones dinámicas según el selector
  const nextMonths = eachMonthOfInterval({
    start: addMonths(new Date(), 1),
    end: addMonths(new Date(), effectiveProjectionMonths),
  });

  // Proyección con interés compuesto
  // Fórmula: Saldo_siguiente = (Saldo_actual * (1 + tasa_mensual)) + aporte_mensual
  let tempProjectedValue = currentPatrimonio;
  let tempLinearValue = currentPatrimonio;
  
  const projectionData = nextMonths.map((month) => {
    // Aplicar interés compuesto + aporte mensual
    tempProjectedValue = (tempProjectedValue * (1 + monthlyReturn)) + avgMonthlyGrowth;
    // Proyección lineal (sin interés) para comparación
    tempLinearValue += avgMonthlyGrowth;
    
    return {
      month: format(month, "MMM", { locale: es }),
      fullDate: month,
      proyeccion: tempProjectedValue,
      proyeccionLineal: tempLinearValue, // Sin interés compuesto
      isProjection: true,
    };
  });

  // Datos históricos: usar según el método de cálculo seleccionado
  const historicalMonthsToShow = calculationMode === "3months" ? 3 : calculationMode === "6months" ? 6 : 6;
  
  const historicalData = monthlyPatrimonio
    .filter(m => m.hasIncome)
    .slice(-historicalMonthsToShow)
    .map(m => ({
      ...m,
      patrimonio: m.patrimonio,
      proyeccion: null,
      proyeccionLineal: null,
    }));

  // Punto de conexión: último mes real con ambos valores
  const lastHistorical = historicalData[historicalData.length - 1];
  const connectionPoint = lastHistorical ? {
    ...lastHistorical,
    proyeccion: lastHistorical.patrimonio, // Conectar con el mismo valor
    proyeccionLineal: lastHistorical.patrimonio, // Conectar ambas líneas
  } : null;

  // Combinar datos reales y proyectados para el gráfico
  const chartData = [
    ...historicalData.slice(0, -1), // Todos menos el último
    ...(connectionPoint ? [connectionPoint] : []), // Punto de conexión
    ...projectionData, // Proyecciones
  ];

  // Calcular tendencia basada en crecimiento del patrimonio
  let trend: "up" | "down" | "stable" = "stable";
  if (avgMonthlyGrowth > 50000) trend = "up"; // Creciendo más de 50k/mes
  else if (avgMonthlyGrowth < -50000) trend = "down"; // Decreciendo
  else trend = "stable";

  const projectedValue = projectionData.length > 0 
    ? projectionData[projectionData.length - 1].proyeccion 
    : currentPatrimonio;

  const projectionLabel = useCustomYears && customYears
    ? `${customYears} año${Number(customYears) !== 1 ? 's' : ''}`
    : projectionMonths === 12 
    ? "1 año" 
    : projectionMonths === 24 
    ? "2 años" 
    : `${projectionMonths} meses`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(value);
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";
  const trendBg = trend === "up" ? "bg-success/5" : trend === "down" ? "bg-destructive/5" : "bg-muted/5";
  const trendText = trend === "up" ? "Mejorando" : trend === "down" ? "Empeorando" : "Estable";

  const isDataSufficient = calculationMode === "manual" 
    ? manualSalary && Number(manualSalary) > 0 
    : recentCompleteMonths.length >= 2;

  return (
    <div className="space-y-4">
      {/* Header con configuración de inteligencia */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-foreground">Proyección Inteligente</h3>
          {portfolioReturn > 0 && (
            <Badge variant="default" className="flex items-center gap-1 bg-success/10 text-success border-success/20">
              <TrendingUpIcon className="h-3 w-3" />
              Con interés compuesto
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowRiskConfig(!showRiskConfig)}
          className="h-9 w-9"
        >
          <Settings className={cn("h-4 w-4 transition-transform", showRiskConfig && "rotate-90")} />
        </Button>
      </div>

      {/* Panel de configuración de riesgo */}
      <Collapsible open={showRiskConfig} onOpenChange={setShowRiskConfig}>
        <CollapsibleContent className="space-y-3">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Asigna perfiles de riesgo a tus categorías para calcular la rentabilidad esperada de tu portafolio.
                    La proyección usará interés compuesto basado en la distribución histórica de tu dinero.
                  </p>
                </div>
              </div>

              {uniqueCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay categorías disponibles. Registra transacciones para comenzar.
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {uniqueCategories.map((category) => {
                    const weight = categoryWeights[category] || 0;
                    const percentage = (weight * 100).toFixed(1);
                    
                    return (
                      <div
                        key={category}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {category}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {percentage}% del portafolio
                          </p>
                        </div>
                        <Select
                          value={riskMapping[category] || "none"}
                          onValueChange={(value: RiskProfile) => {
                            setRiskMapping((prev) => ({
                              ...prev,
                              [category]: value,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Sin rentabilidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aggressive">{RISK_LABELS.aggressive}</SelectItem>
                            <SelectItem value="moderate">{RISK_LABELS.moderate}</SelectItem>
                            <SelectItem value="conservative">{RISK_LABELS.conservative}</SelectItem>
                            <SelectItem value="none">{RISK_LABELS.none}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}

              {portfolioReturn > 0 && (
                <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                  <p className="text-sm font-semibold text-success">
                    Tu portafolio rinde un {(portfolioReturn * 100).toFixed(2)}% anual estimado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tasa mensual efectiva: {(monthlyReturn * 100).toFixed(3)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Configuración */}
      <div className="space-y-3">
        {/* Método de cálculo */}
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5">
          <Label className="text-xs font-semibold text-foreground">Método de cálculo</Label>
          <ToggleGroup 
            type="single" 
            value={calculationMode} 
            onValueChange={(value) => value && setCalculationMode(value as typeof calculationMode)}
            className="grid grid-cols-3 gap-2 w-full"
          >
            <ToggleGroupItem 
              value="3months" 
              className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              3 meses
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="6months" 
              className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              6 meses
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="manual" 
              className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Manual
            </ToggleGroupItem>
          </ToggleGroup>

          {calculationMode === "manual" && (
            <div className="space-y-1.5">
              <Label htmlFor="manual-salary" className="text-xs text-muted-foreground">Tu sueldo mensual</Label>
              <Input
                id="manual-salary"
                type="text"
                placeholder="$1.500.000"
                value={manualSalary ? `$${Number(manualSalary).toLocaleString("es-CL")}` : ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setManualSalary(value);
                }}
                className="h-10 text-base"
              />
              {avgMonthlyExpenses > 0 && (
                <p className="text-xs text-muted-foreground">
                  Gastos mensuales promedio: <span className="font-semibold text-foreground">{formatCurrencyFull(avgMonthlyExpenses)}</span>
                </p>
              )}
            </div>
          )}

          {calculationMode !== "manual" && (
            <p className="text-xs text-muted-foreground">
              {recentCompleteMonths.length > 0 ? (
                <>
                  Basado en {recentCompleteMonths.length} mes{recentCompleteMonths.length !== 1 ? 'es' : ''} completo{recentCompleteMonths.length !== 1 ? 's' : ''}
                  {excludingCurrentMonth && " · Excluyendo mes actual"}
                </>
              ) : (
                "Sin datos suficientes"
              )}
            </p>
          )}
        </div>

        {/* Horizonte de proyección */}
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5">
          <Label className="text-xs font-semibold text-foreground">Proyectar a futuro</Label>
          
          {!useCustomYears ? (
            <ToggleGroup 
              type="single" 
              value={projectionMonths.toString()} 
              onValueChange={(value) => value && setProjectionMonths(Number(value))}
              className="grid grid-cols-4 gap-2 w-full"
            >
              <ToggleGroupItem 
                value="3" 
                className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                3M
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="6" 
                className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                6M
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="12" 
                className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                1A
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="24" 
                className="h-10 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                2A
              </ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="custom-years" className="text-xs text-muted-foreground">Número de años</Label>
              <Input
                id="custom-years"
                type="number"
                placeholder="Ej: 5"
                value={customYears}
                onChange={(e) => setCustomYears(e.target.value)}
                className="h-10 text-base"
                min="1"
                max="30"
              />
            </div>
          )}

          <button
            onClick={() => setUseCustomYears(!useCustomYears)}
            className="text-xs text-primary hover:underline font-medium"
          >
            {useCustomYears ? "← Volver a opciones rápidas" : "Personalizar años →"}
          </button>
        </div>
      </div>
      {/* Métricas clave */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium">Crecimiento/Mes</p>
          <p className={cn("text-xl sm:text-2xl font-bold", avgMonthlyGrowth >= 0 ? "text-success" : "text-destructive", isPrivacyMode && "privacy-blur")}>
            {formatCurrency(avgMonthlyGrowth)}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium">Patrimonio Actual</p>
          <p className={cn("text-xl sm:text-2xl font-bold text-foreground", isPrivacyMode && "privacy-blur")}>
            {formatCurrency(currentPatrimonio)}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 space-y-0.5 col-span-2">
          <p className="text-xs text-primary font-semibold">Proyección a {projectionLabel}</p>
          <p className={cn("text-2xl sm:text-3xl font-bold", projectedValue >= currentPatrimonio ? "text-success" : "text-destructive", isPrivacyMode && "privacy-blur")}>
            {formatCurrency(projectedValue)}
          </p>
        </div>
      </div>

      {/* Gráfico de proyección */}
      <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Evolución & Proyección</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#e11d48]" />
              <span className="text-muted-foreground font-medium">Real</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#e11d48] opacity-40" />
              <span className="text-muted-foreground font-medium">Con interés</span>
            </div>
            {portfolioReturn > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#94a3b8]" />
                <span className="text-muted-foreground font-medium">Sin interés</span>
              </div>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} className={cn(isPrivacyMode && "privacy-blur")}>
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#94a3b8" 
                tickFormatter={formatCurrency}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Línea Real: Solo patrimonio histórico */}
              <Line
                type="monotone"
                dataKey="patrimonio"
                stroke="#e11d48"
                strokeWidth={3}
                dot={{
                  fill: "#e11d48",
                  strokeWidth: 2,
                  r: 5,
                  stroke: "#ffffff"
                }}
                activeDot={{ r: 8, fill: "#e11d48", stroke: "#ffffff", strokeWidth: 2 }}
                connectNulls={false}
              />
              {/* Línea Proyectada SIN INTERÉS: Dibujar primero para que quede atrás */}
              {portfolioReturn > 0 && (
                <Line
                  type="monotone"
                  dataKey="proyeccionLineal"
                  stroke="#94a3b8"
                  strokeWidth={2.5}
                  strokeDasharray="6 6"
                  dot={false}
                  activeDot={{ r: 6, fill: "#94a3b8", stroke: "#ffffff", strokeWidth: 2 }}
                  connectNulls={false}
                />
              )}
              {/* Línea Proyectada CON INTERÉS: Encima de la sin interés */}
              <Line
                type="monotone"
                dataKey="proyeccion"
                stroke="#e11d48"
                strokeWidth={3}
                strokeDasharray="8 8"
                strokeOpacity={0.5}
                dot={{
                  fill: "#e11d48",
                  fillOpacity: 0.5,
                  strokeWidth: 2,
                  r: 5,
                  stroke: "#ffffff",
                  strokeOpacity: 0.5
                }}
                activeDot={{ r: 8, fill: "#e11d48", fillOpacity: 0.5, stroke: "#ffffff", strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
      </div>

      {/* Insight adicional */}
      {isDataSufficient ? (
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          <p className="text-sm text-foreground leading-relaxed">
            {calculationMode === "manual" ? (
              <>
                Con un sueldo de <strong className="text-primary">{formatCurrencyFull(Number(manualSalary))}</strong> y 
                gastos promedio de <strong className="text-foreground">{formatCurrencyFull(avgMonthlyExpenses)}</strong>,
                {avgMonthlyGrowth >= 0 ? (
                  <>
                    {" "}tu patrimonio crecería <strong className="text-success">{formatCurrencyFull(avgMonthlyGrowth)}</strong> por mes{portfolioReturn > 0 && ` con ${(portfolioReturn * 100).toFixed(1)}% de retorno anual`}.
                    En <strong className="text-foreground">{projectionLabel}</strong> proyectamos{" "}
                    <strong className="text-success">{formatCurrencyFull(projectedValue)}</strong> de patrimonio{portfolioReturn > 0 && " (con interés compuesto)"}.
                  </>
                ) : (
                  <>
                    {" "}estarías gastando <strong className="text-destructive">{formatCurrencyFull(Math.abs(avgMonthlyGrowth))}</strong> más 
                    de lo que ganas por mes. Considera ajustar tus gastos.
                  </>
                )}
              </>
            ) : avgMonthlyGrowth >= 0 ? (
              <>
                Tu patrimonio crece <strong className="text-success">{formatCurrencyFull(avgMonthlyGrowth)}</strong> por mes en promedio{portfolioReturn > 0 && ` con ${(portfolioReturn * 100).toFixed(1)}% de retorno anual`}.
                En <strong className="text-primary">{projectionLabel}</strong> proyectamos{" "}
                <strong className="text-success">{formatCurrencyFull(projectedValue)}</strong> de patrimonio{portfolioReturn > 0 && " (con interés compuesto)"}.
                {excludingCurrentMonth && (
                  <span className="block mt-2 text-xs opacity-75">
                    La proyección se actualizará cuando registres tus ingresos de este mes.
                  </span>
                )}
              </>
            ) : (
              <>
                Tu patrimonio está disminuyendo <strong className="text-destructive">{formatCurrencyFull(Math.abs(avgMonthlyGrowth))}</strong> por mes.
                Considera revisar tus gastos e inversiones.
              </>
            )}
          </p>
          
          {portfolioReturn > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/20">
              <p className="text-xs text-muted-foreground">
                <strong>Magia del interés compuesto:</strong> Tu dinero trabaja para ti. 
                {projectedValue > currentPatrimonio + (avgMonthlyGrowth * effectiveProjectionMonths) && (
                  <> Ganarías <strong className="text-success">
                    {formatCurrencyFull(projectedValue - currentPatrimonio - (avgMonthlyGrowth * effectiveProjectionMonths))}
                  </strong> extra gracias a los rendimientos.</>
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex items-start gap-2.5">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {calculationMode === "manual" 
                ? "Ingresa tu sueldo mensual para generar una proyección."
                : `Necesitas al menos 2 meses con ingresos registrados para generar una proyección precisa.${excludingCurrentMonth ? " Registra tus ingresos de este mes para mejorar los datos." : ""}`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

