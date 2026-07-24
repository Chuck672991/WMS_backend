import { randomBytes } from 'crypto';

/**
 * Generates a URL-safe random token (e.g. for password reset / invite links).
 * The plain value is sent to the user; only its hash (see hash.util.ts)
 * should ever be persisted.
 */
export function generatePlainToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
