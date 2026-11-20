import type { Client } from './supabase.ts'
import { withoutImportMark } from './text.ts'

const SENDER = 'rindo. <notificaciones@notificaciones.rindo.cl>'
const BRAND_RED = '#e11d48'
const INCOME_GREEN = '#22c55e'
const MUTED_BAR = '#3f3f46'
const WEEKLY_CHART_HEIGHT_PX = 100
const TOP_DETAIL_MAX_CHARS = 24

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
  `<rect width="32" height="32" rx="6" fill="${BRAND_RED}"/>` +
  '<g transform="translate(16,16)">' +
  '<rect x="-11" y="-2.2" width="22" height="4.5" rx="1" fill="#fff" transform="rotate(-32)"/>' +
  '<rect x="-9.2" y="-2.2" width="18.5" height="4.5" rx="1" fill="#fff" transform="rotate(38)" opacity="0.55"/>' +
  '</g></svg>'

const BRAND_HEADER_ROW =
  '<tr><td style="padding:28px 28px 0">' +
  '<table cellpadding="0" cellspacing="0"><tr>' +
  `<td style="padding-right:10px;vertical-align:middle">${LOGO_SVG}</td>` +
  `<td style="vertical-align:middle;font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">rindo<span style="color:${BRAND_RED}">.</span></td>` +
  '</tr></table>' +
  '</td></tr>'

const DIVIDER_ROW = '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>'

export interface WeeklyStats {
  dailyTotals: { date: string; day: string; total: number }[]
  top3: { detail: string; amount: number }[]
  weekTotal: number
  count: number
}

interface EmailParams {
  to: string
  amount: number
  detail: string
  category: string
  bank: string
  type: 'Gasto' | 'Ingreso' | 'Inversion'
  weeklyStats: WeeklyStats | null
}

interface BatchTransaction {
  date: string
  description: string
  amount: number
  type: string
}

interface BatchEmailParams {
  to: string
  bank: string
  transactions: BatchTransaction[]
}

interface BankSyncFailureParams {
  to: string
  bank: string
  reason: 'circuit_breaker' | 'invalid_credentials' | '2fa_blocked'
}

export async function userEmail(client: Client, userId: string): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(userId)
  if (error) throw error
  return data?.user?.email ?? null
}

const clp = (amount: number) => '$' + Number(amount).toLocaleString('es-CL')
const typeColor = (type: string) => type === 'Ingreso' ? INCOME_GREEN : BRAND_RED

function emailFrame(maxWidthPx: number, rows: string, footer: string): string {
  return (
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:${maxWidthPx}px;margin:0 auto;padding:20px 0">` +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:16px;overflow:hidden">' +
    BRAND_HEADER_ROW +
    rows +
    '</table>' +
    `<div style="text-align:center;padding:14px 0 0;font-size:11px;color:#52525b">${footer}</div>` +
    '</div>'
  )
}

