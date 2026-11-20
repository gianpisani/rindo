import { paceVerdict, type MonthPace } from "@/lib/month-pace";
import { dayRange, linePath } from "@/lib/pace-chart";
import { cn } from "@/lib/utils";
import { MUTED, TONE } from "./tone";

export function PaceSpark({ pace, className }: { pace: MonthPace; className?: string }) {
  const tone = TONE[paceVerdict(pace)];
  const W = 100;
  const H = 100;
  const maxV = Math.max(1, ...pace.me, ...(pace.typical?.median ?? []));
  const px = (d: number) => (d / pace.daysInMonth) * W;
  const py = (v: number) => H - 4 - (v / maxV) * (H - 8);

  return (
    <span className={cn("relative block", className)} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {pace.typical && (
          <path
            d={linePath(dayRange(pace.daysInMonth).map((d) => [px(d), py(pace.typical!.median[d])]))}
            fill="none" stroke={MUTED} strokeWidth={1.25} strokeDasharray="3 3" opacity={0.6} vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={linePath(dayRange(pace.asOfDay).map((d) => [px(d), py(pace.me[d])]))}
          fill="none" stroke={tone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
      </svg>
      <i
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${px(pace.asOfDay)}%`, top: `${py(pace.me[pace.asOfDay])}%`, background: tone }}
      />
    </span>
  );
}
