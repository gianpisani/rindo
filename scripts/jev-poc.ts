import { readFileSync } from 'node:fs'
import { classifyWithJev, prepareJevRequest, JEV_POLICY, type JevCategory, type JevTransaction, type JevHistoryExample } from '../supabase/functions/_shared/jev-categorizer.ts'

// Node >= 22.18; no SDK, Supabase session or database access required.
interface Fixture {
  categories: JevCategory[]
  cases: (JevTransaction & { expectedCategory: string; history?: JevHistoryExample[] })[]
}

async function main() {
  const args = process.argv.slice(2)
  const preview = args.includes('--preview')
  const file = args.find(arg => !arg.startsWith('--')) ?? 'scripts/fixtures/jev-poc.json'
  const fixture = JSON.parse(readFileSync(file, 'utf8')) as Fixture
  if (!Array.isArray(fixture.cases) || fixture.cases.length < 1 || fixture.cases.length > 50) {
    throw new Error('Usa entre 1 y 50 ejemplos por corrida.')
  }
  // Validate the entire fixture before incurring any API cost.
  const requests = fixture.cases.map(tx => {
    const prepared = prepareJevRequest(tx, fixture.categories, tx.history)
    if (tx.expectedCategory !== 'Sin categoría' &&
        !Object.values(prepared.options).some(c => c.name === tx.expectedCategory)) {
      throw new Error(`Categoría esperada inválida para ${tx.type}: ${tx.expectedCategory}`)
    }
    return prepared.payload
  })
  if (preview) {
    console.log(JSON.stringify({ policy: JEV_POLICY, requests }, null, 2))
    return
  }
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) throw new Error('Configura AI_GATEWAY_API_KEY en .env.jev.local. No uses el prefijo VITE_.')

  const rows = []
  for (const tx of fixture.cases) {
    const decision = await classifyWithJev(tx, fixture.categories, { apiKey, history: tx.history })
    rows.push({ tx, decision })
    console.log(JSON.stringify({ detail: tx.detail, expectedCategory: tx.expectedCategory, ...decision }))
    // Stop on provider/auth/schema errors instead of repeating a broken call.
    if (decision.status === 'unavailable') break
  }
  const accepted = rows.filter(row => row.decision.status === 'accepted')
  const correct = rows.filter(row => row.decision.category === row.tx.expectedCategory &&
    !['unavailable', 'skipped'].includes(row.decision.status))
  const acceptedCorrect = accepted.filter(row => row.decision.category === row.tx.expectedCategory)
  const costs = rows.flatMap(row => row.decision.costUsd === undefined ? [] : [row.decision.costUsd])
  const latencies = rows.map(row => row.decision.latencyMs).sort((a, b) => a - b)
  const errors = rows.filter(row => ['unavailable', 'skipped'].includes(row.decision.status)).length
  console.log(JSON.stringify({
    summary: {
      evaluated: rows.length,
      planned: fixture.cases.length,
      correctIncludingNoCategory: `${correct.length}/${rows.length}`,
      automaticCoverage: `${accepted.length}/${rows.length}`,
      precisionAmongAccepted: accepted.length ? `${acceptedCorrect.length}/${accepted.length}` : 'sin asignaciones',
      errors,
      latencyP50Ms: latencies[Math.ceil(latencies.length * 0.5) - 1],
      latencyP95Ms: latencies[Math.ceil(latencies.length * 0.95) - 1],
      reportedCostUsd: costs.reduce((sum, cost) => sum + cost, 0),
      responsesWithCost: costs.length,
      note: 'Ejemplos de prueba; los aciertos no prueban precisión en tus movimientos reales.',
    },
  }, null, 2))
  if (errors) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Error al ejecutar la POC')
  process.exitCode = 1
})
