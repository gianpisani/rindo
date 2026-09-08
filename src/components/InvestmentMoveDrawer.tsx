import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, LineChart, Check, Loader2 } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useTransactions } from "@/hooks/useTransactions";
import { useFintual } from "@/hooks/useFintual";
import { useSoundFX } from "@/hooks/useSoundFX";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { computeLedger } from "@/hooks/useRealFlows";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Los dos movimientos que tocan el balde invertido y que no son un aporte:
 *
 *   Rescate     — saqué plata de las inversiones y volvió a mi liquidez.
 *   Rendimiento — las inversiones valen otra cosa que lo que puse.
 *
 * El rendimiento se pregunta al revés de como se guarda: uno sabe cuánto
 * valen HOY, no cuánto ganaron. La diferencia contra lo que Rindo tiene
 * registrado es el rendimiento, y puede ser negativa.
 */

type Move = "rescate" | "valor";

const MIN_DELTA = 1_000;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseAmount(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatInput(value: string): string {
  const amount = parseAmount(value);
  return amount ? new Intl.NumberFormat("es-CL").format(amount) : "";
}

interface InvestmentMoveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Movimiento con el que abre. Por defecto, el rescate. */
  defaultMove?: Move;
}

export function InvestmentMoveDrawer({
  open,
  onOpenChange,
  defaultMove = "rescate",
}: InvestmentMoveDrawerProps) {
  const { transactions, addTransaction } = useTransactions();
  const { isConnected, totals } = useFintual();
  const { playCelebration, playTap } = useSoundFX();
  const { isPrivacyMode } = usePrivacyMode();

  const [move, setMove] = useState<Move>(defaultMove);
  const [rescateAmount, setRescateAmount] = useState("");
  const [rescateDetail, setRescateDetail] = useState("");
  const [valorHoy, setValorHoy] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Abre siempre en el movimiento con el que lo llamaron.
  useEffect(() => {
    if (open) setMove(defaultMove);
  }, [open, defaultMove]);

  const invertido = useMemo(
    () => computeLedger(transactions).invertido,
    [transactions]
  );

  const rescate = parseAmount(rescateAmount);
  const valor = parseAmount(valorHoy);
  const delta = valor - invertido;
  const hasValor = valorHoy.trim().length > 0;
  const alDia = hasValor && Math.abs(delta) < MIN_DELTA;

  const close = () => {
    setRescateAmount("");
    setRescateDetail("");
    setValorHoy("");
    onOpenChange(false);
  };

  const handleRescate = async () => {
    if (rescate <= 0) return;
    setIsSaving(true);
    try {
      await addTransaction.mutateAsync({
        date: new Date().toISOString(),
        detail: rescateDetail.trim() || null,
        category_name: "Rescate",
        type: "Rescate",
        amount: rescate,
      });
      playCelebration();
      close();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRendimiento = async () => {
    if (!hasValor || alDia) return;
    setIsSaving(true);
    try {
      await addTransaction.mutateAsync({
        date: new Date().toISOString(),
        detail: `Inversiones valen ${formatCurrency(valor)}`,
        category_name: "Rendimiento",
        type: "Rendimiento",
        amount: delta,
      });
      playCelebration();
      toast.success(
        delta > 0
          ? `Tu patrimonio subió ${formatCurrency(delta)}`
          : `Tu patrimonio bajó ${formatCurrency(Math.abs(delta))}`
      );
      close();
    } finally {
      setIsSaving(false);
    }
  };

  const moves: { key: Move; label: string; icon: typeof ArrowDownToLine; active: string }[] = [
    {
      key: "rescate",
      label: "Saqué plata",
      icon: ArrowDownToLine,
      active: "border-cyan-500/40 bg-cyan-500/10 text-cyan-500",
    },
    {
      key: "valor",
      label: "Actualizar valor",
      icon: LineChart,
      active: "border-violet-500/40 bg-violet-500/10 text-violet-500",
    },
  ];

  return (
    <BaseModal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Inversiones"
      description="Lo que sale de las inversiones y lo que crece solo"
      maxWidth="sm"
    >
      <div className="space-y-5">
        {/* Cuánto tiene registrado Rindo en el balde invertido */}
        <div className="flex items-baseline justify-between rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Invertido según Rindo
          </span>
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              isPrivacyMode && "privacy-blur"
            )}
          >
            {formatCurrency(invertido)}
          </span>
        </div>

        {/* Qué movimiento */}
        <div className="grid grid-cols-2 gap-2">
          {moves.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMove(m.key);
                playTap();
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors",
                move === m.key
                  ? m.active
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {move === "rescate" ? (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-muted-foreground">
                $
              </span>
              <Input
                autoFocus
                inputMode="numeric"
                placeholder="0"
                value={formatInput(rescateAmount)}
                onChange={(e) => setRescateAmount(e.target.value)}
                className={cn(
                  "h-16 pl-9 text-center font-mono text-3xl font-bold text-cyan-500",
                  "border-border/60 focus-visible:ring-0",
                  isPrivacyMode && rescateAmount && "privacy-blur"
                )}
              />
            </div>
            <Input
              placeholder="¿De dónde la sacaste? (opcional)"
              value={rescateDetail}
              onChange={(e) => setRescateDetail(e.target.value)}
              className="h-11 rounded-xl text-center text-sm"
            />
            <p className="text-center text-[11px] text-muted-foreground">
              Vuelve a tu liquidez. Tu patrimonio no cambia: cambia de balde.
            </p>
            <Button
              onClick={handleRescate}
              disabled={rescate <= 0 || isSaving}
              className="h-12 w-full rounded-xl bg-cyan-500 text-sm font-medium hover:bg-cyan-500/90"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Rescatar {rescate > 0 ? formatCurrency(rescate) : ""}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg text-muted-foreground">
                $
              </span>
              <Input
                autoFocus
                inputMode="numeric"
                placeholder="0"
                value={formatInput(valorHoy)}
                onChange={(e) => setValorHoy(e.target.value)}
                className={cn(
                  "h-16 pl-9 text-center font-mono text-3xl font-bold text-violet-500",
                  "border-border/60 focus-visible:ring-0",
                  isPrivacyMode && valorHoy && "privacy-blur"
                )}
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              ¿Cuánto valen hoy tus inversiones, en total?
            </p>

            {isConnected && totals.totalNav > 0 && (
              <button
                type="button"
                onClick={() => setValorHoy(String(Math.round(totals.totalNav)))}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <img src="/isotipo-fintual.png" alt="" className="h-3.5 w-3.5" />
                Usar el valor de Fintual
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCurrency(totals.totalNav)}
                </span>
              </button>
            )}

            {hasValor && (
              <div
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-center animate-in fade-in slide-in-from-top-1 duration-200",
                  alDia
                    ? "border-border/60 bg-muted/30"
                    : delta > 0
                      ? "border-violet-500/30 bg-violet-500/5"
                      : "border-rose-500/30 bg-rose-500/5"
                )}
              >
                {alDia ? (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5" />
                    Ya está al día, no hay nada que registrar
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {delta > 0 ? "Ganaron" : "Perdieron"}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 font-mono text-2xl font-bold tabular-nums",
                        delta > 0 ? "text-violet-500" : "text-rose-500",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {delta > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(delta))}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Tu patrimonio {delta > 0 ? "sube" : "baja"} eso. Tu liquidez
                      no cambia.
                    </p>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleRendimiento}
              disabled={!hasValor || alDia || isSaving}
              className="h-12 w-full rounded-xl bg-violet-500 text-sm font-medium hover:bg-violet-500/90"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Registrar rendimiento"
              )}
            </Button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

export default InvestmentMoveDrawer;
