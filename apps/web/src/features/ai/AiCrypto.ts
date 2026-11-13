const Crypto = globalThis.crypto as Crypto

const SALT_LENGTH = 16
const IV_LENGTH = 12

export async function encryptWithWebCrypto(plaintext: string, password?: string): Promise<string> {
  const keyMaterial = await Crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password ?? 'logixzen-default-key'),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const salt = Crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = Crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const key = await Crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const encrypted = await Crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )

  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decryptWithWebCrypto(encrypted: string, password?: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)

  const keyMaterial = await Crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password ?? 'logixzen-default-key'),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const key = await Crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const decrypted = await Crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(decrypted)
}
