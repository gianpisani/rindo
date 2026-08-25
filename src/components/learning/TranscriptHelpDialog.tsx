import { useEffect, useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Wand2,
  ExternalLink,
  ClipboardPaste,
  Check,
  ChevronLeft,
  MousePointer2,
  HelpCircle,
} from "lucide-react";
import { TRANSCRIPT_BOOKMARKLET } from "@/lib/transcript-bookmarklet";

interface TranscriptHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalId: string;
  onPasteFromClipboard: () => void;
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const BAR_SHORTCUT = isMac ? "⌘ + ⇧ + B" : "Ctrl + Shift + B";

const SETUP_KEY = "rindo:transcript-bookmarklet-listo";

/** Recuerda si ya se configuró el marcador para no volver a explicarlo. */
function useSetupDone() {
  const [done, setDone] = useState(true);

  useEffect(() => {
    try {
      setDone(localStorage.getItem(SETUP_KEY) === "1");
    } catch {
      setDone(false);
    }
  }, []);

  const markDone = () => {
    setDone(true);
    try {
      localStorage.setItem(SETUP_KEY, "1");
    } catch {
      /* modo privado: da igual, solo se pierde el recuerdo */
    }
  };

  return { done, markDone };
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold tabular-nums">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

export function TranscriptHelpDialog({
  open,
  onOpenChange,
  externalId,
  onPasteFromClipboard,
}: TranscriptHelpDialogProps) {
  const [view, setView] = useState<"usar" | "configurar">("usar");
  const { done, markDone } = useSetupDone();

  // Cada vez que se abre, se vuelve a la vista de uso.
  useEffect(() => {
    if (open) setView("usar");
  }, [open]);

  const paste = () => {
    markDone();
    onPasteFromClipboard();
    onOpenChange(false);
  };

  if (view === "configurar") {
    return (
      <BaseModal
        open={open}
        onOpenChange={onOpenChange}
        title="Configurar el marcador"
        description="Son tres pasos y no lo vuelves a hacer nunca."
        maxWidth="lg"
        footer={
          <Button
            onClick={() => {
              markDone();
              setView("usar");
            }}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            Listo, ya lo arrastré
          </Button>
        }
      >
        <div className="space-y-5">
          <button
            onClick={() => setView("usar")}
            className="flex items-center gap-1 -ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Volver
          </button>

          <div className="space-y-4">
            <Step n={1} title="Muestra la barra de marcadores de Chrome">
              <p className="text-xs text-muted-foreground">
                Es la barra de links bajo la dirección web. Si no la ves, aprieta{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">
                  {BAR_SHORTCUT}
                </kbd>
              </p>
            </Step>

            <Step n={2} title="Arrastra este botón hasta esa barra">
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                <a
                  href={TRANSCRIPT_BOOKMARKLET}
                  draggable
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Este no se aprieta acá", {
                      description:
                        "Arrástralo hasta la barra de marcadores de arriba.",
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl",
                    "border border-primary/50 bg-primary/15 text-primary",
                    "font-semibold text-sm cursor-grab active:cursor-grabbing",
                    "hover:bg-primary/25 transition-colors select-none"
                  )}
                >
                  <Wand2 className="h-4 w-4" />
                  Subtítulos → Rindo
                </a>

                <p className="text-[11px] text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
                  <MousePointer2 className="h-3 w-3" />
                  Tómalo con el mouse y suéltalo arriba. No lo hagas clic acá.
                </p>
              </div>
            </Step>

            <Step n={3} title="Chrome te pregunta: aprieta «Guardar»">
              <p className="text-xs flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  Va a mostrar una URL larguísima llena de símbolos raros.{" "}
                  <span className="font-medium text-foreground">
                    Eso es normal
                  </span>
                  : esa URL es el programa.
                </span>
              </p>
            </Step>
          </div>

          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              YouTube no deja que Rindo baje los subtítulos por su cuenta, pero
              sí los muestra en su página. El marcador hace lo mismo que harías
              tú a mano: los abre, los lee y te los copia.
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Si el video está doblado</span>,
              YouTube te dará los subtítulos en español. Cambia el idioma a
              inglés en el panel de transcripción antes de apretar el marcador.
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Sin marcador:</span>{" "}
              en YouTube abre «…más» bajo el video, aprieta «Mostrar
              transcripción», selecciona todo ese panel y cópialo.
            </p>
          </div>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Traer los subtítulos"
      description="Un clic en YouTube y los pegas acá."
      maxWidth="lg"
      footer={
        <Button
          onClick={paste}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          <ClipboardPaste className="h-5 w-5 mr-2" />
          Pegar los subtítulos
        </Button>
      }
    >
      <div className="space-y-5">
        {!done && (
          <button
            onClick={() => setView("configurar")}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl p-3 text-left",
              "border border-primary/40 bg-primary/10",
              "hover:bg-primary/15 transition-colors"
            )}
          >
            <HelpCircle className="h-4 w-4 text-primary shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-primary">
                ¿Es primera vez?
              </span>
              <span className="block text-xs text-muted-foreground">
                Hay que configurarlo una sola vez. Te muestro cómo.
              </span>
            </span>
          </button>
        )}

        <div className="space-y-4">
          <Step n={1} title="Abre el video en YouTube">
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <a
                href={`https://www.youtube.com/watch?v=${externalId}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir este video
              </a>
            </Button>
          </Step>

          <Step n={2} title="Aprieta el marcador «Subtítulos → Rindo»" />

          <Step n={3} title="Vuelve acá y pégalos" />
        </div>

        {done && (
          <button
            onClick={() => setView("configurar")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border"
          >
            No tengo el marcador
          </button>
        )}
      </div>
    </BaseModal>
  );
}
