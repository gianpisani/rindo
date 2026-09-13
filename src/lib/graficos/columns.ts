import type { Spec } from "./model";

export const columns = [
  { id: "fecha", label: "Fecha", letter: "A" },
  { id: "categoria", label: "Categoría", letter: "B" },
  { id: "detalle", label: "Detalle", letter: "C" },
  { id: "tipo", label: "Tipo", letter: "D" },
  { id: "monto", label: "Monto", letter: "E" },
  { id: "tarjeta", label: "Tarjeta", letter: "F" },
] as const;
export type Column = (typeof columns)[number]["id"];
export function columnsFor(spec: Spec): Column[] {
  if (spec.columnas) return [...spec.columnas];
  const group: Column = ["mes", "año", "trimestre", "semana"].includes(
    spec.agrupar,
  )
    ? "fecha"
    : (spec.agrupar as Column);
  return [
    group,
    ...(spec.series !== "ninguna" && spec.series !== group
      ? [spec.series as Column]
      : []),
    ...(spec.medida === "cantidad" ? [] : ["monto" as const]),
  ];
}
/** The column headers are the source of the chart suggestion; no hidden query builder. */
export function specForColumns(spec: Spec, selected: Column[]): Spec {
  const groups = selected.filter((c) => c !== "monto");
  const first = groups.includes("fecha") ? "fecha" : groups[0];
  const second = groups.find((c) => c !== first);
  return {
    ...spec,
    columnas: selected,
    agrupar: first === "fecha" ? "mes" : first || "mes",
    series: second && second !== "fecha" ? second : "ninguna",
    medida: selected.includes("monto") ? "monto" : "cantidad",
    grafico:
      groups.length === 0
        ? "numero"
        : first === "fecha" || second
          ? "barras"
          : "torta",
  };
}
