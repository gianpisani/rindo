#!/usr/bin/env -S deno run --allow-net --allow-env
//
// Puebla `bank_settlement_date` en transferencias ya existentes, para que la
// deduplicación de bank-sync también funcione hacia atrás.
//
// Uso:
//   export SUPABASE_URL=...
//   export SUPABASE_SERVICE_ROLE_KEY=...
//   deno run --allow-net --allow-env scripts/backfill-settlement-date.ts            # dry-run
//   deno run --allow-net --allow-env scripts/backfill-settlement-date.ts --apply
//   deno run --allow-net --allow-env scripts/backfill-settlement-date.ts --days=14 --apply

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { bankSettlementDate } from '../supabase/functions/_shared/business-day.ts'

// Vocabulario exacto que produce process-email-v2 para transferencias
// (parseTransferenciaTerceros / parseTransferenciaRecibida).
const TRANSFER_PATTERNS = [
  'Transferencia a %',
  'Transferencia de %',
  'Transferencia a terceros',
  'Transferencia recibida',
]

function parseArgs() {
  const apply = Deno.args.includes('--apply')
  const daysArg = Deno.args.find((a) => a.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7
  if (!Number.isFinite(days) || days <= 0) {
    console.error('--days debe ser un entero positivo')
    Deno.exit(1)
  }
  return { apply, days }
}

async function main() {
  const { apply, days } = parseArgs()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno')
    Deno.exit(1)
  }

  const client = createClient(url, key)

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceIso = since.toISOString()

  const { data: rows, error } = await client
    .from('transactions')
    .select('id, date, detail, bank_description, amount')
    .is('bank_settlement_date', null)
    .not('bank_description', 'is', null)
    .gte('date', sinceIso)
    .or(TRANSFER_PATTERNS.map((p) => `bank_description.ilike.${p}`).join(','))
    .order('date', { ascending: true })

  if (error) {
    console.error('Error consultando transacciones:', error.message)
    Deno.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log(`Sin transferencias por poblar en los últimos ${days} días.`)
    return
  }

  console.log(`${rows.length} transferencia(s) en los últimos ${days} días${apply ? '' : ' (dry-run)'}\n`)
  console.log('date (real)               | monto      | settlement | descripción')
  console.log('-'.repeat(90))

  const updates: { id: string; settlement: string }[] = []

  for (const row of rows) {
    // applyCutoff: false a propósito. Estas filas tienen `import_source` en NULL
    // (son previas a esa columna) y las de bank-sync guardan la hora del
    // servidor al sincronizar, no una hora real —ver bank-import.ts, insertDate—.
    // Sin la regla horaria, una fila de bank-sync que se cuele por el filtro de
    // vocabulario resulta en un no-op, porque su fecha ya es un día hábil, en
    // vez de terminar desplazada al día equivocado.
    const settlement = await bankSettlementDate(client, new Date(row.date), { applyCutoff: false })

    const moved = settlement !== String(row.date).slice(0, 10) ? ' ←' : ''
    console.log(
      `${String(row.date).slice(0, 25).padEnd(25)} | ${String(row.amount).padStart(10)} | ${settlement}${moved.padEnd(3)} | ${row.bank_description}`,
    )

    updates.push({ id: row.id as string, settlement })
  }

  if (!apply) {
    console.log(`\nDry-run: no se escribió nada. Volver a correr con --apply para aplicar.`)
    return
  }

  let ok = 0
  for (const u of updates) {
    const { error: updErr } = await client
      .from('transactions')
      .update({ bank_settlement_date: u.settlement })
      .eq('id', u.id)

    if (updErr) console.error(`  ✗ ${u.id}: ${updErr.message}`)
    else ok++
  }

  console.log(`\n✅ ${ok}/${updates.length} fila(s) actualizada(s).`)
}

await main()
