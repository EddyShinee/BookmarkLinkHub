/** Đăng nhập sinh trắc học (Touch ID / Face ID trên macOS, Windows Hello trên Windows).
 *
 * Cách hoạt động:
 * - Dùng WebAuthn platform authenticator (`navigator.credentials`) để yêu cầu người dùng
 *   xác thực bằng vân tay / khuôn mặt / PIN của hệ điều hành.
 * - Thông tin đăng nhập LinkHub (email + mật khẩu) được mã hoá AES-GCM và lưu trong
 *   chrome.storage.local (hoặc localStorage khi chạy dạng web).
 * - Khoá AES ưu tiên lấy từ extension `prf` của WebAuthn: khoá này chỉ được authenticator
 *   trả về sau khi xác thực sinh trắc học thành công và không bao giờ nằm trên disk.
 *   Nếu authenticator/OS chưa hỗ trợ PRF (ví dụ Windows Hello bản cũ), khoá AES ngẫu nhiên
 *   được lưu cạnh dữ liệu mã hoá — lúc này sinh trắc học là "cổng chặn" chứ không phải
 *   nguồn sinh khoá (mức bảo vệ tương đương session Supabase đang lưu sẵn trong máy).
 *
 * Module này chỉ quản lý kho khoá + nghi thức WebAuthn. Việc gọi Supabase để đăng nhập
 * do UI thực hiện (xem `src/pages/Login.tsx`).
 */
import { chromeStorageAdapter } from './chromeStorageAdapter';

const STORAGE_KEY = 'linkhub_biometric_v1';

/** RP ID dùng khi trang chạy trên chrome-extension:// (phải thuộc host_permissions). */
const EXTENSION_RP_ID = 'bookmark-link-hub.vercel.app';

const HKDF_INFO = 'linkhub-biometric-vault-v1';

export type BiometricPlatform = 'macos' | 'windows' | 'other';

export type BiometricErrorCode =
  | 'unsupported'
  | 'no_credentials'
  | 'cancelled'
  | 'already_enrolled'
  | 'prf_unavailable'
  | 'unknown_credential'
  | 'decrypt_failed'
  | 'storage_failed'
  | 'unknown';

export class BiometricError extends Error {
  code: BiometricErrorCode;

  constructor(code: BiometricErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'BiometricError';
    this.code = code;
  }
}

interface StoredCredential {
  /** Credential ID (base64url) trả về từ authenticator. */
  id: string;
  label: string;
  platform: BiometricPlatform;
  email: string;
  createdAt: number;
  lastUsedAt: number | null;
  /** 'prf': khoá sinh từ authenticator. 'local': khoá ngẫu nhiên lưu kèm. */
  keyMode: 'prf' | 'local';
  /** Input cho PRF (base64). */
  prfSalt: string;
  /** Khoá AES raw (base64) — chỉ tồn tại khi keyMode === 'local'. */
  localKey?: string;
  iv: string;
  ciphertext: string;
  rpId: string;
}

/** Thông tin hiển thị trong Settings (không chứa dữ liệu mã hoá). */
export interface BiometricCredentialInfo {
  id: string;
  label: string;
  platform: BiometricPlatform;
  email: string;
  createdAt: number;
  lastUsedAt: number | null;
  keyMode: 'prf' | 'local';
}

export interface BiometricSecret {
  email: string;
  password: string;
}

/* ------------------------------------------------------------------ helpers */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Uint8Array -> BufferSource "sạch" (tránh SharedArrayBuffer trong type WebAuthn). */
function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function detectBiometricPlatform(): BiometricPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const uaPlatform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  const ua = `${uaPlatform} ${navigator.userAgent ?? ''}`.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'other';
}

/** Máy có platform authenticator (Touch ID / Face ID / Windows Hello) khả dụng hay không. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function resolveRpId(): string {
  if (typeof window === 'undefined') return EXTENSION_RP_ID;
  const { protocol, hostname } = window.location;
  if (protocol === 'http:' || protocol === 'https:') return hostname;
  // chrome-extension:// — RP ID phải là domain nằm trong host_permissions.
  return EXTENSION_RP_ID;
}

/* ------------------------------------------------------------------ storage */

