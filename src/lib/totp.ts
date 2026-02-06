/**
 * TOTP (RFC 6238) using Web Crypto API for extension/browser.
 * Step = 30s, 6-digit code.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.replace(/\s/g, '').toUpperCase();
  const bits: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    for (let b = 4; b >= 0; b--) bits.push((idx >> b) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

function dynamicTruncation(hmac: ArrayBuffer): number {
  const bytes = new Uint8Array(hmac);
  const offset = bytes[bytes.length - 1] & 0x0f;
  return (
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff)
  );
}

export async function generateTOTP(secretBase32: string, stepSeconds = 30): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setUint32(4, counter, false);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const code = dynamicTruncation(sig) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function getTimeRemaining(stepSeconds = 30): number {
  return stepSeconds - (Math.floor(Date.now() / 1000) % stepSeconds);
}
