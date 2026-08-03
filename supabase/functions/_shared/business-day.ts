import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Cliente sin tipos generados: `ReturnType<typeof createClient>` resuelve el
// schema a `never` y rompe cualquier .from()/.upsert() sobre estas tablas.
// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, 'public', any>

// ── Configuración ─────────────────────────────────────────────────────────────

const SANTIAGO_TZ = 'America/Santiago'

const HOLIDAYS_API = (year: number) => `https://api.boostr.cl/holidays/${year}.json`

/**
 * Hora de cierre del día bancario (hora de Santiago). Un movimiento posterior a
 * esta hora queda liquidado el día hábil siguiente.
 *
 * ⚠️ ESTIMACIÓN. No existe fuente pública autoritativa del horario de corte de
 * los bancos chilenos, y el valor real varía por banco: lo que importa no es
 * cuándo llega la transferencia al destinatario, sino con qué fecha el banco
 * emisor estampa el movimiento en la cartola (su cierre de día interno).
 *
 * Para calibrarlo con evidencia: cruzar filas con import_source 'email' contra
 * 'bank-sync' del mismo monto y contraparte, y comparar la hora real del email
 * con la fecha que le puso el banco. El punto donde cambia el comportamiento es
 * el corte real. Si los bancos difieren, agregarlos en CUTOFF_BY_BANK.
 */
const DEFAULT_CUTOFF_HOUR = 18
const CUTOFF_BY_BANK: Record<string, number> = {}

// ── Fechas en zona horaria de Chile ───────────────────────────────────────────
//
// Toda la aritmética de días se hace sobre strings 'YYYY-MM-DD', nunca sumando
// milisegundos a un Date: Chile tiene horario de verano (septiembre-abril), así
// que un día no siempre dura 24h y sumar 86400000ms puede saltar al día
// calendario equivocado.

const YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SANTIAGO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: SANTIAGO_TZ,
  hour: '2-digit',
  hour12: false,
})

/** Fecha y hora de pared en Santiago para un instante dado. */
function santiagoParts(date: Date): { ymd: string; hour: number } {
  return {
    ymd: YMD_FORMATTER.format(date),
    hour: parseInt(HOUR_FORMATTER.format(date), 10),
  }
}

/** Suma n días a una fecha 'YYYY-MM-DD' usando aritmética de calendario en UTC puro. */
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + n)
  return utc.toISOString().slice(0, 10)
}

/** Día de la semana de una fecha 'YYYY-MM-DD' (0 = domingo, 6 = sábado). */
function dayOfWeek(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function isWeekend(ymd: string): boolean {
  const dow = dayOfWeek(ymd)
  return dow === 0 || dow === 6
}

/** Fecha de hoy en Santiago, como 'YYYY-MM-DD'. */
export function todayInSantiago(): string {
  return YMD_FORMATTER.format(new Date())
}

// ── Feriados ──────────────────────────────────────────────────────────────────

/**
 * Cache por año a nivel de módulo. Las edge functions se reutilizan en caliente,
 * así que esto evita ir a la DB en cada invocación. Solo se cachean resultados
 * conocidos: un año no resuelto nunca entra al cache, para que se reintente.
 */
const holidayCache = new Map<number, Set<string>>()

interface BoostrHoliday {
  date?: string
  title?: string
  type?: string
  inalienable?: boolean
}

/**
 * Feriados legales del año, como set de 'YYYY-MM-DD'.
 *
 * Devuelve null si no se pudieron determinar, que NO es lo mismo que "ese año no
 * tiene feriados". La API devuelve `{"status":"success","data":[]}` (no un 404)
 * para años que todavía no publica, así que un resultado vacío jamás se
 * persiste ni se cachea: se reintenta en la siguiente invocación.
 */
async function holidaysForYear(client: Client, year: number): Promise<Set<string> | null> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  // ¿Ya resolvimos este año antes?
  const { data: syncRow } = await client
    .from('chilean_holidays_sync')
    .select('year')
    .eq('year', year)
    .maybeSingle()

  if (syncRow) {
    const { data: rows, error } = await client
      .from('chilean_holidays')
      .select('date')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)

    if (!error && rows) {
      const set = new Set(rows.map((r: { date: string }) => r.date))
      holidayCache.set(year, set)
      return set
    }
  }

  // Año desconocido: rellenarlo desde la API.
  try {
    const res = await fetch(HOLIDAYS_API(year), { headers: { accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`⚠️ API de feriados respondió ${res.status} para ${year}`)
      return null
    }

    const body = await res.json() as { status?: string; data?: BoostrHoliday[] }
    const entries = (body.data ?? []).filter((h): h is BoostrHoliday & { date: string } => !!h.date)

    if (entries.length === 0) {
      // La API aún no publica este año. No persistir ni cachear: si guardáramos
      // el vacío, todos los feriados del año desaparecerían de forma permanente.
      console.warn(`⚠️ API de feriados sin datos para ${year}; se reintentará más adelante`)
      return null
    }

    await client.from('chilean_holidays').upsert(
      entries.map((h) => ({
        date: h.date,
        title: h.title ?? 'Feriado',
        type: h.type ?? null,
        inalienable: h.inalienable ?? false,
      })),
      { onConflict: 'date', ignoreDuplicates: true },
    )

    await client
      .from('chilean_holidays_sync')
      .upsert({ year, holiday_count: entries.length }, { onConflict: 'year' })

    console.log(`📅 Feriados de ${year} obtenidos desde la API: ${entries.length}`)

    const set = new Set(entries.map((h) => h.date))
    holidayCache.set(year, set)
    return set
  } catch (e) {
    console.warn(`⚠️ No se pudieron obtener los feriados de ${year}:`, e)
    return null
  }
}

