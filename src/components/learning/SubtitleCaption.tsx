import { cn } from "@/lib/utils";
import { sliceWords, segmentAtWord, type Block, type Cue } from "@/lib/transcript";
import { usePhraseSelection, type PhraseSpan } from "@/hooks/usePhraseSelection";
import { DockLine, type WordMark } from "./DockLine";

interface SubtitleCaptionProps {
  /** El bloque que se está diciendo. Null = todavía no empieza. */
  block: Block | null;
  /** Hasta qué palabra llegó la voz dentro del bloque. */
  word: number;
  onPick: (term: string, cue: Cue) => void;
  markOf?: (word: string) => WordMark | null;
  /** Con la ficha abierta la frase se aparta: la respuesta manda. */
  dimmed?: boolean;
}

/**
 * Lo que se está diciendo, sobre el video y tocable.
 *
 * Es el arreglo de un problema que se veía todos los días y no se nombraba:
 * había dos subtítulos en pantalla. El de YouTube, quemado sobre la cara —donde
 * de verdad miras cuando alguien habla— y el de Rindo, trescientos píxeles más
 * abajo. Distinto texto, distinto corte, y el único tocable era el de abajo.
 *
 * Así que el de YouTube se apaga y este ocupa su lugar. La palabra que no
 * entendiste aparece donde ya estabas mirando y se toca ahí mismo: se acabó el
 * viaje de bajar la vista, encontrar la línea y llegar dos segundos tarde.
 *
 * En la sala es el segundo elemento de la jerarquía, después de la imagen, y el
 * tamaño lo dice: es el material de lectura de esta pantalla, no un pie de foto.
 * Ya no le hace lugar a ninguna fila de controles —esos viven fuera del cuadro—
 * así que se apoya en el borde de abajo y se queda ahí.
 *
 * El contenedor no recibe clics —el video de atrás se sigue pausando al tocarlo
 * donde no hay texto— y solo la frase los toma.
 */
export function SubtitleCaption({
  block,
  word,
  onPick,
  markOf,
  dimmed,
}: SubtitleCaptionProps) {
  const phrase = usePhraseSelection((span: PhraseSpan) => {
    if (!block) return;
    const term = sliceWords(block.text, span.from.ord, span.to.ord);
    if (!term) return;
    onPick(term, {
      t: segmentAtWord(block, span.from.ord).t,
      text: block.text,
    });
  });

  if (!block) return null;

  return (
    <div
      data-marking={phrase.marking || undefined}
      className={cn(
        "subtitle-caption pointer-events-none absolute inset-x-0 bottom-0 z-10",
        "flex justify-center px-4 pb-5 sm:px-8 sm:pb-7",
        "transition-opacity duration-300",
        dimmed ? "opacity-0" : "opacity-100"
      )}
    >
      <DockLine
        key={block.t}
        text={block.text}
        line={0}
        selection={phrase.rangeOf(0)}
        sweep={word}
        markOf={markOf}
        onWordDown={phrase.begin}
        className={cn(
          "pointer-events-auto inline-block text-center",
          "max-w-[52rem] lg:max-w-[60rem]",
          "text-lg font-medium leading-snug text-white",
          "sm:text-xl lg:text-2xl xl:text-[1.75rem]"
        )}
      />
    </div>
  );
}
