import { md5 } from 'js-md5';

export type ShaAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512';

async function shaDigest(algo: ShaAlgo, text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(algo, enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashText(text: string): Promise<{ md5: string; sha1: string; sha256: string; sha512: string }> {
  const [sha1, sha256, sha512] = await Promise.all([
    shaDigest('SHA-1', text),
    shaDigest('SHA-256', text),
    shaDigest('SHA-512', text),
  ]);
  return {
    md5: md5(text),
    sha1,
    sha256,
    sha512,
  };
}

export function generateUuidV4(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuids(count: number): string[] {
  const n = Math.min(100, Math.max(1, Math.floor(count)));
  return Array.from({ length: n }, () => generateUuidV4());
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()-_=+[]{};:,.?/';

export type PasswordOptions = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  special: boolean;
};

export function generatePassword(opts: PasswordOptions): string {
  let pool = '';
  if (opts.lower) pool += LOWER;
  if (opts.upper) pool += UPPER;
  if (opts.digits) pool += DIGITS;
  if (opts.special) pool += SPECIAL;
  if (!pool) pool = LOWER + UPPER + DIGITS;

  const len = Math.min(64, Math.max(8, Math.floor(opts.length)));
  const out: string[] = [];
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) {
    out.push(pool[bytes[i]! % pool.length]);
  }
  return out.join('');
}
