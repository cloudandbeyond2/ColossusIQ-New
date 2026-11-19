import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits) and the
 * encryption of stored secrets (AES-256-GCM with a key derived from MFA_ENCRYPTION_KEY).
 */

const STEP = 30;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function totp(secret: Uint8Array, at = Date.now(), offset = 0): string {
  const counter = Math.floor(at / 1000 / STEP) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", Buffer.from(secret)).update(buf).digest();
  const o = mac[mac.length - 1]! & 0x0f;
  const code = ((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}

/** Accepts the current code and one step either side (clock drift). */
export function verifyTotp(secret: Uint8Array, code: string, at = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let ok = false;
  for (const off of [-1, 0, 1]) {
    const expected = Buffer.from(totp(secret, at, off));
    if (timingSafeEqual(expected, Buffer.from(code))) ok = true;
  }
  return ok;
}

export function newTotpSecret(): Uint8Array {
  return new Uint8Array(randomBytes(20));
}

export function otpauthUri(secret: Uint8Array, account: string, issuer = "ColossusIQ"): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${base32(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}

function key(): Buffer {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (!k || k.length < 32) throw new Error("MFA_ENCRYPTION_KEY (32+ characters) is required to store or check authenticator secrets");
  return createHash("sha256").update(k).digest();
}

/** iv (12) ‖ tag (16) ‖ ciphertext */
export function encryptSecret(secret: Uint8Array): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(secret), c.final()]);
  return new Uint8Array(Buffer.concat([iv, c.getAuthTag(), body]));
}

export function decryptSecret(blob: Uint8Array): Uint8Array {
  const b = Buffer.from(blob);
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return new Uint8Array(Buffer.concat([d.update(b.subarray(28)), d.final()]));
}
