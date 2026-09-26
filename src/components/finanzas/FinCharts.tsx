import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { clpShort } from "@/lib/finance-history";

const clp = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(value);


// ─── Cascada del mes ─────────────────────────────────────────────────────
// Cuatro columnas: lo que entró sube, lo que se gastó e invirtió baja desde
// ahí, y lo que quedó es la última barra. Se lee sin leyenda.

export interface FlowStep {
  label: string;
  /** Positivo sube, negativo baja. */
  value: number;
  color: string;
  /** "−16% vs ago" y su tono. */
  delta?: { text: string; tone?: string };
}

export function FlowWaterfall({ steps, result, privacy }: {
  steps: FlowStep[];
  result: FlowStep;
  privacy: boolean;
}) {
  // Niveles acumulados: dónde empieza y termina cada barra.
  let level = 0;
  const bars = steps.map((step) => {
    const from = level;
    level += step.value;
    return { ...step, from, to: level };
  });
  const all = [...bars, { ...result, from: 0, to: result.value }];
  const top = Math.max(1, ...all.map((b) => Math.max(b.from, b.to)));
  const bottom = Math.min(0, ...all.map((b) => Math.min(b.from, b.to)));
  const span = top - bottom;
  const y = (v: number) => ((top - v) / span) * 100; // % desde arriba

  return (
    <div className="fin-steps">
      {all.map((bar, i) => {
        const hi = Math.max(bar.from, bar.to);
        const lo = Math.min(bar.from, bar.to);
        const next = all[i + 1];
        return (
          <div key={bar.label} className="fin-step">
            <div className="bar-zone">
              <span className={cn("amt", privacy && "privacy-blur")} style={{ top: `${y(hi)}%`, color: bar.color }}>
                <span className="full">{bar.value < 0 ? "−" : i === 0 ? "+" : ""}{clp(Math.abs(bar.value))}</span>
                <span className="short">{bar.value < 0 ? "−" : i === 0 ? "+" : ""}{clpShort(Math.abs(bar.value)).replace("−", "")}</span>
              </span>
              <span
                className="bar"
                data-dir={bar.to < bar.from ? "down" : "up"}
                style={{ top: `${y(hi)}%`, height: `${y(lo) - y(hi)}%`, background: bar.color, "--i": i } as CSSProperties}
              />
              {/* El puente punteado lleva el nivel a la barra siguiente */}
              {next && <span className="link" style={{ top: `${y(bar.to)}%` }} />}
            </div>
            <div className="foot">
              <div className="n">{bar.label}</div>
              {bar.delta && <div className="d" style={{ color: bar.delta.tone }}>{bar.delta.text}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gasto de cada día ───────────────────────────────────────────────────

export function DailyBars({ values, month, today, onHover, onPick }: {
  /** Índice 1..días del mes. */
  values: number[];
  month: Date;
  /** Día de hoy si es el mes en curso; lo posterior queda vacío. */
  today: number | null;
  onHover: (day: number | null) => void;
  onPick: (day: number) => void;
}) {
  const days = values.length - 1;
  const lived = today ?? days;
  const spent = values.slice(1, lived + 1).map((v) => Math.max(0, v));
  const avg = spent.length ? spent.reduce((s, v) => s + v, 0) / spent.length : 0;
  // Un día excepcional (el arriendo) no debe aplastar al resto: la escala
  // tiene techo y esa barra llega arriba con una marca de "sigue".
  const sorted = [...spent].sort((a, b) => b - a);
  const max = Math.max(1, Math.min(sorted[0] ?? 0, Math.max((sorted[1] ?? 0) * 1.2, avg * 3)));
  const [active, setActive] = useState<number | null>(null);

  const hover = (day: number | null) => { setActive(day); onHover(day); };

  return (
    <>
      <div className="fin-days" onPointerLeave={() => hover(null)}>
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const future = day > lived;
          const weekday = new Date(month.getFullYear(), month.getMonth(), day).getDay();
          const value = Math.max(0, values[day] ?? 0);
          return (
            <button
              key={day}
              className="fin-day"
              data-weekend={weekday === 0 || weekday === 6}
              data-future={future}
              data-today={day === today}
              data-active={active === day}
              disabled={future}
              aria-label={`Día ${day}`}
              onPointerEnter={() => !future && hover(day)}
              onFocus={() => !future && hover(day)}
              onClick={() => !future && value > 0 && onPick(day)}
            >
              <i
                className={cn(value > max && "is-capped")}
                style={{ height: future ? "3px" : `max(2px, ${Math.min(1, value / max) * 100}%)`, "--i": i } as CSSProperties}
              />
            </button>
          );
        })}
        {avg > 0 && <span className="fin-avg" style={{ bottom: `${Math.min(1, avg / max) * 100}%` }} title="Promedio por día" />}
      </div>
      <div className="fin-axis">
        {[1, 8, 15, 22, days].map((d) => <span key={d}>{d}</span>)}
      </div>
    </>
  );
}

// ─── Patrimonio en el tiempo ─────────────────────────────────────────────
// Lo invertido abajo, lo líquido encima: la altura total es el patrimonio.

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
        <path className="area" d={area(totals, invested)} fill="color-mix(in oklch, var(--inicio-emerald) 16%, transparent)" />
        <path d={line(invested)} fill="none" stroke="var(--inicio-blue)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.8} />
        <path d={line(totals)} fill="none" stroke="var(--inicio-emerald)" strokeWidth={2.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {active !== null && <span className="fin-scrub" style={{ left: `${(x(active) / W) * 100}%` }} />}
      <AxisLabels labels={points.map((p) => p.label)} at={(i) => (x(i) / W) * 100} />
    </div>
  );
}

// ─── Mes a mes ───────────────────────────────────────────────────────────

export interface MonthBar { key: string; label: string; ingreso: number; gasto: number; current: boolean }

export function MonthBars({ months, onHover, onPick }: {
  months: MonthBar[];
  onHover: (index: number | null) => void;
  onPick: (index: number) => void;
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
            aria-label={`Ver ${m.label}`}
            onPointerEnter={() => hover(i)}
            onFocus={() => hover(i)}
            onClick={() => onPick(i)}
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

export function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className="fin-spark" aria-hidden="true">
      {values.map((v, i) => <i key={i} style={{ height: `max(1px, ${(v / max) * 100}%)`, background: color, animationDelay: `${i * 18}ms` }} />)}
    </span>
  );
}

/**
 * Etiquetas de un eje ubicadas donde cae cada punto, a lo más ~6: con más,
 * se tocan en una pantalla angosta. La primera y la última se apoyan en los
 * bordes para no salirse de la tarjeta.
 */
function AxisLabels({ labels, at }: { labels: string[]; at: (index: number) => number }) {
  const every = Math.max(1, Math.ceil(labels.length / 6));
  const shown = labels.map((_, i) => i).filter((i) => i % every === 0 || i === labels.length - 1)
    // Si la última queda pegada a la anterior, se va la anterior.
    .filter((i, k, list) => !(k === list.length - 2 && labels.length - 1 - i < every / 2));
  return (
    <div className="fin-axis-abs" aria-hidden="true">
      {shown.map((i) => (
        <span
          key={i}
          style={{ left: `${at(i)}%`, transform: i === 0 ? "none" : i === labels.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}
        >
          {labels[i]}
        </span>
      ))}
    </div>
  );
}