// ── Fecha de liquidación ──────────────────────────────────────────────────────

/**
 * Fecha ('YYYY-MM-DD', zona Chile) en que el banco liquidará un movimiento
 * ocurrido en `date`:
 *
 *   1. Si la hora en Santiago alcanzó el cierre del día bancario, avanza un día.
 *   2. Luego avanza mientras caiga en sábado, domingo o feriado.
 *
 * No hay reglas especiales por día: viernes 23:00 → sábado → lunes; sábado a
 * cualquier hora → lunes; martes 23:00 → miércoles; y las cadenas de feriados
 * (18 y 19 de septiembre pegados a un fin de semana) se resuelven solas.
 *
 * `applyCutoff: false` omite el paso 1, para datos cuya hora del día no es
 * confiable (ver scripts/backfill-settlement-date.ts).
 *
 * Si los feriados del año no se pueden determinar, degrada a solo fin de semana
 * con un warning: un email no debe fallar porque la API de feriados esté caída.
 */
export async function bankSettlementDate(
  client: Client,
  date: Date,
  opts: { bank?: string; applyCutoff?: boolean } = {},
): Promise<string> {
  const { bank, applyCutoff = true } = opts
  const { ymd, hour } = santiagoParts(date)

  let settlement = ymd

  if (applyCutoff) {
    const cutoff = CUTOFF_BY_BANK[bank ?? ''] ?? DEFAULT_CUTOFF_HOUR
    if (hour >= cutoff) {
      settlement = addDays(settlement, 1)
      console.log(`🕐 Cierre bancario (${cutoff}h): ${ymd} ${hour}h → ${settlement}`)
    }
  }

  // Los feriados se resuelven por año dentro del bucle porque una cadena puede
  // cruzar el cambio de año (31 de diciembre → 1 de enero, que es feriado).
  const byYear = new Map<number, Set<string> | null>()
  const isHoliday = async (ymd: string): Promise<boolean> => {
    const year = Number(ymd.slice(0, 4))
    if (!byYear.has(year)) {
      const holidays = await holidaysForYear(client, year)
      if (!holidays) {
        console.warn(`⚠️ Feriados desconocidos para ${year}; usando solo fin de semana`)
      }
      byYear.set(year, holidays)
    }
    return byYear.get(year)?.has(ymd) ?? false
  }

  // Máximo defensivo: ninguna cadena real de feriados chilenos supera unos pocos
  // días, pero evita un bucle infinito si los datos vinieran corruptos.
  for (let i = 0; i < 15; i++) {
    if (!isWeekend(settlement) && !(await isHoliday(settlement))) break
    settlement = addDays(settlement, 1)
  }

  return settlement
}
