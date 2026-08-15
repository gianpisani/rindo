import { useMemo } from "react";
import {
  differenceInCalendarDays,
  format,
  startOfWeek,
  subDays,
} from "date-fns";
import { comprehensionScore } from "@/lib/learning-config";
import type { SessionWithItemCount } from "./useLearningSessions";

export interface PeriodStats {
  sessionCount: number;
  effectiveSeconds: number;
  consumedSeconds: number;
  contentSeconds: number;
  newItems: number;
  /** Promedio de comprensión /8 entre las sesiones que la tienen. */
  comprehension: number | null;
  /** Promedio ponderado: total efectivo ÷ total de contenido. */
  studyMultiplier: number | null;
  /** Promedio de dependencia de subtítulos 0–2 (más alto = menos dependencia). */
  subtitleIndependence: number | null;
  /** Expresiones nuevas por minuto de contenido consumido. */
  vocabDensity: number | null;
}

const EMPTY: PeriodStats = {
  sessionCount: 0,
  effectiveSeconds: 0,
  consumedSeconds: 0,
  contentSeconds: 0,
  newItems: 0,
  comprehension: null,
  studyMultiplier: null,
  subtitleIndependence: null,
  vocabDensity: null,
};

function aggregate(sessions: SessionWithItemCount[]): PeriodStats {
  if (sessions.length === 0) return EMPTY;

  let effectiveSeconds = 0;
  let consumedSeconds = 0;
  let contentSeconds = 0;
  let newItems = 0;

  const comprehensions: number[] = [];
  const subtitles: number[] = [];

  for (const s of sessions) {
    effectiveSeconds += s.effective_seconds;
    consumedSeconds += s.consumed_seconds;
    contentSeconds += s.content_duration_seconds ?? 0;
    newItems += s.new_item_count;

    const score = comprehensionScore(s);
    if (score !== null) comprehensions.push(score);
    if (s.comp_subtitles !== null) subtitles.push(s.comp_subtitles);
  }

  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const consumedMinutes = consumedSeconds / 60;

  return {
    sessionCount: sessions.length,
    effectiveSeconds,
    consumedSeconds,
    contentSeconds,
    newItems,
    comprehension: mean(comprehensions),
    studyMultiplier:
      contentSeconds > 0 && effectiveSeconds > 0
        ? effectiveSeconds / contentSeconds
        : null,
    subtitleIndependence: mean(subtitles),
    vocabDensity: consumedMinutes >= 5 ? newItems / consumedMinutes : null,
  };
}

/**
 * Racha en días: cuenta hacia atrás desde hoy (o ayer, para no romperla antes
 * de que termine el día) mientras haya al menos una sesión por día.
 */
function computeStreak(sessions: SessionWithItemCount[]): number {
  if (sessions.length === 0) return 0;

  const days = new Set(
    sessions.map((s) => format(new Date(s.started_at), "yyyy-MM-dd"))
  );

  const today = new Date();
  const hasToday = days.has(format(today, "yyyy-MM-dd"));

  let cursor = hasToday ? today : subDays(today, 1);
  let streak = 0;

  while (days.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

export interface LearningStats {
  today: PeriodStats;
  thisWeek: PeriodStats;
  last30: PeriodStats;
  /** Los 30 días anteriores a los últimos 30, para comparar. */
  previous30: PeriodStats;
  allTime: PeriodStats;
  streakDays: number;
  daysSinceLastSession: number | null;
  /** Minutos efectivos por día en los últimos 30 días, para el gráfico. */
  dailyMinutes: { date: string; minutes: number }[];
  /** Comprensión por sesión en orden cronológico, para la tendencia. */
  comprehensionSeries: { date: string; score: number }[];
}

export function useLearningStats(sessions: SessionWithItemCount[]): LearningStats {
  return useMemo(() => {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const inRange = (s: SessionWithItemCount, from: Date, to?: Date) => {
      const d = new Date(s.started_at);
      return d >= from && (!to || d < to);
    };

    const day30 = subDays(now, 30);
    const day60 = subDays(now, 60);

    const todaySessions = sessions.filter(
      (s) => format(new Date(s.started_at), "yyyy-MM-dd") === todayKey
    );

    const last30Sessions = sessions.filter((s) => inRange(s, day30));
    const previous30Sessions = sessions.filter((s) => inRange(s, day60, day30));

    // Minutos por día, últimos 30 días
    const byDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      byDay.set(format(subDays(now, i), "yyyy-MM-dd"), 0);
    }
    for (const s of last30Sessions) {
      const key = format(new Date(s.started_at), "yyyy-MM-dd");
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + s.effective_seconds / 60);
      }
    }

    const comprehensionSeries = sessions
      .slice()
      .reverse()
      .map((s) => ({ date: s.started_at, score: comprehensionScore(s) }))
      .filter((x): x is { date: string; score: number } => x.score !== null);

    const lastSession = sessions[0];

    return {
      today: aggregate(todaySessions),
      thisWeek: aggregate(sessions.filter((s) => inRange(s, weekStart))),
      last30: aggregate(last30Sessions),
      previous30: aggregate(previous30Sessions),
      allTime: aggregate(sessions),
      streakDays: computeStreak(sessions),
      daysSinceLastSession: lastSession
        ? differenceInCalendarDays(now, new Date(lastSession.started_at))
        : null,
      dailyMinutes: Array.from(byDay, ([date, minutes]) => ({ date, minutes })),
      comprehensionSeries,
    };
  }, [sessions]);
}
