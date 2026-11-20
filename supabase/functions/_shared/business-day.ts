import type { Client } from './supabase.ts'

const SANTIAGO_TZ = 'America/Santiago'
const HOLIDAYS_API = (year: number) => `https://api.boostr.cl/holidays/${year}.json`

const ESTIMATED_BANK_DAY_CUTOFF_HOUR = 18
const BANK_DAY_CUTOFF_HOUR_BY_BANK: Record<string, number> = {}
const MAX_CONSECUTIVE_NON_BUSINESS_DAYS = 15

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

function santiagoWallClock(date: Date): { ymd: string; hour: number } {
  return {
    ymd: YMD_FORMATTER.format(date),
    hour: parseInt(HOUR_FORMATTER.format(date), 10),
  }
}

function addCalendarDaysWithoutDst(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + n)
  return utc.toISOString().slice(0, 10)
}

function isWeekend(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dayOfWeek === 0 || dayOfWeek === 6
}

const knownHolidaysByYear = new Map<number, Set<string>>()

interface BoostrHoliday {
  date?: string
  title?: string
  type?: string
  inalienable?: boolean
}

async function storedHolidays(client: Client, year: number): Promise<Set<string> | null> {
  const { data: syncRow, error: syncError } = await client
    .from('chilean_holidays_sync')
    .select('year')
    .eq('year', year)
    .maybeSingle()
  if (syncError) {
    console.error(`⚠️ No se pudo leer el estado de feriados de ${year}:`, syncError)
    return null
  }
  if (!syncRow) return null

  const { data: rows, error } = await client
    .from('chilean_holidays')
    .select('date')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
  if (error) {
    console.error(`⚠️ No se pudieron leer los feriados de ${year}:`, error)
    return null
  }
  return new Set((rows ?? []).map((r: { date: string }) => r.date))
}

async function persistHolidays(client: Client, year: number, entries: (BoostrHoliday & { date: string })[]): Promise<boolean> {
  const { error: holidaysError } = await client.from('chilean_holidays').upsert(
    entries.map((h) => ({
      date: h.date,
      title: h.title ?? 'Feriado',
      type: h.type ?? null,
      inalienable: h.inalienable ?? false,
    })),
    { onConflict: 'date', ignoreDuplicates: true },
  )
  if (holidaysError) {
    console.error(`⚠️ No se pudieron guardar los feriados de ${year}:`, holidaysError)
    return false
  }

  const { error: syncError } = await client
    .from('chilean_holidays_sync')
    .upsert({ year, holiday_count: entries.length }, { onConflict: 'year' })
  if (syncError) {
    console.error(`⚠️ No se pudo marcar ${year} como sincronizado:`, syncError)
    return false
  }
  return true
}

async function holidaysFromApi(year: number): Promise<(BoostrHoliday & { date: string })[] | null> {
  try {
    const res = await fetch(HOLIDAYS_API(year), { headers: { accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`⚠️ API de feriados respondió ${res.status} para ${year}`)
      return null
    }
    const body = await res.json() as { status?: string; data?: BoostrHoliday[] }
    const entries = (body.data ?? []).filter((h): h is BoostrHoliday & { date: string } => !!h.date)
    const yearNotPublishedYet = entries.length === 0
    if (yearNotPublishedYet) {
      console.warn(`⚠️ API de feriados sin datos para ${year}; se reintentará más adelante`)
      return null
    }
    return entries
  } catch (error) {
    console.warn(`⚠️ No se pudieron obtener los feriados de ${year}:`, error)
    return null
  }
}

async function holidaysForYear(client: Client, year: number): Promise<Set<string> | null> {
  const cached = knownHolidaysByYear.get(year)
  if (cached) return cached

  const stored = await storedHolidays(client, year)
  if (stored) {
    knownHolidaysByYear.set(year, stored)
    return stored
  }

  const entries = await holidaysFromApi(year)
  if (!entries) return null
  console.log(`📅 Feriados de ${year} obtenidos desde la API: ${entries.length}`)

  const holidays = new Set(entries.map((h) => h.date))
  if (await persistHolidays(client, year, entries)) knownHolidaysByYear.set(year, holidays)
  return holidays
}

export async function bankSettlementDate(
  client: Client,
  date: Date,
  opts: { bank?: string; applyCutoff?: boolean } = {},
): Promise<string> {
  const { bank, applyCutoff = true } = opts
  const { ymd, hour } = santiagoWallClock(date)

  let settlement = ymd

  if (applyCutoff) {
    const cutoff = BANK_DAY_CUTOFF_HOUR_BY_BANK[bank ?? ''] ?? ESTIMATED_BANK_DAY_CUTOFF_HOUR
    if (hour >= cutoff) {
      settlement = addCalendarDaysWithoutDst(settlement, 1)
      console.log(`🕐 Cierre bancario (${cutoff}h): ${ymd} ${hour}h → ${settlement}`)
    }
  }

  const holidaysByYear = new Map<number, Set<string> | null>()
  const isHoliday = async (day: string): Promise<boolean> => {
    const year = Number(day.slice(0, 4))
    if (!holidaysByYear.has(year)) {
      const holidays = await holidaysForYear(client, year)
      if (!holidays) console.warn(`⚠️ Feriados desconocidos para ${year}; usando solo fin de semana`)
      holidaysByYear.set(year, holidays)
    }
    return holidaysByYear.get(year)?.has(day) ?? false
  }

  for (let i = 0; i < MAX_CONSECUTIVE_NON_BUSINESS_DAYS; i++) {
    if (!isWeekend(settlement) && !(await isHoliday(settlement))) break
    settlement = addCalendarDaysWithoutDst(settlement, 1)
  }

  return settlement
}
