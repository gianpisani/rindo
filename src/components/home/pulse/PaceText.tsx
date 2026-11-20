import { paceVerdict, type MonthPace } from "@/lib/month-pace";
import { clpCompact } from "@/lib/format";
import { TONE } from "./tone";

export function PaceText({ pace, className }: { pace: MonthPace; className?: string }) {
  if (!pace.typical) return null;
  const verdict = paceVerdict(pace);
  return (
    <b className={className} style={{ color: verdict === "even" ? undefined : TONE[verdict] }}>
      {verdict === "even"
        ? "Justo en tu ritmo"
        : `${clpCompact(Math.abs(pace.delta))} ${verdict === "under" ? "bajo" : "sobre"} tu ritmo`}
    </b>
  );
}
