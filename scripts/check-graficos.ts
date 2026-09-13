import assert from "node:assert/strict";
import { run, dateKey } from "../src/lib/graficos/engine";
import { baseSpec, factory, boardSchema } from "../src/lib/graficos/model";
import type { Transaction } from "../src/hooks/useTransactions";
const t = (
  id: string,
  date: string,
  type: Transaction["type"],
  amount: number,
  category = "Comida",
  refund: string | null = null,
): Transaction => ({
  id,
  date,
  type,
  amount,
  category_name: category,
  reimbursement_for_category: refund,
  detail: null,
  user_id: "test",
  created_at: date,
  card_id: null,
  installment_id: null,
  bank_description: null,
});
const now = new Date("2026-04-15T12:00:00Z");
const rows = [
  t("1", "2026-01-10T12:00:00Z", "Ingreso", 1000, "Sueldo"),
  t("2", "2026-01-12T12:00:00Z", "Gasto", 300),
  t("3", "2026-03-10T12:00:00Z", "Ingreso", 50, "Devolución", "Comida"),
  t("4", "2026-03-11T12:00:00Z", "Inversión", 400),
  t("5", "2026-03-12T12:00:00Z", "Rescate", 100),
  t("6", "2026-03-13T12:00:00Z", "Rendimiento", -20),
  t("7", "2026-05-01T12:00:00Z", "Gasto", 900),
];
const s = baseSpec();
assert.equal(
  dateKey("2026-02-01T01:00:00Z"),
  "2026-01-31",
  "Dates use Chile timezone, not host timezone",
);
let r = run(s, rows, [], now);
assert.equal(r.total, 250, "Refund reduces expense");
assert.deepEqual(
  r.points.map((p) => p.value),
  [300, 0, -50, 0],
  "Quiet months remain in trend",
);
assert.deepEqual(
  r.ids,
  ["2", "3"],
  "Drilldown includes the contributing refund, excludes future transactions",
);
assert.equal(
  run({ ...s, categorias: ["Comida"] }, rows, [], now).total,
  250,
  "Refund uses reimbursed category",
);
assert.equal(run({ ...s, neto: false }, rows, [], now).total, 300);
assert.equal(
  run({ ...s, medida: "cantidad" }, rows, [], now).total,
  1,
  "Counting expenses counts actual expense rows",
);
assert.equal(
  run({ ...s, medida: "ahorro", tipo: "todos" }, rows, [], now).total,
  75,
  "Savings excludes investments and rescues",
);
assert.equal(
  run({ ...s, medida: "patrimonio", tipo: "todos" }, rows, [], now).total,
  730,
  "Transfers do not create wealth; negative yield reduces it",
);
r = run(
  {
    ...s,
    medida: "patrimonio",
    tipo: "todos",
    periodo: "rango",
    desde: "2026-03",
    hasta: "2026-04",
  },
  rows,
  [],
  now,
);
assert.equal(
  r.points[0].value,
  730,
  "Opening balance is carried into a selected range",
);
assert.deepEqual(
  new Set(r.points[0].ids),
  new Set(["1", "2", "3", "4", "5", "6"]),
);
assert.equal(
  run({ ...s, medida: "ahorro", tipo: "todos" }, [rows[1]], [], now).total,
  null,
  "No income is undefined, not 0%",
);
assert.equal(
  run(
    { ...s, medida: "diario", periodo: "mes" },
    [t("d", "2026-04-01T12:00:00Z", "Gasto", 150)],
    [],
    now,
  ).total,
  10,
  "Daily denominator counts elapsed calendar days",
);
assert.ok(
  run(
    { ...s, periodo: "rango", desde: "2026-04", hasta: "2026-01" },
    rows,
    [],
    now,
  ).error,
);
const weird = run(
  { ...s, agrupar: "categoria", series: "categoria" },
  [t("x", "2026-01-01T12:00:00Z", "Gasto", 10, "__proto__")],
  [],
  now,
);
assert.equal(weird.total, 10);
assert.equal(weird.points[0].series["__proto__"], 10);
assert.ok(boardSchema.safeParse(factory()).success);
assert.equal(boardSchema.safeParse({}).success, false);
console.log(
  "Gráficos: 16 comprobaciones de cálculos, fechas, filtros y configuración correctas.",
);

// Spreadsheet builder: selected columns determine the chart and survive a saved spec.
import { columnsFor, specForColumns } from "../src/lib/graficos/columns";
let built = specForColumns(s, ["fecha", "monto"]);
assert.equal(built.grafico, "barras");
assert.equal(built.agrupar, "mes");
built = specForColumns(s, ["categoria", "monto"]);
assert.equal(built.grafico, "torta");
assert.equal(built.agrupar, "categoria");
assert.deepEqual(columnsFor(built), ["categoria", "monto"]);
built = specForColumns(s, ["fecha", "categoria", "monto"]);
assert.equal(built.series, "categoria");
assert.equal(built.agrupar, "mes");
built = specForColumns(s, ["detalle"]);
assert.equal(built.medida, "cantidad");
assert.equal(built.agrupar, "detalle");
assert.deepEqual(columnsFor(built), ["detalle"]);
const exact = run(
  {
    ...s,
    periodo: "rango",
    desde: "2026-01",
    hasta: "2026-03",
    fechaDesde: "2026-01-13",
    fechaHasta: "2026-03-10",
  },
  rows,
  [],
  now,
);
assert.deepEqual(
  exact.ids,
  ["3"],
  "Exact dates, not whole months, determine included rows",
);
assert.equal(exact.total, -50);
assert.equal(
  boardSchema.safeParse({
    ...factory(),
    blocks: [{ id: crypto.randomUUID(), title: "Detalle", spec: built }],
  }).success,
  true,
);
console.log(
  "Editor de tabla: selección de columnas, sugerencias y fechas exactas correctas.",
);
assert.deepEqual(
  columnsFor(specForColumns(s, ["monto"])),
  ["monto"],
  "A number chart reopens with the exact selected column",
);
