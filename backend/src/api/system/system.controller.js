import * as systemService from '../../application/system/system.service.js';

/**
 * Handles the health check: 200 when the database answers, 503 otherwise.
 *
 * @param {*} _req - The Express request object.
 * @param {*} res - The Express response object.
 * @param {*} next - The Express next middleware function.
 * @param {*} databaseHealthProbe - The injected database probe.
 * @param {string} appVersion - The application version.
 */
export const health = async (_req, res, next, databaseHealthProbe, appVersion) => {
  try {
    const { healthy, body } = await systemService.checkHealth(databaseHealthProbe, appVersion);
    res.set('Cache-Control', 'no-store');
    res.status(healthy ? 200 : 503).json(body);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles the request for the deployed version.
 *
 * @param {*} _req - The Express request object.
 * @param {*} res - The Express response object.
 * @param {*} next - The Express next middleware function.
 * @param {Object} versionInfo - The version information loaded at startup.
 */
export const version = (_req, res, next, versionInfo) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.status(200).json(systemService.getVersion(versionInfo));
  } catch (err) {
    next(err);
  }
};
