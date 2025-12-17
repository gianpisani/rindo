import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts'
import { format } from 'date-fns'
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact'
    }).format(value)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: entry.color }}>
              {formatCurrency(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FintualHistoryChart({ investments }: FintualHistoryChartProps) {
  const { isPrivacyMode } = usePrivacyMode()

  // Procesar datos para el gráfico
  const chartData = useMemo(() => {
    // Agrupar por fecha y goal
    const groupedByDate = investments.reduce((acc, inv) => {
      const date = format(new Date(inv.snapshot_date), 'dd MMM', { locale: es })
      
      if (!acc[date]) {
        acc[date] = { date }
      }
      
      acc[date][inv.goal_name] = inv.nav
      
      return acc
    }, {} as Record<string, any>)

    // Convertir a array y ordenar por fecha
    return Object.values(groupedByDate).sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })
  }, [investments])

  // Obtener lista única de goals para las líneas
  const goals = useMemo(() => {
    const uniqueGoals = new Set<string>()
    investments.forEach(inv => uniqueGoals.add(inv.goal_name))
    return Array.from(uniqueGoals)
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
      notation: 'compact'
    }).format(value)
  }

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
            dataKey="date" 
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
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          {goals.map((goal, index) => (
            <Line
              key={goal}
              type="monotone"
              dataKey={goal}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ 
                fill: colors[index % colors.length], 
                strokeWidth: 2,
                r: 4,
                stroke: '#ffffff'
              }}
              activeDot={{ 
                r: 6, 
                fill: colors[index % colors.length], 
                stroke: '#ffffff', 
                strokeWidth: 2 
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
