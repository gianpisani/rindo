import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'
import { cn } from '@/lib/utils'

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

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  const formatCurrencyExact = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
      <div className="space-y-2">
        {payload.map((entry, index) => {
          const goalName = entry.name as string
          const currentValue = entry.value as number
          const firstValue = entry.payload[`${goalName}_first`]
          const changePercent = firstValue 
            ? ((currentValue - firstValue) / firstValue) * 100 
            : 0
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-muted-foreground">{goalName}:</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: entry.color }}>
                  {formatCurrencyExact(currentValue)}
                </span>
              </div>
              {firstValue && (
                <div className="flex items-center justify-end gap-1 text-xs">
                  <span className={changePercent >= 0 ? "text-success" : "text-destructive"}>
                    {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground">desde inicio</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FintualHistoryChart({ investments }: FintualHistoryChartProps) {
  const { isPrivacyMode } = usePrivacyMode()

  // Procesar datos para el gráfico
  const chartData = useMemo(() => {
    // Agrupar por DÍA (sin hora) y goal
    const groupedByDay = investments.reduce((acc, inv) => {
      const dateObj = parseISO(inv.snapshot_date)
      const dayKey = format(dateObj, 'yyyy-MM-dd') // Solo día, sin hora
      
      if (!acc[dayKey]) {
        acc[dayKey] = { 
          dayKey,
          dateObj,
          displayDate: format(dateObj, 'dd MMM', { locale: es })
        }
      }
      
      // Solo guardar el último valor del día para cada goal
      acc[dayKey][inv.goal_name] = inv.nav
      
      return acc
    }, {} as Record<string, any>)

    // Convertir a array y ordenar cronológicamente (más antiguo a más reciente)
    const sortedData = Object.values(groupedByDay).sort((a, b) => {
      return a.dateObj.getTime() - b.dateObj.getTime()
    })

    // Guardar el primer valor de cada goal para calcular % después
    const goals = new Set<string>()
    investments.forEach(inv => goals.add(inv.goal_name))
    
    const firstValues: Record<string, number> = {}
    goals.forEach(goal => {
      const firstDay = sortedData.find(d => d[goal])
      if (firstDay) {
        firstValues[goal] = firstDay[goal]
      }
    })

    // Agregar valores iniciales a cada punto para el tooltip
    return sortedData.map(data => {
      const enhanced = { ...data }
      goals.forEach(goal => {
        if (firstValues[goal]) {
          enhanced[`${goal}_first`] = firstValues[goal]
        }
      })
      return enhanced
    })
  }, [investments])

  // Obtener lista única de goals y filtrar los que tienen valores > 0
  const { activeGoals, leftAxisGoals, rightAxisGoals } = useMemo(() => {
    const goalsWithValues = new Map<string, number>()
    
    // Calcular el promedio de cada goal
    investments.forEach(inv => {
      if (!goalsWithValues.has(inv.goal_name)) {
        goalsWithValues.set(inv.goal_name, 0)
      }
      goalsWithValues.set(inv.goal_name, goalsWithValues.get(inv.goal_name)! + inv.nav)
    })
    
    // Filtrar goals con valor promedio > 0
    const active = Array.from(goalsWithValues.entries())
      .filter(([_, total]) => total > 0)
      .map(([name]) => name)
      .sort()
    
    // Dividir en dos ejes: primero en left, segundo en right, resto en left
    const left = active.length > 0 ? [active[0]] : []
    const right = active.length > 1 ? [active[1]] : []
    
    // Si hay más de 2, agregar el resto al eje izquierdo
    if (active.length > 2) {
      left.push(...active.slice(2))
    }
    
    return {
      activeGoals: active,
      leftAxisGoals: left,
      rightAxisGoals: right
    }
  }, [investments])

  // Colores para cada línea
  const colors = [
    '#3b82f6', // blue-500
    '#10b981', // green-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  // Calcular dominios independientes para cada eje
  const { leftDomain, rightDomain } = useMemo(() => {
    const getGoalDomain = (goals: string[]) => {
      const values: number[] = []
      
      chartData.forEach(data => {
        goals.forEach(goal => {
          if (data[goal] && data[goal] > 0) {
            values.push(data[goal])
          }
        })
      })

      if (values.length === 0) return ['auto', 'auto']

      const min = Math.min(...values)
      const max = Math.max(...values)
      const range = max - min
      const padding = range * 0.15
      
      return [
        Math.floor(min - padding),
        Math.ceil(max + padding)
      ]
    }

    return {
      leftDomain: getGoalDomain(leftAxisGoals),
      rightDomain: getGoalDomain(rightAxisGoals)
    }
  }, [chartData, leftAxisGoals, rightAxisGoals])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No hay datos históricos suficientes para mostrar</p>
      </div>
    )
  }

  return (
    <div className={cn("w-full", isPrivacyMode && "privacy-blur")}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis 
            dataKey="displayDate" 
            stroke="#94a3b8" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          
          {/* Eje Y izquierdo */}
          <YAxis 
            yAxisId="left"
            stroke={colors[0]}
            tickFormatter={formatCurrency} 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={leftDomain}
          />
          
          {/* Eje Y derecho (solo si hay goals para el eje derecho) */}
          {rightAxisGoals.length > 0 && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={colors[1]}
              tickFormatter={formatCurrency} 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={rightDomain}
            />
          )}
          
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          
          {/* Líneas del eje izquierdo */}
          {leftAxisGoals.map((goal, index) => (
            <Line
              key={goal}
              yAxisId="left"
              type="monotone"
              dataKey={goal}
              name={goal}
              stroke={colors[index * 2 % colors.length]}
              strokeWidth={2}
              dot={{ 
                fill: colors[index * 2 % colors.length], 
                strokeWidth: 2,
                r: 4,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 6, 
                fill: colors[index * 2 % colors.length], 
                stroke: '#ffffff', 
                strokeWidth: 2 
              }}
              connectNulls
            />
          ))}
          
          {/* Líneas del eje derecho */}
          {rightAxisGoals.map((goal, index) => (
            <Line
              key={goal}
              yAxisId="right"
              type="monotone"
              dataKey={goal}
              name={goal}
              stroke={colors[(index * 2 + 1) % colors.length]}
              strokeWidth={2}
              dot={{ 
                fill: colors[(index * 2 + 1) % colors.length], 
                strokeWidth: 2,
                r: 4,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 6, 
                fill: colors[(index * 2 + 1) % colors.length], 
                stroke: '#ffffff', 
                strokeWidth: 2 
              }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
