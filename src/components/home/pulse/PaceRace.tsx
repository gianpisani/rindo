import { useState } from "react";
import { motion } from "framer-motion";
import type { MonthPace, PaceVerdict } from "@/lib/month-pace";
import { dayRange, linePath, type Point } from "@/lib/pace-chart";
import { useElementWidth } from "@/hooks/useElementWidth";
import { cn } from "@/lib/utils";
import { clp, clpCompact } from "@/lib/format";
import { MUTED, TONE } from "./tone";

const pad = { l: 4, r: 64, t: 20, b: 26 };

export function PaceRace({ pace, verdict, privacy }: { pace: MonthPace; verdict: PaceVerdict; privacy: boolean }) {
  const [ref, W] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = W >= 440 ? Math.round(Math.min(440, Math.max(280, W * 0.62))) : 240;
  const { daysInMonth: days, asOfDay, me, typical } = pace;
  const tone = TONE[verdict];

  const maxV = Math.max(1, ...me, ...(typical?.high ?? []), pace.projectedTotal) * 1.08;
  const x = (d: number) => pad.l + (d / days) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);

  if (W === 0) return <div ref={ref} style={{ height: 240 }} />;

  const meLine = linePath(dayRange(asOfDay).map((d) => [x(d), y(me[d])]));
  const band = typical
    ? linePath([
        ...dayRange(days).map((d) => [x(d), y(typical.high[d])] as Point),
        ...dayRange(days).reverse().map((d) => [x(d), y(typical.low[d])] as Point),
      ]) + "Z"
    : null;
  const median = typical ? linePath(dayRange(days).map((d) => [x(d), y(typical.median[d])])) : null;
  const gap = typical
    ? linePath([
        ...dayRange(asOfDay).map((d) => [x(d), y(me[d])] as Point),
        ...dayRange(asOfDay).reverse().map((d) => [x(d), y(typical.median[d])] as Point),
      ]) + "Z"
    : null;
  const ticks = [1, 8, 15, 22, days];
  const hx = hover ?? null;

  return (
    <div
      ref={ref}
      className="relative select-none touch-pan-y"
      style={{ height: H }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const d = Math.round(((e.clientX - r.left - pad.l) / (W - pad.l - pad.r)) * days);
        setHover(Math.max(1, Math.min(days, d)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={W} height={H} className="overflow-visible">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--border)" />
        {ticks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-xs tabular-nums">
            {d}
          </text>
        ))}

        {band && <path d={band} fill={MUTED} opacity={0.1} />}
        {median && (
          <path d={median} fill="none" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
        )}
        {gap && (
          <motion.path
            d={gap}
            fill={tone}
            initial={{ opacity: 0 }}
            animate={{ opacity: verdict === "even" ? 0.06 : 0.16 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          />
        )}

        {pace.isLive && typical && asOfDay < days && (
          <motion.line
            x1={x(asOfDay)} y1={y(me[asOfDay])} x2={x(days)} y2={y(pace.projectedTotal)}
            stroke={tone} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round"
            initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.1 }}
          />
        )}

        <motion.path
          key={`${days}-${asOfDay}-${me[asOfDay]}`}
          d={meLine}
          fill="none"
          stroke={tone}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        <g transform={`translate(${x(asOfDay)},${y(me[asOfDay])})`}>
          {pace.isLive && (
            <motion.circle
              r={6} fill={tone}
              animate={{ scale: [1, 2.4], opacity: [0.35, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <circle r={5} fill={tone} stroke="var(--background)" strokeWidth={2} />
          <text y={-12} textAnchor="middle" className="fill-foreground text-xs font-medium">
            {pace.isLive ? "hoy" : "cierre"}
          </text>
        </g>

        {typical && (
          <g className={cn(privacy && "privacy-blur")}>
            <text x={x(days) + 8} y={y(typical.median[days]) + 4} className="fill-muted-foreground text-xs">
              típico
            </text>
            <text x={x(days) + 8} y={y(typical.median[days]) + 16} className="fill-muted-foreground text-xs tabular-nums">
              {clpCompact(typical.median[days])}
            </text>
          </g>
        )}
        {pace.isLive && typical && asOfDay < days && Math.abs(y(pace.projectedTotal) - y(typical.median[days])) > 24 && (
          <g className={cn(privacy && "privacy-blur")}>
            <text x={x(days) + 8} y={y(pace.projectedTotal) + 4} className="text-xs font-medium" fill={tone}>
              tú
            </text>
            <text x={x(days) + 8} y={y(pace.projectedTotal) + 16} className="text-xs tabular-nums" fill={tone}>
              ~{clpCompact(pace.projectedTotal)}
            </text>
          </g>
        )}

        {hx !== null && (
          <line x1={x(hx)} x2={x(hx)} y1={pad.t} y2={H - pad.b} stroke="var(--foreground)" opacity={0.25} />
        )}
      </svg>

      {hx !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-card border border-border bg-popover px-2 py-1.5 text-xs shadow-float"
          style={{ left: Math.min(Math.max(x(hx) - 70, 0), W - 140), width: 140 }}
        >
          <p className="font-medium">Día {hx}</p>
          <div className={cn("mt-0.5 space-y-0.5 tabular-nums", privacy && "privacy-blur")}>
            {hx <= asOfDay && (
              <p className="flex justify-between"><span className="text-muted-foreground">Tú</span>{clp(me[hx])}</p>
            )}
            {typical && (
              <p className="flex justify-between"><span className="text-muted-foreground">Típico</span>{clp(typical.median[hx])}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
