import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface FintualInvestment {
  id: string
  goal_id: string
  goal_name: string
  nav: number
  deposited: number
  profit: number
  profit_percentage: number
  fund_name: string | null
  snapshot_date: string
}

interface FintualSyncResponse {
  success: boolean
  message?: string
  error?: string
  investments?: Array<{
    goal_id: string
    goal_name: string
    nav: number
    deposited: number
    profit: number
    profit_percentage: number
    fund_name: string | null
  }>
  tokenExpired?: boolean
}

export function useFintual() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [investments, setInvestments] = useState<FintualInvestment[]>([])
  const [historicalData, setHistoricalData] = useState<FintualInvestment[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  // Verificar si hay conexión activa
  useEffect(() => {
    checkConnection()
  }, [])

  // Cargar últimas inversiones guardadas
  useEffect(() => {
    if (isConnected) {
      loadInvestments()
    }
  }, [isConnected])

  const checkConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('fintual_tokens')
        .select('last_synced_at')
        .eq('user_id', user.id)
        .single()

      if (!error && data) {
        setIsConnected(true)
        setLastSyncedAt(data.last_synced_at)
      } else {
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Error checking Fintual connection:', error)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  const loadInvestments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Obtener TODOS los snapshots para el gráfico histórico
      const { data, error } = await supabase
        .from('fintual_investments')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: false })

      if (error) throw error

      // Guardar todos los datos históricos
      setHistoricalData(data || [])

      // Filtrar para obtener solo el último snapshot de cada goal
      const latestByGoal = new Map<string, FintualInvestment>()
      
      data?.forEach((inv) => {
        if (!latestByGoal.has(inv.goal_id)) {
          latestByGoal.set(inv.goal_id, inv)
        }
      })

      setInvestments(Array.from(latestByGoal.values()))
    } catch (error) {
      console.error('Error loading investments:', error)
    }
  }

  const connect = async (email: string, password: string) => {
    try {
      setIsLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      console.log('Conectando a Fintual...', {
        url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fintual-auth`,
        hasToken: !!session.access_token
      })

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fintual-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Error ${response.status}: ${errorText || 'No se pudo conectar con el servidor'}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error conectando con Fintual')
      }

      toast.success('Tu cuenta de Fintual se ha conectado exitosamente')

      setIsConnected(true)
      
      // Sincronizar datos inmediatamente después de conectar
      await sync()

      return true
    } catch (error: any) {
      console.error('Error connecting to Fintual:', error)
      toast.error(error.message || 'No se pudo conectar con Fintual')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const sync = async () => {
    try {
      setIsSyncing(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      console.log('Sincronizando con Fintual...')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fintual-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Error ${response.status}: ${errorText || 'No se pudo sincronizar'}`)
      }

      const result: FintualSyncResponse = await response.json()

      if (!result.success) {
        if (result.tokenExpired) {
          setIsConnected(false)
          toast.error('Token expirado. Reconecta tu cuenta de Fintual')
          return false
        }
        throw new Error(result.error || 'Error sincronizando con Fintual')
      }

      toast.success(result.message || 'Datos actualizados exitosamente')

      setLastSyncedAt(new Date().toISOString())
      await loadInvestments()

      return true
    } catch (error: any) {
      console.error('Error syncing with Fintual:', error)
      toast.error(error.message || 'No se pudo sincronizar con Fintual')
      return false
    } finally {
      setIsSyncing(false)
    }
  }

  const disconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('fintual_tokens')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Tu cuenta de Fintual ha sido desconectada')

      setIsConnected(false)
      setInvestments([])
      setLastSyncedAt(null)
    } catch (error) {
      console.error('Error disconnecting from Fintual:', error)
      toast.error('No se pudo desconectar de Fintual')
    }
  }

  // Calcular totales
  const totals = investments.reduce(
    (acc, inv) => ({
      totalNav: acc.totalNav + Number(inv.nav),
      totalDeposited: acc.totalDeposited + Number(inv.deposited),
      totalProfit: acc.totalProfit + Number(inv.profit),
    }),
    { totalNav: 0, totalDeposited: 0, totalProfit: 0 }
  )

  const totalProfitPercentage =
    totals.totalDeposited > 0
      ? (totals.totalProfit / totals.totalDeposited) * 100
      : 0

  return {
    isConnected,
    isLoading,
    isSyncing,
    investments,
    historicalData,
    lastSyncedAt,
    totals: { ...totals, totalProfitPercentage },
    connect,
    sync,
    disconnect,
    reload: loadInvestments,
  }
}
