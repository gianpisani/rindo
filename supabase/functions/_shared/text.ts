export const BANK_IMPORT_MARK = '🤖'
export const WALLET_MARK = '📱'

export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function withoutImportMark(detail: string): string {
  return detail.replace(/^[🤖📱]\s*/u, '')
}
