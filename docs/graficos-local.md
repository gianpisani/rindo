# Gráficos — implementación local

La navegación ahora ofrece `/graficos`; `/overview` redirige a esa sección. Meta no cambia.

Para probar: `npm run dev -- --host 127.0.0.1 --port 5175`.

- `http://127.0.0.1:5175/graficos`: movimientos de la cuenta que inicia sesión.
- `http://127.0.0.1:5175/graficos-preview.html`: misma interfaz con datos ficticios, sin autenticación. Esta entrada solo monta en desarrollo; no se incluye en el build de producción.

## Implementado

Ocho vistas (barras, líneas, área, torta, dona, anillos, tabla y número), períodos relativos y rango de meses, filtro por tipo/categorías/tarjetas, series, colores por gráfico, plantillas, duplicar, eliminar y deshacer. El tablero permite arrastrar, redimensionar y operar por teclado; conserva distribuciones independientes de escritorio y móvil. La privacidad oculta el gráfico entero, incluidos tooltips. Las barras, tajadas y números abren los movimientos que contribuyen al resultado.

Los datos se consultan por usuario y con paginación para no truncar historiales de más de 1.000 filas. Se usan fechas de Chile y se excluyen fechas posteriores a hoy. Reembolsos netean contra la categoría reembolsada en la fecha recibida. Los meses vacíos aparecen en las tendencias. El patrimonio reutiliza el ledger y arrastra el saldo inicial del rango; aportes y rescates no crean patrimonio. El ahorro usa fechas reales, sin las reglas de atribución de sueldo de Meta. No se dibujan tortas con valores negativos.

## Guardado

La configuración local se guarda por usuario en `rindo-graficos-v1:<user_id>`, sin duplicar movimientos. La demostración usa una clave separada. Los defaults solo se materializan al editar.

La migración `supabase/migrations/20260909_graficos.sql` está preparada pero **no aplicada a la base compartida**. Crea `analysis_boards`, `analysis_blocks`, RLS, propiedad coherente tablero/bloque, y dos RPC. El guardado remoto es atómico y tiene revisión para impedir sobrescrituras entre dispositivos. Tras aplicar la migración aparece “Guardar en mi cuenta”. Las copias locales sin cambios pueden cargar la versión remota; los conflictos preservan la copia local y ofrecen cargar la de la cuenta con respaldo previo.

Se conserva un tablero por usuario en esta primera versión. La proyección de patrimonio con supuestos (`ProjectionCard`) permanece en el repositorio, sin nueva ubicación.

## Validación

- `npm run check:graficos`: casos de reembolsos, filtros, rangos, meses vacíos, ahorro, patrimonio, saldos iniciales, zona horaria y configuración.
- `npm run build`: correcto.
- `npx tsc -p tsconfig.app.json --noEmit`: los mismos 9 errores que HEAD en BankSyncHistory, QuickTransactionForm, useUserProfile y Transactions; sin errores nuevos. Se comparó contra una copia temporal de HEAD.
- Pruebas de navegador con datos ficticios: editar, seleccionar meses y categoría, cambiar color, recargar, arrastrar, redimensionar, mover por teclado, vista móvil y oscuro, drill-down y creación de anillos.
- Aikido: sin hallazgos en los archivos revisados.

Documentación consultada para las APIs: [react-grid-layout 1.5.2](https://github.com/react-grid-layout/react-grid-layout/tree/1.5.2) y [Recharts Pie](https://recharts.github.io/en-US/api/Pie/).

## Editor de tabla (segunda iteración)

“Crear gráfico” abre directamente los movimientos, con fecha, categoría, detalle, tipo, monto y tarjeta. Fechas exactas y filtros están arriba; se seleccionan las columnas desde sus encabezados. Fecha + Monto propone barras mensuales; Categoría + Monto propone torta. Dos columnas descriptivas permiten comparar series. Sin Monto se cuentan movimientos; solo Monto propone un número. Las plantillas quedan como entrada secundaria.

La vista previa y la tabla están juntas en escritorio y se desplazan verticalmente en móvil. Los colores se cambian desde la leyenda. La edición usa un borrador: cancelar no escribe nada; guardar conserva las columnas seleccionadas, fechas, filtros y colores. Los gráficos de la primera versión siguen siendo editables; los campos nuevos de la configuración son opcionales.

Validado en navegador: crear desde columnas, filtrar Comida de febrero a junio, colorear desde la leyenda, guardar, reabrir y cancelar ediciones; también propuesta de torta en móvil a 390 px. Pruebas del motor ampliadas con selección de columnas, persistencia de selección y límites de fechas exactas.

### Pulido de selección inmediata

El gráfico aparece al seleccionar columnas y se actualiza sin un paso adicional de creación. El botón final siempre guarda. Todos los tipos muestran sus nombres, las columnas elegidas se resaltan completas y una descripción visible detalla cálculo, filtros y fechas. En móvil, «Ver gráfico» permite ir a la vista previa sin interrumpir la selección de columnas.

Verificado en la vista local: Fecha + Monto muestra barras inmediatamente; cambiar Fecha por Categoría muestra torta y mantiene el rango exacto febrero–junio. Compilación, comprobaciones de cálculos y revisión del editor correctas; Aikido sin hallazgos.
