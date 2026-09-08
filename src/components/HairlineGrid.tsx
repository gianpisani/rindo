import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────
   La grilla de línea de pelo
   ─────────────────────────────────────────────────────────────────────
   Las tres piezas con las que se arma cualquier página de rindo.

   La idea: los paneles no flotan sobre el fondo separados por aire. Se
   topan entre sí, y lo único que los separa es 1px. El truco es que
   **las líneas SON los gaps**: el contenedor se pinta del color del
   borde (`bg-border`) y los hijos del color de la tarjeta (`bg-card`),
   así que el gap de 1px queda a la vista como una línea dibujada.

   Ventaja de hacerlo así y no con 40 `border` escritos a mano: las
   líneas salen del mismo token (`--border`) que el resto de la app, no
   se duplican donde dos paneles se tocan, y no hay nada que se pueda
   desincronizar.

   Uso típico:

     <Layout bleed>
       <Screen>
         <Row className="lg:flex-[4_1_0%] lg:grid-cols-[1.35fr_1fr]">
           <Panel className="px-5 py-5">…</Panel>
           <Panel className="px-5 py-5">…</Panel>
         </Row>
         <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">…</Row>
         <Row className="lg:min-h-0 lg:flex-[7_1_0%]">…</Row>
       </Screen>
     </Layout>

   Si una fila es un solo panel a lo ancho, el Panel va directo como hijo
   de Screen: no hace falta envolverlo en un Row para nada.
   ───────────────────────────────────────────────────────────────────── */

/**
 * La celda. El padding vive acá, no en cada hijo.
 *
 * `min-h-0` y `min-w-0` no son decorativos: sin ellos un item de grid no
 * baja de la altura (ni del ancho) de su contenido, y la fila flexible no
 * podría ceder espacio ni truncar texto largo.
 */
export function Panel({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-h-0 min-w-0 bg-card", className)} style={style}>
      {children}
    </div>
  );
}

/**
 * La fila. Su gap es la línea.
 *
 * Sin `grid-cols-*` es una sola columna (una fila a lo ancho). Con
 * `lg:grid-cols-[1.5fr_1fr]` se parte en paneles, y el gap de 1px entre
 * ellos es la línea vertical.
 */
export function Row({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-px bg-border", className)}>{children}</div>
  );
}

/**
 * La primera pantalla, por construcción.
 *
 * Alto exacto: viewport menos el header de `Layout` (h-14 = 3.5rem). Las
 * filas que lleven `lg:shrink-0` miden lo que su contenido; las que
 * lleven `lg:flex-1` (o `lg:flex-[N_1_0%]`) se reparten todo lo que
 * sobre. Así **ni el contenido ni el tamaño de la ventana pueden empujar
 * nada abajo del pliegue** — no hay presupuesto de píxeles que adivinar.
 *
 * Debajo de `lg` no aplica nada de esto: apilado en un teléfono el
 * contenido no cabe ni forzándolo, y ahí el scroll es lo correcto.
 *
 * Requisitos para que la cadena de flex no se corte:
 *  - `Layout` tiene que ir con `bleed` (si no, su padding rompe la cuenta)
 *  - la fila que cede necesita `lg:min-h-0` además de su `flex`
 *  - lo que scrollea adentro de un panel necesita `min-h-0 flex-1`
 *
 * El `min-h` evita que en una ventana muy baja el contenido flexible
 * quede aplastado a una línea; ahí es mejor que la página scrollee.
 */
export function Screen({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:min-h-[620px]",
        className
      )}
    >
      {/* El contenedor pintado del color del borde: cada fila aporta su
          gap de 1px y los paneles tapan el resto. Solo lleva borde abajo
          porque arriba topa con el header, a la izquierda con el sidebar
          y a la derecha con el canto de la ventana. */}
      <div className="flex min-h-0 flex-1 flex-col gap-px border-b border-border bg-border">
        {children}
      </div>
    </div>
  );
}
