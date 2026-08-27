// ── El relieve del video ────────────────────────────────────
//
// Un video no es igual de difícil de principio a fin: hay tramos que se siguen
// solos y hay dos minutos donde se acumula el vocabulario que te frena. Eso se
// puede calcular antes de verlo —tenemos la transcripción y el ranking de uso
// del inglés— y por eso la línea de tiempo puede mostrar dónde está lo duro en
// vez de ser una barra de progreso más.

import { bandOf, effectiveRank, tokenize, type RankLookup } from "./corpus";
import type { Cue } from "./transcript";

/** En cuántos tramos se parte el video. */
export const HEAT_BUCKETS = 60;

/** Debajo de esta variación, el video es parejo y no hay relieve que mostrar. */
const FLAT_SPREAD = 0.04;

/** Lo que se muestra cuando el video es parejo: presente, sin gritar. */
const FLAT_LEVEL = 0.32;

const MIN_INK = 0.12;

/**
 * Cuánto pesa cada tramo, de 0 a 1.
 *
 * "Difícil" es la proporción de palabras dichas que caen fuera de las tres mil
 * más usadas —el corte donde uno deja de seguir un podcast sin esfuerzo—. Los
 * nombres propios y las erratas (fuera de lista) no cuentan: que digan
 * "Copenhague" no vuelve difícil un tramo.
 *
 * El resultado se normaliza contra el propio video y no contra una escala
 * absoluta, porque la pregunta que responde la barra es "¿dónde está lo difícil
 * de *esto*?", no "¿qué tan difícil es esto?" —para eso está la pestaña de
 * progreso.
 */
export function difficultyTrack(
  cues: Cue[],
  durationSeconds: number,
  rank: RankLookup,
  buckets = HEAT_BUCKETS
): number[] {
  if (cues.length === 0 || durationSeconds <= 0) return [];

  const hard = new Array(buckets).fill(0);
  const total = new Array(buckets).fill(0);

  for (const cue of cues) {
    const slot = Math.min(
      buckets - 1,
      Math.max(0, Math.floor((cue.t / durationSeconds) * buckets))
    );

    for (const token of tokenize(cue.text)) {
      const band = bandOf(effectiveRank(token, rank)).key;
      if (band === "off") continue;
      total[slot] += 1;
      if (band === "mid" || band === "advanced" || band === "rare") {
        hard[slot] += 1;
      }
    }
  }

  // Los tramos mudos —silencios, música— heredan el anterior: un hueco blanco
  // en medio de la barra se lee como "acá es fácil", que es mentira.
  const share: number[] = [];
  let last = 0;
  for (let i = 0; i < buckets; i++) {
    if (total[i] > 0) last = hard[i] / total[i];
    share.push(last);
  }

  // Suavizado de tres: sin esto el relieve tiembla y parece ruido.
  const smooth = share.map((_, i) => {
    const window = share.slice(Math.max(0, i - 1), i + 2);
    return window.reduce((acc, n) => acc + n, 0) / window.length;
  });

  const min = Math.min(...smooth);
  const max = Math.max(...smooth);
  if (max - min < FLAT_SPREAD) return smooth.map(() => FLAT_LEVEL);

  return smooth.map((value) =>
    Math.max(MIN_INK, (value - min) / (max - min))
  );
}
