import { useState } from 'react'
import Layout from '@/components/Layout'
import { useFintual } from '@/hooks/useFintual'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  Link as LinkIcon, 
  Unlink, 
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  PiggyBank,
  AlertCircle
} from 'lucide-react'
import { FintualConnectionModal } from '@/components/FintualConnectionModal'
import { FintualHistoryChart } from '@/components/FintualHistoryChart'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'

export default function Fintual() {
  const {
    isConnected,
    isLoading,
    isSyncing,
    investments,
    historicalData,
    lastSyncedAt,
    totals,
    connect,
    sync,
    disconnect,
  } = useFintual()

  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const { isPrivacyMode } = usePrivacyMode()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const profitIsPositive = totals.totalProfit >= 0

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            
            {/* Anillo giratorio */}
            <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-blue-500/40 animate-spin [animation-duration:2s]" />
            
            {/* Isotipo Fintual */}
            <img 
              src="/isotipo-fintual.png" 
              alt="Fintual" 
              className="relative z-10 h-16 w-16 animate-breathe drop-shadow-lg"
            />
            
            {/* Partículas orbitales */}
            <div className="absolute inset-0 animate-spin [animation-duration:1.5s]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="absolute inset-0 animate-spin [animation-duration:2s] [animation-direction:reverse]">
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold">Cargando inversiones</p>
            <p className="text-sm text-muted-foreground">Obteniendo tus datos de Fintual...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isConnected) {
    return (
      <Layout>
        <div className="space-y-6">
          {/* Header con logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/isotipo-fintual.png" 
                alt="Fintual" 
                className="h-12 w-12"
              />
              <div>
                <h1 className="text-2xl font-semibold mb-1">Fintual</h1>
                <p className="text-sm text-muted-foreground">
                  Conecta tu cuenta para sincronizar tus inversiones
                </p>
              </div>
            </div>
          </div>

          {/* Card de conexión */}
          <GlassCard className="p-12">
            <div className="flex flex-col items-center justify-center space-y-6 max-w-md mx-auto text-center">
              <img 
                src="/logo-fintual.png" 
                alt="Fintual Logo" 
                className="h-16 opacity-90"
              />
              
              <div className="space-y-2">
                <h3 className="font-semibold text-xl">Conecta tu cuenta de Fintual</h3>
                <p className="text-sm text-muted-foreground">
                  Sincroniza tus inversiones automáticamente y ten todo centralizado en un solo lugar
                </p>
              </div>

              <Alert className="border-blue-500/30 bg-blue-500/5 text-left">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">100% seguro</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                  Nunca guardaremos tu contraseña.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 w-full">
                <Button
                  onClick={() => setShowConnectionModal(true)}
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  size="lg"
                >
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Conectar mi cuenta
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Al conectar aceptas que accedamos a tus datos de inversión de Fintual
                </p>
              </div>

              <div className="pt-6 border-t border-white/5 w-full">
                <h4 className="font-medium mb-3">¿Qué podrás hacer?</h4>
                <div className="grid gap-2 text-sm text-muted-foreground text-left">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">✓</div>
                    <div>Ver todos tus objetivos de inversión en un solo lugar</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">✓</div>
                    <div>Consultar saldos actualizados de tus inversiones</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">✓</div>
                    <div>Revisar rentabilidad histórica de cada objetivo</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">✓</div>
                    <div>Tener un cuadre automático de tus finanzas completas</div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <FintualConnectionModal
          open={showConnectionModal}
          onOpenChange={setShowConnectionModal}
          onConnect={connect}
          isLoading={isLoading}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img 
              src="/isotipo-fintual.png" 
              alt="Fintual" 
              className="h-12 w-12"
            />
            <div>
              <h1 className="text-2xl font-semibold mb-1">Mis inversiones en Fintual</h1>
              {lastSyncedAt && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Última actualización: {formatDate(lastSyncedAt)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={sync}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <Button
              variant="outline"
              onClick={disconnect}
              className="text-destructive hover:text-destructive"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          </div>
        </div>

        {/* Info de sincronización automática */}
        <Alert className="border-blue-500/20 bg-blue-500/5">
          <Clock className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            Tus inversiones se sincronizan automáticamente todos los días a las <strong>19:30 hrs (Chile)</strong>. 
            Puedes sincronizar manualmente en cualquier momento si lo necesitas.
          </AlertDescription>
        </Alert>

        {/* Resumen general */}
        <div className="grid gap-4 md:grid-cols-3">
          <GlassCard className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Saldo Total</p>
                <p className={cn("text-3xl font-bold", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(totals.totalNav)}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Depositado</p>
                <p className={cn("text-3xl font-bold text-gray-400", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(totals.totalDeposited)}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Rentabilidad</p>
                <p className={cn(
                  "text-3xl font-bold",
                  profitIsPositive ? "text-success" : "text-destructive",
                  isPrivacyMode && "privacy-blur"
                )}>
                  {profitIsPositive ? "+" : ""}
                  {formatCurrency(totals.totalProfit)}
                </p>
                <p className={cn(
                  "text-sm mt-1",
                  profitIsPositive ? "text-success" : "text-destructive"
                )}>
                  {totals.totalProfitPercentage.toFixed(2)}%
                </p>
              </div>
              <div className={cn(
                "rounded-lg p-3",
                profitIsPositive ? "bg-success/10" : "bg-destructive/10"
              )}>
                {profitIsPositive ? (
                  <TrendingUp className="h-6 w-6 text-success" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-destructive" />
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Gráfico de evolución histórica */}
        {historicalData.length > 1 && (
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold mb-4">Evolución Histórica</h2>
            <FintualHistoryChart investments={historicalData} />
          </GlassCard>
        )}

        {/* Lista de inversiones */}
        {investments.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Mis Objetivos ({investments.length})
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {investments.map((investment) => {
                const invProfitIsPositive = investment.profit >= 0
                
                return (
                  <GlassCard key={investment.id} className="p-6">
                    <div className="space-y-4">
                      {/* Header del objetivo */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">
                            {investment.goal_name}
                          </h3>
                          {investment.fund_name && (
                            <Badge variant="outline" className="text-xs">
                              {investment.fund_name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={cn("text-2xl font-bold", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(investment.nav)}
                          </p>
                          <p className="text-sm text-muted-foreground">Saldo actual</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Detalles */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Depositado</p>
                          <p className={cn("font-semibold", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(investment.deposited)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Ganancia/Pérdida</p>
                          <p className={cn(
                            "font-semibold",
                            invProfitIsPositive ? "text-success" : "text-destructive",
                            isPrivacyMode && "privacy-blur"
                          )}>
                            {invProfitIsPositive ? "+" : ""}
                            {formatCurrency(investment.profit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Rentabilidad</p>
                          <div className="flex items-center gap-2">
                            {invProfitIsPositive ? (
                              <TrendingUp className="h-4 w-4 text-success" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            )}
                            <p className={cn(
                              "font-semibold",
                              invProfitIsPositive ? "text-success" : "text-destructive"
                            )}>
                              {investment.profit_percentage.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )
              })}
            </div>
          </div>
        ) : (
          <GlassCard className="p-12">
            <div className="text-center text-muted-foreground">
              <p>No hay inversiones registradas en Fintual</p>
            </div>
          </GlassCard>
        )}
      </div>

      <FintualConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        onConnect={connect}
        isLoading={isLoading}
      />
    </Layout>
  )
}
