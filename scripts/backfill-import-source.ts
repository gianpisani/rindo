#!/usr/bin/env -S deno run --allow-net --allow-env
//
// Puebla `import_source` en las filas que quedaron en NULL (todas las anteriores
// a la migración 20260802_settlement_date_and_holidays.sql, que agregó la columna
// sin rellenar el histórico a propósito).
//
// El problema de fondo: hasta ahora el origen de una fila se leía del prefijo
// emoji dentro de `detail`, y 🤖 lo escribían dos fuentes distintas
// (process-email-v2 y bank-sync). Además `detail` es editable por el usuario, así
// que ese prefijo puede no estar. Las reglas de acá se apoyan primero en los
// campos que nadie edita —`bank_description`, `bank_settlement_date`, `date`,
// `created_at`— y dejan `detail` como último recurso.
//
// Uso:
//   export SUPABASE_URL=...
//   export SUPABASE_SERVICE_ROLE_KEY=...
//   deno run --allow-net --allow-env scripts/backfill-import-source.ts --report
//   deno run --allow-net --allow-env scripts/backfill-import-source.ts --selftest
//   deno run --allow-net --allow-env scripts/backfill-import-source.ts --apply
//
// Flags de acotamiento, combinables entre sí y con los modos de arriba:
//   --user-id=<uuid>        solo las filas de ese usuario
//   --until=<YYYY-MM-DD>    solo filas con date anterior a esa fecha
//   --since=<YYYY-MM-DD>    solo filas con date desde esa fecha
//
// Acotar no cambia las reglas: las anclas temporales y el mapa
// user_id → primer sync se calculan igual, para que una corrida por tramos
// clasifique cada fila exactamente igual que una corrida completa.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ── R0: anclas temporales ────────────────────────────────────────────────────
//
// Fechas de deploy de cada función, sacadas del historial de git. Definen qué
// orígenes son siquiera posibles para una fila según su fecha.

/** process-email v1: `detail = "${bank} - ${subject}"`, sin emoji ni bank_description. */
const EMAIL_V1_SINCE = '2025-11-17'
/** process-email-v2: empieza el prefijo 🤖. */
const EMAIL_V2_SINCE = '2026-03-22'
/** process-ios-wallet-push-notification: prefijo 📱. */
const WALLET_SINCE = '2026-04-12'
/**
 * Columna `bank_description` + primera fila posible de bank-sync. Doble corte:
 * antes de esta fecha ninguna fila es de bank-sync, y `bank_description` es NULL
 * para todas las filas —también las automáticas—, así que un NULL ahí no prueba
 * que la fila sea manual.
 */
const BANK_SYNC_SINCE = '2026-04-19'

type ImportSource = 'manual' | 'email' | 'bank-sync' | 'wallet'

/** Bancos que `detectBank()` de process-email-v2 puede devolver, para el fallback. */
const EMAIL_BANKS = [
  'Banco de Chile', 'BCI', 'Santander', 'BancoEstado', 'Itaú',
  'Scotiabank', 'Banco Falabella', 'Banco Security', 'BICE', 'Banco',
]
const EMAIL_FALLBACK_RE = new RegExp(
  `^(${EMAIL_BANKS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}) - `,
)

/**
 * R4 — vocabulario que process-email-v2 escribe en `bank_description`.
 *
 * Salvo parseCompraTarjeta, ningún parser setea `bankDescription`, así que
 * `bank_description` termina siendo el detalle que redactamos nosotros
 * (`parsed.bankDescription ?? parsed.detail`, index.ts:364). Son frases en
 * español en Title-case; un extracto bancario no las emite —el scraper dice
 * "Traspaso A:NOMBRE", en mayúsculas y sin espacio tras los dos puntos—.
 */
const EMAIL_VOCABULARY: RegExp[] = [
  /^Transferencia a /,
  /^Transferencia a terceros$/,
  /^Transferencia de /,
  /^Transferencia recibida$/,
  /^Pago tarjeta de crédito$/,
  /^PAC /,
  /^Cargo automático$/,
  /^Retiro cajero$/,
  EMAIL_FALLBACK_RE,
]

const AUTO_PREFIX_RE = /^[🤖📱]\s*/u

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Row {
  id: string
  user_id: string
  date: string
  created_at: string
  detail: string | null
  bank_description: string | null
  bank_settlement_date: string | null
  import_source: string | null
}

interface Verdict {
  source: ImportSource | null
  rule: string
}

interface Options {
  mode: 'report' | 'apply' | 'selftest'
  userId?: string
  until?: string
  since?: string
}

// ── Clasificador ─────────────────────────────────────────────────────────────

