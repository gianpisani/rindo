// ── Aprendizaje — configuración, escalas y métricas ─────────
//
// Nota de diseño sobre las métricas:
// La única métrica que mide capacidad adquirida de forma honesta es la
// comprensión (/8), porque no depende de cuánto trabajo hiciste durante la
// sesión. El resto (multiplicador, foco, densidad de vocabulario) también
// "mejoran" cuando dejas de esforzarte —pausas menos, capturas menos— así que
// se muestran como contexto de la sesión, nunca como la línea de progreso.

import type { LearningSession } from "@/hooks/useLearningSessions";

// ── Escala de comprensión ───────────────────────────────────

export interface ComprehensionQuestion {
  key: "comp_main_idea" | "comp_details" | "comp_subtitles" | "comp_explain";
  label: string;
  hint: string;
  options: [string, string, string]; // 0, 1, 2
}

export const COMPREHENSION_QUESTIONS: ComprehensionQuestion[] = [
  {
    key: "comp_main_idea",
    label: "La idea principal",
    hint: "¿Cachaste de qué se trataba en el fondo?",
    options: ["No la pillé", "Más o menos", "Clarísima"],
  },
  {
    key: "comp_details",
    label: "Los detalles importantes",
    hint: "Los argumentos, ejemplos y matices",
    options: ["Pocos", "Algunos", "Casi todos"],
  },
  {
    key: "comp_subtitles",
    label: "Dependencia de subtítulos",
    hint: "Cuánto necesitaste leer para seguir",
    options: ["Alta", "Algo", "Poca o nada"],
  },
  {
    key: "comp_explain",
    label: "¿Podrías explicarlo?",
    hint: "En inglés, a otra persona, ahora mismo",
    options: ["No", "En parte", "Sí"],
  },
];

export const MAX_COMPREHENSION = COMPREHENSION_QUESTIONS.length * 2; // 8

// ── Dificultad percibida ────────────────────────────────────

