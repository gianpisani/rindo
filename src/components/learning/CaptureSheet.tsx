import type { RefObject } from "react";
import { Check, Highlighter, Pencil, Play, Search, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/learning-config";
import { WordLookup } from "./WordLookup";

interface CaptureSheetProps {
  /** En pausa la ficha se ve igual, pero no se guarda nada. */
  lookupOnly: boolean;
  /** Si la expresión se está escribiendo a mano. */
  editingTerm: boolean;
  expression: string;
  onExpressionChange: (value: string) => void;
  onExpressionDone: () => void;
  expressionRef: RefObject<HTMLInputElement>;
  /** La frase donde apareció. */
  context: string;
  /** En qué segundo del video se preguntó. */
  capturedAt: number | null;
  autoEnabled: boolean;
  onToggleAuto: () => void;
  /** En automático ya quedó guardada: no hay nada que apretar. */
  alreadySaved: boolean;
  onMeaning: (meaning: string) => void;
  onTranslation: (translation: string | null) => void;
  onSave: () => void;
  onResumeAndSave: () => void;
  onEditTerm: () => void;
  onClose: () => void;
}

/**
 * La respuesta: qué significa la palabra que tocaste.
 *
 * Sube desde abajo, desde donde estaba la palabra, y se planta sobre el video
 * en penumbra. Eso es toda la idea de esta pantalla: cuando preguntas, el video
 * no se encoge —se retira—. El cuadro sigue detrás porque es el contexto de la
 * palabra, pero deja de competir, y la ficha se queda con el ancho entero en
 * vez de con los doce rem de una columna lateral.
 *
 * Y la salida no está debajo del pliegue: guardar es lo que uno viene a hacer,
 * así que vive en su propia fila al pie, siempre a la vista.
 */
export function CaptureSheet({
  lookupOnly,
  editingTerm,
  expression,
  onExpressionChange,
  onExpressionDone,
  expressionRef,
  context,
  capturedAt,
  autoEnabled,
  onToggleAuto,
  alreadySaved,
  onMeaning,
  onTranslation,
  onSave,
  onResumeAndSave,
  onEditTerm,
  onClose,
}: CaptureSheetProps) {
  const ready = expression.trim().length > 1;

  return (
    <div
      className={cn(
        "studio-glass flex w-[min(52rem,calc(100vw-1.5rem))] flex-col rounded-2xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-200"
      )}
    >
      {/* ── De qué se trata ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2.5">
        {lookupOnly ? (
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Highlighter className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        <h3 className="shrink-0 text-xs font-semibold">
          {lookupOnly ? "Consultar" : "Capturar"}
        </h3>
        {capturedAt !== null && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            en {formatClock(capturedAt)}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!lookupOnly && (
            <button
              onClick={onToggleAuto}
              title={
                autoEnabled
                  ? "Automático: tocar una palabra la guarda sola con su significado"
                  : "Activar guardado automático al tocar una palabra"
              }
              className={cn(
                "flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors",
                "text-[10px] font-bold uppercase tracking-wide",
                autoEnabled
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className={cn("h-3 w-3", autoEnabled && "fill-current")} />
              Auto
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar y seguir el video (Esc)"
            className={cn(
              "flex size-6 items-center justify-center rounded-lg",
              "text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Lo que significa ── */}
      <div className="flex min-h-[6.5rem] flex-col gap-2.5 px-4 py-3.5">
        {editingTerm && (
          <Input
            ref={expressionRef}
            value={expression}
            onChange={(e) => onExpressionChange(e.target.value)}
            onBlur={() => expression.trim() && onExpressionDone()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onExpressionDone();
                if (!lookupOnly && expression.trim()) onSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="come across"
            className="h-10 shrink-0 rounded-xl text-base font-medium"
          />
        )}

        {ready ? (
          <WordLookup
            compact
            term={expression}
            contextSentence={context}
            onUseDefinition={onMeaning}
            onTranslation={onTranslation}
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Escribe la expresión que quieres guardar.
          </p>
        )}
      </div>

      {/* ── Qué se hace con ella ── */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border/50 px-4 py-2.5">
        {lookupOnly ? (
          <>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
              La sesión está en pausa: esto es solo para mirar.
            </p>
            <Button
              onClick={onResumeAndSave}
              disabled={!expression.trim()}
              className="h-9 shrink-0 rounded-xl px-4 font-semibold"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Reanudar y guardar
            </Button>
          </>
        ) : alreadySaved ? (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5 shrink-0" />
              Guardada en tu diccionario
            </span>
            <Button
              onClick={onClose}
              className="h-9 shrink-0 rounded-xl px-4 font-semibold"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Seguir
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onEditTerm}
              variant="ghost"
              title="Corregir la expresión"
              className="h-9 shrink-0 rounded-xl px-2.5 text-xs text-muted-foreground"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Corregir
            </Button>
            <span className="min-w-0 flex-1" />
            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
              <kbd className="rounded bg-foreground/10 px-1 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              cierra y sigue
            </span>
            <Button
              onClick={onSave}
              disabled={!expression.trim()}
              className="h-9 shrink-0 rounded-xl px-4 font-semibold"
            >
              Guardar
              <kbd className="ml-2 rounded bg-black/15 px-1 font-mono text-[10px]">
                ⏎
              </kbd>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
