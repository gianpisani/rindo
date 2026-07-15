# Plan: Copiloto v2 — "Meta" (pay yourself first)

> Documento de handoff. Contiene TODO el contexto necesario: hallazgos sobre datos reales,
> decisiones ya tomadas con Gianfranco (no re-litigar), fórmulas exactas, y el plan por fases.
> La página `/budget` (CategoryInsightsView) ya fue rediseñada una vez como "El Copiloto"
> (commit cc4f18d): burn-down mensual + $/día + simulador "¿Me alcanza?". Este plan es su v2.

## 1. El modelo mental del usuario (validado con sus datos reales)

Gianfranco NO presupuesta gasto. Su plan real es **ahorrar $1.500.000/mes y vivir con el resto**
(pay yourself first). El `total_budget` de $700.000 que tiene configurado es en realidad
`sueldo $2.2MM − meta $1.5MM` — un derivado, no un input. La app hoy está construida al revés.

Hallazgos duros (SQL sobre Supabase, proyecto `fxlztcwqmlmhqwzbrebo`, user `42f87eb6-3bb8-4a8d-83b0-8dc8f2680879`, período ene–jun 2026):

- **Sueldo**: ~$2.2MM, llega SIEMPRE entre el 27 y 31 del mes. El sueldo del 27-jun financia julio.
  Hoy la app muestra a mitad de mes "$0 ingreso, $1MM gasto" — pánico falso.
- **Reembolsos**: presta ~$212k/mes que le devuelven. Ingresos tipo `Ingreso` con
  `reimbursement_for_category != null` (los taguea bien: 25/27). Su ingreso bruto aparece
  inflado (~$2.6MM vs $2.2MM real) y su gasto también.
- **Consumo neto real**: ~$1.44MM/mes, PERO se descompone en:
  - **Vida**: ~$1.15MM bruto / ~$0.96MM neto, estable (banda $1.0–1.26MM los 6 meses).
  - **Bombazos**: ~$470k/mes = Eurotrip (hoteles Barcelona/Amsterdam/París) + cuotas de
    tecnología ($156k×12). Categorías: `Viajes y hospedaje`, `Tecnología`.
- **Ahorro real**: invirtió $1.2MM/mes promedio; cumplió la meta de $1.5MM solo 2/6 meses
  (ambos con ingresos extraordinarios: finiquito $1.34MM, venta compu $1.35MM).
  **Junio invirtió $0** (el Hotel París de $577k se comió el sweep) y nadie se lo dijo.
- **Cash flow**: en 13 meses de historia, cash neto ≈ +$63k. Barre TODO excedente a inversión
  ("Risk", "Reserva", Fintual). Su cuenta vive en cero a propósito.
- `shared_expenses` está **muerta** (7 registros, todos de dic-2025). NO construir nada que
  requiera mantener estado pendiente — él registra después de los hechos, no antes.

## 2. Decisiones YA tomadas (no re-abrir)

1. **Neto por defecto, sin toggle bruto.** La conciliación bancaria no le interesa (dicho
   explícitamente). Reembolsos salen del ingreso y netean el consumo.
2. **Sueldo cuenta para el mes que financia** (regla de atribución, día ≥ 25 → mes siguiente).
   NO re-cortar los meses en ciclos: los meses calendario se mantienen.
3. **NO construir "cuentas por cobrar"** ni resucitar shared_expenses. Descartado con datos.
4. **Meta de ahorro como input sagrado**; presupuesto de gasto = derivado.
5. **Vida vs Bombazos** por categoría (simple), con fondo mensual acumulable para bombazos.
6. La Trayectoria (rediseño de /overview), "lo comprometido" (Tarjetas), code-splitting y
   resync de Fintual quedan **fuera de alcance** de este plan.

## 3. Fase 1 — Capa de datos: `src/hooks/useRealFlows.ts`

Hook central de clasificación. Firma sugerida:

```ts
useRealFlows(transactions: Transaction[], month: Date) => {
  ingresoReal: number;        // Ingresos SIN tag de reembolso, con sueldo-shift aplicado
  reembolsosRecibidos: number;
  consumoBruto: number;       // Gastos del mes (sin tránsito)
  consumoNeto: number;        // consumoBruto − reembolsosRecibidos
  vida: number;               // consumo neto de categorías NO bombazo
  bombazos: number;           // consumo en categorías bombazo
  dailyNet: number[];         // gasto neto por día (para burn-down, ya existe similar en v1)
}
```

Reglas de clasificación:
- **Ingreso real**: `type === 'Ingreso' && !reimbursement_for_category`, con sueldo-shift:
  si `category_name === 'Sueldo'` y `getDate(date) >= 25`, atribuir al mes siguiente.
  Constante `SALARY_SHIFT_DAY = 25` exportada.
