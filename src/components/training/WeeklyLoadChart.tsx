import { useMemo } from "react";
import { SPORT_CONFIG } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  sessions: TrainingSession[];
}

export function WeeklyLoadChart({ sessions }: Props) {
  const data = useMemo(() => {
    const weekMap = new Map<string, Record<string, number>>();

    for (const s of sessions) {
      if (s.sport_type === "rest") continue;
      const weekKey = format(
        startOfWeek(parseISO(s.session_date), { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      );
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, {});
      const week = weekMap.get(weekKey)!;
      week[s.sport_type] = (week[s.sport_type] || 0) + (s.target_duration_minutes || 0);
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, sports]) => ({
        week: format(parseISO(weekKey), "d MMM", { locale: es }),
        ...sports,
      }));
  }, [sessions]);

  if (data.length === 0) return null;

  const sportKeys = Array.from(
    new Set(sessions.filter((s) => s.sport_type !== "rest").map((s) => s.sport_type))
  );

  const COLORS: Record<string, string> = {
    running: "#f97316",
    cycling: "#3b82f6",
    swimming: "#06b6d4",
    padel: "#8b5cf6",
    strength: "#f59e0b",
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Carga semanal (min)
      </h4>
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            {sportKeys.map((sport) => (
              <Bar
                key={sport}
                dataKey={sport}
                stackId="a"
                fill={COLORS[sport] || "#888"}
                radius={[2, 2, 0, 0]}
                name={SPORT_CONFIG[sport]?.label || sport}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
