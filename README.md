# Rindo

Finanzas personales que se llenan solas. Los movimientos llegan desde el banco, los correos y la billetera del celular; tú solo entras a ver en qué se te va la plata y a corregir alguna categoría.

[rindo.cl](https://www.rindo.cl)

## Cómo funciona

```
banco (open banking) ─┐
correos del banco ────┼─▶ edge functions ─▶ Supabase (Postgres + RLS) ─▶ app web / PWA
billetera iOS ────────┘        │
                               └─▶ Jev: categoriza con IA (Vercel AI Gateway)
```

| Edge function | Qué hace |
| --- | --- |
| `bank-sync`, `bank-sync-all` | Trae movimientos del banco (manual y por cron). |
| `process-email-v2` | Convierte los correos de aviso del banco en movimientos. |
| `process-ios-wallet-push-notification` | Igual, desde las notificaciones de la billetera del iPhone. |
| `auto-categorize` | Jev, el categorizador. |
| `send-push-notification` | Avisos push. |

Lo que comparten vive en `supabase/functions/_shared/`.

## Stack

Vite · React · TypeScript · Tailwind · shadcn/ui · TanStack Query · Supabase. Se despliega en Vercel.

## Correr en local

Necesitas Node 24.

```sh
npm ci
npm run dev        # http://localhost:8080
```

`.env` trae las claves públicas de Supabase (las mismas que usa la app publicada). Para que Jev categorice en local, copia `.env.jev.example` a `.env.jev.local` y completa `AI_GATEWAY_API_KEY`.

## Antes de abrir una PR

```sh
npm run lint:design                    # escala de diseño
npx tsc -p tsconfig.app.json --noEmit  # tipos
npx eslint src                         # lint
npm run test:jev                       # tests
npm run build
```

Es lo mismo que corre el CI.

## Reglas

Las reglas de diseño y de código (escala, colores, carpetas, errores, mutaciones optimistas) están en [`AGENTS.md`](AGENTS.md). Aplican a personas y a agentes por igual.
