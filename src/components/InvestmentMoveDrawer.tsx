import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/hooks/useTransactions";
import { useSoundFX } from "@/hooks/useSoundFX";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { computeLedger } from "@/hooks/useRealFlows";
import { parseWhisper } from "@/lib/whisper";
import { cn } from "@/lib/utils";
import "./whisper.css";

/**
 * Los dos movimientos que tocan el balde invertido y que no son un aporte:
 *
 *   Rescate     — saqué plata de las inversiones y volvió a mi liquidez.
 *   Rendimiento — las inversiones valen otra cosa que lo que puse.
 *
 * El rendimiento se pregunta al revés de como se guarda: uno sabe cuánto
 * valen HOY, no cuánto ganaron. La diferencia contra lo que Rindo tiene
 * registrado es el rendimiento, y puede ser negativa.
 *
 * Va en el formato del Whisper: la pastilla de arriba elige el movimiento
 * (Tab lo cambia), la línea grande es el monto, y la vista previa dice qué
 * va a pasar antes de guardar.
 */

type Move = "rescate" | "valor";

const MIN_DELTA = 1_000;

const MOVES: { key: Move; label: string; color: string; placeholder: string }[] = [
  { key: "rescate", label: "Rescate", color: "#22d3ee", placeholder: "200000 retiro del fondo" },
  { key: "valor", label: "Rendimiento", color: "#a78bfa", placeholder: "12500000" },
];
const LOSS_COLOR = "#f87171";

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
  const { playCelebration, playTap } = useSoundFX();
  const { isPrivacyMode } = usePrivacyMode();

  const [move, setMove] = useState<Move>(defaultMove);
  const [rescateValue, setRescateValue] = useState("");
  const [valorHoy, setValorHoy] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abre siempre en el movimiento con el que lo llamaron.
  useEffect(() => {
    if (open) setMove(defaultMove);
  }, [open, defaultMove]);

  const invertido = useMemo(
    () => computeLedger(transactions).invertido,
    [transactions]
  );

  const current = MOVES.find((m) => m.key === move)!;
  const rescateParsed = parseWhisper(rescateValue);
  const rescate = rescateParsed?.amount ?? 0;
  const valor = parseAmount(valorHoy);
  const delta = valor - invertido;
  const hasValor = valorHoy.trim().length > 0;
  const alDia = hasValor && Math.abs(delta) < MIN_DELTA;
  const ready = move === "rescate" ? rescate > 0 : hasValor && !alDia;

  const changeMove = (next: Move) => {
    setMove(next);
    playTap();
    inputRef.current?.focus();
  };
  const cycleMove = () => changeMove(move === "rescate" ? "valor" : "rescate");

  const close = () => {
    setRescateValue("");
    setValorHoy("");
    onOpenChange(false);
  };

  const handleRescate = async () => {
    if (rescate <= 0) return;
    setIsSaving(true);
    try {
      await addTransaction.mutateAsync({
        date: new Date().toISOString(),
        detail: rescateParsed?.detail ?? null,
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (move === "rescate") void handleRescate();
    else void handleRendimiento();
  };

  // La vista previa: lo que se va a guardar, en el color del movimiento.
  // Una pérdida va en rojo aunque el movimiento sea violeta.
  const previewTone = move === "valor" && hasValor && !alDia && delta < 0 ? LOSS_COLOR : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": current.color } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Inversiones</Dialog.Title>
          <Dialog.Description className="sr-only">
            Lo que sale de las inversiones y lo que crece solo. Tab cambia entre rescate y rendimiento. Para el rescate escribe el monto y, si quieres, de dónde salió. Para el rendimiento escribe cuánto valen hoy tus inversiones en total.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type">
              <span className="whisper-dot" aria-hidden="true" />
              <span aria-hidden="true">{current.label}</span>
              <select
                aria-label="Movimiento"
                value={move}
                onChange={(event) => changeMove(event.target.value as Move)}
              >
                {MOVES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </div>

            <div className="whisper-entry">
              {move === "rescate" ? (
                <input
                  key="rescate"
                  ref={inputRef}
                  aria-label="Monto del rescate y de dónde salió"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={200}
                  value={rescateValue}
                  onChange={(event) => setRescateValue(event.target.value)}
                  placeholder={current.placeholder}
                  className={cn("whisper-input", isPrivacyMode && rescateValue && "privacy-blur")}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      cycleMove();
                    }
                  }}
                />
              ) : (
                <input
                  key="valor"
                  ref={inputRef}
                  aria-label="Cuánto valen hoy tus inversiones"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={20}
                  value={valorHoy}
                  onChange={(event) => setValorHoy(event.target.value.replace(/\D/g, ""))}
                  placeholder={current.placeholder}
                  className={cn("whisper-input", isPrivacyMode && valorHoy && "privacy-blur")}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      cycleMove();
                    }
                  }}
                />
              )}
              <div
                className={cn("whisper-preview", isPrivacyMode && "privacy-blur")}
                style={previewTone ? { color: previewTone } : undefined}
                aria-hidden="true"
              >
                {move === "rescate" ? (
                  rescate > 0 && <span>rescatas {formatCurrency(rescate)}</span>
                ) : hasValor ? (
                  alDia ? (
                    <span>ya está al día, no hay nada que registrar</span>
                  ) : (
                    <span>
                      {delta > 0 ? "ganaron +" : "perdieron −"}
                      {formatCurrency(Math.abs(delta))}
                    </span>
                  )
                ) : null}
              </div>
            </div>

            <div className="whisper-category-space">
              <p className="whisper-caption" aria-live="polite">
                {move === "rescate" ? (
                  "Vuelve a tu liquidez. Tu patrimonio no cambia: cambia de balde."
                ) : hasValor && !alDia ? (
                  <>Tu patrimonio {delta > 0 ? "sube" : "baja"} eso. Tu liquidez no cambia.</>
                ) : (
                  "¿Cuánto valen hoy tus inversiones, en total?"
                )}
                <br />
                Invertido según Rindo:{" "}
                <span className={cn("whisper-inv-amount", isPrivacyMode && "privacy-blur")}>{formatCurrency(invertido)}</span>
              </p>
            </div>

            <div className="whisper-actions">
              <button
                type="submit"
                className="whisper-submit"
                disabled={!ready || isSaving}
                aria-label={move === "rescate" ? "Rescatar" : "Registrar rendimiento"}
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    {move === "rescate" ? (
                      <span className={cn(isPrivacyMode && rescate > 0 && "privacy-blur")}>
                        Rescatar{rescate > 0 ? ` ${formatCurrency(rescate)}` : ""}
                      </span>
                    ) : (
                      "Registrar rendimiento"
                    )}
                    <span className="hidden sm:inline" aria-hidden="true">↵</span>
                    <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
            <p className="whisper-shortcuts">
              <span>
                <kbd>Tab</kbd> movimiento
              </span>
              <span>
                <kbd>↵</kbd> guardar
              </span>
              <span>
                <kbd>Esc</kbd> cerrar
              </span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default InvestmentMoveDrawer;
