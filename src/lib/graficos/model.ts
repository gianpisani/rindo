import { z } from "zod";
import { TRANSACTION_TYPES } from "@/lib/ledger";

export const chartTypes = {
  barras: "Barras",
  lineas: "Líneas",
  area: "Área",
  torta: "Torta",
  dona: "Dona",
  anillos: "Anillos",
  tabla: "Tabla",
  numero: "Número",
} as const;
export const dimensions = {
  mes: "Mes",
  año: "Año",
  trimestre: "Trimestre",
  categoria: "Categoría",
  tipo: "Tipo",
  tarjeta: "Tarjeta",
  detalle: "Detalle",
  semana: "Día de la semana",
} as const;
export const measures = {
  monto: "Monto total",
  cantidad: "Cantidad de movimientos",
  promedio: "Promedio por movimiento",
  ahorro: "Tasa de ahorro",
  diario: "Gasto por día",
  patrimonio: "Patrimonio acumulado",
} as const;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const specSchema = z.object({
  v: z.literal(1).default(1),
  columnas: z
    .array(
      z.enum(["fecha", "categoria", "detalle", "tipo", "monto", "tarjeta"]),
    )
    .max(3)
    .optional(),
  periodo: z.enum(["todo", "año", "mes", "12meses", "rango"]).default("todo"),
  desde: month.default("2026-01"),
  hasta: month.default("2026-12"),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fechaHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tipo: z.enum(["todos", ...TRANSACTION_TYPES]).default("Gasto"),
  categorias: z.array(z.string().max(200)).max(200).default([]),
  tarjetas: z.array(z.string()).max(100).default([]),
  agrupar: z
    .enum([
      "mes",
      "año",
      "trimestre",
      "categoria",
      "tipo",
      "tarjeta",
      "semana",
      "detalle",
    ])
    .default("mes"),
  series: z
    .enum(["ninguna", "categoria", "tipo", "tarjeta", "detalle"])
    .default("ninguna"),
  grafico: z
    .enum([
      "barras",
      "lineas",
      "area",
      "torta",
      "dona",
      "anillos",
      "tabla",
      "numero",
    ])
    .default("barras"),
  medida: z
    .enum(["monto", "cantidad", "promedio", "ahorro", "diario", "patrimonio"])
    .default("monto"),
  neto: z.boolean().default(true),
  colores: z.record(z.string().regex(/^#[0-9a-fA-F]{6}$/)).default({}),
});
export type Spec = z.infer<typeof specSchema>;
export type Dimension = keyof typeof dimensions;
export const blockSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120).default(""),
  spec: specSchema,
});
export type Block = z.infer<typeof blockSchema>;
const positionSchema = z.object({
  i: z.string().uuid(),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(10000),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(3).max(30),
});
export const boardSchema = z.object({
  id: z.string().uuid(),
  blocks: z.array(blockSchema).max(100),
  layouts: z.object({
    desktop: z.array(positionSchema),
    mobile: z.array(positionSchema),
  }),
  revision: z.number().int().min(0).default(0),
});
export type Board = Omit<Required<z.infer<typeof boardSchema>>, "layouts"> & {
  layouts: { desktop: Position[]; mobile: Position[] };
};
export type Position = Required<z.infer<typeof positionSchema>>;
export const baseSpec = (): Spec => specSchema.parse({});
export const templates: {
  title: string;
  description: string;
  spec: Partial<Spec>;
}[] = [
  {
    title: "Desde cero",
    description: "Elige los datos y dales tu forma.",
    spec: {},
  },
  {
    title: "Evolución mensual",
    description: "Ingresos y gastos a través del tiempo.",
    spec: { tipo: "todos", series: "tipo", grafico: "lineas" },
  },
  {
    title: "En qué se fue",
    description: "Tus gastos, categoría por categoría.",
    spec: { grafico: "dona", agrupar: "categoria", periodo: "año" },
  },
  {
    title: "Tasa de ahorro",
    description: "Qué porcentaje de tus ingresos conservas.",
    spec: {
      grafico: "numero",
      medida: "ahorro",
      tipo: "todos",
      periodo: "año",
    },
  },
  {
    title: "Gasto por día",
    description: "Tu gasto promedio en lo que va del mes.",
    spec: { grafico: "numero", medida: "diario", periodo: "mes" },
  },
  {
    title: "Gastos por categoría",
    description: "Compara cuánto gastaste en cada una.",
    spec: { agrupar: "categoria" },
  },
  {
    title: "Tu semana",
    description: "Los días en que más gastas.",
    spec: { agrupar: "semana", periodo: "12meses" },
  },
  {
    title: "Patrimonio",
    description: "Líquido e invertido, sin contar aportes dos veces.",
    spec: { grafico: "area", medida: "patrimonio", tipo: "todos" },
  },
  {
    title: "Movimientos en una tabla",
    description: "Compara los totales mes a mes.",
    spec: { grafico: "tabla", tipo: "todos", series: "tipo" },
  },
  {
    title: "Gastos por tarjeta",
    description: "La distribución entre tus tarjetas.",
    spec: { grafico: "torta", agrupar: "tarjeta" },
  },
  {
    title: "Categorías y tarjetas",
    description: "Dos niveles en un mismo gráfico.",
    spec: { grafico: "anillos", agrupar: "categoria", series: "tarjeta" },
  },
];
export function newBlock(template = templates[0]): Block {
  return {
    id: crypto.randomUUID(),
    title: template.title === "Desde cero" ? "" : template.title,
    spec: specSchema.parse(template.spec),
  };
}
export function factory(): Board {
  const blocks = [1, 2, 3, 4, 5, 6].map((i) => newBlock(templates[i]));
  const sizes = [
    [0, 0, 8, 9],
    [8, 0, 4, 9],
    [0, 9, 4, 5],
    [4, 9, 4, 5],
    [0, 14, 8, 9],
    [8, 9, 4, 14],
  ];
  return {
    id: crypto.randomUUID(),
    revision: 0,
    blocks,
    layouts: {
      desktop: blocks.map((b, i) => ({
        i: b.id,
        x: sizes[i][0],
        y: sizes[i][1],
        w: sizes[i][2],
        h: sizes[i][3],
      })),
      mobile: blocks.map((b, i) => ({ i: b.id, x: 0, y: i * 9, w: 1, h: 9 })),
    },
  };
}
export function titleFor(b: Block) {
  return (
    b.title ||
    (b.spec.grafico === "numero" ? measures[b.spec.medida] : undefined) ||
    `${b.spec.tipo === "todos" ? "Movimientos" : b.spec.tipo} por ${dimensions[b.spec.agrupar].toLowerCase()}`
  );
}
export const periodLabels = {
  todo: "Todo el historial",
  año: "Este año",
  mes: "Este mes",
  "12meses": "Últimos 12 meses",
  rango: "Rango de fechas",
} as const;
export function periodLabel(s: Spec) {
  return s.periodo === "rango"
    ? `${s.fechaDesde || s.desde} → ${s.fechaHasta || s.hasta}`
    : periodLabels[s.periodo];
}
