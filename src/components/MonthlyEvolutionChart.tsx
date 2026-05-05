import { CHART_COLORS } from "@/lib/chart-config"
import { useMemo, useState, useCallback } from 'react'
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  ComposedChart,
  Line,
  Area,
  Brush,
  CartesianGrid,
  ReferenceArea,
  Legend
} from 'recharts'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MonthlyDataPoint {
  month: string
  Ingresos: number
  Gastos: number
  Inversiones: number
  Balance: number
  Patrimonio: number
}

interface MonthlyEvolutionChartProps {
  data: MonthlyDataPoint[]
}

const PATRIMONIO_COLOR = "#8b5cf6" // violet-500

const COLORS = {
  get Ingresos() { return CHART_COLORS.income; },
  get Gastos() { return CHART_COLORS.expense; },
  get Inversiones() { return CHART_COLORS.investment; },
  get Balance() { return CHART_COLORS.balance; },
  Patrimonio: PATRIMONIO_COLOR,
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatCurrencyCompact = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  const ingresos = payload.find(p => p.dataKey === 'Ingresos')?.value as number || 0
  const gastos = payload.find(p => p.dataKey === 'Gastos')?.value as number || 0
  const inversiones = payload.find(p => p.dataKey === 'Inversiones')?.value as number || 0
  const patrimonio = payload.find(p => p.dataKey === 'Patrimonio')?.value as number || 0
  const ahorro = ingresos - gastos

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl min-w-[240px]">
      <p className="font-semibold text-sm text-foreground mb-3 pb-2 border-b border-border">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Ingresos }} />
            <span className="text-xs text-muted-foreground">Ingresos:</span>
          </div>
          <span className="text-sm font-semibold font-mono tabular-nums" style={{ color: COLORS.Ingresos }}>
            {formatCurrencyFull(ingresos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Gastos }} />
            <span className="text-xs text-muted-foreground">Gastos:</span>
          </div>
          <span className="text-sm font-semibold font-mono tabular-nums" style={{ color: COLORS.Gastos }}>
            {formatCurrencyFull(gastos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Inversiones }} />
            <span className="text-xs text-muted-foreground">Inversiones:</span>
          </div>
          <span className="text-sm font-semibold font-mono tabular-nums" style={{ color: COLORS.Inversiones }}>
            {formatCurrencyFull(inversiones)}
          </span>
        </div>

        {/* Patrimonio acumulado */}
        <div className="flex items-center justify-between gap-4 pt-2 mt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PATRIMONIO_COLOR }} />
            <span className="text-xs text-muted-foreground">Patrimonio:</span>
          </div>
          <span className={cn(
            "text-sm font-bold font-mono tabular-nums",
            patrimonio >= 0 ? "text-violet-500" : "text-destructive"
          )}>
            {formatCurrencyFull(patrimonio)}
          </span>
        </div>

        {/* Ahorro = Ingresos - Gastos */}
        <div className="flex items-center justify-between gap-4 pt-2 mt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">Ahorro:</span>
          </div>
          <span className={cn(
            "text-sm font-bold font-mono tabular-nums",
            ahorro >= 0 ? "text-success" : "text-destructive"
          )}>
            {ahorro >= 0 ? "+" : ""}{formatCurrencyFull(ahorro)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function MonthlyEvolutionChart({ data }: MonthlyEvolutionChartProps) {
  const { isPrivacyMode } = usePrivacyMode()

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null)

  const chartData = useMemo(() => {
    return data.map((item, idx) => ({ ...item, index: idx }))
  }, [data])

  // Y domain for left axis (monthly values)
  const yDomain = useMemo(() => {
    const dataToUse = zoomDomain
      ? chartData.slice(zoomDomain.start, zoomDomain.end + 1)
      : chartData

    const values: number[] = []
    dataToUse.forEach(d => {
      values.push(d.Ingresos, d.Gastos, d.Inversiones)
    })

    if (values.length === 0) return ['auto', 'auto']

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const padding = range * 0.1

    return [
      Math.floor(Math.max(0, min - padding)),
      Math.ceil(max + padding)
    ]
  }, [chartData, zoomDomain])

  // Y domain for right axis (patrimonio - cumulative)
  const yDomainRight = useMemo(() => {
    const dataToUse = zoomDomain
      ? chartData.slice(zoomDomain.start, zoomDomain.end + 1)
      : chartData

    const values = dataToUse.map(d => d.Patrimonio)
    if (values.length === 0) return ['auto', 'auto']

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || Math.abs(max) || 1
    const padding = range * 0.15

    return [
      Math.floor(min - padding),
      Math.ceil(max + padding)
    ]
  }, [chartData, zoomDomain])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null

    const totalIngresos = chartData.reduce((sum, d) => sum + d.Ingresos, 0)
    const totalGastos = chartData.reduce((sum, d) => sum + d.Gastos, 0)
    const totalInversiones = chartData.reduce((sum, d) => sum + d.Inversiones, 0)
    const patrimonio = chartData[chartData.length - 1]?.Patrimonio ?? 0
    const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0

    return {
      totalIngresos,
      totalGastos,
      totalInversiones,
      patrimonio,
      tasaAhorro,
    }
  }, [chartData])

  const handleMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e.activeLabel) {
      setRefAreaLeft(e.activeLabel)
      setIsSelecting(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (isSelecting && e.activeLabel) {
      setRefAreaRight(e.activeLabel)
    }
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight) {
      const leftIdx = chartData.findIndex(d => d.month === refAreaLeft)
      const rightIdx = chartData.findIndex(d => d.month === refAreaRight)

      if (leftIdx !== -1 && rightIdx !== -1) {
        const start = Math.min(leftIdx, rightIdx)
        const end = Math.max(leftIdx, rightIdx)

        if (end - start >= 1) {
          setZoomDomain({ start, end })
        }
      }
    }

    setRefAreaLeft(null)
    setRefAreaRight(null)
    setIsSelecting(false)
  }, [refAreaLeft, refAreaRight, chartData])

  const handleZoomOut = useCallback(() => {
    setZoomDomain(null)
  }, [])

  const handleBrushChange = useCallback((brushData: { startIndex?: number; endIndex?: number }) => {
    if (brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      if (brushData.endIndex - brushData.startIndex >= 1) {
        setZoomDomain({ start: brushData.startIndex, end: brushData.endIndex })
      }
    }
  }, [])

  const visibleData = useMemo(() => {
    if (!zoomDomain) return chartData
    return chartData.slice(zoomDomain.start, zoomDomain.end + 1)
  }, [chartData, zoomDomain])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No hay datos suficientes para mostrar</p>
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-4", isPrivacyMode && "privacy-blur")}>
      {/* Stats cards — 5 boxes */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-success font-semibold uppercase tracking-wider mb-1">Total Ingresos</p>
            <p className="text-sm font-bold font-mono tabular-nums text-success">{formatCurrencyFull(stats.totalIngresos)}</p>
          </div>
          <div className="bg-destructive/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-destructive font-semibold uppercase tracking-wider mb-1">Total Gastos</p>
            <p className="text-sm font-bold font-mono tabular-nums text-destructive">{formatCurrencyFull(stats.totalGastos)}</p>
          </div>
          <div className="bg-sky-500/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-sky-500 font-semibold uppercase tracking-wider mb-1">Total Inversión</p>
            <p className="text-sm font-bold font-mono tabular-nums text-sky-500">{formatCurrencyFull(stats.totalInversiones)}</p>
          </div>
          <div className="bg-violet-500/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wider mb-1">Patrimonio</p>
            <p className={cn(
              "text-sm font-bold font-mono tabular-nums",
              stats.patrimonio >= 0 ? "text-violet-500" : "text-destructive"
            )}>
              {formatCurrencyFull(stats.patrimonio)}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-amber-500/10 rounded-xl p-3 text-center">
            <p className={cn(
              "text-[10px] font-semibold uppercase tracking-wider mb-1",
              stats.tasaAhorro >= 35 ? "text-success" : stats.tasaAhorro >= 10 ? "text-amber-500" : "text-destructive"
            )}>Tasa Ahorro</p>
            <p className={cn(
              "text-sm font-bold font-mono tabular-nums",
              stats.tasaAhorro >= 35 ? "text-success" : stats.tasaAhorro >= 10 ? "text-amber-500" : "text-destructive"
            )}>
              {stats.tasaAhorro.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-end">
        {zoomDomain && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            className="h-7 text-xs gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar
          </Button>
        )}
      </div>

      {/* Main chart */}
      <div className="select-none cursor-crosshair">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={visibleData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
          <defs>
            <linearGradient id="gradientIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.Ingresos} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={COLORS.Ingresos} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gradientGastos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.Gastos} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={COLORS.Gastos} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gradientInversiones" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.Inversiones} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={COLORS.Inversiones} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="gradientPatrimonio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PATRIMONIO_COLOR} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={PATRIMONIO_COLOR} stopOpacity={0}/>
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            opacity={0.2}
            vertical={false}
          />

          <XAxis
            dataKey="month"
            stroke={CHART_COLORS.mutedAxis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />

          {/* Left Y axis — monthly values */}
          <YAxis
            yAxisId="left"
            stroke={CHART_COLORS.mutedAxis}
            tickFormatter={formatCurrencyCompact}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickMargin={4}
          />

          {/* Right Y axis — cumulative patrimonio */}
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={PATRIMONIO_COLOR}
            tickFormatter={formatCurrencyCompact}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={yDomainRight}
            tickMargin={4}
            opacity={0.7}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: CHART_COLORS.mutedAxis, strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            iconType="circle"
            iconSize={8}
          />

          {/* Area fills */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="Ingresos"
            name=""
            stroke="none"
            fill="url(#gradientIngresos)"
            fillOpacity={1}
            animationDuration={1000}
            legendType="none"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="Gastos"
            name=""
            stroke="none"
            fill="url(#gradientGastos)"
            fillOpacity={1}
            animationDuration={1000}
            legendType="none"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="Inversiones"
            name=""
            stroke="none"
            fill="url(#gradientInversiones)"
            fillOpacity={1}
            animationDuration={1000}
            legendType="none"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="Patrimonio"
            name=""
            stroke="none"
            fill="url(#gradientPatrimonio)"
            fillOpacity={1}
            animationDuration={1200}
            legendType="none"
          />

          {/* Lines */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Ingresos"
            stroke={COLORS.Ingresos}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Ingresos, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Ingresos, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Gastos"
            stroke={COLORS.Gastos}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Gastos, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Gastos, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Inversiones"
            stroke={COLORS.Inversiones}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Inversiones, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Inversiones, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />
          {/* Patrimonio — dashed line on right axis */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Patrimonio"
            stroke={PATRIMONIO_COLOR}
            strokeWidth={2.5}
            strokeDasharray="6 3"
            dot={{ fill: PATRIMONIO_COLOR, strokeWidth: 2, r: 3, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: PATRIMONIO_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1200}
          />

          {/* Zoom selection area */}
          {isSelecting && refAreaLeft && refAreaRight && (
            <ReferenceArea
              yAxisId="left"
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fill="#6b7280"
              fillOpacity={0.25}
            />
          )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Brush */}
      {chartData.length > 3 && (
        <div className="px-2">
          <ResponsiveContainer width="100%" height={40}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={yDomain} />
              <Area
                type="monotone"
                dataKey="Ingresos x"
                stroke={COLORS.Ingresos}
                fill={COLORS.Ingresos}
                fillOpacity={0.2}
                strokeWidth={1}
              />
              <Brush
                dataKey="month"
                height={30}
                stroke={CHART_COLORS.income}
                fill="transparent"
                travellerWidth={8}
                startIndex={zoomDomain?.start ?? 0}
                endIndex={zoomDomain?.end ?? chartData.length - 1}
                onChange={handleBrushChange}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Arrastra en el gráfico para hacer zoom • Usa el selector de abajo para navegar
      </p>
    </div>
  )
}
