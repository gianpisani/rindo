import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SPORT_CONFIG, DAY_NAMES } from "@/lib/training-config";
import { SessionCard } from "./SessionCard";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { format, addDays, isToday, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";

interface Props {
  currentWeekStart: Date;
  sessionsByDate: Record<string, TrainingSession[]>;
  onOpenSession: (session: TrainingSession) => void;
  onAddSession: (date: string) => void;
}

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

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const selectedDay = days[selectedDayIndex];
  const selectedDateStr = format(selectedDay, "yyyy-MM-dd");
  const selectedDaySessions = sessionsByDate[selectedDateStr] || [];

  return (
    <>
      {/* Desktop: 7-column grid */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate[dateStr] || [];
          const dayIsToday = isToday(day);

          return (
            <div
              key={dateStr}
              className={cn(
                "rounded-xl border border-border/40 p-2 min-h-[200px] flex flex-col",
                dayIsToday && "border-primary/30 bg-primary/[0.02]"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    {DAY_NAMES[i]}
                  </span>
                  <span
                    className={cn(
                      "text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full",
                      dayIsToday && "bg-primary text-primary-foreground font-bold"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <button
                  onClick={() => onAddSession(dateStr)}
                  className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 space-y-2">
                {daySessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onClick={() => onOpenSession(s)}
                  />
                ))}
                {daySessions.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/40 text-center pt-4">
                    Sin sesiones
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Horizontal day strip + detail */}
      <div className="md:hidden space-y-3">
        {/* Day strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate[dateStr] || [];
            const dayIsToday = isToday(day);
            const isSelected = i === selectedDayIndex;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDayIndex(i)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all shrink-0",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 hover:bg-accent/30",
                  dayIsToday && !isSelected && "border-primary/30"
                )}
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    dayIsToday && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div className="flex gap-[3px]">
                  {daySessions.map((s) => {
                    const sport = SPORT_CONFIG[s.sport_type] || SPORT_CONFIG.rest;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "w-[5px] h-[5px] rounded-full",
                          s.is_race ? "bg-rose-500 w-[7px] h-[7px]" : sport.dot,
                          s.status === "completed" && "opacity-50",
                          s.status === "skipped" && "opacity-25"
                        )}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold capitalize">
                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              {isToday(selectedDay) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Hoy
                </Badge>
              )}
            </div>
            <button
              onClick={() => onAddSession(selectedDateStr)}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {selectedDaySessions.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 py-4 text-center">
              Sin sesiones
            </p>
          ) : (
            selectedDaySessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onOpenSession(session)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
