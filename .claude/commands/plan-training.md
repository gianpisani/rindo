# Plan de Entrenamiento Semanal

Genera un plan de entrenamiento semanal personalizado basado en los datos reales de Garmin y lo escribe en Supabase.

Contexto adicional del usuario: $ARGUMENTS

---

## Paso 1: Leer datos de Garmin (en paralelo)

Usa las herramientas de Garmin MCP para obtener TODOS estos datos en paralelo:

1. `get_training_status` (fecha de ayer)
2. `get_training_readiness` (fecha de ayer)
3. `get_vo2max` (fecha de ayer)
4. `get_race_predictions`
5. `get_lactate_threshold`
6. `get_fitness_age`
7. `get_activities` (limit: 15) - últimas 15 actividades
8. `get_hrv` (fecha de ayer)
9. `get_sleep_data` (fecha de ayer)
10. `get_body_battery` (startDate: ayer)

---

## Paso 2: Analizar los datos

Con los datos obtenidos, analiza:

- **Training Load Balance**: ¿Está en productive, maintaining, recovery, overreaching?
- **ACWR (Acute:Chronic Workload Ratio)**: Basado en las últimas actividades
- **Deficit anaeróbico**: ¿Hay poco trabajo en Z4-Z5? Si sí, incluir sesión semanal de intervalos
- **Recovery state**: Training Readiness + HRV + Sleep + Body Battery
- **Patrón reciente**: ¿Qué deportes ha hecho? ¿Qué volumen? ¿Progresión?

---

## Paso 3: Generar el plan

### Reglas fijas del atleta:
- **Horarios disponibles**: Lunes a Viernes 6:00-7:00 AM o 19:00-22:00. Fines de semana por la mañana.
- **Natación fija**: Martes y Jueves 19:30-21:00 (no mover)
- **Trabajo**: 9:00-18:00 (no disponible)
- **Principio 80/20**: 80% sesiones en Z1-Z2, 20% en Z3-Z5
- **Nunca 2 días duros seguidos** (hard → easy/recovery → hard)
- **Mínimo 1 día de descanso completo** por semana
- **Atacar deficit anaeróbico**: Si hay poco Z4-Z5, incluir 1 sesión de intervalos/tempo semanal
- **Progresión**: No aumentar volumen >10% vs semana anterior

### Zonas HR (calcular desde Lactate Threshold):
- Z1: <68% LT HR
- Z2: 68-82% LT HR
- Z3: 82-94% LT HR
- Z4: 94-100% LT HR
- Z5: >100% LT HR

### Ritmos (calcular desde Race Predictions):
- Easy: ritmo maratón + 30-45s/km
- Moderate: ritmo maratón ± 10s/km
- Tempo: ritmo media maratón
- Threshold: ritmo 10K
- Interval: ritmo 5K o más rápido

### Formato de cada sesión:
Genera 7 días (lunes a domingo) con estos campos:
- `session_date`: YYYY-MM-DD (próximo lunes como inicio)
- `week_start_date`: mismo lunes
- `time_of_day`: "morning" o "evening"
- `scheduled_time`: hora estimada (ej: "06:00", "19:30")
- `sport_type`: running, cycling, swimming, padel, strength, rest
- `session_name`: nombre descriptivo corto (ej: "Easy Run Z2", "Intervalos 5x1000")
- `description`: descripción detallada del workout incluyendo calentamiento, parte principal, vuelta a calma
- `target_duration_minutes`: duración estimada
- `target_distance_meters`: distancia si aplica (en metros)
- `target_hr_zone`: zona HR principal (1-5)
- `target_hr_min` / `target_hr_max`: rango HR exacto (calculado desde LT)
- `target_pace_min_km`: ritmo objetivo si es running (ej: "5:30")
- `target_power_watts`: potencia si es ciclismo
- `intensity`: easy, moderate, hard, recovery, rest
- `coach_notes`: contexto de por qué esta sesión, qué buscar, sensaciones esperadas
- `plan_context`: resumen del análisis (training status, readiness, etc.)

---

## Paso 4: Escribir en Supabase

1. Obtener el user_id actual:
```
const { data: userData } = await supabase.auth.getUser();
const userId = userData.user.id;
```

2. Calcular el próximo lunes (week_start_date)

3. DELETE sesiones existentes de esa semana:
```sql
DELETE FROM training_sessions WHERE user_id = '{userId}' AND week_start_date = '{nextMonday}';
```

4. INSERT las 7 sesiones (una por día, o más si hay dobles):
Usa la función `from('training_sessions').insert([...])` del cliente Supabase.

**IMPORTANTE**: Usa la herramienta Bash para ejecutar las queries via el cliente supabase, o directamente usa la API de Supabase del proyecto. El user_id del atleta es el que está logueado.

Para escribir en Supabase, genera un script que use `curl` al endpoint REST de Supabase, o mejor aún, crea un archivo temporal `.ts` que importa el client y ejecuta el insert. La forma más práctica: genera las sentencias SQL INSERT y ejecútalas directamente en Supabase SQL editor, o usa el MCP de Supabase si está disponible.

**Alternativa pragmática**: Genera el array de objetos JSON y muéstrale al usuario para que copie y pegue, O escribe directamente usando el endpoint REST de Supabase con curl:

```bash
curl -X POST '{SUPABASE_URL}/rest/v1/training_sessions' \
  -H 'apikey: {SUPABASE_KEY}' \
  -H 'Authorization: Bearer {USER_JWT}' \
  -H 'Content-Type: application/json' \
  -d '[{sessions array}]'
```

---

## Paso 5: Mostrar resumen

Muestra una tabla con el plan semanal:

```
| Día        | Sesión              | Deporte  | Duración | Zona | Intensidad |
|------------|---------------------|----------|----------|------|------------|
| Lun 31/03  | Easy Run Z2         | Running  | 45min    | Z2   | Easy       |
| Mar 01/04  | Natación Técnica    | Swimming | 90min    | Z2   | Moderate   |
| ...        | ...                 | ...      | ...      | ...  | ...        |
```

Y un resumen:
- Volumen total: Xh Ym
- Distribución: X% easy, Y% moderate, Z% hard
- Deportes: running ×N, swimming ×N, etc.
- Training load target: basado en estado actual

---

## Notas importantes
- Si Training Readiness es baja (<50), reducir volumen 20-30%
- Si hay signos de overreaching, semana de descarga (50-60% volumen normal)
- Siempre incluir warmup (10min Z1) y cooldown (5-10min Z1) en sesiones de running/cycling
- Las sesiones de natación Mar/Jue son FIJAS, no moverlas
- Adaptar el plan al contexto que da el usuario (competencia próxima, viaje, lesión, etc.)
