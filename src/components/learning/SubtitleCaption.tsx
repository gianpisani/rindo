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
  /** Los controles están a la vista: el subtítulo les hace lugar. */
  lifted?: boolean;
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
 * El contenedor no recibe clics —el video de atrás se sigue pausando al tocarlo
 * donde no hay texto— y solo la frase los toma.
 */
export function SubtitleCaption({
  block,
  word,
  onPick,
  markOf,
  lifted,
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
        // Mientras el video corre la barra es un pelo al borde, así que el
        // subtítulo se apoya abajo. Cuando los controles suben, les hace lugar.
        "flex justify-center px-4 transition-all duration-300 sm:px-8",
        lifted ? "pb-14 sm:pb-16" : "pb-5 sm:pb-6"
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
          "pointer-events-auto inline-block max-w-3xl text-center",
          "text-base font-medium leading-snug text-white sm:text-lg lg:text-xl"
        )}
      />
    </div>
  );
}
