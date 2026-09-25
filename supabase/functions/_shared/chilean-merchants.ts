import { normalizeMerchant } from './category-history.ts'

// What a Chilean merchant *is*, never which of the user's categories it maps to:
// categories are personal, so Jev maps the description onto them. Aliases are
// matched as whole words on the normalized detail (lowercase, no accents).
const merchants: [aliases: string[], description: string][] = [
  // Supermercados
  [['jumbo'], 'Jumbo: cadena de supermercados/hipermercados (Cencosud).'],
  [['lider', 'hiper lider', 'lider express', 'liderexpress', 'walmart'], 'Lider / Lider Express: cadena de supermercados de Walmart Chile.'],
  [['tottus'], 'Tottus: cadena de supermercados (Falabella).'],
  [['santa isabel'], 'Santa Isabel: cadena de supermercados (Cencosud).'],
  [['unimarc', 'smu'], 'Unimarc: cadena de supermercados (SMU).'],
  [['alvi'], 'Alvi: supermercado mayorista (SMU).'],
  [['acuenta', 'super bodega acuenta'], 'aCuenta: supermercado de bajo costo (Walmart Chile).'],
  [['mayorista 10', 'mayorista10'], 'Mayorista 10: supermercado mayorista (SMU).'],
  [['ekono'], 'Ekono: supermercado de barrio de bajo costo.'],
  [['montserrat'], 'Montserrat: cadena de supermercados.'],
  [['el trebol', 'super trebol'], 'El Trébol: cadena de supermercados regional.'],
  [['oxxo'], 'OXXO: tienda de conveniencia (snacks, bebidas, abarrotes).'],
  [['ok market', 'okmarket'], 'OK Market: tienda de conveniencia (snacks, bebidas, abarrotes).'],
  [['spacio 1', 'upa', 'upita', 'pronto copec'], 'Tienda de conveniencia de estación de servicio (snacks, café, bebidas), no combustible.'],
  [['big john'], 'Big John: minimarket de conveniencia.'],
  [['cornershop'], 'Cornershop: app de compras de supermercado a domicilio.'],
  [['frutos del maipo', 'la vega', 'lo valledor'], 'Mercado/feria de frutas, verduras y abarrotes.'],

  // Farmacias y salud
  [['cruz verde'], 'Cruz Verde: cadena de farmacias.'],
  [['salcobrand'], 'Salcobrand: cadena de farmacias.'],
  [['ahumada', 'farmacias ahumada'], 'Farmacias Ahumada: cadena de farmacias.'],
  [['dr simi', 'doctor simi', 'farmacias similares'], 'Dr. Simi: cadena de farmacias de bajo costo.'],
  [['knop'], 'Farmacias Knop: farmacia de productos naturales.'],
  [['preunic'], 'Preunic: tienda de perfumería, cosmética y cuidado personal.'],
  [['maicao'], 'Maicao: tienda de perfumería, cosmética y cuidado personal.'],
  [['clinica alemana', 'clinica las condes', 'clinica santa maria', 'clinica davila', 'clinica indisa', 'redsalud', 'integramedica', 'uc christus', 'megasalud', 'vidaintegra'], 'Clínica o centro médico privado (consultas, exámenes, atenciones de salud).'],
  [['isapre', 'colmena', 'banmedica', 'consalud', 'cruz blanca', 'nueva masvida', 'vida tres', 'fonasa'], 'Sistema previsional de salud (Isapre/Fonasa): cotización o plan de salud.'],
  [['optica', 'rotter krauss', 'opticas gmo', 'gmo'], 'Óptica: lentes y exámenes de la vista.'],

  // Retail, tiendas por departamento y hogar
  [['falabella'], 'Falabella: tienda por departamento (ropa, tecnología, hogar); también banco/tarjeta CMR.'],
  [['ripley'], 'Ripley: tienda por departamento (ropa, tecnología, hogar); también banco/tarjeta Ripley.'],
  [['paris'], 'Paris: tienda por departamento (Cencosud): ropa, tecnología, hogar.'],
  [['la polar'], 'La Polar: tienda por departamento (ropa, tecnología, hogar).'],
  [['hites'], 'Hites: tienda por departamento.'],
  [['abcdin', 'abc din'], 'ABCDin: tienda de electrodomésticos, tecnología y hogar.'],
  [['sodimac', 'homecenter'], 'Sodimac: tienda de mejoramiento del hogar, construcción y ferretería.'],
  [['easy'], 'Easy: tienda de mejoramiento del hogar y construcción (Cencosud).'],
  [['construmart', 'imperial', 'chilemat', 'mts'], 'Tienda de materiales de construcción y ferretería.'],
  [['ikea'], 'IKEA: tienda de muebles y artículos para el hogar.'],
  [['casaideas', 'casa ideas'], 'Casaideas: tienda de artículos y decoración para el hogar.'],
  [['rosen', 'cic', 'flex'], 'Tienda de colchones y camas.'],
  [['daiso', 'miniso'], 'Tienda de artículos variados de bajo costo (hogar, regalos, accesorios).'],
  [['lapiz lopez', 'librerias antartica', 'antartica', 'feria chilena del libro', 'buscalibre', 'contrapunto'], 'Librería o papelería (libros, útiles).'],

  // Ropa, calzado y deporte
  [['h m', 'hm', 'zara', 'mango', 'forever 21', 'bershka', 'pull bear', 'stradivarius', 'tricot', 'corona', 'fashions park', 'family shop', 'gef', 'basement', 'sybilla', 'americanino', 'mossimo', 'uniqlo', 'shein', 'dijon'], 'Tienda de ropa y moda.'],
  [['bata', 'hush puppies', 'guante', 'aldo', 'skechers', 'crocs', 'vans', 'converse'], 'Tienda de calzado.'],
  [['decathlon', 'nike', 'adidas', 'puma', 'under armour', 'the north face', 'columbia', 'lippi', 'doite', 'andesgear', 'marmot', 'patagonia', 'sparta'], 'Tienda de artículos deportivos, outdoor o ropa deportiva.'],

  // Tecnología
  [['pc factory', 'pcfactory'], 'PC Factory: tienda de computación y tecnología.'],
  [['mac online', 'maconline', 'ishop', 'apple store'], 'Tienda/servicio de productos Apple.'],
  [['samsung', 'xiaomi', 'sp digital', 'spdigital', 'microplay', 'weplay', 'zmart'], 'Tienda de tecnología, electrónica o videojuegos.'],

  // Marketplaces y compras online
  [['mercadolibre', 'mercado libre', 'meli'], 'Mercado Libre: marketplace online (el producto comprado es desconocido).'],
  [['aliexpress', 'temu', 'amazon', 'ebay', 'linio', 'dafiti'], 'Marketplace o tienda online (el producto comprado es desconocido).'],

  // Delivery y apps de comida
  [['uber eats', 'ubereats'], 'Uber Eats: delivery de comida (no es viaje de Uber).'],
  [['rappi'], 'Rappi: app de delivery de comida, supermercado y farmacia.'],
  [['pedidosya', 'pedidos ya'], 'PedidosYa: app de delivery de comida y supermercado.'],
  [['justo'], 'Justo: plataforma de pedidos directos a restaurantes.'],
  [['didi food'], 'DiDi Food: delivery de comida.'],

  // Comida rápida, cafés y restaurantes
  [['mcdonalds', 'mc donalds', 'burger king', 'kfc', 'wendys', 'subway', 'taco bell', 'carls jr', 'popeyes', 'five guys', 'johnny rockets'], 'Cadena de comida rápida.'],
  [['dominos', 'papa johns', 'pizza hut', 'telepizza', 'little caesars', 'melt pizzas', 'melt'], 'Cadena de pizzerías.'],
  [['doggis', 'juan maestro', 'domino', 'lomiton', 'schopdog', 'fuente alemana', 'fuente mardoqueo', 'tip y tap', 'la fuente chilena', 'fuente de soda'], 'Local chileno de completos/sándwiches (comida rápida).'],
  [['tarragona', 'bravissimo', 'emporio la rosa', 'freddo', 'palette', 'amorino', 'cremino', 'mimo'], 'Heladería.'],
  [['starbucks', 'juan valdez', 'dunkin', 'cafe haiti', 'cafe caribe', 'tavelli', 'castano', 'colonia', 'la fete', 'cafe altura'], 'Cafetería.'],
  [['niu sushi', 'sushi', 'mr sushi', 'tanta', 'liguria', 'la piojera', 'el hoyo', 'bar nacional'], 'Restaurante o bar.'],
  [['cerveceria', 'botilleria', 'la vinoteca', 'mundo del vino'], 'Botillería o tienda de alcohol.'],

  // Transporte
  [['uber', 'uber trip', 'uber rides'], 'Uber: viaje en auto por app (transporte). Distinto de Uber Eats.'],
  [['didi', 'cabify', 'indrive', 'beat'], 'App de viajes en auto (transporte).'],
  [['metro', 'bip', 'tarjeta bip', 'metrotren', 'efe', 'red movilidad', 'transantiago'], 'Transporte público (Metro de Santiago, tarjeta Bip!, trenes EFE, buses Red).'],
  [['copec', 'shell', 'petrobras', 'aramco', 'enex', 'terpel'], 'Estación de servicio: bencina/combustible (salvo que el detalle diga tienda de conveniencia).'],
  [['autopista', 'costanera norte', 'vespucio', 'autopista central', 'tag', 'autovia', 'ruta 68', 'ruta 5', 'peaje', 'pase diario'], 'Autopista/TAG/peaje (transporte en auto).'],
  [['estacionamiento', 'parking', 'saba', 'central parking', 'republic parking'], 'Estacionamiento.'],
  [['turbus', 'tur bus', 'pullman', 'jac', 'condor bus', 'eme bus', 'buses'], 'Empresa de buses interurbanos.'],
  [['latam', 'sky airline', 'jetsmart', 'jet smart', 'aerolineas argentinas', 'american airlines', 'iberia'], 'Aerolínea (pasajes de avión).'],
  [['despegar', 'booking', 'airbnb', 'expedia', 'hotels com', 'cocha'], 'Agencia/plataforma de viajes o alojamiento.'],
  [['bird', 'lime', 'mobike', 'bike santiago'], 'Arriendo de scooters o bicicletas.'],

  // Servicios básicos, telecom y hogar
  [['enel', 'cge', 'chilquinta', 'saesa', 'frontel'], 'Compañía eléctrica (cuenta de la luz).'],
  [['aguas andinas', 'esval', 'essbio', 'aguas del valle', 'nuevosur', 'smapa'], 'Compañía sanitaria (cuenta del agua).'],
  [['metrogas', 'lipigas', 'abastible', 'gasco'], 'Gas (cuenta del gas de cañería o cilindro).'],
  [['entel', 'movistar', 'wom', 'claro', 'vtr', 'mundo pacifico', 'gtd', 'virgin mobile'], 'Compañía de telecomunicaciones (celular, internet, TV).'],
  [['directv', 'dgo', 'zapping'], 'Servicio de TV pagada/streaming de TV.'],
  [['gastos comunes', 'edipro', 'comunidad feliz', 'kastor', 'administracion edificio'], 'Gastos comunes del edificio/condominio.'],
  [['contribuciones', 'tgr', 'tesoreria'], 'Tesorería General de la República: impuestos, contribuciones o pagos fiscales.'],
  [['sii'], 'Servicio de Impuestos Internos (impuestos).'],
  [['registro civil', 'srcei'], 'Registro Civil (trámites, certificados, carnet).'],
  [['permiso de circulacion', 'municipalidad', 'muni'], 'Municipalidad: permisos de circulación, patentes o trámites municipales.'],

  // Suscripciones y entretención
  [['netflix', 'disney', 'hbo', 'hbo max', 'prime video', 'star plus', 'paramount', 'crunchyroll', 'mubi', 'apple tv'], 'Suscripción de streaming de video.'],
  [['spotify', 'deezer', 'apple music', 'youtube premium', 'tidal'], 'Suscripción de streaming de música.'],
  [['chatgpt', 'openai', 'anthropic', 'claude', 'notion', 'google one', 'icloud', 'dropbox', 'adobe', 'canva', 'microsoft', 'github'], 'Suscripción de software o servicio digital.'],
  [['playstation', 'psn', 'xbox', 'nintendo', 'steam', 'epic games'], 'Videojuegos (compras o suscripción).'],
  [['cinemark', 'cineplanet', 'cinepolis', 'cine hoyts', 'hoyts', 'cinemundo'], 'Cine.'],
  [['puntoticket', 'ticketmaster', 'passline', 'eventrid', 'ticketplus', 'joinnus'], 'Venta de entradas para eventos/conciertos.'],
  [['smart fit', 'smartfit', 'sportlife', 'energy fitness', 'pacific fitness', 'o2 fitness', 'bodytech', 'crossfit'], 'Gimnasio.'],
  [['jardin infantil', 'colegio', 'universidad', 'duoc', 'inacap', 'udd', 'uai', 'uandes', 'usach', 'uchile'], 'Institución educacional (matrícula, mensualidad, arancel).'],

  // Mascotas
  [['superzoo', 'pet happy', 'petco', 'club de perros y gatos', 'tusmascotas', 'veterinaria', 'vet'], 'Tienda de mascotas o veterinaria.'],

  // Finanzas, pagos e intermediarios (el comercio real puede estar después)
  [['mercado pago', 'mercadopago', 'merpago'], 'Mercado Pago: procesador de pagos; el comercio real suele aparecer a continuación en el detalle.'],
  [['sumup', 'tuu', 'getnet', 'transbank', 'webpay', 'onepay', 'flow', 'khipu', 'payu', 'klap', 'mach', 'tenpo', 'fpay'], 'Procesador de pagos o billetera: intermediario; el comercio real suele aparecer a continuación en el detalle.'],
  [['afp', 'provida', 'habitat', 'afp capital', 'cuprum', 'afp modelo', 'planvital', 'afp uno'], 'AFP: ahorro previsional.'],
  [['fintual', 'racional', 'renta4', 'buda', 'orionx', 'cryptomkt', 'coinbase', 'binance'], 'Plataforma de inversión o criptomonedas.'],
  [['servipag', 'caja vecina', 'unired', 'sencillito'], 'Recaudador de pagos de cuentas; el servicio pagado puede aparecer en el detalle.'],

  // Belleza y cuidado personal
  [['peluqueria', 'barberia', 'manicure', 'depilacion'], 'Peluquería, barbería o centro de belleza.'],
  [['sephora', 'mac cosmetics', 'the body shop', 'natura', 'avon', 'loreal'], 'Tienda de cosmética y cuidado personal.'],
]

