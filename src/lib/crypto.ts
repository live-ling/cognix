/**
 * Password encryption utilities using Web Crypto API (AES-256-GCM).
 * Passwords are encrypted before storing in localStorage.
 */

const STORAGE_KEY = 'cognix_encrypted_password';
const SALT_KEY = 'cognix_crypto_salt';
const APP_SECRET = 'Cognix@2024!SecureKey#v1';

/** Generate a device fingerprint from browser characteristics */
function getDeviceFingerprint(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : {} as Navigator;
  return [
    nav.userAgent || '',
    nav.language || '',
    (nav as any).platform || '',
    location.origin,
    APP_SECRET,
  ].join('|');
}

/** Get or create the PBKDF2 salt (stored in localStorage) */
function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));
  return salt;
}

/** Derive an AES-256-GCM key from device fingerprint + salt */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getDeviceFingerprint()),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a password string, returns JSON string for localStorage */
export async function encryptPassword(password: string): Promise<string> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(password);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return JSON.stringify({
    ct: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  });
}

/** Decrypt a previously encrypted password */
export async function decryptPassword(data: string): Promise<string> {
  const { ct, iv } = JSON.parse(data);
  const salt = getOrCreateSalt();
  const key = await deriveKey(salt);
  const cipherBytes = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes);
  return new TextDecoder().decode(decrypted);
}

/** Save encrypted password to localStorage */
export async function saveEncryptedPassword(password: string): Promise<void> {
  const encrypted = await encryptPassword(password);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

/** Load and decrypt password from localStorage. Returns null if not found or decryption fails. */
export async function loadDecryptedPassword(): Promise<string | null> {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return await decryptPassword(data);
  } catch {
    // Decryption failed (e.g., salt changed, data corrupted)
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** Remove encrypted password from localStorage */
export function removeEncryptedPassword(): void {
  localStorage.removeItem(STORAGE_KEY);
}