/**
 * Firma horaria del cron de bank-sync: corre en el minuto 0 de cada hora
 * (20260427_bank_sync_cron.sql) y todas las filas de una misma corrida comparten
 * el mismo HH:MM:SS, porque `date` se arma como día-del-movimiento + hora-del-sync
 * (bank-import.ts:160-162). Los timestamps de email y wallet son la hora real de
 * la compra, repartida sobre todo el minuto: nunca forman ese cluster.
 *
 * Devuelve el set de claves `user_id|HH:MM` que califican: ≥3 filas con esa hora
 * exacta, abarcando ≥2 días de calendario distintos.
 */
function buildCronSignature(rows: Row[]): Set<string> {
  const buckets = new Map<string, { rows: number; days: Set<string> }>()

  for (const row of rows) {
    const key = `${row.user_id}|${row.date.slice(11, 16)}`
    let bucket = buckets.get(key)
    if (!bucket) buckets.set(key, (bucket = { rows: 0, days: new Set() }))
    bucket.rows++
    bucket.days.add(row.date.slice(0, 10))
  }

  const signature = new Set<string>()
  for (const [key, { rows: count, days }] of buckets) {
    if (count >= 3 && days.size >= 2) signature.add(key)
  }
  return signature
}

interface Context {
  /** user_id → fecha (ISO) del primer sync bancario de ese usuario. */
  firstSyncByUser: Map<string, string>
  cronSignature: Set<string>
}

function classify(row: Row, ctx: Context): Verdict {
  const detail = row.detail ?? ''
  const desc = row.bank_description
  const day = row.date.slice(0, 10)

  // Cota por usuario: antes de que conectara su banco, ninguna fila suya puede
  // ser de bank-sync. Cae al ancla global si el usuario no tiene credenciales.
  const firstSync = ctx.firstSyncByUser.get(row.user_id) ?? BANK_SYNC_SINCE
  const bankSyncPossible = day >= firstSync

  // R1 — wallet por prefijo 📱. Es el único emisor de ese emoji en el codebase.
  // El corte por WALLET_SINCE descarta el 📱 que un usuario haya tipeado a mano
  // antes de que la función existiera.
  if (detail.startsWith('📱') && day >= WALLET_SINCE) {
    return { source: 'wallet', rule: 'R1 prefijo 📱' }
  }

  // R2 — email por bank_settlement_date. Solo process-email-v2 la escribe;
  // bank-sync la deja NULL a propósito y wallet nunca la toca.
  if (row.bank_settlement_date) {
    return { source: 'email', rule: 'R2 bank_settlement_date' }
  }

  // R3 — email por ventana temporal: en el período en que bank-sync todavía no
  // existía para este usuario, el único emisor de 🤖 era process-email-v2.
  if (!bankSyncPossible && (detail.startsWith('🤖') || desc !== null)) {
    return { source: 'email', rule: 'R3 anterior a bank-sync' }
  }

  // R4 — email por vocabulario de bank_description (campo no editable).
  if (desc && EMAIL_VOCABULARY.some((re) => re.test(desc))) {
    return { source: 'email', rule: 'R4 vocabulario de email' }
  }

  // A partir de acá solo quedan filas con huella automática ambigua (🤖 o
  // bank_description crudo) o filas sin huella. Las sin huella se resuelven por
  // R7/R8; las ambiguas, por las señales de tiempo R5/R6.
  const looksAutomated = detail.startsWith('🤖') || desc !== null

  if (looksAutomated && bankSyncPossible) {
    // R5 — bank-sync por el desfase date ↔ created_at.
    //
    // email y wallet insertan la fila en el instante en que llega el mail o el
    // push: `date` es la hora real del movimiento y `created_at` el insert, así
    // que el gap es de segundos o minutos y siempre positivo. bank-sync arma
    // `date` como día-del-movimiento + hora-de-la-corrida, así que el gap va de
    // horas a días — y para movimientos del mismo día sale negativo, porque esa
    // hora es `now.toISOString()` (reloj UTC) etiquetada como Santiago.
    const gapMs = new Date(row.created_at).getTime() - new Date(row.date).getTime()
    if (gapMs < 0) return { source: 'bank-sync', rule: 'R5 date > created_at' }
    if (gapMs > 30 * 60 * 1000) return { source: 'bank-sync', rule: 'R5 gap > 30min' }

    // R6 — bank-sync por la firma horaria del cron.
    if (ctx.cronSignature.has(`${row.user_id}|${row.date.slice(11, 16)}`)) {
      return { source: 'bank-sync', rule: 'R6 firma horaria del cron' }
    }
  }

  // R7 — manual por ausencia total de huella. Desde BANK_SYNC_SINCE las tres
  // fuentes automáticas escriben bank_description, así que ahí el NULL sí es
  // concluyente. Es la misma lectura que hace el dedup de bank-import.ts.
  if (day >= BANK_SYNC_SINCE && desc === null && !AUTO_PREFIX_RE.test(detail)) {
    return { source: 'manual', rule: 'R7 sin huella' }
  }

  // R8 — ventana vieja (date < BANK_SYNC_SINCE), donde bank_description es NULL
  // para todos y hay que mirar `detail`.
  if (day < BANK_SYNC_SINCE) {
    if (detail.startsWith('🤖')) return { source: 'email', rule: 'R8 prefijo 🤖 en ventana vieja' }
    if (day >= EMAIL_V1_SINCE && day < EMAIL_V2_SINCE && EMAIL_FALLBACK_RE.test(detail)) {
      return { source: 'email', rule: 'R8 formato de process-email v1' }
    }
    return { source: 'manual', rule: 'R8 sin huella en ventana vieja' }
  }

  // R9 — residuo. El caso irreductible es la compra con tarjeta posterior a
  // BANK_SYNC_SINCE que perdió su emoji: parseCompraTarjeta guarda el nombre
  // crudo del comercio en bank_description, igual que bank-sync. Mejor NULL
  // (origen desconocido, sin badge) que inventar una etiqueta.
  return { source: null, rule: 'R9 sin clasificar' }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(): Options {
  const args = Deno.args
  const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]

  const modes = (['apply', 'selftest', 'report'] as const).filter((m) => args.includes(`--${m}`))
  if (modes.length > 1) {
    console.error(`Elegí un solo modo: ${modes.map((m) => `--${m}`).join(', ')}`)
    Deno.exit(1)
  }

  const until = flag('until')
  const since = flag('since')
  for (const [name, value] of [['until', until], ['since', since]] as const) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      console.error(`--${name} debe tener formato YYYY-MM-DD`)
      Deno.exit(1)
    }
  }

  return { mode: modes[0] ?? 'report', userId: flag('user-id'), until, since }
}

