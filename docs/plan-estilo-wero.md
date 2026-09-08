# Plan: pasar todas las páginas al mismo estilo

Este documento es para vos, la IA que va a continuar el trabajo. Leelo entero
antes de tocar un archivo.

## El objetivo, en una frase

**Nada flota.** Los paneles no son tarjetas redondeadas separadas por aire
sobre un fondo: se topan entre sí, y lo único que los separa es **1px de
línea**. Todo pegado, todo en línea, cero espacio muerto entre bloques.

Dos páginas ya están así y son la referencia a copiar:

- `src/pages/Index.tsx` (Inicio) — el ejemplo completo
- `src/pages/Transactions.tsx` — el ejemplo de página-tabla

Abrí las dos antes de empezar. **No inventes un patrón nuevo: copiá el que ya
está.**

---

## PARTE 0 — Lo que YA está hecho. NO LO TOQUES.

Esto es lo más importante del documento. El sistema base ya está convertido.
Si "arreglás" algo de esta lista vas a romper cosas.

### El radio ya es cero, globalmente

En `tailwind.config.ts` **toda** la escala de `borderRadius` cuelga de
`var(--radius)`, y `--radius` está en `0rem` (`src/index.css`).

Esto significa que **`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`,
`rounded-2xl` y `rounded-3xl` ya se renderizan cuadrados.** No los busques ni
los reemplaces. Si ves `rounded-xl` en el código, está bien y ya sale
cuadrado. Cambiarlos a `rounded-none` sería un retroceso: los dejaría
cuadrados para siempre en vez de seguir la variable si el usuario sube el
radio desde su propia UI.

**La única clase de redondez que hay que revisar es `rounded-full`**, y ya se
hizo un barrido completo (217 → 144). Los 144 que quedan están justificados:
círculos reales (avatares, portadores de ícono, puntos), decorativos (glows,
spinners) y las pastillas de `<Button>`, que es la forma del botón primario de
Wero. Ver PARTE 4 antes de tocar alguno.

### Los tokens ya existen

En `src/index.css`, definidos para claro y oscuro:

| Token | Para qué |
|---|---|
| `--radius` | 0. La perilla de la que cuelga toda la escala. |
| `--border` | La línea de pelo. Opaca, a fuerza completa. |
| `--shadow-hard` | `0 3px 0` sin blur — la sombra de Wero. Utilidad: `shadow-hard`. |
| `--shadow-float` | Solo para lo que de verdad flota: popovers, modales. `shadow-md/lg/xl`. |
| `--font-display` | Outfit, la display. Utilidad: `font-display`. |
| `--ink-on-accent` | Tinta sobre un bloque de acento a fuerza completa. |
| `--highlight` | El amarillo destacador de Wero. Un solo uso: `.chip-month`. |

`shadow-sm` está mapeado a `none` a propósito: en una arquitectura de líneas,
lo que separa dos superficies es el borde, no un halo.

### Las clases de tipografía ya existen

En `src/index.css`, dentro de `@layer components`:

- `.page-title` — Outfit 800, MAYÚSCULA, tracking −0.03em. Para el `<h1>`.
- `.section-title` — Outfit 700, MAYÚSCULA, tracking −0.02em. Para `<h2>/<h3>`.
- `.eyebrow` — JetBrains Mono 10px, MAYÚSCULA, tracking 0.11em. Rótulos chicos.
- `.chip-month` — el bloque amarillo del mes. Ya está en el header global.
- `.press` — el botón se hunde 2px al apretarlo.

### El chasis ya está

- `Layout` acepta `bleed` — saca el padding del `<main>` para que la grilla
  toque el header y el sidebar.
- El header global ya tiene la miga (`PRINCIPAL / INICIO`) y el chip del mes.
- `src/components/HairlineGrid.tsx` exporta `Screen`, `Row` y `Panel`.

---

## PARTE 1 — Las tres piezas

Leé `src/components/HairlineGrid.tsx` completo; los comentarios explican el
porqué de cada línea. Resumen:

