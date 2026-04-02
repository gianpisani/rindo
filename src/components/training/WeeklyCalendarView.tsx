import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  SPORT_CONFIG,
  INTENSITY_CONFIG,
  DAY_NAMES,
} from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import {
  format,
  addDays,
  isToday,
  isSameDay,
  isPast,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus,
  Clock,
  Heart,
  CheckCircle2,
  XCircle,
  Coffee,
  Flag,
  Zap,
  Route,
} from "lucide-react";

interface Props {
  currentWeekStart: Date;
  sessionsByDate: Record<string, TrainingSession[]>;
  onOpenSession: (session: TrainingSession) => void;
  onAddSession: (date: string) => void;
}

/* ─────────────────────────────────────────────────────────────
   Desktop mini card — fits inside the narrow day column
   ───────────────────────────────────────────────────────────── */

function MiniSessionCard({
  session,
  onClick,
}: {
  session: TrainingSession;
  onClick: () => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const isRace = session.is_race;
  const isCompleted = session.status === "completed";
  const isSkipped = session.status === "skipped";
  const isRest = session.sport_type === "rest";

  if (isRest) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg border border-dashed border-border/30 px-2.5 py-2 transition-all",
          "hover:border-border/50 hover:bg-muted/10",
          isCompleted && "opacity-50",
          isSkipped && "opacity-30"
        )}
      >
        <div className="flex items-center gap-2">
          <Coffee className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[11px] text-muted-foreground/50 font-medium">Descanso</span>
          {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg overflow-hidden transition-all",
        "border hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]",
        "active:scale-[0.98]",
        isRace
          ? "border-rose-500/20 bg-gradient-to-br from-rose-500/[0.04] to-amber-500/[0.02]"
          : "border-border/30 hover:border-border/50",
        isCompleted && "border-emerald-500/15 bg-emerald-500/[0.02]",
        isSkipped && "opacity-40"
      )}
    >
      {/* Sport accent bar */}
      <div className={cn("h-[2px]", isRace ? "bg-gradient-to-r from-rose-500 to-amber-500" : sport.dot)} />

      <div className="p-2.5">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "mt-px p-1 rounded-md shrink-0",
              isRace ? "bg-rose-500/10" : sport.bg
            )}
          >
            {isRace ? (
              <Flag className="h-3 w-3 text-rose-500" />
            ) : (
              <SportIcon className={cn("h-3 w-3", sport.color)} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold truncate leading-tight">
                {isRace ? session.race_name || session.session_name : session.session_name}
              </span>
              {isCompleted && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
              {isSkipped && <XCircle className="h-3 w-3 text-rose-400 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {session.target_duration_minutes && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {session.target_duration_minutes}′
                </span>
              )}
              {session.target_hr_zone && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Heart className="h-2.5 w-2.5" />
                  Z{session.target_hr_zone}
                </span>
              )}
              {session.target_distance_meters && session.target_distance_meters >= 1000 && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Route className="h-2.5 w-2.5" />
                  {(session.target_distance_meters / 1000).toFixed(0)}k
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Intensity pill at bottom */}
        <div className="mt-1.5">
          <span
            className={cn(
              "text-[9px] font-semibold px-1.5 py-[1px] rounded-full",
              intensity.color
            )}
          >
            {intensity.label}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main weekly calendar component
   ───────────────────────────────────────────────────────────── */

export function WeeklyCalendarView({
  currentWeekStart,
  sessionsByDate,
  onOpenSession,
  onAddSession,
}: Props) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      if (isSameDay(addDays(currentWeekStart, i), today)) return i;
    }
    return 0;
  });

  useEffect(() => {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      if (isSameDay(addDays(currentWeekStart, i), today)) {
        setSelectedDayIndex(i);
        return;
      }
    }
    setSelectedDayIndex(0);
  }, [currentWeekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");
  const selectedDaySessions = sessionsByDate[selectedDateStr] || [];

  return (
    <>
      {/* ── Desktop: 7-column grid ── */}
      <div className="hidden md:grid grid-cols-7 gap-px bg-border/20 rounded-2xl overflow-hidden border border-border/30">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate[dateStr] || [];
          const dayIsToday = isToday(day);
          const dayIsPast = isPast(day) && !dayIsToday;
          const allDone =
            daySessions.length > 0 && daySessions.every((s) => s.status !== "pending");

          return (
            <div
              key={dateStr}
              className={cn(
                "group/day min-h-[180px] flex flex-col bg-background transition-colors",
                dayIsToday && "bg-primary/[0.02]",
                dayIsPast && "bg-muted/[0.03]",
                allDone && !dayIsToday && "bg-emerald-500/[0.015]"
              )}
            >
              {/* Day header */}
              <div
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 border-b",
                  dayIsToday
                    ? "border-primary/15 bg-primary/[0.04]"
                    : "border-border/15"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      dayIsToday ? "text-primary" : "text-muted-foreground/50"
                    )}
                  >
                    {DAY_NAMES[i]}
                  </span>
                  <span
                    className={cn(
                      "text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full font-bold transition-colors",
                      dayIsToday
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {allDone && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                </div>
                <button
                  onClick={() => onAddSession(dateStr)}
                  className="h-5 w-5 flex items-center justify-center rounded-full opacity-0 group-hover/day:opacity-100 hover:bg-primary/10 text-muted-foreground/50 hover:text-primary transition-all"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Sessions */}
              <div className="flex-1 p-1.5 space-y-1">
                {daySessions.map((s) => (
                  <MiniSessionCard
                    key={s.id}
                    session={s}
                    onClick={() => onOpenSession(s)}
                  />
                ))}
                {daySessions.length === 0 && (
                  <button
                    onClick={() => onAddSession(dateStr)}
                    className="flex-1 w-full h-full min-h-[80px] flex items-center justify-center rounded-lg transition-all group/empty"
                  >
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover/day:opacity-100 transition-opacity">
                      <Plus className="h-4 w-4 text-muted-foreground/25" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: Day selector + detail ── */}
      <div className="md:hidden space-y-4">
        {/* Day strip — segmented control style */}
        <div className="grid grid-cols-7 gap-0.5 bg-muted/30 p-1 rounded-2xl">
          {days.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate[dateStr] || [];
            const dayIsToday = isToday(day);
            const isSelected = i === selectedDayIndex;
            const allDone =
              daySessions.length > 0 && daySessions.every((s) => s.status !== "pending");

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDayIndex(i)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all",
                  isSelected
                    ? "bg-background shadow-sm shadow-black/5"
                    : "hover:bg-background/40"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    isSelected
                      ? dayIsToday
                        ? "text-primary"
                        : "text-foreground"
                      : "text-muted-foreground/50"
                  )}
                >
                  {DAY_NAMES[i].charAt(0)}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                    dayIsToday && isSelected && "bg-primary text-primary-foreground",
                    dayIsToday && !isSelected && "text-primary",
                    !dayIsToday && isSelected && "text-foreground",
                    !dayIsToday && !isSelected && "text-muted-foreground/60"
                  )}
                >
                  {format(day, "d")}
                </span>
                {/* Status indicators */}
                <div className="flex gap-[3px] h-2.5 items-center">
                  {allDone ? (
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                  ) : (
                    daySessions.slice(0, 3).map((s) => {
                      const sport = SPORT_CONFIG[s.sport_type] || SPORT_CONFIG.rest;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "w-[5px] h-[5px] rounded-full transition-transform",
                            s.is_race ? "bg-rose-500" : sport.dot,
                            s.status === "skipped" && "opacity-25",
                            isSelected && "scale-110"
                          )}
                        />
                      );
                    })
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected day header */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold capitalize">
              {format(selectedDay, "EEEE d", { locale: es })}
            </h3>
            {isToday(selectedDay) && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0 text-primary border-primary/25 bg-primary/5 font-semibold"
              >
                Hoy
              </Badge>
            )}
          </div>
          <button
            onClick={() => onAddSession(selectedDateStr)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Selected day sessions */}
        {selectedDaySessions.length === 0 ? (
          <button
            onClick={() => onAddSession(selectedDateStr)}
            className="w-full border border-dashed border-border/30 rounded-2xl py-12 text-center hover:border-primary/20 hover:bg-primary/[0.02] transition-all group"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-xl bg-muted/30 group-hover:bg-primary/5 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/50" />
              </div>
              <p className="text-xs text-muted-foreground/40 group-hover:text-muted-foreground/60">
                Agregar sesión
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-2.5">
            {selectedDaySessions.map((session) => (
              <MobileSessionCard
                key={session.id}
                session={session}
                onClick={() => onOpenSession(session)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mobile: Rich session card with more detail
   ───────────────────────────────────────────────────────────── */

function MobileSessionCard({
  session,
  onClick,
}: {
  session: TrainingSession;
  onClick: () => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const isRace = session.is_race;
  const isCompleted = session.status === "completed";
  const isSkipped = session.status === "skipped";
  const isRest = session.sport_type === "rest";

  if (isRest) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-2xl border border-dashed border-border/30 p-4 transition-all",
          "hover:border-border/50 active:scale-[0.99]",
          isCompleted && "opacity-50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted/40">
            <Coffee className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <span className="text-sm text-muted-foreground/60 font-medium">
            Día de descanso
          </span>
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl overflow-hidden transition-all",
        "border active:scale-[0.99]",
        "hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]",
        isRace
          ? "border-rose-500/20 bg-gradient-to-r from-rose-500/[0.03] to-amber-500/[0.02]"
          : "border-border/30",
        isCompleted && "border-emerald-500/15 bg-emerald-500/[0.02]",
        isSkipped && "opacity-45"
      )}
    >
      {/* Sport accent bar */}
      <div
        className={cn(
          "h-[2.5px]",
          isRace
            ? "bg-gradient-to-r from-rose-500 to-amber-500"
            : sport.dot
        )}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl shrink-0",
              isRace ? "bg-rose-500/10" : sport.bg
            )}
          >
            {isRace ? (
              <Flag className="h-[18px] w-[18px] text-rose-500" />
            ) : (
              <SportIcon className={cn("h-[18px] w-[18px]", sport.color)} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold truncate leading-tight">
                {isRace
                  ? session.race_name || session.session_name
                  : session.session_name}
              </span>
              {isCompleted && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
              {isSkipped && (
                <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              {session.target_duration_minutes && (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.target_duration_minutes} min
                </span>
              )}
              {session.target_hr_zone && (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  Zona {session.target_hr_zone}
                </span>
              )}
              {session.target_distance_meters && session.target_distance_meters >= 1000 && (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Route className="h-3 w-3" />
                  {(session.target_distance_meters / 1000).toFixed(1)} km
                </span>
              )}
              {session.scheduled_time && (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {session.scheduled_time}
                </span>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] shrink-0 border rounded-full font-semibold mt-0.5",
              intensity.color
            )}
          >
            {intensity.label}
          </Badge>
        </div>

        {/* Description preview */}
        {session.description && (
          <p className="text-xs text-muted-foreground/50 mt-3 line-clamp-2 leading-relaxed pl-[52px]">
            {session.description}
          </p>
        )}
      </div>
    </button>
  );
}
