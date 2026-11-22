const SENSITIVE_KEY = /pass|token|secret|cookie|authorization|hash/i;

/**
 * GDPR (GDP01, data minimisation): network addresses are never written to the logs, so no
 * log line can be tied to a person through an IP. The rate limiter still uses req.ip in
 * memory, without storing it.
 */
const NETWORK_ADDRESS_KEY = /^(ip|ips|remoteAddress|clientIp|xForwardedFor|forwardedFor)$/i;

const SENSITIVE_VALUE =
  /^Bearer\s|^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$|^\$argon2/i;

const REDACTED = '[REDACTED]';

function sanitizeValue(value) {
  if (typeof value === 'string') return SENSITIVE_VALUE.test(value) ? REDACTED : value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) return sanitizeFields(value);
  return value;
}

function sanitizeFields(details) {
  return Object.fromEntries(
    Object.entries(details)
      .filter(
        ([key, value]) =>
          value !== undefined && !SENSITIVE_KEY.test(key) && !NETWORK_ADDRESS_KEY.test(key),
      )
      .map(([key, value]) => [key, sanitizeValue(value)]),
  );
}

export function createSecurityLogger({
  enabled = true,
  write = (line) => console.warn(line),
} = {}) {
  return {
    log(event, details = {}) {
      if (!enabled) return;
      write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'SECURITY',
          event,
          ...sanitizeFields(details),
        }),
      );
    },
  };
}