async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY no configurada, no se envía el email')
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SENDER, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
  })
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`)
  return true
}

function weeklyChartRows(stats: WeeklyStats, category: string, highlight: string): string {
  const maxDay = Math.max(...stats.dailyTotals.map((d) => d.total)) || 1
  let labelsRow = ''
  let barsRow = ''
  let daysRow = ''

  stats.dailyTotals.forEach((day, index) => {
    const barPx = day.total > 0 ? Math.max(Math.round((day.total / maxDay) * WEEKLY_CHART_HEIGHT_PX), 6) : 3
    const isToday = index === stats.dailyTotals.length - 1
    const amountLabel = day.total > 0 ? '$' + Math.round(day.total / 1000) + 'k' : ''

    labelsRow += `<td style="text-align:center;padding:0 3px;font-size:10px;color:#71717a;height:16px">${amountLabel}</td>`
    barsRow +=
      `<td style="vertical-align:bottom;text-align:center;padding:0 3px;height:${WEEKLY_CHART_HEIGHT_PX}px">` +
      `<div style="display:inline-block;width:32px;height:${barPx}px;background:${isToday ? highlight : MUTED_BAR};border-radius:4px 4px 2px 2px"></div>` +
      '</td>'
    daysRow += `<td style="text-align:center;padding:6px 3px 0;font-size:11px;color:${isToday ? '#fafafa' : '#52525b'};font-weight:${isToday ? '700' : '400'}">${day.day}</td>`
  })

  const top3Html = stats.top3.map((tx, index) => {
    const detail = tx.detail.length > TOP_DETAIL_MAX_CHARS ? tx.detail.substring(0, TOP_DETAIL_MAX_CHARS) + '...' : tx.detail
    return '<tr>' +
      '<td style="color:#a1a1aa;padding:4px 0;font-size:12px;border-bottom:1px solid #1a1a1e">' +
      `<span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${index === 0 ? highlight : MUTED_BAR};margin-right:8px;vertical-align:middle"></span>` +
      detail +
      '</td>' +
      `<td style="color:#fafafa;text-align:right;padding:4px 0;font-size:12px;font-weight:600;white-space:nowrap;border-bottom:1px solid #1a1a1e">${clp(tx.amount)}</td>` +
      '</tr>'
  }).join('')

  const top3Section = top3Html
    ? '<tr><td style="padding:14px 28px 22px">' +
      '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#52525b;margin-bottom:8px">Más altos de la semana</div>' +
      `<table width="100%" cellpadding="0" cellspacing="0">${top3Html}</table>` +
      '</td></tr>'
    : ''

  return DIVIDER_ROW +
    '<tr><td style="padding:20px 28px 6px">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    `<td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a">${category} · 7 días</td>` +
    `<td style="text-align:right;font-size:14px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">${clp(stats.weekTotal)}</td>` +
    '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 20px 4px">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:10px;padding:12px 8px 8px">' +
    `<tr>${labelsRow}</tr>` +
    `<tr>${barsRow}</tr>` +
    `<tr>${daysRow}</tr>` +
    '</table>' +
    '</td></tr>' +
    top3Section
}

