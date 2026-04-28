interface WeeklyStats {
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

function buildNotificationHtml(params: Omit<EmailParams, 'to'>): string {
  const { amount, detail, category, bank, type, weeklyStats } = params
  const amountStr = '$' + Number(amount).toLocaleString('es-CL')
  const cleanDetail = detail.replace(/^[🤖📱]\s*/, '')
  const typeColor = type === 'Ingreso' ? '#22c55e' : '#e11d48'
  const stats = weeklyStats

  const logoSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
    '<rect width="32" height="32" rx="6" fill="#e11d48"/>' +
    '<g transform="translate(16,16)">' +
    '<rect x="-11" y="-2.2" width="22" height="4.5" rx="1" fill="#fff" transform="rotate(-32)"/>' +
    '<rect x="-9.2" y="-2.2" width="18.5" height="4.5" rx="1" fill="#fff" transform="rotate(38)" opacity="0.55"/>' +
    '</g></svg>'

  let weeklyHtml = ''
  if (stats && stats.dailyTotals && stats.dailyTotals.length > 0) {
    const weekTotal = '$' + Number(stats.weekTotal).toLocaleString('es-CL')
    let maxDay = 0
    for (const d of stats.dailyTotals) {
      if (d.total > maxDay) maxDay = d.total
    }
    if (maxDay === 0) maxDay = 1
    const chartHeight = 100

    let labelsRow = ''
    let barsRow = ''
    let daysRow = ''

    for (let d = 0; d < stats.dailyTotals.length; d++) {
      const day = stats.dailyTotals[d]
      const barPx = day.total > 0 ? Math.max(Math.round((day.total / maxDay) * chartHeight), 6) : 3
      const isToday = d === stats.dailyTotals.length - 1
      const barColor = isToday ? typeColor : '#3f3f46'
      const labelColor = isToday ? '#fafafa' : '#52525b'
      const amountLabel = day.total > 0 ? '$' + Math.round(day.total / 1000) + 'k' : ''

      labelsRow += `<td style="text-align:center;padding:0 3px;font-size:10px;color:#71717a;height:16px">${amountLabel}</td>`

      barsRow +=
        `<td style="vertical-align:bottom;text-align:center;padding:0 3px;height:${chartHeight}px">` +
        `<div style="display:inline-block;width:32px;height:${barPx}px;background:${barColor};border-radius:4px 4px 2px 2px"></div>` +
        `</td>`

      daysRow += `<td style="text-align:center;padding:6px 3px 0;font-size:11px;color:${labelColor};font-weight:${isToday ? '700' : '400'}">${day.day}</td>`
    }

    let top3Html = ''
    if (stats.top3 && stats.top3.length > 0) {
      for (let t = 0; t < stats.top3.length; t++) {
        const tx = stats.top3[t]
        const txAmount = '$' + Number(tx.amount).toLocaleString('es-CL')
        const txDetail = tx.detail.length > 24 ? tx.detail.substring(0, 24) + '...' : tx.detail
        const dotColor = t === 0 ? typeColor : '#3f3f46'
        top3Html +=
          '<tr>' +
          `<td style="color:#a1a1aa;padding:4px 0;font-size:12px;border-bottom:1px solid #1a1a1e">` +
          `<span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${dotColor};margin-right:8px;vertical-align:middle"></span>` +
          txDetail +
          '</td>' +
          `<td style="color:#fafafa;text-align:right;padding:4px 0;font-size:12px;font-weight:600;white-space:nowrap;border-bottom:1px solid #1a1a1e">${txAmount}</td>` +
          '</tr>'
      }
    }

    const top3Section = top3Html
      ? '<tr><td style="padding:14px 28px 22px">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#52525b;margin-bottom:8px">Más altos de la semana</div>' +
        `<table width="100%" cellpadding="0" cellspacing="0">${top3Html}</table>` +
        '</td></tr>'
      : ''

    weeklyHtml =
      '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>' +
      '<tr><td style="padding:20px 28px 6px">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
      `<td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a">${category} · 7 días</td>` +
      `<td style="text-align:right;font-size:14px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">${weekTotal}</td>` +
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

  const bottomPadding = weeklyHtml ? '16px' : '24px'

  return (
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:440px;margin:0 auto;padding:20px 0">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:16px;overflow:hidden">' +
    '<tr><td style="padding:28px 28px 0">' +
    '  <table cellpadding="0" cellspacing="0"><tr>' +
    `    <td style="padding-right:10px;vertical-align:middle">${logoSvg}</td>` +
    '    <td style="vertical-align:middle;font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">rindo<span style="color:#e11d48">.</span></td>' +
    '  </tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px 8px">' +
    `  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:6px">Nuevo ${type.toLowerCase()}</div>` +
    `  <div style="font-size:36px;font-weight:800;color:#fafafa;letter-spacing:-1px;line-height:1">${amountStr}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:12px 28px 20px">' +
    `  <div style="font-size:15px;color:#d4d4d8">${cleanDetail}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>' +
    `<tr><td style="padding:16px 28px ${bottomPadding}">` +
    '  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">' +
    `    <tr><td style="color:#71717a;padding:5px 0">Categoría</td><td style="color:#fafafa;text-align:right;padding:5px 0">${category}</td></tr>` +
    `    <tr><td style="color:#71717a;padding:5px 0">Banco</td><td style="color:#fafafa;text-align:right;padding:5px 0">${bank}</td></tr>` +
    `    <tr><td style="color:#71717a;padding:5px 0">Tipo</td><td style="text-align:right;padding:5px 0">` +
    `      <span style="display:inline-block;background:${typeColor}22;color:${typeColor};padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600">${type}</span>` +
    '    </td></tr>' +
    '  </table>' +
    '</td></tr>' +
    weeklyHtml +
    '</table>' +
    '<div style="text-align:center;padding:14px 0 0;font-size:11px;color:#52525b">Registrado automáticamente por rindo</div>' +
    '</div>'
  )
}

export async function sendNotificationEmail(params: EmailParams): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY not set, skipping email notification')
    return
  }

  const { to, amount, detail, type } = params
  const cleanDetail = detail.replace(/^[🤖📱]\s*/, '')
  const amountStr = '$' + Number(amount).toLocaleString('es-CL')
  const subject = `rindo. | ${type}: ${amountStr} — ${cleanDetail}`

  const html = buildNotificationHtml(params)
  const plainText = `${type}: ${amountStr} — ${cleanDetail} | ${params.category} | ${params.bank}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'rindo. <notificaciones@notificaciones.rindo.cl>',
      to: [to],
      subject,
      html,
      text: plainText,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }

  console.log('📧 Email enviado a', to)
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

function buildBatchNotificationHtml(params: Omit<BatchEmailParams, 'to'>): string {
  const { bank, transactions } = params

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
  const totalStr = '$' + Number(totalAmount).toLocaleString('es-CL')
  const count = transactions.length

  const logoSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
    '<rect width="32" height="32" rx="6" fill="#e11d48"/>' +
    '<g transform="translate(16,16)">' +
    '<rect x="-11" y="-2.2" width="22" height="4.5" rx="1" fill="#fff" transform="rotate(-32)"/>' +
    '<rect x="-9.2" y="-2.2" width="18.5" height="4.5" rx="1" fill="#fff" transform="rotate(38)" opacity="0.55"/>' +
    '</g></svg>'

  let rowsHtml = ''
  for (const tx of transactions) {
    const amtStr = '$' + Number(tx.amount).toLocaleString('es-CL')
    const typeColor = tx.type === 'Ingreso' ? '#22c55e' : '#e11d48'
    const dateParts = tx.date.split('T')[0].split('-')
    const dateLabel = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : tx.date.split('T')[0]
    rowsHtml +=
      '<tr style="border-bottom:1px solid #1a1a1e">' +
      `<td style="color:#71717a;padding:8px 0;font-size:11px;white-space:nowrap;padding-right:12px">${dateLabel}</td>` +
      `<td style="color:#d4d4d8;padding:8px 0;font-size:12px">${tx.description}</td>` +
      `<td style="color:${typeColor};text-align:right;padding:8px 0;font-size:13px;font-weight:600;white-space:nowrap;padding-left:12px">${amtStr}</td>` +
      '</tr>'
  }

  return (
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:20px 0">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:16px;overflow:hidden">' +
    '<tr><td style="padding:28px 28px 0">' +
    '  <table cellpadding="0" cellspacing="0"><tr>' +
    `    <td style="padding-right:10px;vertical-align:middle">${logoSvg}</td>` +
    '    <td style="vertical-align:middle;font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">rindo<span style="color:#e11d48">.</span></td>' +
    '  </tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px 8px">' +
    `  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:6px">Sync bancario &mdash; ${bank}</div>` +
    `  <div style="font-size:36px;font-weight:800;color:#fafafa;letter-spacing:-1px;line-height:1">${totalStr}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:4px 28px 20px">' +
    `  <div style="font-size:13px;color:#71717a">${count} transacci${count === 1 ? 'ón importada' : 'ones importadas'}</div>` +
    '</td></tr>' +
    '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>' +
    '<tr><td style="padding:16px 28px 24px">' +
    `  <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>` +
    '</td></tr>' +
    '</table>' +
    '<div style="text-align:center;padding:14px 0 0;font-size:11px;color:#52525b">Registrado automáticamente por rindo</div>' +
    '</div>'
  )
}

export async function sendBatchNotificationEmail(params: BatchEmailParams): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY not set, skipping email notification')
    return
  }

  const { to, bank, transactions } = params
  const count = transactions.length
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
  const totalStr = '$' + Number(totalAmount).toLocaleString('es-CL')
  const subject = `rindo. | Sync ${bank}: ${count} transacci${count === 1 ? 'ón' : 'ones'} (${totalStr})`

  const html = buildBatchNotificationHtml(params)
  const plainText = transactions.map(t => `${t.date.split('T')[0]} ${t.description} $${t.amount}`).join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'rindo. <notificaciones@notificaciones.rindo.cl>',
      to: [to],
      subject,
      html,
      text: plainText,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }

  console.log('📧 Batch email enviado a', to, `(${count} transacciones)`)
}

// ── Bank sync failure notification ───────────────────────────────────────────

interface BankSyncFailureParams {
  to: string
  bank: string
  reason: 'circuit_breaker' | 'invalid_credentials' | '2fa_blocked'
}

export async function sendBankSyncFailureEmail(params: BankSyncFailureParams): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return

  const { to, bank, reason } = params

  const reasonMessages: Record<string, string> = {
    circuit_breaker: `La sincronización automática con <strong>${bank}</strong> fue desactivada tras 5 fallos consecutivos. Revisa tus credenciales en la sección de Bancos.`,
    invalid_credentials: `Las credenciales de <strong>${bank}</strong> son inválidas. Actualiza tu contraseña en la sección de Bancos.`,
    '2fa_blocked': `La sincronización automática con <strong>${bank}</strong> requiere verificación en dos pasos (2FA). La sincronización automática fue pausada. Puedes sincronizar manualmente cuando necesites.`,
  }

  const subject = `rindo. | Auto-sync ${bank} desactivado`
  const message = reasonMessages[reason] ?? `Hubo un problema con la sincronización de ${bank}.`

  const html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:440px;margin:0 auto;padding:20px 0">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:16px;overflow:hidden">' +
    '<tr><td style="padding:28px 28px 0">' +
    '<table cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:10px;vertical-align:middle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="6" fill="#e11d48"/><g transform="translate(16,16)"><rect x="-11" y="-2.2" width="22" height="4.5" rx="1" fill="#fff" transform="rotate(-32)"/><rect x="-9.2" y="-2.2" width="18.5" height="4.5" rx="1" fill="#fff" transform="rotate(38)" opacity="0.55"/></g></svg></td>' +
    '<td style="vertical-align:middle;font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">rindo<span style="color:#e11d48">.</span></td>' +
    '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px 16px">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:8px">Auto-sync desactivado</div>' +
    `<div style="font-size:15px;color:#d4d4d8;line-height:1.6">${message}</div>` +
    '</td></tr>' +
    '</table>' +
    '<div style="text-align:center;padding:14px 0 0;font-size:11px;color:#52525b">rindo · notificaciones automáticas</div>' +
    '</div>'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'rindo. <notificaciones@notificaciones.rindo.cl>',
      to: [to],
      subject,
      html,
      text: message.replace(/<[^>]+>/g, ''),
    }),
  }).then((r) => {
    if (r.ok) console.log('📧 Failure email enviado a', to)
  }).catch((e) => console.error('⚠️ Failure email error:', e))
}
