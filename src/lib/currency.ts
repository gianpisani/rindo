// Formato de plata en pesos chilenos. Estaba redefinido en cada archivo que
// muestra montos; acá queda una sola versión para lo nuevo.

/** Monto ya numérico listo para mostrar: 12400 → "$12.400". */
export const fmt = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;

/** Máscara para inputs: lo que se tipea se muestra como "$1.234". */
export const formatCurrencyInput = (value: string) => {
  const number = value.replace(/\D/g, "");
  if (!number) return "";
  return `$${new Intl.NumberFormat("es-CL").format(parseInt(number))}`;
};

/** Inversa de formatCurrencyInput: "$1.234" → 1234. */
export const parseRawAmount = (value: string) => {
  const clean = value.replace(/[$.,\s]/g, "");
  return parseFloat(clean) || 0;
};
