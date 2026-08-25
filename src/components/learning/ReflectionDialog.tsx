import { useEffect, useRef, useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  COMPREHENSION_FACES,
  COMPREHENSION_QUESTIONS,
  MAX_COMPREHENSION,
  type ContentProgress,
} from "@/lib/learning-config";
import type { ReflectionInput } from "@/hooks/useActiveLearningSession";

interface ReflectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reflection: ReflectionInput) => void;
  isSubmitting?: boolean;
  /** Avance dentro del contenido: bajo el mínimo no se pregunta nada. */
  progress?: ContentProgress | null;
}

type Answers = Partial<Record<(typeof COMPREHENSION_QUESTIONS)[number]["key"], number>>;

/**
 * Bajo este avance no se pide comprensión: evaluar tres minutos de un video
 * de cuarenta no mide nada. Se guarda como fragmento y listo.
 */
const MIN_RATIO_TO_ASK = 0.25;

/**
 * Lo que se espera desde la tercera cara hasta guardar. Suficiente para ver
 * que quedó marcada y para arrepentirse, no tanto como para tener que
 * confirmar con otro botón.
 */
const AUTOSAVE_MS = 900;

/**
 * El check de salida.
 *
 * Tres preguntas, cinco caras, cero texto que leer, cero escapatoria: no hay
 * botón de cerrar ni "guardar sin evaluar". El formulario anterior pedía
 * escribir un párrafo en inglés y elegir entre doce opciones de texto después
 * de cuarenta minutos de video; se contestó cero veces en nueve días.
 */
export function ReflectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  progress,
}: ReflectionDialogProps) {
  const [answers, setAnswers] = useState<Answers>({});
  /**
   * El auto-guardado dispara una sola vez. Sin esto, un guardado que falla
   * deja el diálogo abierto y completo, y el efecto lo reintentaría en bucle.
   */
  const [autoSaved, setAutoSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setAutoSaved(false);
  }, [open]);

  const ratio = progress?.ratio ?? null;
  const isFragment = ratio !== null && ratio < MIN_RATIO_TO_ASK;

  const answeredCount = COMPREHENSION_QUESTIONS.filter(
    (q) => answers[q.key] !== undefined
  ).length;
  const isComplete = answeredCount === COMPREHENSION_QUESTIONS.length;

  const score = COMPREHENSION_QUESTIONS.reduce(
    (acc, q) => acc + (answers[q.key] ?? 0),
    0
  );

  const submit = () => {
    if (isFragment) {
      onSubmit({
        comp_main_idea: null,
        comp_subtitles: null,
        comp_explain: null,
        main_idea_text: null,
      });
      return;
    }
    if (!isComplete) return;
    onSubmit({
      comp_main_idea: answers.comp_main_idea!,
      comp_subtitles: answers.comp_subtitles!,
      comp_explain: answers.comp_explain!,
      main_idea_text: null,
    });
  };

  // Guarda solo. Cada cara nueva reinicia la cuenta, así cambiar de opinión
  // en el último segundo no dispara el guardado a medias.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (!open || isFragment || !isComplete || isSubmitting || autoSaved) return;
    const timer = setTimeout(() => {
      setAutoSaved(true);
      submitRef.current();
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [open, isFragment, isComplete, isSubmitting, autoSaved, answers]);

  return (
    <BaseModal
      open={open}
      // Obligatorio: cerrar no es una opción. El único camino es responder.
      onOpenChange={() => undefined}
      dismissible={false}
      title={isFragment ? "Lo dejaste temprano" : "¿Cómo te fue?"}
      description={
        isFragment
          ? `Vas en ${progress?.percent ?? 0}% · retómalo cuando quieras`
          : "Tres toques y listo"
      }
      maxWidth="lg"
      footer={
        isFragment ? (
          <Button
            onClick={submit}
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Guardar y salir"
            )}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 h-12">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Guardando…</span>
              </>
            ) : isComplete && autoSaved ? (
              <Button
                onClick={submit}
                className="w-full h-11 font-semibold rounded-xl"
              >
                Guardar sesión
              </Button>
            ) : isComplete ? (
              <p className="text-sm">
                <span className="font-bold text-primary tabular-nums">
                  {score}/{MAX_COMPREHENSION}
                </span>
                <span className="text-muted-foreground"> · guardando…</span>
              </p>
            ) : (
              <div className="flex items-center gap-1.5">
                {COMPREHENSION_QUESTIONS.map((q) => (
                  <span
                    key={q.key}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      answers[q.key] !== undefined
                        ? "w-6 bg-primary"
                        : "w-6 bg-border"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )
      }
    >
      {isFragment ? (
        <p className="text-sm text-muted-foreground leading-relaxed text-center py-4">
          El tiempo y las expresiones de este rato ya están guardados. No te
          pregunto qué entendiste porque {progress?.percent ?? 0}% de un video
          no alcanza para medirlo.
        </p>
      ) : (
        <div className="space-y-7 pt-1">
          {COMPREHENSION_QUESTIONS.map((q) => (
            <FaceQuestion
              key={q.key}
              icon={q.icon}
              label={q.label}
              anchors={q.anchors}
              value={answers[q.key]}
              onChange={(value) =>
                setAnswers((prev) => ({ ...prev, [q.key]: value }))
              }
            />
          ))}
        </div>
      )}
    </BaseModal>
  );
}

// ── Una pregunta, cinco caras ───────────────────────────────

function FaceQuestion({
  icon,
  label,
  anchors,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  anchors: [string, string, string];
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const answered = value !== undefined;

  return (
    <div>
      <p className="text-sm font-semibold flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        {label}
      </p>

      <div className="grid grid-cols-5 gap-1 mt-2.5">
        {COMPREHENSION_FACES.map((face, index) => {
          const isSelected = value === index;
          return (
            <button
              key={face}
              type="button"
              onClick={() => onChange(index)}
              aria-label={`${label} — ${index + 1} de ${COMPREHENSION_FACES.length}`}
              className={cn(
                "aspect-square rounded-2xl border flex items-center justify-center",
                "transition-all duration-150 active:scale-95",
                isSelected
                  ? "border-primary bg-primary/10 scale-[1.06] shadow-sm"
                  : "border-border/60 hover:border-border hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "text-[26px] sm:text-3xl leading-none transition-all duration-150",
                  isSelected
                    ? "grayscale-0 opacity-100"
                    : answered
                      ? "grayscale opacity-40"
                      : "grayscale-[0.35] opacity-80"
                )}
              >
                {face}
              </span>
            </button>
          );
        })}
      </div>

      {/* El criterio va en los extremos: el de la izquierda manda para la cara
          de la izquierda y el de la derecha para la de la derecha. */}
      <div className="grid grid-cols-5 gap-1 mt-1.5">
        <span className="col-span-2 text-[11px] text-muted-foreground text-left">
          {anchors[0]}
        </span>
        <span className="text-[10px] text-muted-foreground/60 text-center">
          {anchors[1]}
        </span>
        <span className="col-span-2 text-[11px] text-muted-foreground text-right">
          {anchors[2]}
        </span>
      </div>
    </div>
  );
}