export type Difficulty = "easy" | "comfortable" | "challenge" | "hard" | "too_hard";

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; emoji: string; color: string; bg: string; border: string }
> = {
  easy: { label: "Fácil", emoji: "😌", color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  comfortable: { label: "Cómodo", emoji: "🙂", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  challenge: { label: "Buen desafío", emoji: "🎯", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  hard: { label: "Difícil", emoji: "😮‍💨", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  too_hard: { label: "Demasiado", emoji: "🥵", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "comfortable", "challenge", "hard", "too_hard"];

// ── Tipos de item ───────────────────────────────────────────

export type ItemType =
  | "word" | "expression" | "phrasal_verb" | "idiom" | "collocation"
  | "grammar" | "pronunciation" | "sentence" | "concept";

export const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; short: string }> = {
  word: { label: "Palabra", short: "Palabra" },
  expression: { label: "Expresión", short: "Expresión" },
  phrasal_verb: { label: "Phrasal verb", short: "Phrasal" },
  idiom: { label: "Modismo", short: "Idiom" },
  collocation: { label: "Colocación", short: "Colloc." },
  grammar: { label: "Gramática", short: "Gramática" },
  pronunciation: { label: "Pronunciación", short: "Pronun." },
  sentence: { label: "Frase interesante", short: "Frase" },
  concept: { label: "Concepto", short: "Concepto" },
};

export const ITEM_TYPE_ORDER: ItemType[] = [
  "expression", "phrasal_verb", "word", "idiom", "collocation",
  "sentence", "grammar", "pronunciation", "concept",
];

/**
 * Los cuatro tipos que se ofrecen al capturar.
 *
 * La taxonomía completa de arriba sirve para leer datos antiguos, pero elegir
 * entre nueve categorías lingüísticas en mitad de un video es un impuesto:
 * hay que pensar si algo es colocación o modismo justo cuando uno quiere
 * seguir viendo. Estas cuatro se distinguen por la forma de lo que guardas,
 * no por su etiqueta gramatical, así que se eligen sin pensar.
 */
export const CAPTURE_TYPES: {
  type: ItemType;
  label: string;
  hint: string;
}[] = [
  { type: "word", label: "Palabra", hint: "una sola palabra" },
  { type: "expression", label: "Expresión", hint: "phrasal verbs, modismos, combinaciones" },
  { type: "sentence", label: "Frase", hint: "una oración que quieres recordar entera" },
  { type: "grammar", label: "Estructura", hint: "un patrón que se repite" },
];

/**
 * Adivina el tipo por la forma del texto, para que el valor por defecto casi
 * siempre sea el correcto y no haya que tocar nada.
 */
export function detectItemType(text: string): ItemType {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return "word";
  if (words.length <= 4) return "expression";
  return "sentence";
}

// ── Dominio ─────────────────────────────────────────────────

export type Mastery = "new" | "learning" | "familiar" | "mastered";

export const MASTERY_CONFIG: Record<
  Mastery,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  new: { label: "Nueva", color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500" },
  learning: { label: "Aprendiendo", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500" },
  familiar: { label: "Familiar", color: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20", dot: "bg-violet-500" },
  mastered: { label: "Dominada", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500" },
};

export const MASTERY_ORDER: Mastery[] = ["new", "learning", "familiar", "mastered"];

// ── Tipos de contenido ──────────────────────────────────────

export type ContentType = "youtube" | "podcast" | "article" | "series" | "other";

export const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; emoji: string }> = {
  youtube: { label: "YouTube", emoji: "🎬" },
  podcast: { label: "Podcast", emoji: "🎧" },
  article: { label: "Artículo", emoji: "📄" },
  series: { label: "Serie / Película", emoji: "🍿" },
  other: { label: "Otro", emoji: "✨" },
};

// ── Reloj: constantes del motor de sesión ───────────────────

/** Cada cuánto la sesión activa escribe su latido en la base. */
export const HEARTBEAT_MS = 20_000;

/**
 * Si el video está pausado y no tocas nada por este tiempo, la sesión se
 * auto-pausa. El tiempo efectivo se corta en la última actividad real, no en
 * el momento de darse cuenta — así irte sin pausar no infla los datos.
 */
export const IDLE_AUTO_PAUSE_MS = 5 * 60_000;

/**
 * Si al volver encuentras una sesión "activa" cuyo último latido es más viejo
 * que esto, se asume que cerraste la pestaña: se corta en el último latido.
 */
export const STALE_HEARTBEAT_MS = 90_000;

// ── Métricas ────────────────────────────────────────────────

export interface SessionMetrics {
  /** 0–8, null si la sesión no tiene reflexión completa. */
  comprehension: number | null;
  /** Tiempo estudiando ÷ duración del contenido. */
  studyMultiplier: number | null;
  /** Tiempo estudiando ÷ tiempo calendario. */
  focusRatio: number | null;
  /** Items nuevos por minuto de contenido consumido. */
  vocabDensity: number | null;
}

export function comprehensionScore(
  s: Pick<LearningSession, "comp_main_idea" | "comp_details" | "comp_subtitles" | "comp_explain">
): number | null {
  const parts = [s.comp_main_idea, s.comp_details, s.comp_subtitles, s.comp_explain];
  if (parts.some((p) => p === null || p === undefined)) return null;
  return parts.reduce<number>((acc, p) => acc + (p ?? 0), 0);
}

export function sessionMetrics(s: LearningSession, newItemCount = 0): SessionMetrics {
  const effective = s.effective_seconds;
  const duration = s.content_duration_seconds ?? 0;
  const elapsed = s.elapsed_seconds ?? 0;
  const consumedMinutes = s.consumed_seconds / 60;

  return {
    comprehension: comprehensionScore(s),
    studyMultiplier: duration > 0 && effective > 0 ? effective / duration : null,
    focusRatio: elapsed > 0 && effective > 0 ? Math.min(effective / elapsed, 1) : null,
    vocabDensity: consumedMinutes >= 1 ? newItemCount / consumedMinutes : null,
  };
}

// ── Avance dentro del contenido ─────────────────────────────

/** A partir de acá se considera que viste el contenido entero. */
export const COMPLETION_THRESHOLD = 0.9;

export interface ContentProgress {
  /** 0–1, o null si no se conoce la duración. */
  ratio: number | null;
  percent: number | null;
  positionSeconds: number;
  durationSeconds: number | null;
  /** Lo viste casi entero. */
  isComplete: boolean;
  /** Quedó a medias y tiene sentido retomarlo. */
  isPartial: boolean;
  /** "14:30 / 22:43" */
  label: string | null;
}

export function contentProgress(session: {
  last_position_seconds: number;
  content_duration_seconds: number | null;
}): ContentProgress {
  const position = Math.max(0, session.last_position_seconds);
  const duration = session.content_duration_seconds;

  if (!duration || duration <= 0) {
    return {
      ratio: null,
      percent: null,
      positionSeconds: position,
      durationSeconds: null,
      isComplete: false,
      isPartial: position > 0,
      label: position > 0 ? formatClock(position) : null,
    };
  }

  const ratio = Math.min(position / duration, 1);
  const isComplete = ratio >= COMPLETION_THRESHOLD;

  return {
    ratio,
    percent: Math.round(ratio * 100),
    positionSeconds: position,
    durationSeconds: duration,
    isComplete,
    // Menos de un minuto visto no cuenta como "a medias"
    isPartial: !isComplete && position > 60,
    label: `${formatClock(position)} / ${formatClock(duration)}`,
  };
}

// ── Formato ─────────────────────────────────────────────────

/** 3725 → "1h 2m". Bajo un minuto muestra segundos. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** 3725 → "1:02:05". Para el reloj en vivo y los timestamps del video. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, "0")}`
    : `${mm}:${String(seconds).padStart(2, "0")}`;
}

// ── Utilidades de YouTube ───────────────────────────────────

/** Extrae el id de video de cualquier forma de URL de YouTube. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Un id pelado
  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      // /embed/ID, /shorts/ID, /live/ID, /v/ID
      const m = url.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }

  return null;
}

/** Segundos de arranque codificados en la URL (?t=90, ?t=1m30s, #t=…). */
export function parseYouTubeStart(input: string): number {
  try {
    const url = new URL(input.trim());
    const t = url.searchParams.get("t") ?? url.searchParams.get("start");
    if (!t) return 0;
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return 0;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } catch {
    return 0;
  }
}

export function youTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youTubeWatchUrl(videoId: string, seconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return seconds && seconds > 0 ? `${base}&t=${Math.floor(seconds)}s` : base;
}

// ── Niveles ─────────────────────────────────────────────────

export const LEVELS = [
  "Principiante",
  "Básico",
  "Intermedio",
  "Intermedio alto",
  "Avanzado",
  "Fluido",
] as const;