```tsx
import { Screen, Row, Panel } from "@/components/HairlineGrid";

<Layout bleed>
  <Screen>
    {/* fila de dos paneles: el gap de 1px entre ellos es la línea */}
    <Row className="lg:shrink-0 lg:grid-cols-[1.35fr_1fr]">
      <Panel className="px-5 py-5">…</Panel>
      <Panel className="px-5 py-5">…</Panel>
    </Row>

    {/* franja de cuatro celdas */}
    <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">…</Row>

    {/* la fila que CEDE: se queda con todo lo que sobre del viewport */}
    <Row className="lg:min-h-0 lg:flex-[7_1_0%] lg:grid-cols-[1.6fr_1fr]">
      <Panel className="flex flex-col">…</Panel>
      <Panel className="flex flex-col">…</Panel>
    </Row>
  </Screen>

  {/* lo que va abajo del pliegue, si hay algo */}
  <div className="grid gap-px border-b border-border bg-border">…</div>
</Layout>
```

Si una fila es **un solo panel a lo ancho**, el `Panel` va directo como hijo
de `Screen` — no hace falta envolverlo en un `Row`. Así está
`Transactions.tsx`.

### Cómo funciona el pliegue (leer esto, es la parte que más se rompe)

`Screen` tiene el alto exacto del viewport menos el header (3.5rem). Adentro:

- las filas con `lg:shrink-0` miden **lo que su contenido**
- las filas con `lg:flex-1` o `lg:flex-[N_1_0%]` **se reparten lo que sobre**

Así la primera pantalla es exacta por construcción. **No calcules alturas a
mano.** Si ves un `max-h-[calc(100vh-320px)]` o similar dentro de un
componente, ese número mágico hay que sacarlo y dejar que el layout mande
(así se hizo con `TransactionsTable`, que ahora tiene un prop `fill`).

Tres cosas que cortan la cadena de flex y hacen que el panel colapse a cero o
desborde:

1. Olvidar `bleed` en `Layout` → su padding rompe la cuenta.
2. Olvidar `lg:min-h-0` en la fila que cede → no puede encogerse.
3. Lo que scrollea adentro de un panel necesita `min-h-0 flex-1` y el panel
   necesita ser `flex flex-col`.

**Debajo de `lg` nada de esto aplica**, a propósito: apilado en un teléfono el
contenido no cabe ni forzándolo, y ahí el scroll de la página es lo correcto.
Si un hijo lleva `flex-1`, dale un alto propio para mobile
(`h-[220px] lg:h-auto lg:min-h-0 lg:flex-1`), porque un `flex-1` dentro de un
contenedor de alto automático colapsa a cero.

---

## PARTE 2 — La receta, página por página

Para cada página, en este orden:

### 1. Poner `bleed` y envolver en `Screen`

```diff
-    <Layout>
-      <div className="space-y-6">
+    <Layout bleed>
+      <Screen>
```

### 2. Matar los espacios de layout

Estos son los que hay que eliminar, porque son exactamente el "aire entre
cosas" que no queremos:

- `space-y-4` / `space-y-6` en el contenedor de la página
- `gap-3` / `gap-4` en un `grid` que reparte tarjetas
- el padding del `<main>` (lo saca `bleed`)

**Los gaps que SÍ se quedan:** los de dentro de una fila de contenido — un
ícono al lado de su texto (`gap-2`), una lista de items (`space-y-2.5`), un
`flex` de chips. Esos son ritmo interno, no aire entre bloques.

### 3. Convertir cada tarjeta en un `Panel`

`<Card>` y `<GlassCard>` desaparecen del layout de la página. Su contenido
pasa a un `Panel`, y el `Row` provee la línea que antes era el borde de la
tarjeta.

```diff
-  <div className="grid gap-4 md:grid-cols-2">
-    <GlassCard className="p-5">…</GlassCard>
-    <GlassCard className="p-5">…</GlassCard>
-  </div>
+  <Row className="lg:shrink-0 md:grid-cols-2">
+    <Panel className="px-5 py-4">…</Panel>
+    <Panel className="px-5 py-4">…</Panel>
+  </Row>
```

`<Card>` sigue existiendo y está bien usarla **dentro** de un modal o de un
panel cuando de verdad hace falta un objeto anidado. Lo que no va es la
tarjeta como unidad de layout de la página.

### 4. Poner la tipografía

- El `<h1>` de la página → `className="page-title text-2xl"`
- Los `<h2>/<h3>` de sección → `className="section-title text-base"`
- Los rótulos chicos → `className="eyebrow"`

