const BOT_PREFIX = "🤖";

export const isBotDetail = (detail?: string | null) => (detail || "").startsWith(BOT_PREFIX);

export const detailToSave = (original: string | null | undefined, next: string) =>
  next ? (isBotDetail(original) ? `${BOT_PREFIX} ${next}` : next) : null;
