# Plan: "Gráficos" — el Excel de los movimientos

> Documento de handoff. Reemplaza la sección **Finanzas** (`/overview`) por una sección donde
> uno arma sus propios gráficos sobre sus movimientos. **Meta no se toca**: es otro eje
> (prescriptivo, con su plan v2 ya ejecutado en `docs/plan-meta-copiloto-v2.md`).

## 1. Por qué muere Finanzas

`src/pages/Overview.tsx` son 1.426 líneas que en su mayoría repiten lo que ya existe:

| Lo que muestra Finanzas | Dónde ya vive |
|---|---|
| Balance, donut de gastos del mes, límites, recientes, wrapped | **Inicio** (`Index.tsx`) |
| Presupuesto por categoría | **Meta** (ahí el presupuesto es el input, no un derivado) |
| KPIs del mes, tasa de ahorro, gasto diario | solo acá → se rescatan como bloques de número |
| Evolución mensual, gasto acumulado por categoría, mejor/peor mes | solo acá → se expresan como gráficos |
| Proyección de patrimonio (`ProjectionCard`) | solo acá → **queda pendiente** (ver §7) |

Antecedente que importa: el commit `73cf2c2` ya borró un `Dashboard.tsx` + `DashboardGrid`
(react-grid-layout, 15 columnas, layout en localStorage) y lo fusionó en Finanzas con tabs.
Murió porque eran **widgets fijos que solo se podían mover**: mover cajas que no elegiste no es
poder. Esta versión es lo contrario — el usuario define el contenido, no solo la posición.
El CSS de ese dashboard sigue en `index.css:1048-1103` y se reusa.

## 2. Decisiones tomadas con Gianfranco (no re-abrir)

1. **Simple como Excel.** Barra de controles arriba, gráfico abajo. Se descartó
   explícitamente el composer de "frases con chips" y el parseo de lenguaje natural.
2. **Canvas libre** (`x, y, w, h`): se arrastra y se estira cada bloque donde uno quiera.
   Con el costo asumido de un layout aparte para móvil.
3. **Nombre de la sección: "Gráficos"** (`/graficos`), ícono `ChartNoAxesCombined`.
4. **Los colores editados viven en el bloque**, no en la categoría. Abajo del picker, un
   "usar en toda la app" opcional que sí escribe `categories.color`.
5. **Muere Finanzas. Meta se queda intacta.**
6. `MonthlyEvolutionChart` se vuelve un gráfico de fábrica y el componente (546 líneas) se borra.
   La tasa de ahorro y el gasto diario vuelven como bloques de número.

## 3. El modelo: un bloque = un gráfico

Cinco controles, todos con componentes que ya existen en el design system:

```
┌─ Gasto en Comida · ene–sep 2026 ──────────────────── ⋮ ─┐
│  [ene 2026 ▾] → [sep 2026 ▾]   [Comida ▾]   [barras ▾] 🎨│
│   ▁▃▅▂▇▄▃▅▂                                              │
│   E  F  M  A  M  J  J  A  S                              │
└──────────────────────────────────────────────────────────┘
```

1. **Meses**: `desde → hasta`, dos selects de mes. Por defecto, del movimiento más viejo a hoy.
   Chips rápidos: `todo` · `este año` · `últimos 12`.
2. **Qué**: tipo de movimiento + categorías (vacío = Todo).
3. **Cómo lo parto**: mes · año · trimestre · categoría · tipo · tarjeta · día de la semana · balde.
4. **Gráfico**: barras · líneas · área · torta · dona · anillos (2 niveles) · tabla · número.
5. **🎨 Colores**: una fila por serie con su swatch.

El título se genera solo desde el spec (`tituloAuto`) y se puede pisar (`title_override`).
Click en cualquier barra o tajada → los movimientos detrás, reusando `CategoryDetailModal`.

### El spec que se guarda

