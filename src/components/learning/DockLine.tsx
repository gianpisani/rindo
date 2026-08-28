import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";
import { splitWords } from "@/lib/transcript";
import { computeDock, numberWords, DOCK_SCALE } from "@/lib/dock";
import type { LineRange, WordAt } from "@/hooks/usePhraseSelection";

/** Cómo se marca una palabra: el subrayado dice de qué se trata. */
export interface WordMark {
  /** Color del subrayado — se usa el de la banda de frecuencia. */
  color: string;
  /** Punteado = todavía no la tienes. Sólido = ya está en tu diccionario. */
  solid?: boolean;
  title: string;
}

interface DockLineProps {
  text: string;
  /** Número de línea: lo lee el arrastre para saber por dónde va la frase. */
  line: number;
  onWordDown: (at: WordAt, event: React.PointerEvent) => void;
  /** El tramo de esta línea que está marcado, si lo está. */
  selection?: LineRange | null;
  /** Marca por palabra. Devuelve null para dejarla limpia. */
  markOf?: (word: string) => WordMark | null;
  /** Cuánto crece la palabra señalada y sus vecinas. */
  steps?: number[];
  className?: string;
}

/**
 * Una línea de subtítulo donde cada palabra se puede señalar y tocar.
 *
 * Vive aparte porque la usan los dos lugares donde se lee: la frase grande
 * bajo el video y la transcripción completa del costado. Que el gesto sea el
 * mismo en ambos es la mitad de que la pantalla se sienta una sola cosa.
 *
 * Hay dos maneras de mirar la línea y no conviven: el dock agranda la palabra
 * que señalas, y la banda pinta la frase que arrastras. En cuanto la frase pasa
 * de una palabra el dock se apaga —si no, las palabras siguen creciéndose y
 * corriéndose unas a otras, y la banda queda partida en pedazos.
 *
 * La banda es un solo rectángulo medido y no el fondo de cada palabra. Esa es
 * toda la diferencia entre que se sienta suave o no: con fondos por palabra la
 * frase crece a manchones que se encienden: con un rectángulo, el borde se
 * desliza hasta la palabra siguiente. El destino es discreto —siempre cae en
 * un límite de palabra, nunca a media letra— pero el viaje es continuo, que es
 * lo que uno lee como suave.
 *
 * Va memoizada porque la pista son cientos de líneas y al arrastrar el estado
 * cambia en cada palabra: sin esto se redibujaría la transcripción entera
 * varias veces por segundo, que es justo el momento en que tiene que ir suave.
 */
/** Un renglón de la banda, en coordenadas de la línea. */
interface Band {
  top: number;
  left: number;
  right: number;
  height: number;
}

const BAND_RADIUS = "0.35em";

