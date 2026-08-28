import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Crosshair, FileText, List, RefreshCw, Trash2 } from "lucide-react";

interface TranscriptActionsProps {
  cueCount: number;
  /** La pista de subtítulos va detrás del video. */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  onBring: () => void;
  onDelete: () => void;
  /** Abre la transcripción completa. */
  onOpenText: () => void;
}

/**
 * Qué hacer con los subtítulos, ahora que el texto ya no vive acá.
 *
 * El texto ya no vive en la pantalla: se lee sobre el video, que es donde
 * miras. Pero "¿dónde dijo eso?" sigue existiendo, así que la transcripción
 * completa queda a un clic —abierta cuando la buscas, ocupando cero cuando no.
 */
export function TranscriptActions({
  cueCount,
  follow,
  onFollowChange,
  onBring,
  onDelete,
  onOpenText,
}: TranscriptActionsProps) {
  const hasTranscript = cueCount > 0;

  return (
    <div className="shrink-0 rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
          <h3 className="text-xs font-semibold">Subtítulos</h3>
        </div>
        {hasTranscript && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {cueCount} líneas
          </span>
        )}
      </div>

      {hasTranscript ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ActionChip
            onClick={onOpenText}
            icon={<List className="h-3 w-3" />}
            label="Ver el texto"
            title="La transcripción completa, para buscar dónde se dijo algo"
          />
          <ActionChip
            onClick={() => onFollowChange(!follow)}
            icon={<Crosshair className="h-3 w-3" />}
            label={follow ? "Sincronizados" : "Scroll libre"}
            title={
              follow
                ? "La pista se mueve con el video — tócalo para soltarla"
                : "La pista no te sigue — tócalo para volver a sincronizar"
            }
            active={follow}
          />
          <ActionChip
            onClick={onBring}
            icon={<RefreshCw className="h-3 w-3" />}
            label="Reemplazar"
            title="Traer la transcripción de nuevo"
          />
          <ActionChip
            onClick={onDelete}
            icon={<Trash2 className="h-3 w-3" />}
            label="Borrar"
            title="Eliminar la transcripción guardada"
            danger
          />
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Todavía no los tienes. Se traen una vez y quedan guardados para
            siempre.
          </p>
          <Button
            onClick={onBring}
            size="sm"
            className="mt-2 h-8 w-full rounded-xl"
          >
            Traer subtítulos
          </Button>
        </>
      )}
      {hasTranscript && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-3.5 border-b-2 border-dotted border-[var(--band-4)]" />
            sobre tu nivel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-3.5 border-b-2 border-primary" />
            ya la tienes
          </span>
        </div>
      )}
    </div>
  );
}

function ActionChip({
  onClick,
  icon,
  label,
  title,
  active,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
        danger && "hover:border-destructive/40 hover:text-destructive"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