```ts
// src/lib/graficos/spec.ts
export interface SpecGrafico {
  v: 1;
  periodo:
    | { modo: "todo" }
    | { modo: "este-año" }
    | { modo: "ultimos"; meses: number }
    | { modo: "rango"; desde: string; hasta: string }; // "2026-01"
  tipo: TransactionType | "todos";
  categorias: string[];              // [] = todas
  tarjetas: string[];                // [] = todas
  partirPor: CampoId;                // "mes" | "categoria" | ...
  segundaDimension?: CampoId;        // series / anillo externo
  grafico: "barras" | "lineas" | "area" | "torta" | "dona" | "anillos" | "tabla" | "numero";
  medida: "plata" | "cantidad" | "promedio" | "promedio-mensual"
        | "tasa-ahorro" | "gasto-por-dia" | "balance";
  neto: boolean;                     // netea reembolsos (default true)
  topN?: number;                     // + "Otros"
  colores: Record<string, string>;   // solo las claves que el usuario tocó
}
```

**El período es relativo por defecto.** Un gráfico guardado con `modo: "este-año"` sigue siendo
verdad en enero; uno con fechas duras se podre. Por eso `rango` existe pero no es el default.

**Medidas derivadas.** `tasa-ahorro`, `gasto-por-dia` y `balance` son tres fórmulas con nombre
en `medidas.ts` (no se expresan como group-by) y solo se ofrecen para `grafico: "numero"` y
`"lineas"`. Es lo que permite recuperar los KPIs de Finanzas sin ensuciar el modelo.

**Normalización que repara, no rechaza.** `normalizarSpec(raw)` toma cualquier jsonb y devuelve
un spec válido rellenando lo que falta. Un spec viejo o roto nunca puede tirar la página: en el
peor caso el bloque muestra "este gráfico ya no se entiende, arreglalo".

### El motor

Corre **en el cliente**. `App.tsx` ya prefetchea todas las transacciones; un group-by en memoria
sobre miles de filas es instantáneo, funciona offline en la PWA, y es lo que hace que tocar un
control se sienta vivo. Si algún día son 50k filas, el mismo spec se compila a SQL: el contrato
es el spec, no la query.

```
src/lib/graficos/
  spec.ts       tipos + normalizarSpec() + tituloAuto()
  campos.ts     los campos disponibles: { id, label, valorDe(t), colorDe(v), formato }
  medidas.ts    suma / conteo / promedio + las tres derivadas
  motor.ts      correr(spec, transactions, categories, cards) => Serie[]
  fabrica.ts    TABLERO_DE_FABRICA
```

`motor.ts` **usa `ledger.ts`** (`bucketDeltas`, `displaySign`, `isPassThrough`) para el signo, el
balde y el neteo de reembolsos. Si "neto" o "invertido" dan distinto que en Inicio, el número
está mal: una sola fuente de la verdad.

### Los colores por defecto

Nunca una paleta indexada — eso es lo que hace que un gráfico se vea de otra app.

- Si el valor tiene identidad propia, el color es el suyo: `categories.color`,
  `credit_cards.color`, `TYPE_COLORS` del ledger.
- Si no la tiene (año, mes, día de la semana): **rampa secuencial generada en OKLCH** desde
  `--accent-*`, con el mismo criterio que `--band-1..5` en `index.css`.
- `spec.colores[clave]` pisa lo anterior, y solo guarda lo que el usuario tocó.

Picker: la grilla de 8 swatches + `<input type="color">` que ya existe en
`Categories.tsx:205-222` y `CategoryCreateInline.tsx:117-138`. Cero UI nueva.

## 4. La base de datos

