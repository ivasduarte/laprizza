import { systemClock } from '../../infrastructure/clock.js';

/**
 * Checks whether the service can handle requests (database reachable).
 * A probe that throws is treated as unhealthy; error details are never returned.
 * 
 * @param {*} databaseHealthProbe - The injected database probe.
 * @param {*} appVersion - The application version.
 * @param {*} clock - The injected clock.
 * @returns The health result.
 */
export async function checkHealth(databaseHealthProbe, appVersion, clock = systemClock) {
  let healthy;
  try {
    healthy = (await databaseHealthProbe.isHealthy()) === true;
  } catch {
    healthy = false;
  }

  return {
    healthy,
    body: {
      status: healthy ? 'ok' : 'unavailable',
      version: appVersion,
      timestamp: clock.now().toISOString(),
    },
  };
}

/**
 * Returns the deployed version, as loaded from VERSION.json at startup.
 * 
 * @param {*} versionInfo - The version loaded at startup.
 * @returns A copy of the version information.
 */
export function getVersion(versionInfo) {
    return { ...versionInfo };
}