// Ambiguous words that also appear as ordinary text in details. They only count
// when the detail mentions nothing else we recognize.
const weakAliases = new Set(['paris', 'easy', 'flex', 'cic', 'vet', 'muni', 'tag', 'bip', 'metro', 'uber', 'beat', 'lime', 'bird', 'corona', 'imperial', 'colonia', 'melt', 'buses', 'mts', 'efe', 'jac', 'justo', 'sushi', 'flow', 'mach', 'energy', 'apple', 'capital', 'gmo', 'upa', 'claude', 'max'])

const index = merchants.flatMap(([aliases, description]) =>
  aliases.map(alias => ({ alias: normalizeMerchant(alias), description })))
  // Longer aliases first so "uber eats" beats "uber" and "lider express" beats "lider".
  .sort((a, b) => b.alias.length - a.alias.length)

export function chileanMerchantContext(detail: string): string[] {
  let text = ` ${normalizeMerchant(detail)} `
  const strong: string[] = []
  const weak: string[] = []
  for (const { alias, description } of index) {
    if (!text.includes(` ${alias} `)) continue
    // Consume the match so a shorter alias inside it doesn't also fire.
    text = text.replace(` ${alias} `, '  ')
    const bucket = weakAliases.has(alias) ? weak : strong
    if (!bucket.includes(description)) bucket.push(description)
  }
  return (strong.length ? strong : weak).slice(0, 3)
}
