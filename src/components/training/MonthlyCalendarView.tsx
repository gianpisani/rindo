import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SPORT_CONFIG, DAY_NAMES } from "@/lib/training-config";
import { SessionPill } from "./SessionPill";
import { SessionCard } from "./SessionCard";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { format, isSameMonth, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";

interface Props {
  calendarDays: Date[];
  currentMonth: Date;
  selectedDate: Date;
  sessionsByDate: Record<string, TrainingSession[]>;
  totalRows: number;
  onSelectDate: (date: Date) => void;
  onOpenSession: (session: TrainingSession) => void;
  onAddSession?: (date: string) => void;
}

export function MonthlyCalendarView({
  calendarDays,
  currentMonth,
  selectedDate,
  sessionsByDate,
  totalRows,
  onSelectDate,
  onOpenSession,
  onAddSession,
}: Props) {
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDaySessions = sessionsByDate[selectedDateStr] || [];

  return (
    <>
      <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/30">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={cn(
                "py-2 text-center",
                i < 6 && "border-r border-border/20"
              )}
            >
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {name}
              </span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate[dateStr] || [];
            const dayIsToday = isToday(day);
            const inMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const col = i % 7;
            const row = Math.floor(i / 7);
            const isLastRow = row === totalRows - 1;
            const hasRace = daySessions.some((s) => s.is_race);

            return (
              <div
                key={dateStr}
                onClick={() => onSelectDate(day)}
                className={cn(
                  "min-h-[56px] md:min-h-[90px] p-1 md:p-1.5 cursor-pointer transition-colors relative group",
                  col < 6 && "border-r border-border/20",
                  !isLastRow && "border-b border-border/20",
                  !inMonth && "bg-muted/10",
                  dayIsToday && inMonth && "bg-primary/[0.04]",
                  isSelected && "ring-2 ring-primary/30 ring-inset",
                  hasRace && "bg-rose-500/[0.02]",
                  "hover:bg-accent/20"
                )}
              >
                {/* Day number */}
                <div className="flex justify-between mb-0.5">
                  {onAddSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSession(dateStr);
                      }}
                      className="hidden md:flex h-5 w-5 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 text-muted-foreground hover:text-primary"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                  <span
                    className={cn(
                      "text-[11px] md:text-xs tabular-nums w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-colors ml-auto",
                      dayIsToday && "bg-primary text-primary-foreground font-bold",
                      !dayIsToday && inMonth && "text-foreground",
                      !dayIsToday && !inMonth && "text-muted-foreground/40"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Desktop: session pills */}
                <div className="hidden md:flex flex-col gap-0.5 max-h-[80px] md:max-h-none overflow-hidden">
                  {daySessions.map((s) => (
                    <SessionPill
                      key={s.id}
                      session={s}
                      onClick={() => onOpenSession(s)}
                    />
                  ))}
                </div>

                {/* Mobile: colored dots */}
                <div className="flex md:hidden gap-[3px] justify-center flex-wrap mt-0.5">
                  {daySessions.map((s) => {
                    const sport = SPORT_CONFIG[s.sport_type] || SPORT_CONFIG.rest;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "rounded-full",
                          s.is_race ? "w-[7px] h-[7px] bg-rose-500" : cn("w-[5px] h-[5px]", sport.dot),
                          s.status === "completed" && "opacity-50",
                          s.status === "skipped" && "opacity-25"
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Selected Day Detail */}
      <div className="md:hidden space-y-3">
        <div className="bg-muted/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold capitalize">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            {isToday(selectedDate) && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Hoy
              </Badge>
            )}
          </div>
          {onAddSession && (
            <button
              onClick={() => onAddSession(selectedDateStr)}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        {selectedDaySessions.length === 0 ? (
          <div className="border border-dashed border-border/40 rounded-lg py-8 text-center">
            <p className="text-xs text-muted-foreground/50">Sin sesiones</p>
          </div>
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
    </>
  );
}
