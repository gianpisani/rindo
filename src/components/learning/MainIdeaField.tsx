import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil } from "lucide-react";
import { MAX_FACE_VALUE } from "@/lib/learning-config";
import { useMainIdea } from "@/hooks/useLearningSessions";

interface MainIdeaFieldProps {
  sessionId: string;
  /** Lo que ya habías escrito, si escribiste. */
  value: string | null;
  /** La respuesta a "¿lo explicarías en inglés?", para ajustar el tono. */
  explainScore?: number | null;
  className?: string;
}

/**
 * Explicar el video con tus palabras, en inglés.
 *
 * Vive DESPUÉS de guardar, nunca antes: es lo más valioso que se puede hacer
 * al terminar un video y también lo más caro de escribir, así que ponerlo como
 * requisito para salir era justamente lo que hacía que nadie cerrara una
 * sesión. Acá no bloquea nada y se puede volver a editar cuando quieras.
 */
export function MainIdeaField({
  sessionId,
  value,
  explainScore,
  className,
}: MainIdeaFieldProps) {
  const saveMainIdea = useMainIdea();
  /**
   * Lo guardado se lleva acá y no se lee del prop: la tarjeta de cierre
   * recibe la sesión tal como la devolvió el guardado, así que nunca se
   * enteraría de lo que escribiste después.
   */
  const [saved, setSaved] = useState(value ?? "");
  const [text, setText] = useState(value ?? "");
  const [editing, setEditing] = useState(!value);

  // Al cambiar de sesión (o al llegar el dato) se recarga lo escrito.
  useEffect(() => {
    setSaved(value ?? "");
    setText(value ?? "");
    setEditing(!value);
  }, [value, sessionId]);

  const trimmed = text.trim();
  const isDirty = trimmed !== saved.trim();

  const save = () => {
    saveMainIdea.mutate(
      { id: sessionId, text: trimmed || null },
      {
        onSuccess: () => {
          setSaved(trimmed);
          setEditing(!trimmed);
        },
      }
    );
  };

  // Ya escribiste: se muestra como lo que es, un texto tuyo.
  if (!editing) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            La idea principal, según tú
          </p>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        </div>
        <p className="text-sm leading-relaxed rounded-xl bg-muted/30 border border-border/50 p-3">
          {saved}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <h3 className="text-sm font-semibold">What was the main idea?</h3>
        <p className="text-xs text-muted-foreground">
          {explainScore !== null && explainScore !== undefined
            ? explainScore >= MAX_FACE_VALUE - 1
              ? "Dijiste que podías explicarlo. Aprovecha que está fresco."
              : "Aunque sea una línea, como te salga. Nadie más lo lee."
            : "En inglés, como te salga. Nadie más lo lee."}
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="The video argues that…"
        rows={3}
        className="rounded-xl resize-none"
      />

      {(isDirty || saved) && (
        <div className="flex justify-end gap-2">
          {saved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(saved);
                setEditing(false);
              }}
              className="rounded-xl text-muted-foreground"
            >
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            onClick={save}
            disabled={!isDirty || saveMainIdea.isPending}
            className="rounded-xl font-semibold"
          >
            {saveMainIdea.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
