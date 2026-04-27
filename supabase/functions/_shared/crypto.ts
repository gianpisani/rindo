/**
 * Cryptographic utilities for bank sync credential management.
 * Uses Web Crypto API (built-in Deno, zero dependencies).
 *
 * Two independent keys:
 *   BANK_CREDENTIALS_ENCRYPTION_KEY — at-rest encryption (edge function ↔ database)
 *   CREDENTIALS_TRANSIT_KEY         — transit encryption (edge function ↔ Open Banking API)
 *
 * Format: base64(iv[12] || ciphertext || authTag[16])
 */

const ALGORITHM = "AES-GCM"
const IV_LENGTH = 12   // 96-bit IV, recommended for GCM
const TAG_LENGTH = 128 // auth tag bits

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToKey(hexKey: string): Promise<CryptoKey> {
  const raw = hexToBytes(hexKey)
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM }, false, ["encrypt", "decrypt"])
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((s, b) => s + b.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of bufs) {
    out.set(b, offset)
    offset += b.length
  }
  return out
}

async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await hexToKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, encoded)
  const blob = concatBuffers(iv, new Uint8Array(ciphertext))
  return btoa(String.fromCharCode(...blob))
}

async function decrypt(base64Blob: string, hexKey: string): Promise<string> {
  const key = await hexToKey(hexKey)
  const blob = Uint8Array.from(atob(base64Blob), (c) => c.charCodeAt(0))
  const iv = blob.subarray(0, IV_LENGTH)
  const ciphertext = blob.subarray(IV_LENGTH)
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

// ── At-rest encryption (edge function ↔ database) ────────────────────────────

/**
 * Encrypts a bank password for storage in the database.
 * Uses BANK_CREDENTIALS_ENCRYPTION_KEY env var.
 */
export async function encryptPassword(password: string): Promise<string> {
  const key = Deno.env.get("BANK_CREDENTIALS_ENCRYPTION_KEY")
  if (!key) throw new Error("BANK_CREDENTIALS_ENCRYPTION_KEY not configured")
  return encrypt(password, key)
}

/**
 * Decrypts a bank password retrieved from the database.
 * Uses BANK_CREDENTIALS_ENCRYPTION_KEY env var.
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  const key = Deno.env.get("BANK_CREDENTIALS_ENCRYPTION_KEY")
  if (!key) throw new Error("BANK_CREDENTIALS_ENCRYPTION_KEY not configured")
  return decrypt(encrypted, key)
}

// ── Transit encryption (edge function ↔ Open Banking API) ────────────────────

/**
 * Encrypts { rut, password } into a single base64 blob for sending to the Open Banking API.
 * Uses CREDENTIALS_TRANSIT_KEY env var.
 */
export async function encryptForTransit(rut: string, password: string): Promise<string> {
  const key = Deno.env.get("CREDENTIALS_TRANSIT_KEY")
  if (!key) throw new Error("CREDENTIALS_TRANSIT_KEY not configured")
  return encrypt(JSON.stringify({ rut, password }), key)
}
