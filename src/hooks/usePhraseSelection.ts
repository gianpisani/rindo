import { useCallback, useEffect, useRef, useState } from "react";

// ── Arrastrar para marcar una frase ─────────────────────────
//
// El navegador ya sabe seleccionar texto, pero lo hace con la selección del
// sistema: el azul del OS, la lupa de iOS, el cursor de I y el arrastre que
// empieza a mitad de una letra. Eso sirve para copiar y pegar, no para señalar
// una frase de un subtítulo mientras corre un video.
//
// Acá la unidad mínima es la palabra, nunca el carácter: aprietas una y
// arrastras, y la marca crece de palabra en palabra —de una línea a la otra si
// hace falta. Soltar es preguntar. Un toque sin arrastre es una sola palabra,
// así que el clic de siempre sigue siendo el mismo gesto y no dos.

/** Dónde vive una palabra: en qué línea y en qué lugar dentro de ella. */
export interface WordAt {
  line: number;
  ord: number;
}

/** Un tramo de palabras, de la primera a la última, ambas incluidas. */
export interface PhraseSpan {
  from: WordAt;
  to: WordAt;
}

/** El rango que le toca a una línea; `to` infinito = sigue en la de abajo. */
export interface LineRange {
  from: number;
  to: number;
  /** La frase viene de la línea de arriba: ese extremo no se cierra. */
  openStart: boolean;
  /** La frase sigue en la de abajo: ese extremo tampoco. */
  openEnd: boolean;
}

const isBefore = (a: WordAt, b: WordAt) =>
  a.line !== b.line ? a.line < b.line : a.ord < b.ord;

const order = (a: WordAt, b: WordAt): PhraseSpan =>
  isBefore(b, a) ? { from: b, to: a } : { from: a, to: b };

const same = (a: WordAt, b: WordAt) => a.line === b.line && a.ord === b.ord;

/**
 * Qué palabra hay bajo el dedo. Se pregunta por coordenadas y no por los
 * eventos de cada palabra: con el puntero capturado los `pointerenter` de las
 * hermanas no llegan, y sin capturar se pierde el arrastre al salir de la línea.
 */
function wordFromPoint(x: number, y: number): WordAt | null {
  const el = document.elementFromPoint(x, y);
  const word = el?.closest<HTMLElement>("[data-ord]");
  const line = word?.closest<HTMLElement>("[data-line]");
  if (!word || !line) return null;

  const at = { line: Number(line.dataset.line), ord: Number(word.dataset.ord) };
  return Number.isFinite(at.line) && Number.isFinite(at.ord) ? at : null;
}

export function usePhraseSelection(onPhrase: (span: PhraseSpan) => void) {
  const [span, setSpan] = useState<PhraseSpan | null>(null);
  const [dragging, setDragging] = useState(false);

  const live = useRef<{ anchor: WordAt; head: WordAt } | null>(null);
  const handler = useRef(onPhrase);
  useEffect(() => {
    handler.current = onPhrase;
  });

  /** Apretaste una palabra: desde acá la marca ya se ve. */
  const begin = useCallback((at: WordAt, event: { pointerType: string; preventDefault: () => void }) => {
    // Solo con mouse: en el teléfono cancelar el `pointerdown` se lleva puesto
    // el scroll de la pista. Ahí el arrastre lateral lo permite `touch-action`.
    if (event.pointerType === "mouse") event.preventDefault();

    live.current = { anchor: at, head: at };
    setSpan({ from: at, to: at });
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const move = (event: PointerEvent) => {
      const drag = live.current;
      if (!drag) return;

      const at = wordFromPoint(event.clientX, event.clientY);
      // Sobre un espacio o fuera de la pista: la marca se queda donde estaba,
      // que es lo que uno espera al pasar por encima de una coma.
      if (!at || same(at, drag.head)) return;

      drag.head = at;
      setSpan(order(drag.anchor, at));
    };

    const finish = () => {
      const drag = live.current;
      live.current = null;
      setDragging(false);
      setSpan(null);
      if (drag) handler.current(order(drag.anchor, drag.head));
    };

    /** El navegador se llevó el gesto para hacer scroll: no preguntaste nada. */
    const abort = () => {
      live.current = null;
      setDragging(false);
      setSpan(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", abort);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", abort);
    };
  }, [dragging]);

  /** Qué parte de la marca le toca pintar a una línea. */
  const rangeOf = useCallback(
    (line: number): LineRange | null => {
      if (!span || line < span.from.line || line > span.to.line) return null;
      return {
        from: line === span.from.line ? span.from.ord : 0,
        to: line === span.to.line ? span.to.ord : Number.POSITIVE_INFINITY,
        openStart: line > span.from.line,
        openEnd: line < span.to.line,
      };
    },
    [span]
  );

  /**
   * La frase ya es más de una palabra.
   *
   * No es lo mismo que `dragging`: entre que aprietas y sueltas para elegir una
   * sola palabra también estás arrastrando, y ahí apagar media pantalla sería
   * un parpadeo. La pista se apaga cuando de verdad estás marcando una frase.
   */
  const marking = span !== null && !same(span.from, span.to);

  return { dragging, marking, begin, rangeOf };
}
