/**
 * rindo — Lee emails bancarios y crea transacciones automáticamente.
 * Configurar como trigger de Google Apps Script (cada 5-15 min).
 *
 * Bancos soportados: Banco de Chile, BCI, Santander, BancoEstado, Itaú
 *
 * ⚠️ Configurar USER_ID con tu ID de usuario de rindo antes de usar.
 */

var USER_ID = 'TU_USER_ID_AQUI';

var SUPABASE_ENDPOINT = 'https://fxlztcwqmlmhqwzbrebo.supabase.co/functions/v1/process-email-v2';

var GMAIL_QUERY = 'is:unread newer_than:2h from:(bancochile.cl OR bci.cl OR santander.cl OR bancoestado.cl OR itau.cl)';

function checkBankEmails() {
  var threads = GmailApp.search(GMAIL_QUERY);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.isUnread()) continue;

      var body = msg.getPlainBody() || '';
      body = stripFooter(body);

      var payload = {
        subject: msg.getSubject(),
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

        if (result.success && result.parsed) {
          sendNotificationEmail(result.parsed);
        }

        if (result.success || result.skipped) {
          msg.markRead();
        }
      } catch (e) {
        Logger.log('❌ Fetch error: ' + e);
      }
    }
  }
}

/**
 * Envía un email de notificación cuando se crea una transacción.
 * @param {Object} parsed - { amount, type, detail, category, bank }
 */
function sendNotificationEmail(parsed) {
  var emoji = parsed.type === 'Ingreso' ? '💰' : '💳';
  var amount = '$' + Number(parsed.amount).toLocaleString('es-CL');
  var subject = emoji + ' ' + parsed.type + ': ' + amount + ' — ' + parsed.detail.replace(/^🤖\s*/, '');

  var body = [
    '<div style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">',
    '  <div style="background:#18181b;border-radius:12px;padding:24px;color:#fafafa">',
    '    <h2 style="margin:0 0 4px;font-size:14px;color:#a1a1aa;font-weight:500">rindo.</h2>',
    '    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700">' + emoji + ' Nuevo ' + parsed.type.toLowerCase() + ' registrado</h1>',
    '    <div style="background:#27272a;border-radius:8px;padding:16px;margin-bottom:16px">',
    '      <div style="font-size:32px;font-weight:700;color:#fafafa;margin-bottom:8px">' + amount + '</div>',
    '      <div style="font-size:14px;color:#a1a1aa">' + parsed.detail.replace(/^🤖\s*/, '') + '</div>',
    '    </div>',
    '    <table style="width:100%;font-size:13px;color:#a1a1aa">',
    '      <tr><td style="padding:4px 0">Categoría</td><td style="text-align:right;color:#fafafa">' + (parsed.category || 'Sin categoría') + '</td></tr>',
    '      <tr><td style="padding:4px 0">Banco</td><td style="text-align:right;color:#fafafa">' + (parsed.bank || '—') + '</td></tr>',
    '      <tr><td style="padding:4px 0">Tipo</td><td style="text-align:right;color:#fafafa">' + parsed.type + '</td></tr>',
    '    </table>',
    '  </div>',
    '  <p style="text-align:center;font-size:11px;color:#71717a;margin-top:16px">Creado automáticamente por rindo</p>',
    '</div>'
  ].join('\n');

  GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, parsed.type + ': ' + amount + ' — ' + parsed.detail, {
    htmlBody: body,
    name: 'rindo.'
  });
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