- **Reembolso recibido**: `type === 'Ingreso' && reimbursement_for_category != null`.
- **Tránsito (excluir de todo)**: `type === 'Gasto' && category_name === 'Reembolsos'`
  (es plata que pone por otros, ej. "Luz y agua" $213k) y `category_name === 'Conciliación'`.
- **Bombazo**: `type === 'Gasto'` en `BOMBAZO_CATEGORIES = ['Viajes y hospedaje', 'Tecnología']`
  (constante exportada, fácil de ampliar).
- **Vida**: el resto de los gastos.
- Neteo de reembolsos: contra el mes en que llegan (igual que hoy). No intentar matching
  reembolso↔gasto (decidido: el error cross-mes es ruido).

Parsing de fechas: usar `new Date(t.date)` + `isSameMonth` de date-fns, consistente con el
resto del código (`date` es TIMESTAMPTZ en zona Chile).

**Tabla de verificación contra datos reales** (el hook DEBE reproducir esto, ± reglas de
tránsito que restan el gasto de $213k de mayo en "Reembolsos" y Conciliación):

| mes | gasto bruto | reembolsos | consumo neto (sin ajuste tránsito) | invertido | ingreso real (sin shift) |
|---|---|---|---|---|---|
| 2026-01 | 1.694.167 | 310.621 | 1.383.546 | 500.000 | 2.113.396 |
| 2026-02 | 1.431.697 | 50.000 | 1.381.697 | 2.350.000 | 3.706.091 |
| 2026-03 | 1.693.173 | 283.020 | 1.410.153 | 1.100.000 | 2.342.308 |
| 2026-04 | 2.090.366 | 165.324 | 1.925.042 | 1.964.455 | 3.731.109 |
| 2026-05 | 1.224.956 | 177.009 | 1.047.947 | 1.300.000 | 2.327.711 |
| 2026-06 | 1.740.991 | 235.193 | 1.505.798 | 0 | 2.507.484 |

Con sueldo-shift: cada sueldo (28-ene $2.066.032, 27-feb $2.135.869, 31-mar $2.234.808,
30-abr $2.238.215, 29-may $2.237.711, 27-jun $2.227.484) se mueve al mes siguiente.
Julio 2026 debe mostrar ~$2.227.484 de ingreso, no $0.

## 4. Fase 2 — Migración DB

Vía `mcp__supabase__apply_migration` (proyecto `fxlztcwqmlmhqwzbrebo`):

```sql
alter table monthly_budgets
  add column savings_goal numeric,          -- la meta: 1500000
  add column splurge_fund_monthly numeric,  -- aporte mensual al fondo de bombazos: ej 300000
  add column splurge_fund_start date;       -- desde cuándo acumula el fondo
```

`total_budget` queda como fallback legacy: si `savings_goal` es null, la página cae al
comportamiento v1 (presupuesto manual). Al configurar la meta por primera vez, ofrecer
migrar: `presupuesto derivado = ingreso recurrente − meta`.

Regenerar tipos: `mcp__supabase__generate_typescript_types` → `src/integrations/supabase/types.ts`.
Actualizar `useMonthlyBudget.ts` con los campos nuevos y su upsert.

## 5. Fase 3 — Copiloto v2 en `/budget` (`src/components/CategoryInsightsView.tsx`)

### Fórmulas (con `useRealFlows` del mes seleccionado)

```
ingresoMes        = ingresoReal (con sueldo-shift)
presupuestoGasto  = ingresoMes − savings_goal          // el techo derivado
disponibleHoy     = presupuestoGasto − consumoNeto
perDay            = max(0, disponibleHoy) / díasRestantes (incluye hoy)
metaProtegida     = clamp(ingresoMes − consumoNeto, 0, savings_goal)   // "cuánto sigue viva"
metaProyectada    = clamp(ingresoMes − consumoProyectado, 0, savings_goal)
consumoProyectado = consumoNeto / fracciónTranscurrida  (+ simulación)
ahorradoMesCerrado= ingresoMes − consumoNeto            // veredicto de meses pasados
fondoBombazos     = Σ desde splurge_fund_start (splurge_fund_monthly − bombazos_del_mes)
```

Nota mid-month: `ingresoMes` puede crecer durante el mes (Vinked). Está bien — el techo
se mueve a favor. El sueldo ya llegó (mes anterior, día ≥25).

### UI (evolución del hero actual, mantener GlassCard/NumberFlow/privacy-blur/tokens OKLCH)

1. **Barra de meta** arriba: "META DEL MES: ahorrar $1.5M ✎" + barra de progreso
   `metaProtegida/savings_goal` (emerald si intacta, amber si mordida, rose si $0).
   Meta editable inline (mismo patrón del presupuesto editable v1).
