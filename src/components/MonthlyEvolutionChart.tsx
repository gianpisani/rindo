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
}

interface MonthlyEvolutionChartProps {
  data: MonthlyDataPoint[]
}

const COLORS = {
  Ingresos: "#10b981",
  Gastos: "#e11d48",
  Inversiones: "#0ea5e9",
  Balance: "#f59e0b",
}

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  // Obtener valores directamente por dataKey (evita duplicados)
  const ingresos = payload.find(p => p.dataKey === 'Ingresos')?.value as number || 0
  const gastos = payload.find(p => p.dataKey === 'Gastos')?.value as number || 0
  const inversiones = payload.find(p => p.dataKey === 'Inversiones')?.value as number || 0
  const ahorro = ingresos - gastos

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl min-w-[220px]">
      <p className="font-semibold text-sm text-foreground mb-3 pb-2 border-b border-border">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Ingresos }} />
            <span className="text-xs text-muted-foreground">Ingresos:</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: COLORS.Ingresos }}>
            {formatCurrencyFull(ingresos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Gastos }} />
            <span className="text-xs text-muted-foreground">Gastos:</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: COLORS.Gastos }}>
            {formatCurrencyFull(gastos)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.Inversiones }} />
            <span className="text-xs text-muted-foreground">Inversiones:</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: COLORS.Inversiones }}>
            {formatCurrencyFull(inversiones)}
          </span>
        </div>
        
        {/* Ahorro = Ingresos - Gastos */}
        <div className="flex items-center justify-between gap-4 pt-2 mt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">Ahorro:</span>
          </div>
          <span className={cn(
            "text-sm font-bold",
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
  
  // Estado para zoom
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null)

  // Agregar índice a los datos
  const chartData = useMemo(() => {
    return data.map((item, idx) => ({ ...item, index: idx }))
  }, [data])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  }

  // Calcular dominio del eje Y
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

  // Calcular estadísticas
  const stats = useMemo(() => {
    if (chartData.length === 0) return null
    
    const totalIngresos = chartData.reduce((sum, d) => sum + d.Ingresos, 0)
    const totalGastos = chartData.reduce((sum, d) => sum + d.Gastos, 0)
    const totalInversiones = chartData.reduce((sum, d) => sum + d.Inversiones, 0)
    const avgBalance = chartData.reduce((sum, d) => sum + (d.Ingresos - d.Gastos - d.Inversiones), 0) / chartData.length
    
    // Mejor mes
    const bestMonth = chartData.reduce((best, current) => {
      const currentBalance = current.Ingresos - current.Gastos - current.Inversiones
      const bestBalance = best.Ingresos - best.Gastos - best.Inversiones
      return currentBalance > bestBalance ? current : best
    }, chartData[0])
    
    return {
      totalIngresos,
      totalGastos,
      totalInversiones,
      avgBalance,
      bestMonth: bestMonth.month,
      bestBalance: bestMonth.Ingresos - bestMonth.Gastos - bestMonth.Inversiones,
      tasaAhorro: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0
    }
  }, [chartData])

  // Handlers para zoom
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

  // Datos visibles según zoom
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
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="bg-success/10 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-success font-medium">Total Ingresos</p>
            <p className="text-sm font-bold text-success">{formatCurrency(stats.totalIngresos)}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-destructive font-medium">Total Gastos</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(stats.totalGastos)}</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2.5 text-center">
            <p className={`text-[10px] ${stats.tasaAhorro >= 35 ? "text-success" : stats.tasaAhorro >= 10 ? "text-amber-500" : "text-destructive"} font-medium`}>Tasa Ahorro</p>
            <p className={cn(
              "text-sm font-bold",
              stats.tasaAhorro >= 35 ? "text-success" : stats.tasaAhorro >= 10 ? "text-amber-500" : "text-destructive"
            )}>
              {stats.tasaAhorro.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Controles */}
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

      {/* Gráfico principal */}
      <div className="select-none cursor-crosshair">
        <ResponsiveContainer width="100%" height={280}>
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
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#374151" 
            opacity={0.2}
            vertical={false}
          />
          
          <XAxis 
            dataKey="month" 
            stroke="#94a3b8" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          
          <YAxis 
            stroke="#94a3b8"
            tickFormatter={formatCurrency} 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickMargin={8}
          />
          
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          
          <Legend 
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            iconType="circle"
            iconSize={8}
          />
          
          {/* Áreas con gradiente - name vacío para que no aparezcan en leyenda ni tooltip */}
          <Area
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
            type="monotone"
            dataKey="Inversiones"
            name=""
            stroke="none"
            fill="url(#gradientInversiones)"
            fillOpacity={1}
            animationDuration={1000}
            legendType="none"
          />
          
          {/* Líneas */}
          <Line
            type="monotone"
            dataKey="Ingresos"
            stroke={COLORS.Ingresos}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Ingresos, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Ingresos, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />
          <Line
            type="monotone"
            dataKey="Gastos"
            stroke={COLORS.Gastos}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Gastos, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Gastos, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />
          <Line
            type="monotone"
            dataKey="Inversiones"
            stroke={COLORS.Inversiones}
            strokeWidth={2.5}
            dot={{ fill: COLORS.Inversiones, strokeWidth: 2, r: 4, stroke: "#ffffff" }}
            activeDot={{ r: 6, fill: COLORS.Inversiones, stroke: "#ffffff", strokeWidth: 2 }}
            animationDuration={1000}
          />

          {/* Área de selección para zoom */}
          {isSelecting && refAreaLeft && refAreaRight && (
            <ReferenceArea
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
                stroke="#3b82f6"
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

