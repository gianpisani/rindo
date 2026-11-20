# Rindo — reglas para agentes

App de finanzas personales (Vite + React + TS + Tailwind 3 + shadcn/ui + Supabase). Casi todo llega solo (banco, mail, wallet); el usuario entra a **ver** en qué se le va la plata y a **corregir categorías**, sobre todo desde el celular.

## Principio
**Make it simple and stay simple.** Cada pantalla tiene UNA cosa importante; lo demás pasa a segundo plano o desaparece. Antes de agregar un estilo, busca uno que borrar. Nada de librerías nuevas sin preguntar.

## Escala de diseño (la revisa `npm run lint:design` en CI)
- **Texto:** `text-xs` (12) · `text-sm` (14) · `text-xl` (20) · `text-hero`. En CSS: `var(--fs-1|2|3|hero)`. Nunca `text-[Npx]`, `text-base`, `text-lg`, `text-2xl`…
- **Grosor:** `font-normal`, `font-medium`; `font-semibold` solo para el número protagonista. Nunca `font-bold`.
- **Radio:** `rounded-card` (superficies) y `rounded-full` (lo que se toca). Nunca `rounded-lg/xl/[…]`.
- **Sombra:** `shadow-float` solo para lo que flota (popover, sheet); si no, ninguna. Nunca `shadow-md`, `drop-shadow-*`.
- **Espaciado:** 4 · 8 · 12 · 16 · 24.
- Excepción real: comentario `design-scale-ok: motivo` en la misma línea o la anterior.

## Color con intención
- Tokens, no hex: `foreground`, `muted-foreground`, `success` (ingresos/reembolsos), `spend` (gasto, violeta), `destructive` (solo alertas y errores), `primary` (marca: solo nav activa y el punto del logo).
- Los gastos van en color neutro; el rojo es solo para alertas.
- Color de categoría: `tint`/`tintColor` de `src/lib/category-color.ts`.
- Texto ≥ 4.5:1 de contraste en claro y oscuro.

## Componentes que ya existen (úsalos, no los dupliques)
- **Botones de acción:** `<Button>` de `src/components/ui/button.tsx` (variantes `default` / `ghost` / `destructive`; tamaños `default` / `sm` / `xs` / `icon`). Filas, chips y tabs no son botones de acción.
- **Cambiar categoría:** `QuickCategoryPicker` es la única forma (popover en web, sheet en celular, optimista).
- **Vacío:** `EmptyState` (una línea gris centrada, máx. una acción ghost). **Cargando:** `ui/skeleton` con la forma del contenido.
- Tocables de ícono: área ≥ 36px (`size-9`).
- Foco con teclado: lo da la regla global `:focus-visible` de `src/index.css`; no pongas `outline-none` sin reemplazo.

## Código
- **Autoexplicativo:** los nombres dicen la intención. Sin comentarios (salvo `design-scale-ok` y directivas de lint/TS).
- **Sin redundancia:** antes de escribir algo, busca si ya existe en `src/lib` o `src/hooks`. Una sola implementación por cosa.
- **Carpetas firmes:**
  - `src/pages/` solo compone pantallas; no llama a Supabase directo.
  - `src/hooks/` es la única capa que habla con Supabase (queries y mutaciones con react-query).
  - `src/lib/` lógica pura, sin React ni Supabase, testeable.
  - `src/components/<área>/` componentes por área; `src/components/ui/` solo primitivas shadcn.
  - `supabase/functions/_shared/` todo lo que repiten las edge functions.
- **Errores:** nunca `catch {}` mudo ni `{ error }` de Supabase sin revisar. Si falla una acción del usuario, `toast.error` con mensaje claro; si falla una lectura, el estado de error de la query.
- **Optimista:** toda mutación que el usuario ve se aplica al cache en `onMutate`, se revierte en `onError` y se reconcilia en `onSettled`.

## Antes de commitear
```
npm run lint:design
npx tsc -p tsconfig.app.json --noEmit
npx eslint src          # 0 errores
npm run test:jev
npm run build
```
Es lo mismo que corre el CI ("Revisar PR").

## Reglas de trabajo
- No cambies funcionalidad ni datos si la tarea es visual.
- El repo es público: no subas capturas con datos financieros, nombres ni correos reales.