/** Trae todas las filas paginando: la API corta en 1000 por request. */
async function fetchAll(
  client: SupabaseClient,
  opts: Options,
  labeled: boolean,
): Promise<Row[]> {
  const columns = 'id, user_id, date, created_at, detail, bank_description, bank_settlement_date, import_source'
  const pageSize = 1000
  const out: Row[] = []

  for (let from = 0; ; from += pageSize) {
    let query = client
      .from('transactions')
      .select(columns)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1)

    query = labeled ? query.not('import_source', 'is', null) : query.is('import_source', null)
    if (opts.userId) query = query.eq('user_id', opts.userId)
    if (opts.until) query = query.lt('date', opts.until)
    if (opts.since) query = query.gte('date', opts.since)

    const { data, error } = await query
    if (error) {
      console.error('Error consultando transacciones:', error.message)
      Deno.exit(1)
    }
    if (!data || data.length === 0) break
    out.push(...(data as Row[]))
    if (data.length < pageSize) break
  }

  return out
}

/**
 * Mapa user_id → fecha del primer sync bancario, para acotar R3 por usuario.
 * Se consulta sin los filtros de acotamiento: la cota tiene que ser la misma
 * corra el script completo o por tramos.
 */
async function loadFirstSyncByUser(client: SupabaseClient): Promise<Map<string, string>> {
  const firstSync = new Map<string, string>()

  for (const table of ['bank_sync_credentials', 'bank_sync_log']) {
    const { data, error } = await client.from(table).select('user_id, created_at')
    if (error) {
      console.warn(`⚠️  No se pudo leer ${table} (${error.message}); se usa el ancla global.`)
      continue
    }
    for (const row of (data ?? []) as { user_id: string; created_at: string }[]) {
      const day = row.created_at.slice(0, 10)
      const current = firstSync.get(row.user_id)
      if (!current || day < current) firstSync.set(row.user_id, day)
    }
  }

  return firstSync
}

function describeFilters(opts: Options): string {
  const parts: string[] = []
  if (opts.userId) parts.push(`user-id=${opts.userId}`)
  if (opts.since) parts.push(`since=${opts.since}`)
  if (opts.until) parts.push(`until=${opts.until}`)
  return parts.length ? parts.join(' · ') : 'sin filtros (todas las filas)'
}