async function readAll(): Promise<StoredCredential[]> {
  const raw = await chromeStorageAdapter.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StoredCredential => {
      return (
        !!entry &&
        typeof entry.id === 'string' &&
        typeof entry.ciphertext === 'string' &&
        typeof entry.iv === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function writeAll(entries: StoredCredential[]): Promise<void> {
  try {
    await chromeStorageAdapter.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    throw new BiometricError('storage_failed');
  }
}

function toInfo(entry: StoredCredential): BiometricCredentialInfo {
  return {
    id: entry.id,
    label: entry.label,
    platform: entry.platform,
    email: entry.email,
    createdAt: entry.createdAt,
    lastUsedAt: entry.lastUsedAt,
    keyMode: entry.keyMode,
  };
}

/** Danh sách credential đã đăng ký trên trình duyệt / profile hiện tại. */
export async function listBiometricCredentials(): Promise<BiometricCredentialInfo[]> {
  const entries = await readAll();
  return entries.sort((a, b) => a.createdAt - b.createdAt).map(toInfo);
}

export async function hasBiometricCredentials(): Promise<boolean> {
  return (await readAll()).length > 0;
}

/* -------------------------------------------------------------------- crypto */

async function deriveKeyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: textEncoder.encode(HKDF_INFO),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importLocalKey(rawBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buffer(fromBase64(rawBase64)), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function encryptSecret(
  key: CryptoKey,
  secret: BiometricSecret
): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(iv) },
    key,
    textEncoder.encode(JSON.stringify(secret))
  );
  return { iv: toBase64(iv), ciphertext: toBase64(encrypted) };
}

async function decryptSecret(key: CryptoKey, entry: StoredCredential): Promise<BiometricSecret> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buffer(fromBase64(entry.iv)) },
      key,
      buffer(fromBase64(entry.ciphertext))
    );
    const parsed = JSON.parse(textDecoder.decode(plain)) as BiometricSecret;
    if (!parsed?.email || typeof parsed.password !== 'string') {
      throw new BiometricError('decrypt_failed');
    }
    return parsed;
  } catch (e) {
    if (e instanceof BiometricError) throw e;
    throw new BiometricError('decrypt_failed');
  }
}

/* ------------------------------------------------------------------ webauthn */

interface PrfExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

function readPrfResult(credential: PublicKeyCredential): ArrayBuffer | null {
  const results = credential.getClientExtensionResults() as PrfExtensionResults;
  return results.prf?.results?.first ?? null;
}

function isPrfEnabled(credential: PublicKeyCredential): boolean {
  const results = credential.getClientExtensionResults() as PrfExtensionResults;
  return results.prf?.enabled === true;
}

function mapCeremonyError(e: unknown): BiometricError {
  if (e instanceof BiometricError) return e;
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
      return new BiometricError('cancelled', e.message);
    }
    if (e.name === 'InvalidStateError') {
      return new BiometricError('already_enrolled', e.message);
    }
    if (e.name === 'NotSupportedError' || e.name === 'SecurityError') {
      return new BiometricError('unsupported', e.message);
    }
  }
  return new BiometricError('unknown', e instanceof Error ? e.message : undefined);
}

async function requestAssertion(
  entries: StoredCredential[],
  rpId: string
): Promise<PublicKeyCredential> {
  const prfEntries = entries.filter((entry) => entry.keyMode === 'prf');
  const evalByCredential: Record<string, { first: ArrayBuffer }> = {};
  for (const entry of prfEntries) {
    evalByCredential[entry.id] = { first: buffer(fromBase64(entry.prfSalt)) };
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: buffer(randomBytes(32)),
    rpId,
    timeout: 60_000,
    userVerification: 'required',
    allowCredentials: entries.map((entry) => ({
      id: buffer(fromBase64Url(entry.id)),
      type: 'public-key' as const,
      transports: ['internal' as AuthenticatorTransport],
    })),
  };

  if (Object.keys(evalByCredential).length > 0) {
    (publicKey as PublicKeyCredentialRequestOptions & { extensions?: unknown }).extensions = {
      prf: { evalByCredential },
    };
  }

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!assertion) throw new BiometricError('cancelled');
  return assertion;
}

async function keyForEntry(
  entry: StoredCredential,
  assertion: PublicKeyCredential
): Promise<CryptoKey> {
  if (entry.keyMode === 'local') {
    if (!entry.localKey) throw new BiometricError('decrypt_failed');
    return importLocalKey(entry.localKey);
  }
  const prfOutput = readPrfResult(assertion);
  if (!prfOutput) throw new BiometricError('prf_unavailable');
  return deriveKeyFromPrf(prfOutput);
}

/* ------------------------------------------------------------------- actions */

export interface EnrollParams {
  email: string;
  password: string;
  label: string;
}