export const DockLine = memo(function DockLine({
  text,
  line,
  onWordDown,
  selection,
  markOf,
  steps = DOCK_SCALE,
  className,
}: DockLineProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  /** Anchos naturales, medidos una sola vez por línea. */
  const [widths, setWidths] = useState<number[]>([]);

  const parts = useMemo(() => numberWords(splitWords(text)), [text]);

  useEffect(() => {
    setHovered(null);
    setWidths([]);
  }, [text]);

  /**
   * Qué trozos van pintados. Los espacios y los signos que quedan en medio
   * también: si no, la frase se lee como parches sueltos en vez de una banda.
   */
  const marked = useMemo(() => {
    if (!selection) return null;

    const flags = parts.map(
      (part) =>
        part.isWord && part.ord >= selection.from && part.ord <= selection.to
    );
    const first = flags.indexOf(true);
    const last = flags.lastIndexOf(true);
    if (first === -1) return null;
    for (let i = first; i <= last; i++) flags[i] = true;

    return { flags, first, last };
  }, [parts, selection]);

  /** La frase ya es más de una palabra: el dock le deja el paso a la banda. */
  const marking = marked !== null && marked.first !== marked.last;
  useEffect(() => {
    if (marking) setHovered(null);
  }, [marking]);

  /**
   * Mide al entrar por primera vez a la línea. En ese momento ninguna de sus
   * palabras está agrandada, así que la medida es la real.
   */
  const handleEnter = useCallback(
    (ord: number, el: HTMLElement) => {
      if (marked) return;
      setHovered(ord);
      setWidths((prev) => {
        if (prev.length) return prev;
        const row = el.parentElement;
        if (!row) return prev;
        return Array.from(
          row.querySelectorAll<HTMLElement>("[data-part]")
        ).map((node) => node.getBoundingClientRect().width);
      });
    },
    [marked]
  );

  const dock =
    hovered !== null && widths.length && !marking
      ? computeDock(parts, widths, hovered, steps)
      : null;

  /**
   * Dónde va la banda. Una por renglón visible: una línea larga da la vuelta,
   * y un rectángulo no puede doblar la esquina.
   *
   * No se dibuja mientras el dock está encendido —una sola palabra señalada ya
   * se ve, está grande y en color— porque el dock mueve las palabras con
   * `transform` y las medidas del layout no se enteran: la banda quedaría
   * corrida justo debajo de la palabra que estás mirando.
   */
  const lineRef = useRef<HTMLParagraphElement>(null);
  const [bands, setBands] = useState<Band[]>([]);

  useLayoutEffect(() => {
    if (!marked || dock) {
      setBands((prev) => (prev.length ? [] : prev));
      return;
    }

    const line = lineRef.current;
    if (!line) return;

    const nodes = Array.from(line.querySelectorAll<HTMLElement>("[data-part]"));
    const rows: Band[] = [];
    for (let i = marked.first; i <= marked.last; i++) {
      const node = nodes[i];
      if (!node) continue;

      const row = rows[rows.length - 1];
      // Los trozos vienen en orden, así que basta comparar con el anterior:
      // si bajó de renglón, empieza una banda nueva.
      if (row && Math.abs(row.top - node.offsetTop) < 2) {
        row.right = Math.max(row.right, node.offsetLeft + node.offsetWidth);
        row.height = Math.max(row.height, node.offsetHeight);
      } else {
        rows.push({
          top: node.offsetTop,
          left: node.offsetLeft,
          right: node.offsetLeft + node.offsetWidth,
          height: node.offsetHeight,
        });
      }
    }

    setBands(rows);
  }, [marked, dock, text]);

  return (
    <p
      ref={lineRef}
      data-line={line}
      onMouseLeave={() => setHovered(null)}
      // `isolate` es lo que deja meter la banda detrás del texto sin que se
      // hunda también detrás del fondo de la línea que está sonando.
      className={cn("relative isolate select-none", className)}
      // `pan-y` es lo que reparte el gesto en el teléfono: hacia abajo la pista
      // sigue haciendo scroll, hacia el lado se marca la frase.
      style={{ touchAction: "pan-y", WebkitTouchCallout: "none" }}
    >
      {bands.map((band, row) => (
        <span
          key={row}
          aria-hidden
          className="phrase-band"
          style={{
            left: band.left,
            top: band.top,
            width: band.right - band.left,
            height: band.height,
            // Solo se cierran los extremos donde la frase de verdad empieza y
            // termina. Donde el texto da la vuelta —o sigue en la línea de
            // abajo— el borde queda recto: eso es lo que dice "esto continúa".
            borderStartStartRadius: row === 0 && !selection?.openStart ? BAND_RADIUS : 0,
            borderEndStartRadius: row === 0 && !selection?.openStart ? BAND_RADIUS : 0,
            borderStartEndRadius:
              row === bands.length - 1 && !selection?.openEnd ? BAND_RADIUS : 0,
            borderEndEndRadius:
              row === bands.length - 1 && !selection?.openEnd ? BAND_RADIUS : 0,
          }}
        />
      ))}

      {parts.map((part, index) => {
        const scale = dock?.scale[index] ?? 1;
        const shift = dock?.shift[index] ?? 0;
        const isFocus = scale === steps[0];
        const isMarked = marked?.flags[index] ?? false;

        const style: CSSProperties = {
          transform:
            shift || scale !== 1
              ? `translateX(${shift}px) scale(${scale})`
              : undefined,
          transformOrigin: "center bottom",
          // Al empezar a marcar las palabras vuelven a su tamaño más rápido: la
          // banda ya está donde el layout dice, y no puede esperarlas.
          transition: `transform ${marking ? 120 : 220}ms cubic-bezier(0.22, 1, 0.36, 1), color 140ms ease-out, opacity 160ms ease-out`,
          willChange: dock ? "transform" : undefined,
        };

        // El trozo marcado no pinta nada: solo se enciende. El color lo pone
        // la banda, que va detrás y es una sola.
        const markClass = isMarked && "phrase-mark";

        if (!part.isWord) {
          // `whitespace-pre` es obligatorio: un inline-block que solo contiene
          // un espacio lo colapsa a cero y las palabras quedan pegadas.
          return (
            <span
              key={index}
              data-part
              className={cn("inline-block whitespace-pre", markClass)}
              style={style}
            >
              {part.value}
            </span>
          );
        }

        const mark = markOf?.(part.value) ?? null;
        if (mark) {
          style.textDecoration = "underline";
          style.textDecorationStyle = mark.solid ? "solid" : "dotted";
          style.textDecorationColor = mark.color;
          style.textDecorationThickness = "2px";
          style.textUnderlineOffset = "0.28em";
        }

        return (
          <span
            key={index}
            data-part
            data-ord={part.ord}
            title={mark?.title}
            onMouseEnter={(e) => handleEnter(part.ord, e.currentTarget)}
            onPointerDown={(event) => onWordDown({ line, ord: part.ord }, event)}
            className={cn(
              "inline-block cursor-pointer rounded",
              isFocus && "font-bold text-primary",
              markClass
            )}
            style={style}
          >
            {part.value}
          </span>
        );
      })}
    </p>
  );
});
