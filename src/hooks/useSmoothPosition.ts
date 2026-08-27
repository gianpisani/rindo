import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { activeCueIndex, type Cue } from "@/lib/transcript";

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

/**
 * Qué línea se está diciendo, al cuadro.
 *
 * Interpola igual que `useSmoothPosition` pero devuelve el índice y no el
 * segundo, y esa diferencia es todo: la pista tiene cientos de líneas y
 * repintarlas sesenta veces por segundo para mover un resaltado sería
 * grotesco. Con el índice, React descarta el estado repetido y la lista solo
 * se rehace cuando de verdad cambia la frase.
 */
export function useActiveCue(
  ref: MutableRefObject<PlaybackSample>,
  cues: Cue[]
): number {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    let frame: number;

    const tick = () => {
      const sample = ref.current;
      const seconds = sample.playing
        ? sample.seconds + (performance.now() - sample.at) / 1000
        : sample.seconds;
      setIndex(activeCueIndex(cues, seconds));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, cues]);

  return index;
}