**Trampa de especificidad:** las clases están en `@layer components`, así que
cualquier utilidad de Tailwind les gana. Al poner `page-title` hay que
**borrar** `font-bold`, `font-semibold` y `tracking-tight` de ese elemento, o
no se va a ver el efecto. El `text-*` de tamaño y el `text-*` de color sí se
quedan: la clase decide voz, no escala ni color.

### 5. Los subtítulos de relleno se van

Un pie que repite la etiqueta gasta una línea. `"Gestiona todas tus
transacciones"` debajo de `TRANSACCIONES` no dice nada; reemplazalo por un
dato (`"1.284 movimientos"` con `.eyebrow`) o borralo.

### 6. Los verbos arriba, los filtros abajo

Si la página tiene una toolbar que mezcla acciones (importar, exportar,
sincronizar) con filtros (buscar, fecha, categoría), separalas: las acciones
van en la franja de identidad junto al `<h1>`, los filtros en su propia
franja. Mezclarlas confunde lo que *hacés* con lo que *mirás*. Ver
`Transactions.tsx`.

Los controles de filtro van compactos (`h-8`): en una franja de chrome, un
input de 40px pesa más que el dato que filtra.

---

## PARTE 3 — Espacios: la regla concreta

Cuando dudes si un espacio se queda o se va, preguntá: **¿esto separa dos
bloques, o da ritmo dentro de uno?**

| Se va | Se queda |
|---|---|
| `space-y-6` en el wrapper de la página | `space-y-2.5` en una lista de items |
| `gap-4` en un grid de tarjetas | `gap-2` entre un ícono y su label |
| `p-4 sm:p-6` del `<main>` | `px-5 py-4` dentro de un `Panel` |
| `mb-6` entre secciones | `mt-1` entre un rótulo y su número |

Y una que es puro upside: si una fila tiene items de altura fija y sobra
espacio (una lista de 6 categorías en un panel alto), hacé que **los items se
reparten el alto** (`flex flex-col` + cada item `lg:flex-1 lg:min-h-[40px]`)
en vez de dejar un hueco abajo. Ese patrón ya está en Inicio, en el panel de
categorías.

---

## PARTE 4 — Redondeces: qué se queda redondo

Repito porque es lo que más se malinterpreta: **`rounded-lg/md/sm/xl/2xl` ya
son cuadrados.** No los toques.

De `rounded-full`, se queda redondo:

- **Avatares** — son fotos de personas.
- **Círculos reales** (`size-8`, `w-9 h-9`) — botones de ícono, portadores de
  ícono, puntos de color. Wero usa el círculo justamente para esto.
- **Decorativos** — glows, spinners, anillos de carga. Un glow cuadrado no es
  un glow.
- **`<Button>`** — es la pastilla del `.button-primary` de Wero
  (`border-radius: 30px` en su CSS real). No la cuadres.
- **`switch` y `radio-group`** — la forma es reconocimiento, no estilo. Un
  interruptor cuadrado deja de leerse como interruptor.

Va cuadrado (con `rounded-sm`, no borrando la clase, para que siga colgando de
`--radius`):

- **Barras de progreso** — la pista *y* el relleno. Un relleno redondo en una
  pista cuadrada se ve peor que las dos redondas.
- **Rótulos, badges y chips de texto** — son etiquetas. Los rótulos de Wero
  son bloques cuadrados.
- **Inputs y `SelectTrigger`** — un campo de texto con forma de pastilla es lo
  más lejos de Wero que hay.
- **Controles segmentados y tabs escritos a mano** — los `Tabs` de shadcn ya
  salen cuadrados del token, así que las pastillas a mano son las que no
  calzan con el propio sistema.

Si encontrás alguno de estos en las páginas que te toquen, cambialo. Pero **no
hagas un `sed` global de `rounded-full`**: hay 144 que están bien.

---

## PARTE 5 — Las páginas, en orden

Empezá por las chicas para tomar el patrón, y dejá las grandes para el final.