/** Agrupa los sin clasificar por prefijo de bank_description, para calibrar. */
function reportUnclassified(rows: { row: Row }[]) {
  const groups = new Map<string, number>()
  for (const { row } of rows) {
    const key = (row.bank_description ?? row.detail ?? '(sin texto)').slice(0, 40)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }

  console.log('\nSin clasificar, agrupados por bank_description:')
  const sorted = [...groups].sort((a, b) => b[1] - a[1])
  for (const [prefix, count] of sorted.slice(0, 40)) {
    console.log(`  ${String(count).padStart(5)}  ${prefix}`)
  }
  if (sorted.length > 40) console.log(`  … y ${sorted.length - 40} patrón(es) más`)
}

// ── Modos ────────────────────────────────────────────────────────────────────

async function runClassification(client: SupabaseClient, opts: Options) {
  const firstSyncByUser = await loadFirstSyncByUser(client)
  const rows = await fetchAll(client, opts, false)

  if (rows.length === 0) {
    console.log('No hay filas con import_source en NULL para ese filtro.')
    return null
  }

  const ctx: Context = { firstSyncByUser, cronSignature: buildCronSignature(rows) }
  const verdicts = rows.map((row) => ({ row, ...classify(row, ctx) }))

  const bySource = new Map<string, number>()
  const byRule = new Map<string, number>()
  for (const v of verdicts) {
    const key = v.source ?? '(sin clasificar)'
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
    byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1)
  }

  console.log(`Filtros: ${describeFilters(opts)}`)
  console.log(`${rows.length} fila(s) con import_source en NULL\n`)

  console.log('Por origen asignado:')
  for (const [source, count] of [...bySource].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${source}`)
  }

  console.log('\nPor regla:')
  for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${rule}`)
  }

  const unclassified = verdicts.filter((v) => v.source === null)
  if (unclassified.length > 0) reportUnclassified(unclassified)

  return verdicts
}

/**
 * Contrasta el clasificador contra las filas que las edge functions ya
 * etiquetaron. Es el único test de precisión disponible sin datos anotados a
 * mano; el sesgo a tener en cuenta es que esas filas son todas posteriores al
 * 2026-08-02, así que ejercitan R1/R2/R5/R6 pero no las ventanas viejas.
 */
async function runSelfTest(client: SupabaseClient, opts: Options) {
  const firstSyncByUser = await loadFirstSyncByUser(client)
  const rows = await fetchAll(client, opts, true)

  if (rows.length === 0) {
    console.log('No hay filas ya etiquetadas contra las cuales contrastar.')
    return
  }

  const ctx: Context = { firstSyncByUser, cronSignature: buildCronSignature(rows) }

  let ok = 0
  const misses = new Map<string, number>()
  for (const row of rows) {
    const { source, rule } = classify(row, ctx)
    if (source === row.import_source) ok++
    else misses.set(`${row.import_source} → ${source ?? 'null'} (${rule})`, (misses.get(`${row.import_source} → ${source ?? 'null'} (${rule})`) ?? 0) + 1)
  }

  console.log(`Filtros: ${describeFilters(opts)}`)
  console.log(`Selftest sobre ${rows.length} fila(s) ya etiquetada(s): ${ok} acierto(s), ${rows.length - ok} error(es)\n`)

  if (misses.size > 0) {
    console.log('Errores (esperado → obtenido):')
    for (const [label, count] of [...misses].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(6)}  ${label}`)
    }
  }
}

async function runApply(client: SupabaseClient, opts: Options) {
  const verdicts = await runClassification(client, opts)
  if (!verdicts) return

  const toUpdate = verdicts.filter((v) => v.source !== null)
  console.log(`\nAplicando ${toUpdate.length} actualización(es)…`)

  // Un UPDATE por origen en vez de uno por fila: son 4 requests en total.
  let ok = 0
  for (const source of ['manual', 'email', 'bank-sync', 'wallet'] as ImportSource[]) {
    const ids = toUpdate.filter((v) => v.source === source).map((v) => v.row.id)
    if (ids.length === 0) continue

    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const { error } = await client
        .from('transactions')
        .update({ import_source: source })
        .in('id', chunk)

      if (error) console.error(`  ✗ ${source} (${chunk.length} filas): ${error.message}`)
      else ok += chunk.length
    }
  }

  const left = verdicts.length - toUpdate.length
  console.log(`\n✅ ${ok}/${toUpdate.length} fila(s) actualizada(s). ${left} quedaron en NULL.`)
}

async function main() {
  const opts = parseArgs()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno')
    Deno.exit(1)
  }

  const client = createClient(url, key)

  if (opts.mode === 'selftest') {
    await runSelfTest(client, opts)
  } else if (opts.mode === 'apply') {
    await runApply(client, opts)
  } else {
    const verdicts = await runClassification(client, opts)
    if (verdicts) {
      console.log('\nDry-run: no se escribió nada. Volver a correr con --apply para aplicar.')
    }
  }
}

await main()
