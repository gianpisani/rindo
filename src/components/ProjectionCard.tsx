import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useState } from "react";

export default function ProjectionCard() {
  const { transactions } = useTransactions();
  const [projectionMonths, setProjectionMonths] = useState<number>(3);

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
  // Excluir mes actual si no tiene ingresos (está incompleto)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const completeMonths = monthlyPatrimonio.filter(m => {
    const monthDate = new Date(m.fullDate);
    const isCurrentMonth = monthDate.getMonth() === currentMonth && monthDate.getFullYear() === currentYear;
    
    // Si es el mes actual, solo incluir si tiene ingresos
    if (isCurrentMonth) {
      return m.hasIncome;
    }
    
    // Meses pasados: incluir si tienen ingresos
    return m.hasIncome;
  });
  
  // Usar últimos 3-6 meses completos para calcular tendencia
  const recentCompleteMonths = completeMonths.slice(-Math.min(6, completeMonths.length));
  
  // Información para el usuario
  const excludingCurrentMonth = !monthlyPatrimonio[monthlyPatrimonio.length - 1]?.hasIncome;
  
  // Calcular crecimiento promedio mensual del patrimonio
  let avgMonthlyGrowth = 0;
  if (recentCompleteMonths.length >= 2) {
    const growths = [];
    for (let i = 1; i < recentCompleteMonths.length; i++) {
      const growth = recentCompleteMonths[i].patrimonio - recentCompleteMonths[i - 1].patrimonio;
      growths.push(growth);
    }
    avgMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
  }

  // Patrimonio actual
  const currentPatrimonio = monthlyPatrimonio[monthlyPatrimonio.length - 1]?.patrimonio || 0;

  // Generar proyecciones dinámicas según el selector
  const nextMonths = eachMonthOfInterval({
    start: addMonths(new Date(), 1),
    end: addMonths(new Date(), projectionMonths),
  });

  let tempProjectedValue = currentPatrimonio;
  const projectionData = nextMonths.map((month) => {
    tempProjectedValue += avgMonthlyGrowth;
    return {
      month: format(month, "MMM", { locale: es }),
      fullDate: month,
      proyeccion: tempProjectedValue,
      isProjection: true,
    };
  });

  // Datos históricos con patrimonio real
  const historicalData = monthlyPatrimonio
    .filter(m => m.hasIncome)
    .slice(-6)
    .map(m => ({
      ...m,
      patrimonio: m.patrimonio,
      proyeccion: null,
    }));

  // Punto de conexión: último mes real con ambos valores
  const lastHistorical = historicalData[historicalData.length - 1];
  const connectionPoint = lastHistorical ? {
    ...lastHistorical,
    proyeccion: lastHistorical.patrimonio, // Conectar con el mismo valor
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

  const projectionLabel = projectionMonths === 12 ? "1 año" : projectionMonths === 24 ? "2 años" : `${projectionMonths} meses`;

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

  return (
    <div className="">
      <div className="pb-4">
        <div className="flex flex-col gap-4">          
          {/* Selector de período de proyección */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {recentCompleteMonths.length > 0 ? (
                <>
                  Basado en {recentCompleteMonths.length} mes{recentCompleteMonths.length !== 1 ? 'es' : ''} completo{recentCompleteMonths.length !== 1 ? 's' : ''}
                  {excludingCurrentMonth && " (excluyendo mes actual sin ingresos)"}
                </>
              ) : (
                "Sin datos suficientes"
              )}
            </p>
            <ToggleGroup 
              type="single" 
              value={projectionMonths.toString()} 
              onValueChange={(value) => value && setProjectionMonths(Number(value))}
              className="gap-1"
            >
              <ToggleGroupItem 
                value="3" 
                className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                3M
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="6" 
                className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                6M
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="12" 
                className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                1A
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="24" 
                className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                2A
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {/* Métricas clave */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Crecimiento/Mes</p>
            <p className={`text-2xl font-semibold ${avgMonthlyGrowth >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(avgMonthlyGrowth)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Patrimonio Actual</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(currentPatrimonio)}
            </p>
          </div>
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <p className="text-xs text-muted-foreground">Proyección {projectionLabel}</p>
            <p className={`text-2xl font-semibold ${projectedValue >= currentPatrimonio ? "text-success" : "text-destructive"}`}>
              {formatCurrency(projectedValue)}
            </p>
          </div>
        </div>

        {/* Gráfico de proyección */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Evolución & Proyección</p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Real</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary/40" />
                <span className="text-muted-foreground">Proyectado</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                tickFormatter={formatCurrency}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrencyFull(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "1rem",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              {/* Línea Real: Solo patrimonio histórico */}
              <Line
                type="monotone"
                dataKey="patrimonio"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (!payload.patrimonio) return null;
                  return <circle key={`real-${index}`} cx={cx} cy={cy} r={4} fill="hsl(var(--primary))" />;
                }}
                connectNulls={false}
              />
              {/* Línea Proyectada: Solo desde el último punto real hacia adelante */}
              <Line
                type="monotone"
                dataKey="proyeccion"
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (!payload.proyeccion || !payload.isProjection) return null;
                  return <circle key={`proj-${index}`} cx={cx} cy={cy} r={4} fill="hsl(var(--primary) / 0.4)" />;
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Insight adicional */}
        {recentCompleteMonths.length >= 2 ? (
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              {avgMonthlyGrowth >= 0 ? (
                <>
                  Tu patrimonio crece <strong className="text-success">{formatCurrencyFull(avgMonthlyGrowth)}</strong> por mes en promedio.
                  En <strong className="text-foreground">{projectionLabel}</strong> proyectamos{" "}
                  <strong className="text-success">{formatCurrencyFull(projectedValue)}</strong> de patrimonio.
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
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground inline" />
                Necesitas al menos 2 meses con ingresos registrados para generar una proyección precisa.
                {excludingCurrentMonth && " Registra tus ingresos de este mes para mejorar los datos."}
              </div>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

