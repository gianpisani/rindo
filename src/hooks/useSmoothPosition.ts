import { useEffect, useRef, useState, type MutableRefObject } from "react";

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
