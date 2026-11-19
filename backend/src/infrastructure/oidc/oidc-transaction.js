import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');

/**
 * Signs and verifies the short-lived OIDC transaction (state, nonce, code_verifier) kept in a
 * cookie between /login and /callback. Stateless: HMAC-SHA256 with a key derived from the JWT
 * secret (separate key, so access tokens and transactions can never be swapped).
 *
 * @param {{secret: string, ttlMs: number, clock?: {now: () => Date}}} deps
 */
export function createTransactionCodec({ secret, ttlMs, clock = { now: () => new Date() } }) {
  const key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'laprizza-oidc-transaction', 32));
  const mac = (data) => createHmac('sha256', key).update(data).digest();

  return {
    /** @param {Record<string, unknown>} payload @returns {string} Opaque cookie value. */
    sign(payload) {
      const body = b64(JSON.stringify({ ...payload, exp: clock.now().getTime() + ttlMs }));
      return `${body}.${b64(mac(body))}`;
    },

    /** @returns {Record<string, any>|null} The payload, or null if missing/tampered/expired. */
    verify(value) {
      if (typeof value !== 'string') return null;
      const parts = value.split('.');
      if (parts.length !== 2) return null;
      const [body, signature] = parts;
      const given = Buffer.from(signature, 'base64url');
      const expected = mac(body);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
      try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        return Number.isFinite(payload.exp) && payload.exp > clock.now().getTime() ? payload : null;
      } catch {
        return null;
      }
    },
  };
}