/** Đăng ký một credential sinh trắc học mới cho tài khoản hiện tại. */
export async function enrollBiometricCredential(
  params: EnrollParams
): Promise<BiometricCredentialInfo> {
  if (!(await isBiometricAvailable())) throw new BiometricError('unsupported');

  const rpId = resolveRpId();
  const existing = await readAll();
  const platform = detectBiometricPlatform();
  const prfSalt = randomBytes(32);

  let created: PublicKeyCredential | null;
  try {
    created = (await navigator.credentials.create({
      publicKey: {
        challenge: buffer(randomBytes(32)),
        rp: { id: rpId, name: 'LinkHub' },
        user: {
          id: buffer(randomBytes(32)),
          name: params.email,
          displayName: params.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        attestation: 'none',
        timeout: 60_000,
        excludeCredentials: existing
          .filter((entry) => entry.rpId === rpId)
          .map((entry) => ({
            id: buffer(fromBase64Url(entry.id)),
            type: 'public-key' as const,
            transports: ['internal' as AuthenticatorTransport],
          })),
        extensions: { prf: {} },
      } as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;
  } catch (e) {
    throw mapCeremonyError(e);
  }

  if (!created) throw new BiometricError('cancelled');

  const id = toBase64Url(created.rawId);
  const entry: StoredCredential = {
    id,
    label: params.label.trim() || params.email,
    platform,
    email: params.email,
    createdAt: Date.now(),
    lastUsedAt: null,
    keyMode: 'local',
    prfSalt: toBase64(prfSalt),
    iv: '',
    ciphertext: '',
    rpId,
  };

  let key: CryptoKey | null = null;

  // Một số authenticator trả PRF ngay khi tạo credential; nếu không, thử một assertion
  // để lấy PRF output (thêm một lần xác thực sinh trắc học).
  const createPrf = readPrfResult(created);
  if (createPrf) {
    key = await deriveKeyFromPrf(createPrf);
    entry.keyMode = 'prf';
  } else if (isPrfEnabled(created)) {
    try {
      const assertion = await requestAssertion([{ ...entry, keyMode: 'prf' }], rpId);
      const prfOutput = readPrfResult(assertion);
      if (prfOutput) {
        key = await deriveKeyFromPrf(prfOutput);
        entry.keyMode = 'prf';
      }
    } catch (e) {
      // Người dùng huỷ ở bước này => huỷ luôn việc đăng ký.
      const mapped = mapCeremonyError(e);
      if (mapped.code === 'cancelled') throw mapped;
    }
  }

  if (!key) {
    const rawKey = randomBytes(32);
    entry.keyMode = 'local';
    entry.localKey = toBase64(rawKey);
    key = await importLocalKey(entry.localKey);
  }

  const { iv, ciphertext } = await encryptSecret(key, {
    email: params.email,
    password: params.password,
  });
  entry.iv = iv;
  entry.ciphertext = ciphertext;

  const next = [...existing.filter((item) => item.id !== id), entry];
  await writeAll(next);
  return toInfo(entry);
}

export interface BiometricUnlockResult extends BiometricSecret {
  credentialId: string;
  label: string;
}

/** Yêu cầu xác thực sinh trắc học và trả về thông tin đăng nhập đã giải mã. */
export async function unlockWithBiometrics(): Promise<BiometricUnlockResult> {
  const entries = await readAll();
  if (entries.length === 0) throw new BiometricError('no_credentials');
  if (!(await isBiometricAvailable())) throw new BiometricError('unsupported');

  const rpId = entries[0].rpId ?? resolveRpId();

  let assertion: PublicKeyCredential;
  try {
    assertion = await requestAssertion(entries, rpId);
  } catch (e) {
    throw mapCeremonyError(e);
  }

  const id = toBase64Url(assertion.rawId);
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new BiometricError('unknown_credential');

  const key = await keyForEntry(entry, assertion);
  const secret = await decryptSecret(key, entry);

  entry.lastUsedAt = Date.now();
  await writeAll(entries);

  return { ...secret, credentialId: entry.id, label: entry.label };
}

/** Đổi tên credential (không cần xác thực lại). */
export async function renameBiometricCredential(id: string, label: string): Promise<void> {
  const entries = await readAll();
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new BiometricError('unknown_credential');
  entry.label = label.trim() || entry.email;
  await writeAll(entries);
}

/** Cập nhật email/mật khẩu được lưu cho một credential (khi user đổi mật khẩu). */
export async function updateBiometricSecret(
  id: string,
  secret: BiometricSecret
): Promise<BiometricCredentialInfo> {
  const entries = await readAll();
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new BiometricError('unknown_credential');

  let key: CryptoKey;
  if (entry.keyMode === 'local') {
    if (!entry.localKey) throw new BiometricError('decrypt_failed');
    key = await importLocalKey(entry.localKey);
  } else {
    let assertion: PublicKeyCredential;
    try {
      assertion = await requestAssertion([entry], entry.rpId ?? resolveRpId());
    } catch (e) {
      throw mapCeremonyError(e);
    }
    if (toBase64Url(assertion.rawId) !== entry.id) throw new BiometricError('unknown_credential');
    const prfOutput = readPrfResult(assertion);
    if (!prfOutput) throw new BiometricError('prf_unavailable');
    key = await deriveKeyFromPrf(prfOutput);
  }

  const { iv, ciphertext } = await encryptSecret(key, secret);
  entry.iv = iv;
  entry.ciphertext = ciphertext;
  entry.email = secret.email;
  await writeAll(entries);
  return toInfo(entry);
}

/** Xoá credential khỏi LinkHub (passkey trong OS cần xoá thủ công ở cài đặt hệ thống). */
export async function deleteBiometricCredential(id: string): Promise<void> {
  const entries = await readAll();
  const next = entries.filter((entry) => entry.id !== id);
  await writeAll(next);
}

/** Xoá toàn bộ credential (dùng khi đăng xuất / dọn dữ liệu). */
export async function clearBiometricCredentials(): Promise<void> {
  await writeAll([]);
}
