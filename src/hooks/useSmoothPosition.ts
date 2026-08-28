import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { activeCueIndex, wordTimes, type Block } from "@/lib/transcript";

export interface PlaybackSample {
  /** Último segundo informado por el reproductor. */
  seconds: number;
  playing: boolean;
  /** Cuándo se informó, en la escala de `performance.now()`. */
  at: number;
}

/**
 * El minuto exacto, cuadro a cuadro.
 *
 * El reproductor de YouTube informa su posición dos veces por segundo: suficiente
 * para un reloj, ridículo para un subtítulo —la frase entraría medio segundo
 * tarde y a saltos—. Así que entre reporte y reporte se interpola con el reloj
 * del navegador, que es exactamente lo que hace que esto se sienta caro en vez
 * de barato.
 *
 * Se lee de una `ref` a propósito: la interpolación repinta solo al componente
 * que la usa, no a la pantalla entera.
 */
export function useSmoothPosition(
  ref: MutableRefObject<PlaybackSample>
): number {
  const [seconds, setSeconds] = useState(() => ref.current.seconds);
  const frameRef = useRef<number>();

  useEffect(() => {
    const tick = () => {
      const sample = ref.current;
      const next = sample.playing
        ? sample.seconds + (performance.now() - sample.at) / 1000
        : sample.seconds;
      // Con la misma cifra React no repinta: en pausa esto no cuesta nada.
      setSeconds(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [ref]);

  return seconds;
}

/** Dónde va la voz: en qué bloque y en qué palabra de ese bloque. */
export interface ActiveSpot {
  block: number;
  word: number;
}

const NOWHERE: ActiveSpot = { block: -1, word: -1 };

/**
 * Qué se está diciendo, hasta la palabra.
 *
 * Un bloque dura diez segundos. Si lo único que se supiera es cuál es el bloque,
 * el subtítulo se encendería entero y se quedaría quieto todo ese rato —más
 * muerto que las líneas de dos segundos que había antes—. Lo que lo mantiene
 * vivo es que adentro del bloque la voz avance palabra por palabra.
 *
 * Los tiempos por palabra se calculan una vez por transcripción; en el cuadro
 * solo se busca. Y se devuelve el mismo objeto cuando nada cambió, así que
 * React no repinta sesenta veces por segundo para no mover nada.
 */
export function useActiveSpot(
  ref: MutableRefObject<PlaybackSample>,
  blocks: Block[],
  endSeconds: number
): ActiveSpot {
  const [spot, setSpot] = useState<ActiveSpot>(NOWHERE);

  const times = useMemo(
    () =>
      blocks.map((block, index) =>
        wordTimes(block, blocks[index + 1]?.t ?? endSeconds)
      ),
    [blocks, endSeconds]
  );

  useEffect(() => {
    let frame: number;

    const tick = () => {
      const sample = ref.current;
      const seconds = sample.playing
        ? sample.seconds + (performance.now() - sample.at) / 1000
        : sample.seconds;

      const block = activeCueIndex(blocks, seconds);
      let word = -1;
      if (block >= 0) {
        const marks = times[block];
        // Los bloques son de una docena de palabras: buscar de atrás para
        // adelante llega antes que armar una búsqueda binaria.
        for (let i = marks.length - 1; i >= 0; i--) {
          if (marks[i] <= seconds) {
            word = i;
            break;
          }
        }
      }

      setSpot((prev) =>
        prev.block === block && prev.word === word ? prev : { block, word }
      );
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, blocks, times]);

  return spot;
}
