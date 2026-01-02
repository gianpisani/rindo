import { useMemo, useState, useCallback } from 'react'
import { 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  TooltipProps, 
  Area, 
  ComposedChart,
  Line,
  Brush,
  ReferenceLine,
  CartesianGrid,
  ReferenceArea
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'
import { cn } from '@/lib/utils'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FintualInvestment {
  id: string
  goal_id: string
  goal_name: string
  nav: number
  deposited: number
  profit: number
  profit_percentage: number
  snapshot_date: string
}

interface FintualHistoryChartProps {
  investments: FintualInvestment[]
}

interface ChartDataPoint {
  dayKey: string
  dateObj: Date
  displayDate: string
  index: number
  [key: string]: string | number | Date
}

const formatCurrencyExact = (value: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  activeGoals: string[]
  goalColors: Record<string, string>
}

const CustomTooltip = ({ active, payload, label, activeGoals, goalColors }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null

  // Agrupar datos por goal
  const goalData: Record<string, { nav: number; deposited: number }> = {}
  
  payload.forEach(entry => {
    const dataKey = entry.dataKey as string
    activeGoals.forEach(goal => {
      if (dataKey === `${goal}_nav`) {
        if (!goalData[goal]) goalData[goal] = { nav: 0, deposited: 0 }
        goalData[goal].nav = entry.value as number
      }
      if (dataKey === `${goal}_deposited`) {
        if (!goalData[goal]) goalData[goal] = { nav: 0, deposited: 0 }
        goalData[goal].deposited = entry.value as number
      }
    })
  })

  // Calcular totales
  const totalNav = Object.values(goalData).reduce((sum, d) => sum + d.nav, 0)
  const totalDeposited = Object.values(goalData).reduce((sum, d) => sum + d.deposited, 0)
  const totalProfit = totalNav - totalDeposited
  const totalProfitPercent = totalDeposited > 0 ? (totalProfit / totalDeposited) * 100 : 0

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl min-w-[240px]">
      <p className="font-semibold text-sm text-foreground mb-3 pb-2 border-b border-border">{label}</p>
      
      <div className="space-y-3">
        {Object.entries(goalData).map(([goal, data]) => {
          const profit = data.nav - data.deposited
          const profitPercent = data.deposited > 0 ? (profit / data.deposited) * 100 : 0
          const color = goalColors[goal]
          
          return (
            <div key={goal} className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs font-medium text-foreground">{goal}</span>
              </div>
              
              <div className="pl-5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-semibold" style={{ color }}>
                    {formatCurrencyExact(data.nav)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depositado:</span>
                  <span className="text-muted-foreground">
                    {formatCurrencyExact(data.deposited)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ganancia:</span>
                  <span className={cn(
                    "font-semibold",
                    profit >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {profit >= 0 ? "+" : ""}{formatCurrencyExact(profit)}
                    <span className="ml-1 opacity-70">
                      ({profit >= 0 ? "+" : ""}{profitPercent.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total si hay más de un goal */}
      {Object.keys(goalData).length > 1 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Total:</span>
            <span className={cn(
              "font-bold",
              totalProfit >= 0 ? "text-success" : "text-destructive"
            )}>
              {totalProfit >= 0 ? "+" : ""}{formatCurrencyExact(totalProfit)}
              <span className="ml-1 opacity-70">
                ({totalProfit >= 0 ? "+" : ""}{totalProfitPercent.toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function FintualHistoryChart({ investments }: FintualHistoryChartProps) {
  const { isPrivacyMode } = usePrivacyMode()
  
  // Estado para zoom manual con selección
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null)

  // Colores para cada goal
  const goalColors: Record<string, string> = useMemo(() => {
    const colors = [
      '#3b82f6', // blue-500
      '#10b981', // green-500
      '#f59e0b', // amber-500
      '#ef4444', // red-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
    ]
    
    const goals = [...new Set(investments.map(inv => inv.goal_name))].sort()
    const colorMap: Record<string, string> = {}
    goals.forEach((goal, index) => {
      colorMap[goal] = colors[index % colors.length]
    })
    return colorMap
  }, [investments])

  // Procesar datos para el gráfico - NAV y Depositado por cada goal
  const chartData = useMemo(() => {
    const goals = [...new Set(investments.map(inv => inv.goal_name))]
    
    const groupedByDay = investments.reduce((acc, inv) => {
      const dateObj = parseISO(inv.snapshot_date)
      const dayKey = format(dateObj, 'yyyy-MM-dd')
      
      if (!acc[dayKey]) {
        acc[dayKey] = { 
          dayKey,
          dateObj,
          displayDate: format(dateObj, 'dd MMM', { locale: es }),
          index: 0
        }
      }
      
      // Guardar NAV y Depositado para cada goal
      acc[dayKey][`${inv.goal_name}_nav`] = inv.nav
      acc[dayKey][`${inv.goal_name}_deposited`] = inv.deposited
      
      return acc
    }, {} as Record<string, ChartDataPoint>)

    const sorted = Object.values(groupedByDay).sort((a, b) => {
      return a.dateObj.getTime() - b.dateObj.getTime()
    })

    // Filtrar días feriados (donde todos los NAV son idénticos al día anterior)
    const filtered = sorted.filter((day, index) => {
      if (index === 0) return true
      
      const prevDay = sorted[index - 1]
      
      const allSame = goals.every(goal => {
        const currentNav = day[`${goal}_nav`] as number | undefined
        const prevNav = prevDay[`${goal}_nav`] as number | undefined
        
        if (currentNav === undefined || prevNav === undefined) return false
        return currentNav === prevNav
      })
      
      return !allSame
    })

    // Agregar índice para el brush
    return filtered.map((item, idx) => ({ ...item, index: idx }))
  }, [investments])

  // Obtener lista única de goals activos
  const activeGoals = useMemo(() => {
    const goalsWithValues = new Map<string, number>()
    
    investments.forEach(inv => {
      if (!goalsWithValues.has(inv.goal_name)) {
        goalsWithValues.set(inv.goal_name, 0)
      }
      goalsWithValues.set(inv.goal_name, goalsWithValues.get(inv.goal_name)! + inv.nav)
    })
    
    return Array.from(goalsWithValues.entries())
      .filter(([_, total]) => total > 0)
      .map(([name]) => name)
      .sort()
  }, [investments])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  // Calcular dominio del eje Y
  const yDomain = useMemo(() => {
    const dataToUse = zoomDomain 
      ? chartData.slice(zoomDomain.start, zoomDomain.end + 1)
      : chartData
      
    const values: number[] = []
    
    dataToUse.forEach(data => {
      activeGoals.forEach(goal => {
        const nav = data[`${goal}_nav`] as number | undefined
        const deposited = data[`${goal}_deposited`] as number | undefined
        if (nav) values.push(nav)
        if (deposited) values.push(deposited)
      })
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
  }, [chartData, activeGoals, zoomDomain])

  // Calcular estadísticas para mostrar
  const stats = useMemo(() => {
    if (chartData.length === 0) return null
    
    const lastDay = chartData[chartData.length - 1]
    const firstDay = chartData[0]
    
    let totalCurrentNav = 0
    let totalFirstNav = 0
    let totalCurrentDeposited = 0
    
    activeGoals.forEach(goal => {
      const currentNav = lastDay[`${goal}_nav`] as number || 0
      const firstNav = firstDay[`${goal}_nav`] as number || 0
      const currentDeposited = lastDay[`${goal}_deposited`] as number || 0
      
      totalCurrentNav += currentNav
      totalFirstNav += firstNav
      totalCurrentDeposited += currentDeposited
    })
    
    const totalProfit = totalCurrentNav - totalCurrentDeposited
    const profitPercent = totalCurrentDeposited > 0 ? (totalProfit / totalCurrentDeposited) * 100 : 0
    
    // Calcular max y min históricos
    let maxNav = 0
    let minNav = Infinity
    
    chartData.forEach(day => {
      let dayTotal = 0
      activeGoals.forEach(goal => {
        dayTotal += (day[`${goal}_nav`] as number) || 0
      })
      if (dayTotal > maxNav) maxNav = dayTotal
      if (dayTotal < minNav && dayTotal > 0) minNav = dayTotal
    })
    
    return {
      totalNav: totalCurrentNav,
      totalProfit,
      profitPercent,
      maxNav,
      minNav,
      daysTracked: chartData.length
    }
  }, [chartData, activeGoals])

  // Handlers para zoom con selección
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
      const leftIdx = chartData.findIndex(d => d.displayDate === refAreaLeft)
      const rightIdx = chartData.findIndex(d => d.displayDate === refAreaRight)
      
      if (leftIdx !== -1 && rightIdx !== -1) {
        const start = Math.min(leftIdx, rightIdx)
        const end = Math.max(leftIdx, rightIdx)
        
        if (end - start >= 2) {
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
      if (brushData.endIndex - brushData.startIndex >= 2) {
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
        <p>No hay datos históricos suficientes para mostrar</p>
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-4", isPrivacyMode && "privacy-blur")}>
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Valor Total</p>
            <p className="text-lg font-bold">{formatCurrencyExact(stats.totalNav)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Ganancia</p>
            <p className={cn(
              "text-lg font-bold",
              stats.totalProfit >= 0 ? "text-success" : "text-destructive"
            )}>
              {stats.totalProfit >= 0 ? "+" : ""}{formatCurrencyExact(stats.totalProfit)}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Rentabilidad</p>
            <p className={cn(
              "text-lg font-bold",
              stats.profitPercent >= 0 ? "text-success" : "text-destructive"
            )}>
              {stats.profitPercent >= 0 ? "+" : ""}{stats.profitPercent.toFixed(2)}%
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Máximo histórico</p>
            <p className="text-lg font-bold text-amber-500">{formatCurrencyExact(stats.maxNav)}</p>
          </div>
        </div>
      )}

      {/* Controles de zoom */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-4">
          {activeGoals.map(goal => (
            <div key={goal} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: goalColors[goal] }}
              />
              <span className="text-muted-foreground">{goal}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          {zoomDomain && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleZoomOut}
              className="h-8 text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reiniciar
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Arrastra en el gráfico para hacer zoom
          </span>
        </div>
      </div>

      {/* Gráfico principal */}
      <div className="select-none cursor-crosshair">
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart 
            data={visibleData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
          <defs>
            {activeGoals.map(goal => (
              <linearGradient key={`gradient_${goal}`} id={`gradient_${goal}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={goalColors[goal]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={goalColors[goal]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#374151" 
            opacity={0.2}
            vertical={false}
          />
          
          <XAxis 
            dataKey="displayDate" 
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
            content={
              <CustomTooltip 
                activeGoals={activeGoals} 
                goalColors={goalColors}
              />
            }
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          
          {/* Área de ganancia con gradiente */}
          {activeGoals.map(goal => (
            <Area
              key={`${goal}_area`}
              type="monotone"
              dataKey={`${goal}_nav`}
              stroke="none"
              fill={`url(#gradient_${goal})`}
              fillOpacity={1}
              connectNulls
              animationDuration={1000}
              animationEasing="ease-out"
            />
          ))}
          
          {/* Líneas de Depositado (punteadas) */}
          {activeGoals.map(goal => {
            const color = goalColors[goal]
            return (
              <Line
                key={`${goal}_deposited`}
                type="monotone"
                dataKey={`${goal}_deposited`}
                name={`${goal} Depositado`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: color, 
                  stroke: '#ffffff', 
                  strokeWidth: 2,
                  opacity: 0.7
                }}
                connectNulls
                legendType="none"
                animationDuration={1200}
                animationEasing="ease-out"
              />
            )
          })}
          
          {/* Líneas de NAV (sólidas) */}
          {activeGoals.map(goal => {
            const color = goalColors[goal]
            return (
              <Line
                key={`${goal}_nav`}
                type="monotone"
                dataKey={`${goal}_nav`}
                name={`${goal} Valor`}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ 
                  r: 6, 
                  fill: color, 
                  stroke: '#ffffff', 
                  strokeWidth: 2 
                }}
                connectNulls
                legendType="none"
                animationDuration={1000}
                animationEasing="ease-out"
              />
            )
          })}

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

      {/* Brush (selector de rango) */}
      <div className="px-4">
        <ResponsiveContainer width="100%" height={50}>
          <ComposedChart data={chartData}>
            <XAxis dataKey="displayDate" hide />
            <YAxis hide domain={yDomain} />
            {activeGoals.map(goal => (
              <Area
                key={`brush_${goal}`}
                type="monotone"
                dataKey={`${goal}_nav`}
                stroke={goalColors[goal]}
                fill={goalColors[goal]}
                fillOpacity={0.3}
                strokeWidth={1}
              />
            ))}
            <Brush
              dataKey="displayDate"
              height={40}
              stroke="#3b82f6"
              fill="transparent"
              travellerWidth={10}
              startIndex={zoomDomain?.start ?? 0}
              endIndex={zoomDomain?.end ?? chartData.length - 1}
              onChange={handleBrushChange}
            >
              <ComposedChart>
                {activeGoals.map(goal => (
                  <Area
                    key={`mini_${goal}`}
                    type="monotone"
                    dataKey={`${goal}_nav`}
                    stroke={goalColors[goal]}
                    fill={goalColors[goal]}
                    fillOpacity={0.2}
                  />
                ))}
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Nota explicativa */}
      <p className="text-xs text-muted-foreground text-center">
        Línea sólida = valor actual • Línea punteada = depositado • Usa el selector de abajo o arrastra en el gráfico para zoom
      </p>
    </div>
  )
}
