/**
 * rindo — Lee emails bancarios y crea transacciones automáticamente.
 * Configurar como trigger de Google Apps Script (cada 5-15 min).
 *
 * Bancos soportados: Banco de Chile, BCI, Santander, BancoEstado, Itaú
 *
 * ⚠️ Configurar USER_ID con tu ID de usuario de rindo antes de usar.
 *
 * Usa el label "rindo/procesado" para marcar emails ya procesados y evitar
 * duplicados (más confiable que read/unread, que tiene delay en el índice de Gmail).
 */

var USER_ID = 'TU_USER_ID_AQUI';

var SUPABASE_ENDPOINT = 'https://fxlztcwqmlmhqwzbrebo.supabase.co/functions/v1/process-email-v2';

var LABEL_NAME = 'rindo/procesado';

var GMAIL_QUERY = 'is:unread newer_than:2h -label:rindo-procesado from:(bancochile.cl OR bci.cl OR santander.cl OR bancoestado.cl OR itau.cl)';

/**
 * Obtiene o crea el label de Gmail para marcar emails procesados.
 */
function getOrCreateLabel_() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) label = GmailApp.createLabel(LABEL_NAME);
  return label;
}

function checkBankEmails() {
  var label = getOrCreateLabel_();
  var threads = GmailApp.search(GMAIL_QUERY);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.isUnread()) continue;

      var body = msg.getPlainBody() || '';
      body = stripFooter(body);

      var payload = {
        subject: msg.getSubject().substring(0, 500),
        content: body.substring(0, 2000),
        from: msg.getFrom(),
        timestamp: msg.getDate().toISOString(),
        user_id: USER_ID
      };

      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      try {
        var response = UrlFetchApp.fetch(SUPABASE_ENDPOINT, options);
        var result = JSON.parse(response.getContentText());

        Logger.log(
          result.success
            ? '✅ ' + (result.parsed ? result.parsed.detail + ' $' + result.parsed.amount : 'OK')
            : result.skipped
              ? '⏭️ Skipped: ' + (result.reason || '')
              : '❌ Error: ' + (result.error || '')
        );

        if (result.success || result.skipped) {
          msg.markRead();
          threads[i].addLabel(label);

          if (result.success && result.parsed) {
            sendNotificationEmail(result.parsed);
          }
        } else {
          Logger.log('⚠️ No se aplicó label, se reintentará: ' + (result.error || ''));
        }
      } catch (e) {
        Logger.log('❌ Fetch error (se reintentará): ' + e);
      }
    }
  }
}

/**
 * Envía un email de notificación cuando se crea una transacción.
 */
