-- Función para enviar notificación cuando se alcanza el límite de una categoría
CREATE OR REPLACE FUNCTION notify_category_limit_reached()
RETURNS TRIGGER AS $$
DECLARE
  v_limit RECORD;
  v_current_spending NUMERIC;
  v_percentage NUMERIC;
  v_notification_payload JSONB;
BEGIN
  -- Obtener el límite de la categoría para este usuario
  SELECT * INTO v_limit
  FROM category_limits
  WHERE user_id = NEW.user_id
    AND category_name = NEW.category_name;

  -- Si no hay límite configurado, salir
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcular el gasto actual del mes en esta categoría
  SELECT COALESCE(SUM(amount), 0) INTO v_current_spending
  FROM transactions
  WHERE user_id = NEW.user_id
    AND category_name = NEW.category_name
    AND type = 'Gasto'
    AND date >= date_trunc('month', CURRENT_DATE)
    AND date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Calcular el porcentaje
  v_percentage := (v_current_spending / v_limit.monthly_limit) * 100;

  -- Si se alcanzó el porcentaje de alerta, enviar notificación
  IF v_percentage >= v_limit.alert_at_percentage THEN
    -- Preparar el payload de la notificación
    v_notification_payload := jsonb_build_object(
      'userId', NEW.user_id,
      'notification', jsonb_build_object(
        'title', '⚠️ Límite de categoría',
        'body', format('Has alcanzado el %s%% del límite en %s ($%s de $%s)', 
          ROUND(v_percentage)::TEXT,
          NEW.category_name,
          TO_CHAR(v_current_spending, 'FM999,999,999'),
          TO_CHAR(v_limit.monthly_limit, 'FM999,999,999')
        ),
        'tag', 'category-limit-' || NEW.category_name,
        'requireInteraction', true,
        'icon', '/icon-192x192.png',
        'badge', '/icon-192x192.png'
      )
    );

    -- Llamar a la función edge para enviar la notificación
    -- Nota: Esto requiere que tengas configurado el edge function
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := v_notification_payload
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta después de insertar una transacción de gasto
DROP TRIGGER IF EXISTS trigger_notify_category_limit ON transactions;
CREATE TRIGGER trigger_notify_category_limit
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.type = 'Gasto')
  EXECUTE FUNCTION notify_category_limit_reached();

-- Función para enviar notificación cuando se completa la sincronización de Fintual
CREATE OR REPLACE FUNCTION notify_fintual_sync_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_payload JSONB;
  v_total_amount NUMERIC;
BEGIN
  -- Solo notificar si el estado cambió a 'synced'
  IF NEW.sync_status = 'synced' AND (OLD.sync_status IS NULL OR OLD.sync_status != 'synced') THEN
    -- Calcular el total de inversiones sincronizadas
    SELECT COALESCE(SUM(amount), 0) INTO v_total_amount
    FROM transactions
    WHERE user_id = NEW.user_id
      AND category_name = 'Inversiones'
      AND description ILIKE '%fintual%';

    -- Preparar el payload de la notificación
    v_notification_payload := jsonb_build_object(
      'userId', NEW.user_id,
      'notification', jsonb_build_object(
        'title', '✅ Sincronización completada',
        'body', format('Fintual sincronizado: $%s', TO_CHAR(v_total_amount, 'FM999,999,999')),
        'tag', 'fintual-sync',
        'icon', '/icon-192x192.png',
        'badge', '/icon-192x192.png'
      )
    );

    -- Llamar a la función edge para enviar la notificación
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := v_notification_payload
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificar cuando se completa la sincronización de Fintual
DROP TRIGGER IF EXISTS trigger_notify_fintual_sync ON fintual_connections;
CREATE TRIGGER trigger_notify_fintual_sync
  AFTER UPDATE ON fintual_connections
  FOR EACH ROW
  EXECUTE FUNCTION notify_fintual_sync_complete();

-- Comentarios para documentación
COMMENT ON FUNCTION notify_category_limit_reached() IS 'Envía una notificación push cuando se alcanza el límite de una categoría';
COMMENT ON FUNCTION notify_fintual_sync_complete() IS 'Envía una notificación push cuando se completa la sincronización de Fintual';

