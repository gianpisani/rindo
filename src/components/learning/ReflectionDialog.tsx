import { useEffect, useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  COMPREHENSION_QUESTIONS,
  DIFFICULTY_CONFIG,
  DIFFICULTY_ORDER,
  MAX_COMPREHENSION,
  type ContentProgress,
  type Difficulty,
} from "@/lib/learning-config";
import type { ReflectionInput } from "@/hooks/useActiveLearningSession";

interface ReflectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reflection: ReflectionInput) => void;
  isSubmitting?: boolean;
  /** Avance dentro del contenido, para adaptar el texto y la salida rápida. */
  progress?: ContentProgress | null;
}

type Answers = Partial<Record<(typeof COMPREHENSION_QUESTIONS)[number]["key"], number>>;

export function ReflectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  progress,
}: ReflectionDialogProps) {
  const [mainIdea, setMainIdea] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  useEffect(() => {
    if (!open) return;
    setMainIdea("");
    setAnswers({});
    setDifficulty(null);
  }, [open]);

  const leftPartway = !!progress?.isPartial;

  const answeredCount = COMPREHENSION_QUESTIONS.filter(
    (q) => answers[q.key] !== undefined
  ).length;
  const isComplete = answeredCount === COMPREHENSION_QUESTIONS.length;

  const score = COMPREHENSION_QUESTIONS.reduce(
    (acc, q) => acc + (answers[q.key] ?? 0),
    0
  );

  /**
   * Guardar sin nota. El tiempo y las expresiones cuentan igual; la
   * comprensión queda vacía en vez de inventada.
   */
  const handleSkip = () => {
    onSubmit({
      comp_main_idea: null,
      comp_details: null,
      comp_subtitles: null,
      comp_explain: null,
      main_idea_text: mainIdea.trim() || null,
      difficulty,
    });
  };

  const handleSubmit = () => {
    if (!isComplete) return;
    onSubmit({
      comp_main_idea: answers.comp_main_idea!,
      comp_details: answers.comp_details!,
      comp_subtitles: answers.comp_subtitles!,
      comp_explain: answers.comp_explain!,
      main_idea_text: mainIdea.trim() || null,
      difficulty,
    });
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={leftPartway ? "Lo dejaste a medias" : "Antes de cerrar"}
      description={
        leftPartway
          ? `Vas en ${progress?.percent}% · puedes retomarlo cuando quieras`
          : "Cuarenta segundos y queda medido"
      }
      maxWidth="lg"
      footer={
        <div className="space-y-2">
          {isComplete && (
            <p className="text-center text-sm">
              <span className="text-muted-foreground">Comprensión </span>
              <span className="font-bold text-primary">
                {score} / {MAX_COMPREHENSION}
              </span>
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!isComplete || isSubmitting}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isComplete ? (
              "Guardar sesión"
            ) : (
              `Faltan ${COMPREHENSION_QUESTIONS.length - answeredCount}`
            )}
          </Button>

          <Button
            onClick={handleSkip}
            disabled={isSubmitting}
            variant="ghost"
            className="w-full h-9 rounded-xl text-muted-foreground hover:text-foreground"
          >
            Guardar sin evaluar y salir
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {leftPartway && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              El tiempo y las expresiones de este rato ya están guardados.
              Puedes evaluar lo que alcanzaste a ver, o guardarlo sin nota y
              retomar el video después desde{" "}
              <span className="font-medium text-foreground">Seguir viendo</span>.
            </p>
          </div>
        )}

        {/* Idea principal, en inglés */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">What was the main idea?</h3>
            <p className="text-xs text-muted-foreground">
              En inglés, como te salga. Nadie más lo lee.
            </p>
          </div>
          <Textarea
            value={mainIdea}
            onChange={(e) => setMainIdea(e.target.value)}
            placeholder="The video argues that…"
            rows={3}
            className="rounded-xl resize-none"
          />
        </div>

        {/* Comprensión */}
        <div className="space-y-3">
          {COMPREHENSION_QUESTIONS.map((q) => (
            <div key={q.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{q.label}</span>
                <span className="text-[11px] text-muted-foreground text-right shrink-0">
                  {q.hint}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {q.options.map((option, value) => {
                  const isSelected = answers[q.key] === value;
                  return (
                    <button
                      key={option}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [q.key]: value }))
                      }
                      className={cn(
                        "px-2 py-2.5 rounded-xl text-xs font-medium border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Dificultad percibida */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">¿Cómo se sintió?</h3>
            <p className="text-xs text-muted-foreground">
              Sirve para encontrar el nivel donde más aprendes.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTY_ORDER.map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              const isSelected = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(isSelected ? null : d)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    "flex items-center gap-1.5",
                    isSelected
                      ? cn(config.border, config.bg, "text-foreground")
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <span>{config.emoji}</span>
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
