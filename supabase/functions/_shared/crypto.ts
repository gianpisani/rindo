const ALGORITHM = 'AES-GCM'
const GCM_IV_BYTES = 12
const GCM_TAG_BITS = 128

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function hexToKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', hexToBytes(hexKey), { name: ALGORITHM }, false, ['encrypt', 'decrypt'])
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(bufs.reduce((s, b) => s + b.length, 0))
  let offset = 0
  for (const b of bufs) {
    out.set(b, offset)
    offset += b.length
  }
  return out
}

async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await hexToKey(hexKey)
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: GCM_TAG_BITS }, key, new TextEncoder().encode(plaintext))
  return btoa(String.fromCharCode(...concatBuffers(iv, new Uint8Array(ciphertext))))
}

async function decrypt(base64Blob: string, hexKey: string): Promise<string> {
  const key = await hexToKey(hexKey)
  const blob = Uint8Array.from(atob(base64Blob), (c) => c.charCodeAt(0))
  const iv = blob.subarray(0, GCM_IV_BYTES)
  const ciphertext = blob.subarray(GCM_IV_BYTES)
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: GCM_TAG_BITS }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

function keyFromEnv(name: string): string {
  const key = Deno.env.get(name)
  if (!key) throw new Error(`${name} not configured`)
  return key
}

const AT_REST_KEY = 'BANK_CREDENTIALS_ENCRYPTION_KEY'
const TRANSIT_KEY = 'CREDENTIALS_TRANSIT_KEY'

export async function encryptPassword(password: string): Promise<string> {
  return encrypt(password, keyFromEnv(AT_REST_KEY))
}

export async function decryptPassword(encrypted: string): Promise<string> {
  return decrypt(encrypted, keyFromEnv(AT_REST_KEY))
}

export async function encryptForTransit(rut: string, password: string): Promise<string> {
  return encrypt(JSON.stringify({ rut, password }), keyFromEnv(TRANSIT_KEY))
}
