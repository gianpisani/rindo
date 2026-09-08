import { useState } from 'react'
import Layout from '@/components/Layout'
import { useFintual } from '@/hooks/useFintual'
import { Screen, Row, Panel } from '@/components/HairlineGrid'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Clock,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertCircle
} from 'lucide-react'
import { FintualConnectionModal } from '@/components/FintualConnectionModal'
import { FintualHistoryChart } from '@/components/FintualHistoryChart'
import { cn } from '@/lib/utils'
import { usePrivacyMode } from '@/hooks/usePrivacyMode'

const BENEFITS = [
  'Ver todos tus objetivos de inversión en un solo lugar',
  'Consultar saldos actualizados de tus inversiones',
  'Revisar rentabilidad histórica de cada objetivo',
  'Tener un cuadre automático de tus finanzas completas',
]

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

  /** Compacto a propósito: va dentro de un .eyebrow, no en un párrafo. */
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-CL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const profitIsPositive = totals.totalProfit >= 0

  if (isLoading) {
    /* Estado de carga: es un bloque centrado, no una grilla de paneles,
       así que no se le fuerza el Screen. Los círculos de acá son
       decorativos (glow, anillo, partículas) y siguen redondos. */
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />

            {/* Anillo giratorio */}
            <div className="absolute -inset-2 rounded-full border-2 border-transparent border-t-blue-500/40 animate-spin [animation-duration:2s]" />

            {/* Isotipo Fintual */}
            <img
              src="/isotipo-fintual.png"
              alt="Fintual"
              className="relative z-10 h-16 w-16 animate-breathe"
            />

            {/* Partículas orbitales */}
            <div className="absolute inset-0 animate-spin [animation-duration:1.5s]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="absolute inset-0 animate-spin [animation-duration:2s] [animation-direction:reverse]">
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-blue-400" />
            </div>
          </div>

          <div className="text-center">
            <p className="section-title text-base">Cargando inversiones</p>
            <p className="mt-1 text-sm text-muted-foreground">Obteniendo tus datos de Fintual...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isConnected) {
    /* Sin conexión: la identidad como franja y la invitación como la fila
       que cede — el pitch a la izquierda, lo que gana a la derecha. Así
       la pantalla se llena en vez de dejar una tarjeta flotando. */
    return (
      <Layout bleed>
        <Screen>
          <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
            <img src="/isotipo-fintual.png" alt="Fintual" className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <h1 className="page-title text-xl md:text-2xl">Fintual</h1>
              <p className="eyebrow mt-1">Sin conectar</p>
            </div>
          </Panel>

          <Row className="lg:min-h-0 lg:flex-1 lg:grid-cols-[1.1fr_1fr]">
            <Panel className="flex flex-col justify-center px-5 py-8 md:px-8">
              <img src="/logo-fintual.png" alt="Fintual" className="h-10 self-start opacity-90" />
              <h2 className="section-title mt-5 text-xl">Conecta tu cuenta de Fintual</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Sincroniza tus inversiones automáticamente y ten todo centralizado
                en un solo lugar.
              </p>

              {/* La nota de seguridad: tira de pelo con su tono, sin caja
                  ni relleno teñido. La misma gramática que Inicio. */}
              <div className="mt-5 flex items-start gap-2.5 border-y border-border py-2.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <p className="min-w-0 text-[11px] leading-snug">
                  <span className="font-semibold">100% seguro</span>
                  <span className="text-muted-foreground">
                    {' · '}Nunca guardaremos tu contraseña.
                  </span>
                </p>
              </div>

              <Button
                onClick={() => setShowConnectionModal(true)}
                className="mt-5 self-start bg-blue-500 hover:bg-blue-600"
                size="lg"
              >
                <LinkIcon className="mr-2 h-5 w-5" />
                Conectar mi cuenta
              </Button>
              <p className="mt-2.5 max-w-md text-xs text-muted-foreground">
                Al conectar aceptas que accedamos a tus datos de inversión de Fintual.
              </p>
            </Panel>

            <Panel className="flex flex-col justify-center px-5 py-8 md:px-8">
              <p className="eyebrow">Qué podrás hacer</p>
              <div className="mt-4 space-y-2.5">
                {BENEFITS.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-success">✓</span>
                    <p className="min-w-0 text-sm text-muted-foreground">{benefit}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </Row>
        </Screen>

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
    <Layout bleed>
      {/* Mismo chasis que Inicio: identidad, la nota de sincronización, la
          franja de totales, y los objetivos como la fila que cede. El
          gráfico va abajo del pliegue porque tiene alto propio (350px de
          canvas) y no sabe ceder. */}
      <Screen>
        {/* ── Fila 1 — identidad y los verbos de la página ───────── */}
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
          <img src="/isotipo-fintual.png" alt="Fintual" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="page-title text-xl md:text-2xl">Fintual</h1>
            <p className="eyebrow mt-1">
              {investments.length}{' '}
              {investments.length === 1 ? 'objetivo' : 'objetivos'}
              {lastSyncedAt ? ` · al ${formatDate(lastSyncedAt)}` : ''}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={sync} disabled={isSyncing} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              <span className="hidden sm:inline">
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Unlink className="h-4 w-4" />
              <span className="hidden sm:inline">Desconectar</span>
            </Button>
          </div>
        </Panel>

        {/* ── Fila 2 — la nota de sincronización. Franja de chrome. ─ */}
        <Panel className="flex items-start gap-2.5 px-4 py-2 md:px-5 lg:shrink-0">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="min-w-0 text-[11px] leading-snug text-muted-foreground">
            Se sincroniza solo todos los días a las{' '}
            <span className="font-semibold text-foreground">19:30 hrs</span> (Chile).
            Podés sincronizar a mano cuando quieras.
          </p>
        </Panel>

        {/* ── Fila 3 — los tres totales ──────────────────────────── */}
        <Row className="grid-cols-1 sm:grid-cols-3 lg:shrink-0">
          <Panel className="px-4 py-3.5 md:px-5">
            <p className="eyebrow">Saldo total</p>
            <p
              className={cn(
                'mt-2 font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl',
                isPrivacyMode && 'privacy-blur'
              )}
            >
              {formatCurrency(totals.totalNav)}
            </p>
          </Panel>

          <Panel className="px-4 py-3.5 md:px-5">
            <p className="eyebrow">Depositado</p>
            <p
              className={cn(
                'mt-2 font-mono text-lg font-bold tracking-tight tabular-nums text-muted-foreground md:text-xl',
                isPrivacyMode && 'privacy-blur'
              )}
            >
              {formatCurrency(totals.totalDeposited)}
            </p>
          </Panel>

          <Panel className="px-4 py-3.5 md:px-5">
            <p className="eyebrow">Rentabilidad</p>
            <div className="mt-2 flex items-baseline gap-2">
              {profitIsPositive ? (
                <TrendingUp className="h-4 w-4 shrink-0 self-center text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 self-center text-destructive" />
              )}
              <p
                className={cn(
                  'font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl',
                  profitIsPositive ? 'text-success' : 'text-destructive',
                  isPrivacyMode && 'privacy-blur'
                )}
              >
                {profitIsPositive ? '+' : ''}
                {formatCurrency(totals.totalProfit)}
              </p>
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  profitIsPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {totals.totalProfitPercentage.toFixed(2)}%
              </span>
            </div>
          </Panel>
        </Row>

        {/* ── Fila 4 — los objetivos. Esta es la que cede: la lista
            scrollea por dentro y llena cualquier alto. ──────────── */}
        <Panel className="flex flex-col lg:min-h-0 lg:flex-1">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5 md:px-5">
            <h2 className="section-title text-base">Objetivos</h2>
            {investments.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {investments.length}
              </span>
            )}
          </div>

          {investments.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <div className="flex size-14 items-center justify-center border border-border">
                <PiggyBank className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="section-title text-sm">Sin inversiones registradas</p>
              <p className="text-xs text-muted-foreground">
                Sincroniza para traer tus objetivos de Fintual.
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto lg:min-h-0 lg:flex-1">
              {/* Rótulos de columna: solo cuando la fila es una línea. */}
              <div className="sticky top-0 z-10 hidden items-center gap-3 border-b border-border bg-card px-4 py-1.5 md:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_9rem_9rem_11rem]">
                <span className="eyebrow">Objetivo</span>
                <span className="eyebrow text-right">Saldo</span>
                <span className="eyebrow text-right">Depositado</span>
                <span className="eyebrow text-right">Rentabilidad</span>
              </div>

              {investments.map((investment) => {
                const invProfitIsPositive = investment.profit >= 0

                return (
                  <div
                    key={investment.id}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 md:px-5 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_11rem] lg:items-center lg:gap-3"
                  >
                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <p className="truncate text-sm font-semibold">
                        {investment.goal_name}
                      </p>
                      {investment.fund_name && (
                        <p className="eyebrow mt-0.5 truncate">{investment.fund_name}</p>
                      )}
                    </div>

                    <div className="min-w-0 lg:text-right">
                      <p className="eyebrow lg:hidden">Saldo</p>
                      <p
                        className={cn(
                          'font-mono text-sm font-semibold tabular-nums',
                          isPrivacyMode && 'privacy-blur'
                        )}
                      >
                        {formatCurrency(investment.nav)}
                      </p>
                    </div>

                    <div className="min-w-0 lg:text-right">
                      <p className="eyebrow lg:hidden">Depositado</p>
                      <p
                        className={cn(
                          'font-mono text-sm tabular-nums text-muted-foreground',
                          isPrivacyMode && 'privacy-blur'
                        )}
                      >
                        {formatCurrency(investment.deposited)}
                      </p>
                    </div>

                    <div className="col-span-2 min-w-0 lg:col-span-1 lg:text-right">
                      <p className="eyebrow lg:hidden">Rentabilidad</p>
                      <div className="flex items-baseline gap-2 lg:justify-end">
                        <p
                          className={cn(
                            'font-mono text-sm font-semibold tabular-nums',
                            invProfitIsPositive ? 'text-success' : 'text-destructive',
                            isPrivacyMode && 'privacy-blur'
                          )}
                        >
                          {invProfitIsPositive ? '+' : ''}
                          {formatCurrency(investment.profit)}
                        </p>
                        <span
                          className={cn(
                            'font-mono text-[11px] tabular-nums',
                            invProfitIsPositive ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {investment.profit_percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </Screen>

      {/* ── ABAJO DEL PLIEGUE — el gráfico, que tiene alto propio ── */}
      {historicalData.length > 1 && (
        <div className="grid gap-px border-b border-border bg-border">
          <Panel className="px-4 py-4 md:px-5">
            <h2 className="section-title mb-3 text-base">Evolución histórica</h2>
            <FintualHistoryChart investments={historicalData} />
          </Panel>
        </div>
      )}

      <FintualConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        onConnect={connect}
        isLoading={isLoading}
      />
    </Layout>
  )
}