function sendNotificationEmail(parsed) {
  var amount = '$' + Number(parsed.amount).toLocaleString('es-CL');
  var detail = (parsed.detail || '').replace(/^🤖\s*/, '');
  var category = parsed.category || 'Sin categoría';
  var bank = parsed.bank || '—';
  var typeColor = parsed.type === 'Ingreso' ? '#22c55e' : '#e11d48';
  var stats = parsed.weeklyStats;

  var subject = 'rindo. | ' + parsed.type + ': ' + amount + ' — ' + detail;

  var logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
    + '<rect width="32" height="32" rx="6" fill="#e11d48"/>'
    + '<g transform="translate(16,16)">'
    + '<rect x="-11" y="-2.2" width="22" height="4.5" rx="1" fill="#fff" transform="rotate(-32)"/>'
    + '<rect x="-9.2" y="-2.2" width="18.5" height="4.5" rx="1" fill="#fff" transform="rotate(38)" opacity="0.55"/>'
    + '</g></svg>';

  // Weekly stats section (bar chart + top 3)
  var weeklyHtml = '';
  if (stats && stats.dailyTotals && stats.dailyTotals.length > 0) {
    var weekTotal = '$' + Number(stats.weekTotal).toLocaleString('es-CL');
    var maxDay = 0;
    for (var d = 0; d < stats.dailyTotals.length; d++) {
      if (stats.dailyTotals[d].total > maxDay) maxDay = stats.dailyTotals[d].total;
    }
    if (maxDay === 0) maxDay = 1;
    var chartHeight = 100; // px

    // Bar chart — pure table, no flex (Gmail compatible)
    var labelsRow = '';
    var barsRow = '';
    var daysRow = '';

    for (var d = 0; d < stats.dailyTotals.length; d++) {
      var day = stats.dailyTotals[d];
      var barPx = day.total > 0 ? Math.max(Math.round((day.total / maxDay) * chartHeight), 6) : 3;
      var isToday = d === stats.dailyTotals.length - 1;
      var barColor = isToday ? typeColor : '#3f3f46';
      var labelColor = isToday ? '#fafafa' : '#52525b';
      var amountLabel = day.total > 0 ? '$' + Math.round(day.total / 1000) + 'k' : '';

      labelsRow += '<td style="text-align:center;padding:0 3px;font-size:10px;color:#71717a;height:16px">' + amountLabel + '</td>';

      barsRow += ''
        + '<td style="vertical-align:bottom;text-align:center;padding:0 3px;height:' + chartHeight + 'px">'
        + '<div style="display:inline-block;width:32px;height:' + barPx + 'px;background:' + barColor + ';border-radius:4px 4px 2px 2px"></div>'
        + '</td>';

      daysRow += '<td style="text-align:center;padding:6px 3px 0;font-size:11px;color:' + labelColor + ';font-weight:' + (isToday ? '700' : '400') + '">' + day.day + '</td>';
    }

    // Top 3
    var top3Html = '';
    if (stats.top3 && stats.top3.length > 0) {
      for (var t = 0; t < stats.top3.length; t++) {
        var tx = stats.top3[t];
        var txAmount = '$' + Number(tx.amount).toLocaleString('es-CL');
        var txDetail = tx.detail.length > 24 ? tx.detail.substring(0, 24) + '...' : tx.detail;
        top3Html += ''
          + '<tr>'
          + '<td style="color:#a1a1aa;padding:4px 0;font-size:12px;border-bottom:1px solid #1a1a1e">'
          + '<span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:' + (t === 0 ? typeColor : '#3f3f46') + ';margin-right:8px;vertical-align:middle"></span>'
          + txDetail
          + '</td>'
          + '<td style="color:#fafafa;text-align:right;padding:4px 0;font-size:12px;font-weight:600;white-space:nowrap;border-bottom:1px solid #1a1a1e">' + txAmount + '</td>'
          + '</tr>';
      }
    }

    weeklyHtml = ''
      // Separador
      + '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>'

      // Header sección
      + '<tr><td style="padding:20px 28px 6px">'
      + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a">' + category + ' · 7 días</td>'
      + '<td style="text-align:right;font-size:14px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">' + weekTotal + '</td>'
      + '</tr></table>'
      + '</td></tr>'

      // Chart area with subtle bg
      + '<tr><td style="padding:8px 20px 4px">'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:10px;padding:12px 8px 8px">'
      + '<tr>' + labelsRow + '</tr>'
      + '<tr>' + barsRow + '</tr>'
      + '<tr>' + daysRow + '</tr>'
      + '</table>'
      + '</td></tr>'

      // Top 3
      + (top3Html ? ''
        + '<tr><td style="padding:14px 28px 22px">'
        + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#52525b;margin-bottom:8px">Más altos de la semana</div>'
        + '<table width="100%" cellpadding="0" cellspacing="0">' + top3Html + '</table>'
        + '</td></tr>'
        : '');
  }

  var html = ''
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:440px;margin:0 auto;padding:20px 0">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;border-radius:16px;overflow:hidden">'

    // Header con logo
    + '<tr><td style="padding:28px 28px 0">'
    + '  <table cellpadding="0" cellspacing="0"><tr>'
    + '    <td style="padding-right:10px;vertical-align:middle">' + logoSvg + '</td>'
    + '    <td style="vertical-align:middle;font-size:18px;font-weight:700;color:#fafafa;letter-spacing:-0.3px">rindo<span style="color:#e11d48">.</span></td>'
    + '  </tr></table>'
    + '</td></tr>'

    // Monto
    + '<tr><td style="padding:24px 28px 8px">'
    + '  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;margin-bottom:6px">Nuevo ' + parsed.type.toLowerCase() + '</div>'
    + '  <div style="font-size:36px;font-weight:800;color:#fafafa;letter-spacing:-1px;line-height:1">' + amount + '</div>'
    + '</td></tr>'

    // Detalle
    + '<tr><td style="padding:12px 28px 20px">'
    + '  <div style="font-size:15px;color:#d4d4d8">' + detail + '</div>'
    + '</td></tr>'

    // Separador
    + '<tr><td style="padding:0 28px"><div style="border-top:1px solid #27272a"></div></td></tr>'

    // Info
    + '<tr><td style="padding:16px 28px ' + (weeklyHtml ? '16px' : '24px') + '">'
    + '  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">'
    + '    <tr><td style="color:#71717a;padding:5px 0">Categoría</td><td style="color:#fafafa;text-align:right;padding:5px 0">' + category + '</td></tr>'
    + '    <tr><td style="color:#71717a;padding:5px 0">Banco</td><td style="color:#fafafa;text-align:right;padding:5px 0">' + bank + '</td></tr>'
    + '    <tr><td style="color:#71717a;padding:5px 0">Tipo</td><td style="text-align:right;padding:5px 0">'
    + '      <span style="display:inline-block;background:' + typeColor + '22;color:' + typeColor + ';padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600">' + parsed.type + '</span>'
    + '    </td></tr>'
    + '  </table>'
    + '</td></tr>'

    // Weekly stats
    + weeklyHtml

    + '</table>'
    + '<div style="text-align:center;padding:14px 0 0;font-size:11px;color:#52525b">Registrado automáticamente por rindo</div>'
    + '</div>';

  var plainText = parsed.type + ': ' + amount + ' — ' + detail + ' | ' + category + ' | ' + bank;

  GmailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    subject,
    plainText,
    { htmlBody: html, name: 'rindo.' }
  );
}

/**
 * Corta el footer/boilerplate de seguridad de los emails bancarios
 * para que el contenido que llega al server sea limpio.
 */
function stripFooter(text) {
  var markers = [
    'Revisa Saldos y Movimientos',
    'Sigue estos consejos para evitar fraudes',
    'Nunca te llamaremos solicitando',
    'Realiza todo de forma',
    'Este e-mail fue generado automaticamente',
    'Importante: Este e-mail fue generado',
    'Mi Banco Mi Pass',
  ];

  var cutIndex = text.length;
  for (var k = 0; k < markers.length; k++) {
    var idx = text.indexOf(markers[k]);
    if (idx > 0 && idx < cutIndex) {
      cutIndex = idx;
    }
  }

  return text.substring(0, cutIndex).trim();
}