| # | Página | Líneas | Qué tiene |
|---|---|---|---|
| 1 | `NotFound.tsx` | 68 | 3 `space-y`. Trivial, sirve de calentamiento. |
| 2 | `Categories.tsx` | 283 | 6 `space-y`. Tiene inputs y toggles con forma de pastilla. |
| 3 | `Fintual.tsx` | 409 | 9 `space-y`, 7 `<Card>`. |
| 4 | `Learning.tsx` | 519 | 2 `space-y`. Ojo: `.studio-glass` es vidrio **a propósito** (flota sobre video). No lo toques. |
| 5 | `PendingDebts.tsx` | 582 | 8 `space-y`. Dos controles segmentados en pastilla. |
| 6 | `CreditCards.tsx` | 839 | 4 `space-y`, 5 `<Card>`. |
| 7 | `Overview.tsx` | 1411 | 14 `space-y`, 9 `<Card>`. **La más grande.** Acá viven los gráficos que se sacaron de Inicio, así que es la página de análisis: respetá eso, no la conviertas en un dashboard de acción. |
| 8 | `TutoringClasses.tsx` | 1698 | 20 `space-y`, 6 `<Card>`. |

`CategoryInsights.tsx` (11 líneas) solo monta `CategoryInsightsView`. Si lo
tocás, el trabajo está en el componente, no en la página.

**Hacé UNA página por vez y verificá antes de pasar a la siguiente.** Son
archivos grandes; un cambio de estructura mal cerrado en JSX es media hora de
depuración.

---

## PARTE 6 — Cómo verificar

Después de cada página, los cuatro comandos:

```bash
npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c "error TS"   # tiene que dar 13
npx vite build 2>&1 | grep -E "✓ built|error"                     # tiene que compilar
npx eslint src/pages/LaQueTocaste.tsx                             # ver abajo
npm run check:blocks                                              # tiene que pasar
```

### El baseline exacto

**`tsc` da 13 errores y ese es el número correcto.** Son todos preexistentes,
de tipos de datos (`Transaction`, `nav_preferences`), en
`BankSyncHistory.tsx`, `QuickTransactionForm.tsx`, `ReconciliationCard.tsx`,
`WhisperInput.tsx`, `useUserProfile.ts` y `Transactions.tsx`. **No los
arregles** — no son tuyos y tocarlos mete riesgo en el cambio de estilo.

Si `tsc` te da **más** de 13, rompiste algo. Encontralo antes de seguir.

`eslint` tiene **62 errores preexistentes** en el repo (mayoría
`no-explicit-any` y `no-empty`). Para saber si uno es tuyo, compará contra
`HEAD` sin ensuciar el working tree:

```bash
git worktree add --detach /tmp/head-rindo HEAD
ln -s "$(pwd)/node_modules" /tmp/head-rindo/node_modules
(cd /tmp/head-rindo && npx eslint src/pages/LaQueTocaste.tsx)
git worktree remove --force /tmp/head-rindo   # limpialo cuando termines
```

`vite build` **no chequea tipos**. Correr solo el build y decir "compila" no
alcanza: ya causó una pantalla negra en producción. Corré `tsc` siempre.

---

## PARTE 7 — Lo que NO tenés que hacer

- **No commitees.** El usuario revisa y commitea él.
- **No uses `git add -A` ni `git commit -am`.** Se trabaja en paralelo sobre
  el mismo working tree; stagear todo se lleva cambios que no son tuyos. Si
  tenés que stagear, nombrá los archivos uno por uno.
- **No abras el navegador del usuario** para "verificar cómo quedó". Verificá
  en código: `tsc`, el build, y revisando la cadena de flex. Si algo solo se
  puede ver mirando, decilo y dejá que él mire.
- **No arregles los 13 errores de `tsc`** ni los 62 de `eslint`.
- **No toques `--radius`, `tailwind.config.ts`, los tokens de `index.css` ni
  `HairlineGrid.tsx`.** Ya están. Si creés que uno está mal, decilo en vez de
  cambiarlo.
- **No cambies `Layout` ni el header** sin decirlo: son globales y afectan
  todas las páginas.
- **No agregues funcionalidad.** Esto es un cambio de estilo. Si ves algo que
  mejoraría la página (un número que falta, un dato duplicado con otra
  página), **anotalo y decilo al final**, no lo implementes.

---

## PARTE 8 — Al terminar

Contá, por página:

1. Qué estructura le pusiste (qué filas, cuál cede).
2. Qué borraste (los `space-y`, las `<Card>`, los subtítulos de relleno).
3. Los números de verificación (`tsc` = 13, build ok, eslint sin nuevos).
4. Cualquier cosa que hayas dejado sin hacer y por qué.
5. Las mejoras que viste y **no** implementaste, como lista de sugerencias.

Si una página no entra en el patrón —porque su contenido no es una grilla de
paneles, por ejemplo— **no la fuerces**. Explicá por qué y proponé una
alternativa.
