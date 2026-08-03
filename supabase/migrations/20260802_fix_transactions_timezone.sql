-- Fija el timezone de sesión de la base a America/Santiago.
--
-- Sin esto, cualquier valor de fecha/hora sin offset explícito (literales
-- 'YYYY-MM-DD' usados en la ventana de dedup de bank-import.ts, o el
-- timestamp híbrido que arma esa misma función) se interpreta en UTC en
-- vez de en la zona horaria del usuario, lo que hace que dos movimientos
-- del "mismo día" en Chile caigan en días de calendario UTC distintos y
-- rompan la detección de duplicados entre process-ios-wallet-push-notification
-- y bank-sync/bank-sync-all.
ALTER DATABASE postgres SET timezone TO 'America/Santiago';
