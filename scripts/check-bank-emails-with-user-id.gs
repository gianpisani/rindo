/**
 * Rindo — Lee emails bancarios y crea transacciones automáticamente.
 * Configurar como trigger de Google Apps Script (cada 5-15 min).
 *
 * Bancos soportados: Banco de Chile, BCI, Santander, BancoEstado, Itaú
 *
 * ⚠️ Configurar USER_ID con tu ID de usuario de Rindo antes de usar.
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
