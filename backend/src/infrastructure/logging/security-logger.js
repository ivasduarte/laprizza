const SENSITIVE_KEY = /pass|token|secret|cookie|authorization|hash/i;

export function createSecurityLogger({
  enabled = true,
  write = (line) => console.warn(line),
} = {}) {
  return {
    log(event, details = {}) {
      if (!enabled) return;
      const safe = Object.fromEntries(
        Object.entries(details).filter(
          ([key, value]) => value !== undefined && !SENSITIVE_KEY.test(key),
        ),
      );
      write(
        JSON.stringify({ timestamp: new Date().toISOString(), type: 'SECURITY', event, ...safe }),
      );
    },
  };
}
