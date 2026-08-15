import { useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Wand2,
  ExternalLink,
  ClipboardPaste,
  Check,
  ChevronDown,
  MousePointer2,
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
      <div className="min-w-0 flex-1 pb-1">
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
  const [showManual, setShowManual] = useState(false);

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Traer los subtítulos"
      description="Se configura una sola vez. Después es un clic por video."
      maxWidth="lg"
      footer={
        <Button
          onClick={() => {
            onPasteFromClipboard();
            onOpenChange(false);
          }}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          <ClipboardPaste className="h-5 w-5 mr-2" />
          Ya lo aprete — pegar acá
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Qué es esto */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            YouTube no deja que Rindo baje los subtítulos por su cuenta. Pero sí
            los muestra en su página. Este botón hace lo mismo que harías tú a
            mano: los abre, los lee y te los copia.
          </p>
        </div>

        {/* Configuración, una sola vez */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">
            Una sola vez
          </p>

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

            <Step n={3} title="Chrome te va a preguntar: aprieta «Guardar»">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Se abre una ventana que dice{" "}
                  <span className="font-medium text-foreground">
                    «Editar marcador»
                  </span>{" "}
                  con el nombre y una URL larguísima llena de símbolos raros.
                </p>
                <p className="text-xs mt-2 flex items-start gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Eso es normal y significa que funcionó.
                    </span>{" "}
                    Esa URL rara es el programa. Solo aprieta Guardar.
                  </span>
                </p>
              </div>
            </Step>
          </div>
        </div>

        {/* Cada vez */}
        <div className="border-t border-border/50 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Cada video, de ahí en adelante
          </p>

          <div className="space-y-4">
            <Step n={4} title="Abre el video en YouTube">
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

            <Step
              n={5}
              title="Estando ahí, aprieta el marcador «Subtítulos → Rindo»"
            >
              <p className="text-xs text-muted-foreground">
                Aparecerá un aviso verde diciendo cuántas líneas copió.
              </p>
            </Step>

            <Step n={6} title="Vuelve a Rindo y aprieta el botón de abajo" />
          </div>
        </div>

        {/* Aviso de doblaje */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Ojo:</span> si el video
            está doblado, YouTube te dará los subtítulos en español. Cambia el
            idioma a inglés en el panel de transcripción antes de apretar el
            marcador.
          </p>
        </div>

        {/* Salida manual */}
        <div>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showManual && "rotate-180")}
            />
            No quiero marcadores, prefiero hacerlo a mano
          </button>

          {showManual && (
            <ol className="text-xs text-muted-foreground mt-3 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Abre el video en YouTube</li>
              <li>
                Bajo el video, en la descripción, aprieta{" "}
                <span className="font-medium text-foreground">…más</span>
              </li>
              <li>
                Abajo del todo aparece{" "}
                <span className="font-medium text-foreground">
                  Mostrar transcripción
                </span>
                . Apriétalo.
              </li>
              <li>
                Se abre un panel a la derecha con el texto y los minutos.
                Selecciona todo ese texto y cópialo.
              </li>
              <li>Vuelve acá y aprieta el botón de abajo.</li>
            </ol>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
