/** Nhãn & thông báo lỗi cho đăng nhập sinh trắc học (dùng chung Login + Settings). */
import { getT } from './i18n';
import type { Locale } from './settings';
import { BiometricError, detectBiometricPlatform, type BiometricPlatform } from './biometricAuth';

/** Tên phương thức theo hệ điều hành: Touch ID/Face ID (macOS), Windows Hello (Windows). */
export function biometricMethodLabel(
  locale: Locale,
  platform: BiometricPlatform = detectBiometricPlatform()
): string {
  const t = getT(locale);
  if (platform === 'macos') return t.biometricMethodMac;
  if (platform === 'windows') return t.biometricMethodWindows;
  return t.biometricMethodGeneric;
}

/** Icon Material Symbols phù hợp với phương thức. */
export function biometricMethodIcon(platform: BiometricPlatform = detectBiometricPlatform()): string {
  return platform === 'windows' ? 'face' : 'fingerprint';
}

export function withMethod(template: string, method: string): string {
  return template.replace('{method}', method);
}

export function biometricErrorMessage(locale: Locale, error: unknown): string {
  const t = getT(locale);
  if (error instanceof BiometricError) {
    switch (error.code) {
      case 'cancelled':
        return t.biometricErrorCancelled;
      case 'already_enrolled':
        return t.biometricErrorAlreadyEnrolled;
      case 'prf_unavailable':
        return t.biometricErrorPrf;
      case 'decrypt_failed':
        return t.biometricErrorDecrypt;
      case 'no_credentials':
        return t.biometricErrorNoCredentials;
      case 'unsupported':
        return withMethod(t.biometricUnsupported, biometricMethodLabel(locale));
      default:
        return t.biometricErrorUnknown;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return t.biometricErrorUnknown;
}
