import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";

export interface WorthPoint { label: string; liquido: number; invertido: number }

export function WorthChart({ points, onHover }: { points: WorthPoint[]; onHover: (index: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;
  const W = 1000;
  const H = 300;
  const totals = points.map((p) => Math.max(0, p.invertido) + Math.max(0, p.liquido));
  const max = Math.max(1, ...totals) * 1.08;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = (upper: number[], lower: number[]) =>
    `${line(upper)}L${x(points.length - 1)},${y(lower[lower.length - 1])}` +
    lower.slice().reverse().map((v, i) => `L${x(lower.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join("") + "Z";
  const invested = points.map((p) => Math.max(0, p.invertido));
  const zeros = points.map(() => 0);

  const move = (e: PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = Math.round(ratio * (points.length - 1));
    setActive(i);
    onHover(i);
  };

  return (
    <div ref={box} className="absolute inset-0" onPointerMove={move} onPointerLeave={() => { setActive(null); onHover(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ bottom: 18, height: "calc(100% - 18px)" }}>
        <path className="area" d={area(invested, zeros)} fill="color-mix(in oklch, var(--inicio-blue) 30%, transparent)" />
        <path className="area" d={area(totals, invested)} fill="oklch(var(--success) / .16)" />
        <path d={line(invested)} fill="none" stroke="var(--inicio-blue)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.8} />
        <path d={line(totals)} fill="none" stroke="oklch(var(--success))" strokeWidth={2.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {active !== null && <span className="fin-scrub" style={{ left: `${(x(active) / W) * 100}%` }} />}
      <AxisLabels labels={points.map((p) => p.label)} at={(i) => (x(i) / W) * 100} />
    </div>
  );
}

export interface MonthBar { key: string; label: string; ingreso: number; gasto: number; current: boolean }

export function MonthBars({ months, onHover }: {
  months: MonthBar[];
  onHover: (index: number | null) => void;
}) {
  const max = Math.max(1, ...months.flatMap((m) => [m.ingreso, m.gasto]));
  const [active, setActive] = useState<number | null>(null);
  const hover = (i: number | null) => { setActive(i); onHover(i); };
  return (
    <>
      <div className="fin-bars" onPointerLeave={() => hover(null)}>
        {months.map((m, i) => (
          <button
            key={m.key}
            className="fin-mon"
            data-current={m.current}
            data-active={active === i}
            aria-label={m.label}
            onPointerEnter={() => hover(i)}
            onFocus={() => hover(i)}
            onClick={() => hover(i)}
          >
            <i className="in" style={{ height: `max(2px, ${(m.ingreso / max) * 100}%)`, "--i": i } as CSSProperties} />
            <i className="out" style={{ height: `max(2px, ${(m.gasto / max) * 100}%)`, "--i": i } as CSSProperties} />
          </button>
        ))}
      </div>
      <AxisLabels labels={months.map((m) => m.label)} at={(i) => ((i + 0.5) / months.length) * 100} />
    </>
  );
}

export function CategoryHistory({ points, color, privacy }: {
  points: { label: string; value: number }[];
  color: string;
  privacy: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => Math.max(0, p.value));
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;
  const peak = values.indexOf(Math.max(...values));
  const hovered = active !== null ? points[active] : null;

  return (
    <div className="fin-sheet-chart">
      <div className={cn("hd", privacy && "privacy-blur")}>
        {hovered ? (
          <><span className="capitalize">{hovered.label}</span> · <b>{clp(Math.max(0, hovered.value))}</b></>
        ) : (
          <>promedio <b>{clp(avg)}</b> al mes · máximo <b>{clp(values[peak] ?? 0)}</b> en {points[peak]?.label}</>
        )}
      </div>
      <div className="fin-plot">
        <div className="fin-bars" onPointerLeave={() => setActive(null)}>
          {points.map((p, i) => (
            <button
              key={`${p.label}-${i}`}
              className="fin-mon"
              data-active={active === i}
              aria-label={`${p.label}: ${clp(values[i])}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <i
                className="out"
                style={{ height: `max(2px, ${(values[i] / max) * 100}%)`, background: color, "--i": i } as CSSProperties}
              />
            </button>
          ))}
          {avg > 0 && <span className="fin-avg" style={{ bottom: `${Math.min(1, avg / max) * 100}%` }} title="Promedio al mes" />}
        </div>
        <AxisLabels labels={points.map((p) => p.label)} at={(i) => ((i + 0.5) / points.length) * 100} />
      </div>
    </div>
  );
}

export function Spark({ values, color }: { values: number[]; color?: string | null }) {
  const max = Math.max(1, ...values);
  return (
    <span className="fin-spark" aria-hidden="true" style={color ? ({ "--c": color } as CSSProperties) : undefined}>
      {values.map((v, i) => <i key={i} style={{ height: `max(1px, ${(v / max) * 100}%)`, animationDelay: `${i * 18}ms` }} />)}
    </span>
  );
}

function AxisLabels({ labels, at }: { labels: string[]; at: (index: number) => number }) {
  const last = labels.length - 1;
  const every = Math.max(1, Math.ceil(labels.length / 6));
  const shown = labels.map((_, i) => i).filter((i) => (last - i) % every === 0);
  return (
    <div className="fin-axis-abs" aria-hidden="true">
      {shown.map((i) => (
        <span
          key={i}
          style={{ left: `${at(i)}%`, transform: i === 0 ? "none" : i === last ? "translateX(-100%)" : "translateX(-50%)" }}
        >
          {labels[i]}
        </span>
      ))}
    </div>
  );
}