2. **Hero $/día**: se mantiene, ahora derivado de `presupuestoGasto`. Subtítulo:
   "= ingreso $X − meta $1.5M − gastado $Y".
3. **Burn-down**: se mantiene (ComposedChart), con DOS líneas de referencia:
   `presupuestoGasto` (el techo operativo, label "Tu límite") e `ingresoMes` (label "Ingreso").
   La zona entre ambas = "comiéndote la meta". Proyección punteada igual que v1, color por
   `metaProyectada > 0`.
4. **Sección Vida / Bombazos** (nueva, entre hero y sobres): dos filas —
   Vida: `$X` vs banda normal (~promedio 6 meses, mostrar "normal/alto/bajo");
   Bombazos: gasto del mes + estado del fondo ("fondo: $340k de $900k acumulado").
5. **Simulador**: se mantiene; el veredicto cambia a lenguaje de meta:
   "Sí, y tu meta sigue intacta" / "Sí, pero $Xk salen de tu meta" / "No: tu meta quedaría en $0".
6. **Strip de veredictos** (nuevo, al pie del hero): últimos 4 meses cerrados:
   `jun ⚠ ahorraste $0 — tu meta pagó el Hotel París` / `may ◐ protegiste $1.3M de $1.5M` /
   `✓` si ≥ meta. El "por qué" del ⚠: bombazo más grande del mes.
7. **Detector de sweep**: si el último mes cerrado tiene `ahorrado − invertido > $200k`,
   mostrar aviso: "cerraste [mes] con $X sin invertir".
8. **Sobres por categoría**: quedan como v1 (sparklines, $/día por sobre).
9. **Meses pasados**: autopsia con veredicto (ya existe la navegación de meses).
10. **Empty state**: si no hay `savings_goal`, el setup pide LA META (no el presupuesto):
    "¿Cuánto quieres ahorrar al mes?" → deriva y muestra el presupuesto resultante al tiro.

### Renombrar en nav

`src/lib/routes-config.ts`: título "Presupuesto" → **"Meta"** (el ícono Target ya calza).
Revisar strings que digan "Presupuesto" en la página y BudgetWheel-like referencias (BudgetWheel
ya fue eliminado).

## 6. Fase 4 — Inicio (`src/pages/Index.tsx`)

- KPIs y Balance Total migran a `useRealFlows`: ingreso real (con shift), consumo neto.
  El Balance Total histórico debe restar tránsito/reembolsos correctamente.
- **Card de sweep** (una card, no rediseño): mismo detector de la fase 3, visible los
  primeros días del mes.
- Los insights de `useCategoryInsights` ya netean por categoría — no tocar.

## 7. Limpieza de datos (opcional, 5 min)

Ingresos-devolución sin tag que inflan el ingreso real (~$137k en 6m). Encontrarlos:

```sql
select id, date, category_name, detail, amount from transactions
where user_id = '42f87eb6-3bb8-4a8d-83b0-8dc8f2680879' and type = 'Ingreso'
  and reimbursement_for_category is null
  and (detail ilike '%reembolso%' or detail ilike '%devoluci%' or category_name in ('Comida','Deporte'));
-- Conocidos: "Devolución Nico" $37.850 (ene), "Reembolso comida" $67.000 (feb),
-- "Sushi marina" $7.000 (mar), "Padel devolución" $25.500 (mar)
```

Setear `reimbursement_for_category` con la categoría correspondiente (confirmar con Gianfranco
antes de UPDATE). Además: sugerencia de tag en QuickAdd cuando un ingreso contenga
"reembolso/devolución" en el detalle — chip sugerido, conservador, nunca automático.

## 8. Orden de ejecución y verificación

1. Fase 1 (hook) → verificar contra la tabla del §3 con un test rápido o console.
2. Fase 2 (migración + tipos).
3. Fase 3 (página) → 4. Fase 4 (Inicio) → 5. limpieza §7.
- **Antes de CADA push: `npx tsc --noEmit` completo** (vite build no typechequea — ya causó
  un black screen en prod) + `npm run build`. Push directo a main = producción.
- Estilo: seguir el design system existente (tokens OKLCH `--accent-*`, clases tailwind
  rose-500/amber-500/emerald-500 — NUNCA hex hardcodeado para estados), NumberFlow para
  números que cambian, `privacy-blur` en todo monto, es-CL/CLP compact.
- El usuario aprueba reframes con "hell yes" — este plan YA está aprobado, ejecutar sin
  re-preguntar el enfoque. Preguntar solo ante decisiones destructivas (ej. UPDATE de datos §7).
