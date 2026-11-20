const GENERIC_MESSAGE = "Algo salió mal. Intenta de nuevo.";
const OFFLINE_MESSAGE = "Sin conexión. Intenta de nuevo.";

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message !== "";

export function errorMessage(error: unknown) {
  if (!hasMessage(error)) return GENERIC_MESSAGE;
  if (/failed to fetch|network|load failed/i.test(error.message)) return OFFLINE_MESSAGE;
  return error.message;
}

export class MissingRowsError extends Error {
  constructor(readonly missing: number) {
    super(missing === 1 ? "Ese movimiento ya no existe." : "Algunos movimientos ya no existen.");
    this.name = "MissingRowsError";
  }
}
