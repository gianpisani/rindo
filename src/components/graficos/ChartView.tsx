import { ColorLegend } from "./ColorLegend";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import NumberFlow from "@number-flow/react";
import type { Spec } from "@/lib/graficos/model";
import {
  formatValue,
  type Result,
  type NamedColor,
} from "@/lib/graficos/engine";
import { CHART_COLORS } from "@/lib/chart-config";

const typeColor: Record<string, () => string> = {
  Ingreso: () => CHART_COLORS.income,
  Gasto: () => CHART_COLORS.expense,
  Inversión: () => CHART_COLORS.investment,
  Rescate: () => CHART_COLORS.rescue,
  Rendimiento: () => CHART_COLORS.yield,
};
export function colorFor(
  key: string,
  s: Spec,
  categories: NamedColor[],
  cards: NamedColor[],
  i = 0,
) {
  return (
    (Object.prototype.hasOwnProperty.call(s.colores, key)
      ? s.colores[key]
      : undefined) ||
    categories.find((c) => c.name === key)?.color ||
    cards.find((c) => c.name === key)?.color ||
    (Object.prototype.hasOwnProperty.call(typeColor, key)
      ? typeColor[key]()
      : undefined) ||
    (s.series === "ninguna" &&
    !["categoria", "tarjeta", "tipo"].includes(s.agrupar)
      ? "var(--primary)"
      : `oklch(${0.55 + (i % 5) * 0.055} 0.17 ${15 + (i % 8) * 39})`)
  );
}
export interface ChartViewProps {
  spec: Spec;
  result: Result;
  categories: NamedColor[];
  cards: NamedColor[];
  privateMode?: boolean;
  onInspect?: (ids: string[], label: string) => void;
  onColorChange?: (key: string, color: string) => void;
}
export function ChartView({
  spec: s,
  result: r,
  categories,
  cards,
  privateMode = false,
  onInspect,
  onColorChange,
}: ChartViewProps) {
  const color = (k: string, i = 0) => colorFor(k, s, categories, cards, i);
  if (r.error)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
        {r.error}
      </div>
    );
  if (privateMode)
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Montos ocultos
      </div>
    );
  if (!r.ids.length)
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-sm font-medium">Sin movimientos en este período</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Prueba con otro período o cambia los filtros.
          </p>
        </div>
      </div>
    );
  if (s.grafico === "numero")
    return (
      <button
        className="flex h-full w-full flex-col items-start justify-center px-3 text-left"
        onClick={() => onInspect?.(r.ids, "Movimientos del cálculo")}
      >
        <span className="chart-big-number font-mono font-semibold tracking-tight tabular-nums">
          {r.total === null ? (
            "—"
          ) : (
            <NumberFlow
              value={r.total}
              locales="es-CL"
              format={
                s.medida === "ahorro"
                  ? { maximumFractionDigits: 1, style: "unit", unit: "percent" }
                  : s.medida === "cantidad"
                    ? { maximumFractionDigits: 0 }
                    : {
                        style: "currency",
                        currency: "CLP",
                        maximumFractionDigits: 0,
                      }
              }
            />
          )}
        </span>
        <span className="mt-3 text-xs text-muted-foreground">
          {s.medida === "ahorro" && r.total === null
            ? "No hay ingresos para calcular una tasa."
            : `${r.ids.length.toLocaleString("es-CL")} movimientos en el cálculo`}
        </span>
      </button>
    );
  const series =
    s.series === "ninguna" || s.medida === "patrimonio" ? ["Total"] : r.series;
  const rows = r.points.map((p) => ({
    ...p,
    ...Object.fromEntries(series.map((k, i) => [`v${i}`, p.series[k] || 0])),
  }));
  if (s.grafico === "tabla")
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="py-3 font-medium">Grupo</th>
              {series.map((k) => (
                <th key={k} className="px-2 text-right font-medium">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.points.map((p) => (
              <tr key={p.key} className="border-t border-border/40">
                <td className="py-3">
                  <button
                    className="text-left hover:underline"
                    onClick={() => onInspect?.(p.ids, p.label)}
                  >
                    {p.label}
                  </button>
                </td>
                {series.map((k) => (
                  <td key={k} className="px-2 text-right font-mono">
                    <button
                      onClick={() =>
                        onInspect?.(p.seriesIds[k] || [], `${p.label} · ${k}`)
                      }
                    >
                      {formatValue(p.series[k] || 0, s.medida)}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  const tip = (
    <Tooltip
      content={({ active, payload, label }) =>
        active && payload?.length ? (
          <div className="max-w-xs rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
            <p className="mb-2 font-medium">{label || payload[0]?.name}</p>
            {payload.map((p, i) => (
              <div key={i} className="flex justify-between gap-5 py-0.5">
                <span>{String(p.name)}</span>
                <span className="font-mono">
                  {formatValue(Number(p.value), s.medida)}
                </span>
              </div>
            ))}
          </div>
        ) : null
      }
    />
  );
  if (["torta", "dona", "anillos"].includes(s.grafico)) {
    if (
      r.points.some(
        (p) => p.value < 0 || Object.values(p.series).some((v) => v < 0),
      )
    )
      return (
        <div className="grid h-full place-items-center p-5 text-center text-sm text-muted-foreground">
          Este resultado tiene valores negativos. Elige barras, líneas o tabla
          para mostrarlos sin distorsión.
        </div>
      );
    const slices = r.points.filter((p) => p.value > 0);
    if (!slices.length)
      return (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          El total es cero. Prueba la vista de tabla.
        </div>
      );
    const outer = slices.flatMap((p, i) =>
      series
        .filter((k) => (p.series[k] || 0) > 0)
        .map((k) => ({
          name: `${p.label} · ${k}`,
          value: p.series[k],
          ids: p.seriesIds[k],
          color: color(k, i),
          key: k,
        })),
    );
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {tip}
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius={
                  s.grafico === "torta"
                    ? 0
                    : s.grafico === "anillos"
                      ? "25%"
                      : "56%"
                }
                outerRadius={s.grafico === "anillos" ? "55%" : "85%"}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
                onClick={(p) => onInspect?.(p.ids, p.label)}
              >
                {slices.map((p, i) => (
                  <Cell
                    key={p.key}
                    fill={color(p.key, i)}
                    className="cursor-pointer"
                  />
                ))}
              </Pie>
              {s.grafico === "anillos" && (
                <Pie
                  data={outer}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="88%"
                  stroke="var(--card)"
                  isAnimationActive={false}
                  onClick={(p) => onInspect?.(p.ids, p.name)}
                >
                  {outer.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ColorLegend
          items={slices.map((p, i) => ({
            key: p.key,
            label: p.label,
            color: color(p.key, i),
            ids: p.ids,
          }))}
          onChange={onColorChange}
          onInspect={onInspect}
        />
      </div>
    );
  }
  const axes = (
    <>
      <CartesianGrid
        vertical={false}
        stroke="var(--border)"
        strokeOpacity={0.5}
      />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        tickLine={false}
        axisLine={false}
        minTickGap={20}
        tickMargin={10}
      />
      <YAxis
        width={58}
        tickFormatter={(v) => formatValue(v, s.medida, true)}
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        tickLine={false}
        axisLine={false}
      />
      {tip}
    </>
  );
  const inspect = (raw: unknown, k: string) => {
    const p = raw as { key?: string; payload?: { key?: string } };
    const point = r.points.find((x) => x.key === (p.key || p.payload?.key));
    if (point)
      onInspect?.(
        point.seriesIds[k] || point.ids,
        `${point.label}${k === "Total" ? "" : ` · ${k}`}`,
      );
  };
  const activePoint = (series: string) => (raw: unknown) => {
    const point = raw as {
      cx: number;
      cy: number;
      fill: string;
      payload?: { key?: string };
    };
    return (
      <circle
        cx={point.cx}
        cy={point.cy}
        r={5}
        fill={point.fill}
        stroke="var(--card)"
        strokeWidth={2}
        role="button"
        tabIndex={0}
        aria-label={`Ver movimientos de ${series}`}
        className="cursor-pointer"
        onClick={() => inspect(point, series)}
        onKeyDown={(e) => {
          if (e.key === "Enter") inspect(point, series);
        }}
      />
    );
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {s.grafico === "barras" ? (
            <BarChart
              data={rows}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
            >
              {axes}
              {series.map((k, i) => (
                <Bar
                  key={k}
                  name={k}
                  dataKey={`v${i}`}
                  fill={color(k, i)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive={false}
                  onClick={(p) => inspect(p, k)}
                >
                  {series.length === 1 &&
                    r.points.map((p, j) => (
                      <Cell key={p.key} fill={color(p.key, j)} />
                    ))}
                </Bar>
              ))}
            </BarChart>
          ) : s.grafico === "area" ? (
            <AreaChart
              data={rows}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
            >
              {axes}
              {series.map((k, i) => (
                <Area
                  key={k}
                  type="monotone"
                  name={k}
                  dataKey={`v${i}`}
                  stroke={color(k, i)}
                  fill={color(k, i)}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  isAnimationActive={false}
                  activeDot={activePoint(k)}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart
              data={rows}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
            >
              {axes}
              {series.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  name={k}
                  dataKey={`v${i}`}
                  stroke={color(k, i)}
                  strokeWidth={2}
                  dot={rows.length < 20 ? { r: 3 } : false}
                  isAnimationActive={false}
                  activeDot={activePoint(k)}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {(series.length > 1 || onColorChange) && (
        <ColorLegend
          items={
            s.grafico === "barras" && series.length === 1
              ? r.points.map((p, i) => ({
                  key: p.key,
                  label: p.label,
                  color: color(p.key, i),
                  ids: p.ids,
                }))
              : series.map((k, i) => ({
                  key: k,
                  label: k === "Total" ? "Monto" : k,
                  color: color(k, i),
                  ids: r.ids,
                }))
          }
          onChange={onColorChange}
          onInspect={onInspect}
        />
      )}
    </div>
  );
}
