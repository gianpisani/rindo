# Rindo - Raycast Extension

Agrega gastos e ingresos a Rindo directamente desde Raycast. Sin abrir el navegador.

## Comandos

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| **Agregar Gasto** | Registra un gasto rápidamente | `45000 sushi`, `$12000 uber` |
| **Agregar Ingreso** | Registra un ingreso | `1500000 sueldo` |
| **Iniciar Sesión** | Login con tu cuenta de Rindo | Email + contraseña |
| **Últimas Transacciones** | Ver las últimas 20 transacciones | - |

## Setup

### 1. Instalar dependencias

```bash
cd raycast-extension
npm install
```

### 2. Iniciar en modo desarrollo

```bash
npm run dev
```

Esto registra la extensión en Raycast automáticamente.

### 3. Configurar preferencias

La primera vez que abras cualquier comando, Raycast te pedirá las preferencias:

- **Supabase URL**: `https://fxlztcwqmlmhqwzbrebo.supabase.co`
- **Supabase Anon Key**: La anon key de tu proyecto (la encuentras en tu `.env` como `VITE_SUPABASE_PUBLISHABLE_KEY`)

### 4. Iniciar sesión

Busca "Iniciar Sesión" en Raycast y entra con tu email y contraseña de Rindo. Solo necesitas hacerlo una vez; la sesión se guarda y refresca automáticamente.

### 5. ¡Listo!

Abre Raycast (`Cmd+Space`) y escribe "gasto" o "rindo":

```
Agregar Gasto → 45000 sushi → Enter
```

## Cómo funciona

1. Escribes monto + detalle (ej: `45000 sushi`)
2. Se crea la transacción en Supabase directamente
3. Si el detalle tiene 3+ caracteres, se auto-categoriza usando tu historial y keywords
4. Recibes confirmación en un HUD: `✅ Gasto guardado: $45.000 · sushi → Comida`

## Deploy de la Edge Function (opcional)

Si quieres usar la Edge Function `quick-add` como endpoint unificado:

```bash
supabase functions deploy quick-add
```

## Notas

- La extensión usa la API REST de Supabase directamente (no la Edge Function), así que funciona sin deploy adicional
- La sesión se almacena en el LocalStorage de Raycast (encriptado)
- El token se refresca automáticamente cuando expira