function notificationHtml({ amount, detail, category, bank, type, weeklyStats }: Omit<EmailParams, 'to'>): string {
  const color = typeColor(type)
  const weeklyHtml = weeklyStats?.dailyTotals.length ? weeklyChartRows(weeklyStats, category, color) : ''
  const bottomPadding = weeklyHtml ? '16px' : '24px'

  return emailFrame(440,
    '<tr><td style="padding:24px 28px 8px">' +
    `<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:6px">Nuevo ${type.toLowerCase()}</div>` +
    `<div style="font-size:36px;font-weight:800;color:#fafafa;letter-spacing:-1px;line-height:1">${clp(amount)}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:12px 28px 20px">' +
    `<div style="font-size:15px;color:#d4d4d8">${withoutImportMark(detail)}</div>` +
    '</td></tr>' +
    DIVIDER_ROW +
    `<tr><td style="padding:16px 28px ${bottomPadding}">` +
    '<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">' +
    `<tr><td style="color:#71717a;padding:5px 0">Categoría</td><td style="color:#fafafa;text-align:right;padding:5px 0">${category}</td></tr>` +
    `<tr><td style="color:#71717a;padding:5px 0">Banco</td><td style="color:#fafafa;text-align:right;padding:5px 0">${bank}</td></tr>` +
    '<tr><td style="color:#71717a;padding:5px 0">Tipo</td><td style="text-align:right;padding:5px 0">' +
    `<span style="display:inline-block;background:${color}22;color:${color};padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600">${type}</span>` +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +
    weeklyHtml,
    'Registrado automáticamente por rindo')
}

export async function sendNotificationEmail(params: EmailParams): Promise<void> {
  const detail = withoutImportMark(params.detail)
  const amount = clp(params.amount)
  const sent = await sendEmail({
    to: params.to,
    subject: `rindo. | ${params.type}: ${amount} — ${detail}`,
    html: notificationHtml(params),
    text: `${params.type}: ${amount} — ${detail} | ${params.category} | ${params.bank}`,
  })
  if (sent) console.log('📧 Email de movimiento enviado')
}

const dayMonth = (isoDate: string) => {
  const [year, month, day] = isoDate.split('T')[0].split('-')
  return year && month && day ? `${day}/${month}` : isoDate.split('T')[0]
}

function batchNotificationHtml({ bank, transactions }: Omit<BatchEmailParams, 'to'>): string {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0)
  const count = transactions.length
  const rowsHtml = transactions.map((tx) =>
    '<tr style="border-bottom:1px solid #1a1a1e">' +
    `<td style="color:#71717a;padding:8px 0;font-size:11px;white-space:nowrap;padding-right:12px">${dayMonth(tx.date)}</td>` +
    `<td style="color:#d4d4d8;padding:8px 0;font-size:12px">${tx.description}</td>` +
    `<td style="color:${typeColor(tx.type)};text-align:right;padding:8px 0;font-size:13px;font-weight:600;white-space:nowrap;padding-left:12px">${clp(tx.amount)}</td>` +
    '</tr>').join('')

  return emailFrame(480,
    '<tr><td style="padding:24px 28px 8px">' +
    `<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:6px">Sync bancario &mdash; ${bank}</div>` +
    `<div style="font-size:36px;font-weight:800;color:#fafafa;letter-spacing:-1px;line-height:1">${clp(total)}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:4px 28px 20px">' +
    `<div style="font-size:13px;color:#71717a">${count} transacci${count === 1 ? 'ón importada' : 'ones importadas'}</div>` +
    '</td></tr>' +
    DIVIDER_ROW +
    '<tr><td style="padding:16px 28px 24px">' +
    `<table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>` +
    '</td></tr>',
    'Registrado automáticamente por rindo')
}

export async function sendBatchNotificationEmail(params: BatchEmailParams): Promise<void> {
  const count = params.transactions.length
  const total = clp(params.transactions.reduce((sum, t) => sum + t.amount, 0))
  const sent = await sendEmail({
    to: params.to,
    subject: `rindo. | Sync ${params.bank}: ${count} transacci${count === 1 ? 'ón' : 'ones'} (${total})`,
    html: batchNotificationHtml(params),
    text: params.transactions.map(t => `${t.date.split('T')[0]} ${t.description} $${t.amount}`).join('\n'),
  })
  if (sent) console.log(`📧 Email de sync enviado (${count} transacciones)`)
}

export async function sendBankSyncFailureEmail({ to, bank, reason }: BankSyncFailureParams): Promise<void> {
  const reasonMessages: Record<BankSyncFailureParams['reason'], string> = {
    circuit_breaker: `La sincronización automática con <strong>${bank}</strong> fue desactivada tras 5 fallos consecutivos. Revisa tus credenciales en la sección de Bancos.`,
    invalid_credentials: `Las credenciales de <strong>${bank}</strong> son inválidas. Actualiza tu contraseña en la sección de Bancos.`,
    '2fa_blocked': `La sincronización automática con <strong>${bank}</strong> requiere verificación en dos pasos (2FA). La sincronización automática fue pausada. Puedes sincronizar manualmente cuando necesites.`,
  }
  const message = reasonMessages[reason] ?? `Hubo un problema con la sincronización de ${bank}.`

  const sent = await sendEmail({
    to,
    subject: `rindo. | Auto-sync ${bank} desactivado`,
    html: emailFrame(440,
      '<tr><td style="padding:24px 28px 16px">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:8px">Auto-sync desactivado</div>' +
      `<div style="font-size:15px;color:#d4d4d8;line-height:1.6">${message}</div>` +
      '</td></tr>',
      'rindo · notificaciones automáticas'),
    text: message.replace(/<[^>]+>/g, ''),
  })
  if (sent) console.log('📧 Email de sync desactivado enviado')
}
