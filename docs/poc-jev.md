# Whisper y Jev en Rindo

## Probar localmente

Abre [Rindo local](http://127.0.0.1:8080/). **W**, **N**, los botones del dashboard, Agregar en Movimientos y el acceso móvil abren el mismo Whisper.

1. Escribe una línea, por ejemplo `15000 almuerzo`.
2. Tab cambia el tipo sin salir del texto; Shift+Tab retrocede. Flecha abajo entra a las categorías, donde Tab recorre los controles y Enter selecciona. Puedes tocar una categoría: se muestran primero las cuatro categorías de alimentación, cuando estén activadas, y luego las frecuentes del tipo elegido y el resto se despliega con `+N`. Tocar la seleccionada vuelve a automático.
3. Enter o Guardar cierra el compositor inmediatamente. El movimiento aparece mientras se guarda. Una selección manual evita la llamada a Jev; sin selección se categoriza en segundo plano.
4. Más opciones permite elegir fecha, tarjeta y gasto compartido. Se mantienen ingreso, inversión, rescate, rendimiento (incluida pérdida) y reembolso.
5. Si falla el guardado, se retira el movimiento provisional y se puede recuperar lo escrito. Si falla solo la categorización, el movimiento queda guardado sin categoría.

La prueba local utiliza el Supabase real de Rindo: guardar crea un movimiento real. No se agregaron registros ficticios durante las comprobaciones visuales.

La clave de AI Gateway permanece en `.env.jev.local`, excluido de Git. No se requieren IDs de usuarios ni existe una pantalla de laboratorio.

```sh
npm run dev -- --host 127.0.0.1
```

## Criterio de categorización

- Se elige la categoría más probable del tipo de movimiento, incluso cuando las opciones estén próximas. No se creó una bandeja «Por revisar».
- Se consulta el historial del mismo usuario por páginas de 1.000, hasta 10.000 movimientos recientes ya categorizados. Así un historial de más de 800 movimientos cabe sin recortarse a las primeras coincidencias.
- Se agrupan repeticiones y se priorizan ejemplos por comercio y palabras relevantes. Jev recibe hasta 24 ejemplos con descripción, categoría, frecuencia y origen de la clasificación. No recibe IDs de registros, montos ni fechas del historial; se retiran los sufijos de tarjeta enmascarados de esos ejemplos.
- El detalle explícito prevalece sobre el antecedente: «regalo en Paris» puede ser Regalos aunque otras compras en Paris sean Ropa. Las categorías históricas son contexto, no reglas infalibles ni entrenamiento del modelo.
- Se respetan las categorías elegidas manualmente y las ediciones hechas mientras el proveedor responde. Rescate, rendimiento y reembolso conservan su tratamiento específico.
- No se recategorizó el historial. Tras aplicar la migración de contexto, las nuevas elecciones manuales y predicciones se guardan como `manual` y `jev`. El historial previo mantiene origen desconocido: no se presenta como confirmado ni se reescribe.

Quick-add y sincronización bancaria (manual y programada) utilizan el mismo categorizador. Los cambios locales de correo y Wallet todavía no están publicados: requieren verificar la autenticación de sus clientes. Las importaciones toman una sola copia del historial y tienen cuatro llamadas simultáneas como máximo: las predicciones del propio lote no se usan como ejemplos dentro de ese lote.

## Alimentación y entornos

La migración `supabase/migrations/20260923120000_category_context.sql` agrega descripciones y disponibilidad de categorías, y origen de clasificación en movimientos. No cambia categorías de movimientos antiguos.

La producción de `rindo.cl` utiliza `fxlztcwqmlmhqwzbrebo`, verificado en la aplicación publicada. El entorno local usado durante la POC apuntaba a `rnjhquvvimpygkjpbign`: son bases diferentes y no se deben intercambiar ni copiar datos automáticamente.

La preparación de producción aplica solamente esta migración y activa las cuatro categorías para el propietario indicado en el secreto `RINDO_CATEGORY_OWNER_EMAIL`. La función usa permisos del llamador y RLS; no configura todas las cuentas al instalar la migración. Crea Supermercado, Café y snacks, Comida diaria y Comidas y panoramas con sus definiciones. Comida y Café quedan históricas, conservando sus movimientos, reembolsos y límites. No se distribuyen presupuestos antiguos entre las nuevas categorías sin una decisión del usuario.
Las definiciones son editables en Categorías. Whisper y Jev excluyen categorías históricas de nuevas sugerencias; estas siguen disponibles al consultar el historial y vincular reembolsos. Las consultas y ediciones existentes siguen funcionando antes de aplicar la migración.

Los reportes por categoría comparten el cálculo de gasto neto y comparan meses con el mismo criterio. Los reembolsos se atribuyen al mes recibido y a la categoría vinculada, no aumentan el conteo de compras y el gasto efectivo por categoría conserva un mínimo de cero. El detalle mantiene visible el gasto bruto y los reembolsos. No se modificó la contabilidad del patrimonio.

## Publicación

El despliegue usa los accesos existentes de GitHub Actions para Supabase y la integración de Vercel con `main`. No requiere una sesión local de las CLI ni un MCP de Supabase.

1. El workflow manual **Prepare Jev production** configura `AI_GATEWAY_API_KEY` exclusivamente en el servidor, aplica la migración pendiente y comprueba las cuatro categorías del propietario. Los secretos nunca se imprimen. La migración queda registrada y no se repite; volver a ejecutar sí restaura las definiciones iniciales de alimentación.
2. **Deploy Supabase Functions** publica el backend al cambiar sus archivos en `main`.
3. Vercel publica el frontend desde `main`; verificar el estado Ready y la aplicación pública antes de darlo por terminado.

Antes de publicar los importadores de correo y Wallet, hay que comprobar la autenticación de sus clientes. Sus cambios locales exigen una sesión válida del dueño o una llamada desde un servicio confiable con la credencial del servidor. Un ID de usuario o la clave pública anónima no bastan. No se debe poner `service_role` en el navegador ni en atajos personales. Un cliente antiguo sin sesión recibirá 401. Estos cambios quedan fuera de esta publicación; se conserva el comportamiento anterior de esos importadores. El script de correo del repositorio apunta al proyecto de producción, pero falta confirmar si es el cliente activo.

La configuración del entorno local no se modifica al publicar. La clave de Gateway nunca debe llevar el prefijo `VITE_`.

## Comprobaciones

```sh
npm run test:jev
npm run build
npm run poc:jev
```

La suite cubre categoría manual, parsing de pesos chilenos, tipos, autenticación, aislamiento por dueño, búsqueda en más de 800 ejemplos, historial contradictorio, errores del proveedor y protección frente a ediciones concurrentes. El comando POC sí llama a Jev con ejemplos preparados; no escribe movimientos ni lee el historial real.

La corrida real del 23 de septiembre de 2026 acertó **11/11 ejemplos preparados**, incluidos Rapalon, Paris con propósito explícito y Uber Eats frente a Uber Trip. Mediana del proveedor: **427 ms**, P95: **1.656 ms**, costo reportado: **US$0**. Es una prueba acotada; no mide precisión sobre el historial real ni promete ese costo a futuro.

La compilación pasó. La verificación global de tipos conserva errores anteriores de sincronización bancaria, perfil y gastos compartidos; el lint global también tenía dos `any` en la importación CSV de Movimientos. Se comprueban los archivos nuevos por separado. Aikido no encontró hallazgos en los 26 archivos revisados de esta iteración.

### Verificación de alimentación

37 pruebas locales pasaron, incluyendo origen manual/automático, exclusión de categorías históricas, descripciones persistidas y reembolsos sin duplicar compras. Compilación y empaquetado de la función pasaron. Aikido revisó 22 archivos sin hallazgos (un primer intento falló por conexión).

La prueba `npm run poc:jev -- scripts/fixtures/jev-food.json` usa casos ilustrativos derivados de los criterios conversados, no registros extraídos de Supabase. Los 13 casos obtuvieron la categoría esperada; el tercer caso tuvo un timeout inicial de 5 segundos y se repitió junto con los casos pendientes. No equivale a 13 respuestas correctas en 13 intentos ni mide precisión sobre el historial personal. No se insertaron movimientos de prueba.