```sql
-- supabase/migrations/20260909_graficos.sql
create table analysis_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mis gráficos',
  layout jsonb not null default '{}'::jsonb,   -- { lg: { "<blockId>": {x,y,w,h} }, sm: {...} }
  position int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table analysis_blocks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references analysis_boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spec jsonb not null,
  title_override text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

RLS (4 policies por tabla), índices por `user_id`/`board_id` y trigger `update_updated_at_column`
calcados de `20260330_budget_system.sql`.

**Por qué el layout va en el tablero y no en el bloque.** El `spec` cambia poco y de a uno (una
escritura, una fila). El layout cambia todo el tiempo y de a varios: arrastrar un gráfico
reacomoda a sus vecinos. Con el layout en el tablero, un drag es **un** `update` (con debounce);
con el layout en cada bloque son N escrituras por arrastre.

**Los defaults viven en código, no en la base.** `TABLERO_DE_FABRICA` en `fabrica.ts`; si el
usuario no tiene tableros, se renderiza ese. Se materializa a filas **solo cuando toca algo**
(copy-on-write). Sin backfill para los usuarios que ya existen, sin trigger en el signup, y los
defaults mejoran para todos cuando se mejora el archivo.

Tablero de fábrica (6 bloques):

1. **Evolución mensual** — líneas, todo, por mes, series por tipo. (reemplaza `MonthlyEvolutionChart`)
2. **En qué se fue este año** — dona, gasto, este año, por categoría, top 6 + Otros.
3. **Tasa de ahorro** — número, últimos 12 meses.
4. **Gasto por día** — número, este mes.
5. **Top 10 categorías** — barras horizontales, todo el historial.
6. **Gasto por día de la semana** — barras, últimos 12 meses.

Aparte, una **galería de plantillas** (`+ Gráfico` → ~12 armados) para que agregar sea un click.

## 5. Librerías: ninguna nueva para graficar

- **Recharts se queda.** Ya es el incumbente (`Overview`, `ProjectionCard`, `LearningProgress`,
  `ui/chart.tsx`) y es una librería de *primitivas*: cada `<Cell fill>`, tick y tooltip los
  escribimos nosotros y toman los tokens vía `CHART_COLORS`. No trae estética propia.
  La familia torta sale completa: torta, dona, **anillos anidados** (dos `<Pie>` en un
  `<PieChart>`), treemap, y barras apiladas al 100%.
- **Se van del `package.json`**: `@tremor/react` y `@nivo/sankey` — cero imports en todo `src`
  (verificado) y ambas traen su propio look.
- **Se agrega `@types/react-grid-layout`** (devDep): `react-grid-layout@1.5.2` no trae types y
  sin eso `tsc` no compila.
- El número grande usa `NumberFlow`, que ya es el idioma de la app.
- **Privacy mode**: todo monto visible respeta `isPrivacyMode` + `privacy-blur`, como el resto.

## 6. Fases

**Fase 0 — limpieza.** Sacar tremor y nivo, agregar `@types/react-grid-layout`, renombrar el CSS
huérfano del dashboard muerto (`index.css:1048-1103`).

**Fase 1 — modelo y motor.** `src/lib/graficos/*`. Es la fase que se puede verificar sin UI.

**Fase 2 — migración.** `20260909_graficos.sql` vía `mcp__supabase__apply_migration`
(proyecto `fxlztcwqmlmhqwzbrebo`) + `mcp__supabase__generate_typescript_types` para regenerar
`src/integrations/supabase/types.ts`. **Pedir OK antes de aplicar.**

**Fase 3 — UI.**

```
src/hooks/useGraficos.ts                    react-query: tableros + bloques, layout con debounce
src/components/graficos/Lienzo.tsx          react-grid-layout, drag desde el header
src/components/graficos/BloqueGrafico.tsx   GlassCard + controles + render
src/components/graficos/BarraControles.tsx  los 5 controles
src/components/graficos/PickerColores.tsx   swatches + input type=color
src/components/graficos/Galeria.tsx         + Gráfico → plantillas
src/pages/Graficos.tsx
```

**Fase 4 — matar Finanzas.**

- Borrar `src/pages/Overview.tsx` y `src/components/MonthlyEvolutionChart.tsx`.
- `CategoryDetailModal` **se queda**: es el drill-down de los bloques.
- `routes-config.ts`: `Finanzas /overview` → `Gráficos /graficos`, shortcut 3.
- `App.tsx`: ruta nueva + un `<Navigate to="/graficos">` desde `/overview` para no romper links.
- `useNavPreferences.ts:38` y `CustomizeNavDrawer.tsx:89` apuntan a `/overview` en los defaults.
- **`nav-preferences-storage` está persistido con `version: 1` y sin `migrate`.** Hay que subir a
  `version: 2` con un `migrate` que mapee `/overview` → `/graficos`: `getOrderedRoutes` se cura
  solo, pero `mobileTabs` se quedaría con 2 tabs en el celular sin avisar.

**Verificación antes de push**: `npx tsc --noEmit` completo. `vite build` no chequea tipos y por
eso ya se fue una pantalla negra a producción una vez.

## 7. Pendiente explícito

`ProjectionCard` (proyección de patrimonio) es un modelo con supuestos, no una agrupación de
movimientos: no se expresa como gráfico. No se decidió si se va a Meta o muere. **No se borra ni
se mueve en este plan**: queda en el repo sin ruta hasta que se decida.
