// Cliente mínimo de la API open-banking-chile: iniciar un scraping y consultar su job.
// Lo usan bank-sync (el cliente hace el polling) y bank-sync-all (el cron hace el polling).

import { encryptForTransit } from './crypto.ts'
import type { ScrapeResult } from './bank-import.ts'

const OPEN_BANKING_BASE = 'https://open-banking-api-98187240066.southamerica-west1.run.app'

export type JobStatus = 'queued' | 'running' | 'awaiting_2fa' | 'completed' | 'failed'

export interface Job {
  id: string
  bank: string
  status: JobStatus
  progress?: string
  createdAt: number
  completedAt?: number
  result?: ScrapeResult
  error?: string
}

/** Inicia un job de scraping. Si la API responde con error devuelve `{ apiError }`. */
export async function startScrape(
  apiKey: string,
  params: { bank: string; rut: string; password: string; fromDate?: string },
): Promise<{ jobId: string; status: JobStatus } | { apiError: string }> {
  const encryptedCredentials = await encryptForTransit(params.rut, params.password)
  const body: Record<string, string> = { bank: params.bank, encryptedCredentials }
  if (params.fromDate) body.fromDate = params.fromDate

  const res = await fetch(`${OPEN_BANKING_BASE}/api/v1/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { apiError: `Scrape API error ${res.status}: ${await res.text()}` }

  const { jobId, status } = await res.json()
  return { jobId, status }
}

/** Consulta el estado de un job. Si la API responde con error devuelve `{ apiError }`. */
export async function getJob(apiKey: string, jobId: string): Promise<Job | { apiError: string }> {
  const res = await fetch(`${OPEN_BANKING_BASE}/api/v1/jobs/${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return { apiError: `Job poll HTTP ${res.status}` }
  return await res.json() as Job
}
