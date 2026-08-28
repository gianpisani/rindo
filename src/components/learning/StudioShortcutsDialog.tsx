import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Lo que se puede hacer sin mover la mano de donde está. */
const KEYS: [string, string][] = [
  ["Espacio", "reproducir o pausar"],
  ["← →", "diez segundos atrás o adelante"],
  ["R", "repetir la frase que acaba de sonar"],
  ["E", "capturar una expresión a mano"],
  ["C", "esconder el subtítulo"],
  ["Esc", "cerrar lo que esté abierto, o salir del estudio"],
];

/**
 * Los atajos, detrás de un signo de pregunta.
 *
 * Los botones que hacían esto no vuelven: lo que hacían son teclas, y las
 * teclas se aprenden una vez. Lo que sí hace falta es poder preguntarlas.
 */
export function StudioShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[25rem] gap-0 p-0">
        <div className="p-7">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-[15px] font-semibold">
              Cómo se maneja esto
            </DialogTitle>
          </DialogHeader>

          <dl className="mt-6 space-y-3.5">
            {KEYS.map(([key, what]) => (
              <div key={key} className="flex items-center gap-4">
                <dt className="w-[4.5rem] shrink-0 text-right">
                  <kbd
                    className={cn(
                      "inline-flex h-6 items-center rounded-md px-2",
                      "border border-border/70 bg-muted/50",
                      "font-mono text-[11px] font-medium text-foreground"
                    )}
                  >
                    {key}
                  </kbd>
                </dt>
                <dd className="text-[13px] leading-snug text-muted-foreground">
                  {what}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 border-t border-border/50 pt-5 text-[13px] leading-relaxed text-muted-foreground">
            Lo que más vas a usar no es una tecla. Toca cualquier palabra del
            subtítulo y el video se detiene solo para mostrarte qué significa.
            Al guardarla vuelve a andar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
