// ── Progreso: lo que se mueve en el tiempo ──────────────────
//
// Regla que ordena este archivo: una métrica de progreso tiene que poder
// EMPEORAR. "El 81% del inglés que escuchaste son palabras básicas" no es
// progreso, es una propiedad de los videos que elegiste. Acá solo vive lo que
// se mueve contigo.

import type { BandKey } from "./corpus";

// ── Forma ───────────────────────────────────────────────────

/**
 * Cuántos días pesa el promedio. Con 14, dos semanas sin estudiar dejan la
 * forma en poco más de un tercio: se nota, pero no te borra el mes anterior.
 */
export const FORM_TAU_DAYS = 14;

/** Cuántos días hacia adelante se dibuja la caída si paras hoy. */
export const FORM_PROJECTION_DAYS = 14;

export interface FormPoint {
  date: string;
  minutes: number;
  /** 100 = vienes cumpliendo la meta diaria todos los días. */
  form: number;
  /** Los puntos proyectados no son historia: son advertencia. */
  projected?: boolean;
}

const decay = (tau: number) => 1 - Math.exp(-1 / tau);

/**
 * La forma, como en Strava.
 *
 * Un promedio exponencial de los minutos efectivos por día: cada día que
 * estudias empuja hacia arriba y cada día que no, deja caer. No es una racha
 * —una racha se rompe entera por un día malo y no distingue diez minutos de
 * una hora— sino una inercia: cuesta subirla y cuesta perderla.
 *
 * Se normaliza contra tu meta diaria para que el número signifique algo:
 * 100 es "vengo cumpliendo la meta todos los días".
 */
export function computeForm(
  days: { date: string; minutes: number }[],
  targetMinutes: number,
  tau = FORM_TAU_DAYS
): FormPoint[] {
  const alpha = decay(tau);
  const target = Math.max(1, targetMinutes);

  let ewma = 0;
  return days.map((day) => {
    ewma += (day.minutes - ewma) * alpha;
    return {
      date: day.date,
      minutes: day.minutes,
      form: (ewma / target) * 100,
    };
  });
}

/** Dónde quedarías si no estudiaras nada por N días. */
export function projectForm(
  current: number,
  days: number,
  tau = FORM_TAU_DAYS
): number {
  return current * Math.exp(-days / tau);
}

/**
 * Dónde llegarías manteniendo un ritmo. `pace` es 1 si cumples la meta justa.
 *
 * Es la contracara de la caída: sirve para que el primer día no se lea como un
 * fracaso. La forma de alguien que recién empieza SIEMPRE es baja —así funciona
 * un promedio con inercia— y lo único que hace falta saber es dónde estarías si
 * siguieras. Cumpliendo la meta a diario, en dos semanas se llega a 63.
 */
export function projectFormAtPace(
  current: number,
  days: number,
  pace = 1,
  tau = FORM_TAU_DAYS
): number {
  const remaining = Math.exp(-days / tau);
  return current * remaining + pace * 100 * (1 - remaining);
}

export interface FormState {
  label: string;
  hint: string;
  tone: "hot" | "good" | "warm" | "cold";
}

/**
 * Cómo se llama lo que te está pasando, en una palabra.
 *
 * `daysSinceLast` importa: una forma de 4 al día siguiente de tu primera
 * sesión es "arrancando", y la misma forma de 4 tres semanas después de la
 * última es "frío". El número es idéntico y significan cosas opuestas.
 */
export function formState(
  form: number,
  delta: number,
  daysSinceLast: number | null = null
): FormState {
  const active = daysSinceLast !== null && daysSinceLast <= 2;

  if (form < 25 && active) {
    return {
      label: "Arrancando",
      hint: "Vuelve mañana y la curva empieza a subir",
      tone: "warm",
    };
  }

  if (form >= 100)
    return {
      label: "En forma",
      hint: "Vienes cumpliendo la meta diaria",
      tone: "hot",
    };
  if (form >= 60)
    return {
      label: delta >= 0 ? "Subiendo" : "Bajando",
      hint: delta >= 0 ? "Vas construyendo inercia" : "Perdiendo lo ganado",
      tone: "good",
    };
  if (form >= 25)
    return {
      label: delta >= 0 ? "Arrancando" : "Enfriándote",
      hint: delta >= 0 ? "Falta constancia para que agarre" : "Un par de días más y se apaga",
      tone: "warm",
    };
  return {
    label: form > 0 ? "Frío" : "Sin arrancar",
    hint: "Se construye con días seguidos, no con maratones",
    tone: "cold",
  };
}

// ── Dificultad de un contenido ──────────────────────────────

/**
 * Qué tan difícil es un video, en una escala de 0 a 100.
 *
 * Es el porcentaje de palabras que NO están entre las mil más usadas del
 * inglés. Esas mil cubren la mayor parte de una conversación normal, así que
 * lo que sobra es exactamente lo que hace difícil seguir a alguien.
 *
 * Sirve para lo único que importa acá: comparar dos videos entre sí y ver si
 * con los meses te estás metiendo con contenido más duro.
 */
export function lexicalDifficulty(bandTokens: Record<BandKey, number>): number | null {
  const total = Object.values(bandTokens).reduce((acc, n) => acc + n, 0);
  if (total === 0) return null;
  return ((total - bandTokens.core) / total) * 100;
}

// ── Tasa de frenos ──────────────────────────────────────────

/** Cuántas veces te frenaste por cada diez minutos de contenido. */
export function stopRate(stops: number, consumedSeconds: number): number | null {
  const minutes = consumedSeconds / 60;
  if (minutes < 2) return null;
  return (stops / minutes) * 10;
}

// ── Tendencias ──────────────────────────────────────────────

export interface Trend {
  first: number;
  last: number;
  delta: number;
  /** Porcentaje de cambio, o null si el punto de partida era cero. */
  ratio: number | null;
}

/**
 * Compara la primera mitad de una serie con la segunda.
 *
 * Contra el promedio de las mitades y no contra el primer y el último punto:
 * un solo video raro no debería poder inventar una tendencia.
 */
export function trendOf(values: number[]): Trend | null {
  if (values.length < 4) return null;

  const half = Math.floor(values.length / 2);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const first = mean(values.slice(0, half));
  const last = mean(values.slice(half));

  return {
    first,
    last,
    delta: last - first,
    ratio: first === 0 ? null : (last - first) / first,
  };
}
