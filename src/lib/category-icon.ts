import { CARD_PAYMENT_ICON, isCardPaymentCategory } from "./ledger";

const FALLBACK_ICON = "🏷️";

const CATEGORY_ICONS: Record<string, string> = {
  comida: "🍔",
  alimentación: "🍔",
  restaurante: "🍽️",
  almuerzo: "🍽️",
  cena: "🍽️",
  café: "☕",
  coffee: "☕",
  bar: "🍺",
  bebida: "🥤",
  transporte: "🚗",
  movilización: "🚗",
  taxi: "🚕",
  metro: "🚇",
  bencina: "⛽",
  gasolina: "⛽",
  estacionamiento: "🅿️",
  ropa: "👕",
  vestuario: "👗",
  calzado: "👟",
  moda: "👗",
  salud: "💊",
  médico: "🏥",
  farmacia: "💊",
  clínica: "🏥",
  dental: "🦷",
  deporte: "🏋️",
  gimnasio: "🏋️",
  fitness: "🏋️",
  entretenimiento: "🎬",
  cine: "🎬",
  teatro: "🎭",
  concierto: "🎵",
  streaming: "📺",
  netflix: "📺",
  spotify: "🎵",
  música: "🎵",
  educación: "📚",
  universidad: "🎓",
  curso: "📚",
  libro: "📖",
  viaje: "✈️",
  viajes: "✈️",
  hotel: "🏨",
  turismo: "🗺️",
  hospedaje: "🏨",
  supermercado: "🛒",
  mercado: "🛒",
  almacén: "🛒",
  tecnología: "💻",
  electrónica: "💻",
  computación: "💻",
  celular: "📱",
  mascota: "🐾",
  mascotas: "🐾",
  veterinario: "🐾",
  hogar: "🏠",
  arriendo: "🏠",
  casa: "🏠",
  muebles: "🪑",
  servicios: "💡",
  agua: "💧",
  internet: "📶",
  suscripción: "🔄",
  suscripciones: "🔄",
  ahorro: "💰",
  inversión: "📈",
  fondos: "📈",
  fintual: "📈",
  sueldo: "💵",
  salario: "💵",
  ingreso: "💵",
  regalo: "🎁",
  cumpleaños: "🎂",
  deuda: "💳",
  crédito: "💳",
  seguro: "🛡️",
  peluquería: "✂️",
  belleza: "💅",
  "sin categoría": "❓",
  transferencia: "↔️",
};

export function getCategoryIcon(name: string): string {
  if (!name) return FALLBACK_ICON;
  if (isCardPaymentCategory(name)) return CARD_PAYMENT_ICON;
  const lower = name.toLowerCase();
  if (CATEGORY_ICONS[lower]) return CATEGORY_ICONS[lower];
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return FALLBACK_ICON;
}

export function categoriesInUse(
  transactions: { category_name: string }[],
  categories: { name: string; icon?: string | null }[],
) {
  return Array.from(new Set(transactions.map((t) => t.category_name).filter((name) => name && name.trim().length > 0)))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, emoji: categories.find((c) => c.name === name)?.icon || getCategoryIcon(name) }));
}
